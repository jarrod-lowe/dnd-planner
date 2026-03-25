# D&D Planner Frontend Design

## Overview

The frontend is built with SvelteKit and uses a reactive store pattern for state management. This document describes the architecture and data flow for the play mode interface.

## Technology Stack

- **Framework**: SvelteKit with TypeScript
- **State**: Svelte 5 runes (`$state`, `$derived`)
- **Styling**: CSS custom properties with semantic naming
- **Testing**: Vitest, Playwright

## Play Mode Architecture

### Store Layer

The `playStore` manages all play mode state:

```typescript
// src/lib/play/playStore.svelte.ts
export const playStore = {
  get state(): PlayState { ... },

  // Actions
  loadRuleGroups(characterId: string): Promise<void>,
  addToPlan(rule: Rule): void,
  removeFromPlan(instanceId: string): void,
  movePlanItem(instanceId: string, direction: 'up' | 'down'): void,
  updateSelections(instanceId: string, selections: Record<string, unknown>): void,
  reset(): void
};
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                      Play Mode Data Flow                          │
└──────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │   API       │
                    │ (RuleGroups)│
                    └──────┬──────┘
                           │ loadRuleGroups()
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                        playStore                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │   ruleGroups    │  │  plannedItems   │  │     facts       │   │
│  │   (standing)    │  │  (user plan)    │  │   (current)     │   │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘   │
│           │                    │                     │             │
│           └────────────────────┼─────────────────────┘             │
│                                │                                   │
│                                ▼                                   │
│                    ┌─────────────────────┐                         │
│                    │      evaluate()     │                         │
│                    │   (rules engine)    │                         │
│                    └──────────┬──────────┘                         │
│                               │                                    │
│                               ▼                                    │
│                    ┌─────────────────────┐                         │
│                    │   engineOutput      │                         │
│                    │  - availableRules   │                         │
│                    │  - facts (updated)  │                         │
│                    │  - diagnostics      │                         │
│                    └─────────────────────┘                         │
└──────────────────────────────────────────────────────────────────┘
```

### Adding to Plan with Capture Vars

When a rule with `capture: true` vars is added to the plan:

```typescript
function addToPlan(rule: Rule): void {
  // 1. Resolve capture vars from current facts
  const initialSelections = resolveInitialSelections(rule, state.facts);

  // 2. Create planned item with selections
  const newItem: PlannedItem = {
    instanceId: generateInstanceId(),
    rule: {
      ...rule,
      selections: initialSelections
    },
    order: state.plannedItems.length
  };

  // 3. Add to plan
  state = {
    ...state,
    plannedItems: [...state.plannedItems, newItem]
  };

  // 4. Trigger evaluation
  debouncedEvaluate();
}
```

## Component Hierarchy

```
PlayCharacterMode.svelte
├── StatsColumn.svelte         # Character stats display
│   └── StatBlock.svelte       # Individual stat
├── ChoicesColumn.svelte       # Available actions
│   └── ChoicePanel.svelte     # Single choice with slider
└── PlanColumn.svelte          # User's planned actions
    └── PlanItem.svelte        # Wrapper for planned item
        └── ChoicePanel.svelte # Editable version with slider
```

## ChoicePanel Slider Behavior

The `ChoicePanel` component handles both:
- **Available choices** (disabled slider, shows available amount)
- **Planned items** (enabled slider, shows selected amount)

```svelte
<!-- ChoicePanel.svelte -->
<script>
  const moveCurrentDistance = $derived(
    uiModel === 'move' ? resolveVarDefault('distance') : undefined
  );
  const moveMaxDistance = $derived(
    uiModel === 'move' ? resolveVarDefault('maxDistance') : undefined
  );

  let sliderValue = $derived.by(() => {
    // Prioritize selection (for planned items with capture vars)
    if (entry.rule.selections?.distance !== undefined) {
      return entry.rule.selections.distance;
    }
    // Fall back to current remaining (for available choices)
    return moveCurrentDistance ?? moveMaxDistance ?? 0;
  });
</script>
```

### Why Capture Vars Fix the Slider Bug

Without capture vars:
1. Add Walk → no selections → slider uses `moveCurrentDistance` (remaining after ALL items)
2. After evaluation, remaining is 0 → slider shows 0

With capture vars:
1. Add Walk → selections captured: `{ distance: 25 }` → slider shows 25
2. Slider always shows the captured value, not the computed remaining

## CSS Architecture

### Semantic Variables

All colors use semantic CSS variables defined in the theme:

```css
/* Good - uses semantic variables */
.choice-panel {
  background: var(--md-sys-color-surface-container-high);
  border: 1px solid var(--md-sys-color-outline-variant);
}

/* Bad - hardcoded colors */
.choice-panel {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
}
```

### Component Styling

Components use scoped styles with BEM-like naming:

```css
.choice-panel { }
.choice-panel--editable { }
.choice-panel--warning { }
.choice-panel__header { }
.choice-panel__body { }
.choice-panel__model { }
```

## Internationalization (i18n)

All user-facing text uses the i18n system:

```svelte
<script>
  import { t } from '$lib/i18n';
</script>

<span class="choice-panel__title">{$t(uiName)}</span>
```

Translation keys are defined in `src/lib/i18n/translations/`.

## Accessibility

- Semantic HTML elements (`<button>`, `<input>`, etc.)
- ARIA labels for interactive elements
- Keyboard navigation support
- Focus indicators
- Color contrast meeting WCAG standards

## See Also

- [DATA_MODEL.md](./DATA_MODEL.md) - Core data structures
- [RULES_ENGINE.md](./RULES_ENGINE.md) - Rules engine evaluation
