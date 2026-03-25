# D&D Planner Data Model

## Overview

This document describes the core data structures and types used in the D&D Planner application.

## Rules Engine Types

### Rule

A reusable executable rule that defines game mechanics.

```typescript
interface Rule {
  id: string;
  description?: string;
  ui?: {
    model?: string; // UI component to use (e.g., 'move')
    section?: string; // Section category (e.g., 'move', 'action')
    name?: string; // i18n key for display name
  };
  vars?: Record<string, VarDefinition>;
  selections?: Record<string, unknown>;
  phase?: Phase;
  enabled?: boolean;
  when?: Condition[];
  after?: GroupReference[];
  group?: string[];
  activities: Activity[];
}
```

### VarDefinition

Defines a variable that can be customized when a rule is executed.

```typescript
interface VarDefinition {
  default: Source; // Default value source
  capture?: boolean; // When true, resolve default from facts at add time
}
```

#### The `capture` Property

When `capture: true` is set on a var, the default value is resolved from the current facts and stored as a selection when the rule is added to the plan. This is useful for vars that reference facts which change during evaluation.

**Example:**

```yaml
vars:
  distance:
    capture: true
    default:
      fact: character.movement.current
```

When a Walk action is added to the plan:

1. The `distance` var's default is resolved from `character.movement.current` (e.g., 30)
2. The value 30 is stored as `selections.distance` on the planned item
3. The slider shows 30ft, even after evaluation changes `character.movement.current`

Without `capture: true`, the slider would show the remaining movement after all planned items are evaluated, which could be 0.

### Source

A unified value reference used in activities.

```typescript
interface Source {
  fact?: string; // Reference to a fact in working state
  number?: number; // A literal numeric value
  var?: string; // Reference to a rule variable
}
```

### Facts

Durable state values that persist across evaluations.

```typescript
type Facts = Record<string, number | string | boolean | object>;
```

Keys use dot-notation paths like `"character.movement.current"`.

## Play Mode Types

### PlannedItem

Represents a single item in the user's action plan.

```typescript
interface PlannedItem {
  instanceId: string; // Unique identifier for this instance
  rule: Rule; // The rule being planned (with selections)
  order: number; // Position in the plan (0-indexed)
}
```

### PlayState

State for play mode, managing rules engine and plan.

```typescript
interface PlayState {
  ruleGroups: Rule[];
  isLoadingRuleGroups: boolean;
  ruleGroupError: string | null;
  engineOutput: EngineOutput | null;
  isEvaluating: boolean;
  plannedItems: PlannedItem[];
  facts: Facts;
}
```

## Data Flow

1. **Standing Rules** - Loaded from API, define always-active game mechanics
2. **Available Rules** - Offered by the engine based on current state
3. **Planned Items** - User-selected actions with optional customizations
4. **Evaluation** - Engine processes standing + planned rules, produces facts and output
5. **Capture** - When adding to plan, capture vars resolve their defaults from current facts

## See Also

- [RULES_ENGINE.md](./RULES_ENGINE.md) - Rules engine evaluation semantics
- [FRONTEND_DESIGN.md](./FRONTEND_DESIGN.md) - Frontend architecture
