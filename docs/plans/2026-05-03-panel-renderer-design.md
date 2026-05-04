# Panel Renderer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ChoicePanel.svelte (~2000 lines) and EffectPanel.svelte (~188 lines) with a single PanelRenderer component driven by typed fields declared in rule YAML.

**Architecture:** Rules declare `primaryControl`, `secondaryControl`, and `information` in their `ui` block. A single PanelRenderer component reads these typed fields and dispatches on `type` within each slot — never on rule ID or model name. The old `ui.model` string is eliminated.

**Tech Stack:** Svelte 5, TypeScript, Vitest, @testing-library/svelte

**Design doc:** `docs/plans/2026-05-03-panel-renderer-design.md`

**Important constraints:**

- All user-facing text must go through i18n (CLAUDE.md)
- CSS must use theme variables only, no new colors (CLAUDE.md)
- TDD: RED tests must compile, run, not panic, and fail before implementation
- Run `make test` before declaring done

---

## Phase 1: Types & Utilities

### Task 1: TypeScript types for panel descriptor

**Files:**

- Create: `src/lib/components/play/panel-renderer/types.ts`
- Test: `tests/unit/lib/components/play/panel-renderer/types.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/panel-renderer/types.test.ts
import { describe, it, expect } from 'vitest';
import type {
  Control,
  DiceLineControl,
  SliderControl,
  SelectControl,
  Information,
  TextInformation,
  CountdownInformation,
  PanelDescriptor,
  ValueSource,
  DiceEntry
} from '$lib/components/play/panel-renderer/types';

describe('Panel renderer types', () => {
  it('ValueSource can be a fact reference', () => {
    const vs: ValueSource = { fact: 'character.movement.remaining' };
    expect(vs.fact).toBe('character.movement.remaining');
  });

  it('ValueSource can be a var reference', () => {
    const vs: ValueSource = { var: 'distance' };
    expect(vs['var']).toBe('distance');
  });

  it('ValueSource can be a literal number', () => {
    const vs: ValueSource = { number: 5 };
    expect(vs.number).toBe(5);
  });

  it('ValueSource can be a literal string', () => {
    const vs: ValueSource = { string: 'melee' };
    expect(vs.string).toBe('melee');
  });

  it('DiceLineControl has required fields', () => {
    const control: DiceLineControl = {
      type: 'dice-line',
      dice: [{ expression: 'd20', bonus: { var: 'hitBonus' } }]
    };
    expect(control.type).toBe('dice-line');
    expect(control.dice).toHaveLength(1);
  });

  it('SliderControl has required fields', () => {
    const control: SliderControl = {
      type: 'slider',
      var: 'distance',
      max: { var: 'maxDistance' }
    };
    expect(control.type).toBe('slider');
    expect(control['var']).toBe('distance');
  });

  it('SelectControl has required fields', () => {
    const control: SelectControl = {
      type: 'select',
      var: 'level',
      options: { var: 'levels' }
    };
    expect(control.type).toBe('select');
  });

  it('TextInformation with labelValues', () => {
    const info: TextInformation = {
      type: 'text',
      label: 'play.information.saveDc',
      labelValues: {
        saveType: { fact: 'spellcasting.saveType' },
        dc: { fact: 'spellcasting.saveDC' }
      }
    };
    expect(info.type).toBe('text');
    expect(info.labelValues?.dc).toBeTruthy();
  });

  it('CountdownInformation with filled and total', () => {
    const info: CountdownInformation = {
      type: 'countdown',
      filled: { var: 'countDown' },
      total: { var: 'duration' }
    };
    expect(info.type).toBe('countdown');
    expect(info.filled).toBeTruthy();
  });

  it('PanelDescriptor with all optional fields', () => {
    const descriptor: PanelDescriptor = {
      section: 'action-attack',
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ expression: 'd20', bonus: { var: 'hitBonus' } }]
      },
      information: [{ type: 'text', label: 'some.key' }]
    };
    expect(descriptor.secondaryControl).toBeUndefined();
    expect(descriptor.primaryControl?.type).toBe('dice-line');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/panel-renderer/types.test.ts`
Expected: FAIL — module not found

**Step 3: Write the types**

```typescript
// src/lib/components/play/panel-renderer/types.ts

export interface ValueSource {
  fact?: string;
  var?: string;
  number?: number;
  string?: string;
  array?: unknown[];
}

export interface DiceEntry {
  expression: string | { var: string };
  bonus?: ValueSource;
  damageType?: ValueSource;
}

export interface ControlBase {
  enabled?: {
    condition: import('$lib/rules-engine').Condition;
    button: string; // i18n key
  };
  annotationLabels?: string[];
}

export interface DiceLineControl extends ControlBase {
  type: 'dice-line';
  ranges?: ValueSource;
  advantage?: ValueSource;
  dice: DiceEntry[];
}

export interface SliderControl extends ControlBase {
  type: 'slider';
  var: string;
  min?: ValueSource;
  max?: ValueSource;
  unit?: string; // i18n key
}

export interface SelectControl extends ControlBase {
  type: 'select';
  var: string;
  options: ValueSource;
  display?: ValueSource;
}

export type Control = DiceLineControl | SliderControl | SelectControl;

export interface TextInformation {
  type: 'text';
  label: string; // i18n key
  labelValues?: Record<string, ValueSource>;
}

export interface CountdownInformation {
  type: 'countdown';
  filled: ValueSource;
  total: ValueSource;
}

export type Information = TextInformation | CountdownInformation;

export interface PanelDescriptor {
  section?: string;
  name?: string; // i18n key
  primaryControl?: Control;
  secondaryControl?: Control;
  information?: Information[];
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/panel-renderer/types.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): add TypeScript types for panel descriptor
```

---

### Task 2: resolveValueSource utility

**Files:**

- Create: `src/lib/components/play/panel-renderer/resolveValueSource.ts`
- Test: `tests/unit/lib/components/play/panel-renderer/resolveValueSource.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/panel-renderer/resolveValueSource.test.ts
import { describe, it, expect } from 'vitest';
import {
  resolveValueSource,
  resolveExpression
} from '$lib/components/play/panel-renderer/resolveValueSource';
import type { ValueSource, DiceEntry } from '$lib/components/play/panel-renderer/types';

describe('resolveValueSource', () => {
  it('resolves a fact reference', () => {
    const result = resolveValueSource({ fact: 'character.speed' }, { 'character.speed': 30 }, {});
    expect(result).toBe(30);
  });

  it('resolves a var reference', () => {
    const result = resolveValueSource(
      { var: 'distance' },
      {},
      { distance: { default: { number: 15 } } }
    );
    expect(result).toBe(15);
  });

  it('resolves a literal number', () => {
    const result = resolveValueSource({ number: 5 }, {}, {});
    expect(result).toBe(5);
  });

  it('resolves a literal string', () => {
    const result = resolveValueSource({ string: 'melee' }, {}, {});
    expect(result).toBe('melee');
  });

  it('resolves var default from fact', () => {
    const result = resolveValueSource(
      { var: 'hitBonus' },
      { 'character.hitBonus': 5 },
      { hitBonus: { default: { fact: 'character.hitBonus' } } }
    );
    expect(result).toBe(5);
  });

  it('resolves var with selection override', () => {
    const result = resolveValueSource(
      { var: 'distance' },
      {},
      { distance: { default: { number: 10 } } },
      { distance: 25 }
    );
    expect(result).toBe(25);
  });

  it('returns undefined for missing value', () => {
    const result = resolveValueSource({ fact: 'nonexistent' }, {}, {});
    expect(result).toBeUndefined();
  });
});

describe('resolveExpression', () => {
  it('resolves a literal expression', () => {
    const result = resolveExpression('d20', {}, {}, {});
    expect(result).toBe('d20');
  });

  it('resolves a var expression', () => {
    const result = resolveExpression(
      { var: 'damageDie' },
      {},
      { damageDie: { default: { number: 12 } } },
      {}
    );
    expect(result).toBe(12);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/panel-renderer/resolveValueSource.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/lib/components/play/panel-renderer/resolveValueSource.ts
import type { ValueSource, VarDefinition } from '$lib/components/play/panel-renderer/types';
import type { Facts } from '$lib/rules-engine';

type VarDefs = Record<string, VarDefinition>;
type Selections = Record<string, unknown>;

export function resolveValueSource(
  source: ValueSource | undefined,
  facts: Facts,
  vars: VarDefs,
  selections?: Selections
): number | string | unknown[] | undefined {
  if (!source) return undefined;

  if (source.number !== undefined) return source.number;
  if (source.string !== undefined) return source.string;
  if (source.fact !== undefined) return facts[source.fact];
  if (source.var !== undefined) {
    if (selections && selections[source.var] !== undefined) {
      return selections[source.var];
    }
    const varDef = vars[source.var];
    if (!varDef) return undefined;
    const def = varDef.default;
    if (def.number !== undefined) return def.number;
    if (def.fact !== undefined) return facts[def.fact];
    if (def.array !== undefined) return def.array;
    return undefined;
  }
  if (source.array !== undefined) return source.array;
  return undefined;
}

export function resolveExpression(
  expression: string | { var: string },
  facts: Facts,
  vars: VarDefs,
  selections?: Selections
): string | number | undefined {
  if (typeof expression === 'string') return expression;
  return resolveValueSource({ var: expression.var }, facts, vars, selections) as number | undefined;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/panel-renderer/resolveValueSource.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): add resolveValueSource utility
```

---

### Task 3: extractPanelDescriptor utility

Extracts a typed PanelDescriptor from a Rule's opaque `ui` field.

**Files:**

- Create: `src/lib/components/play/panel-renderer/extractPanelDescriptor.ts`
- Test: `tests/unit/lib/components/play/panel-renderer/extractPanelDescriptor.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/panel-renderer/extractPanelDescriptor.test.ts
import { describe, it, expect } from 'vitest';
import { extractPanelDescriptor } from '$lib/components/play/panel-renderer/extractPanelDescriptor';
import type { Rule } from '$lib/rules-engine';

describe('extractPanelDescriptor', () => {
  it('extracts name and section from rule.ui', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: { name: 'rule.test.name', section: 'action-attack' }
    };
    const desc = extractPanelDescriptor(rule);
    expect(desc.name).toBe('rule.test.name');
    expect(desc.section).toBe('action-attack');
  });

  it('returns empty descriptor for rule with no ui', () => {
    const rule: Rule = { id: 'test', activities: [] };
    const desc = extractPanelDescriptor(rule);
    expect(desc.name).toBeUndefined();
    expect(desc.section).toBeUndefined();
    expect(desc.primaryControl).toBeUndefined();
    expect(desc.secondaryControl).toBeUndefined();
    expect(desc.information).toBeUndefined();
  });

  it('extracts primaryControl with type', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: {
        name: 'test',
        primaryControl: {
          type: 'slider',
          var: 'distance',
          max: { var: 'maxDistance' }
        }
      }
    };
    const desc = extractPanelDescriptor(rule);
    expect(desc.primaryControl?.type).toBe('slider');
  });

  it('extracts information array', () => {
    const rule: Rule = {
      id: 'test',
      activities: [],
      ui: {
        name: 'test',
        information: [
          { type: 'text', label: 'some.key' },
          { type: 'countdown', filled: { var: 'c' }, total: { var: 'd' } }
        ]
      }
    };
    const desc = extractPanelDescriptor(rule);
    expect(desc.information).toHaveLength(2);
    expect(desc.information?.[0].type).toBe('text');
    expect(desc.information?.[1].type).toBe('countdown');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/panel-renderer/extractPanelDescriptor.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

```typescript
// src/lib/components/play/panel-renderer/extractPanelDescriptor.ts
import type { Rule } from '$lib/rules-engine';
import type { PanelDescriptor } from './types';

export function extractPanelDescriptor(rule: Rule): PanelDescriptor {
  const ui = rule.ui ?? {};
  return {
    section: ui.section as string | undefined,
    name: ui.name as string | undefined,
    primaryControl: ui.primaryControl as PanelDescriptor['primaryControl'],
    secondaryControl: ui.secondaryControl as PanelDescriptor['secondaryControl'],
    information: ui.information as PanelDescriptor['information']
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/panel-renderer/extractPanelDescriptor.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): add extractPanelDescriptor utility
```

---

## Phase 2: PanelRenderer Component (TDD)

### Task 4: PanelRenderer — title, warning, container

**Files:**

- Create: `src/lib/components/play/PanelRenderer.svelte`
- Test: `tests/unit/lib/components/play/PanelRenderer.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/PanelRenderer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createMockEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: { id: 'test-rule', description: 'Test Rule', activities: [] },
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

describe('PanelRenderer', () => {
  describe('basic rendering', () => {
    it('renders rule description as title when no ui.name', () => {
      const entry = createMockEntry();
      const { getByText } = render(PanelRenderer, { props: { entry } });
      expect(getByText('Test Rule')).toBeTruthy();
    });

    it('calls onTap when clicked in read-only mode', async () => {
      const entry = createMockEntry();
      const onTap = vi.fn();
      const { container } = render(PanelRenderer, { props: { entry, onTap } });
      const button = container.querySelector('button.panel-renderer');
      button?.click();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('shows warning indicator for illegal choice', () => {
      const entry = createMockEntry({ legal: false });
      const { container } = render(PanelRenderer, { props: { entry } });
      expect(container.querySelector('.warning-indicator--illegal')).toBeTruthy();
    });

    it('shows warning indicator for inapplicable choice', () => {
      const entry = createMockEntry({ applicable: false });
      const { container } = render(PanelRenderer, { props: { entry } });
      expect(container.querySelector('.warning-indicator--inapplicable')).toBeTruthy();
    });

    it('renders as div when editable', () => {
      const entry = createMockEntry();
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true }
      });
      const panel = container.querySelector('.panel-renderer');
      expect(panel?.tagName).toBe('DIV');
    });

    it('renders as button when not editable', () => {
      const entry = createMockEntry();
      const { container } = render(PanelRenderer, {
        props: { entry, editable: false }
      });
      const panel = container.querySelector('.panel-renderer');
      expect(panel?.tagName).toBe('BUTTON');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal PanelRenderer**

Create `src/lib/components/play/PanelRenderer.svelte` with:

- Props: `entry`, `editable`, `onTap`, `facts`, `activeAnnotations`, `onSelectionChange`, `onRemove`
- Container: `<button>` when read-only, `<div>` when editable
- Title from `extractPanelDescriptor`
- WarningIndicator for illegal/inapplicable
- Slot for controls and information (empty for now)

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): basic title, warning, and container structure
```

---

### Task 5: PanelRenderer — slider control

**Files:**

- Modify: `src/lib/components/play/PanelRenderer.svelte`
- Create: `src/lib/components/play/PanelSlider.svelte`
- Test: `tests/unit/lib/components/play/PanelSlider.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/PanelSlider.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createSliderEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: {
    id: 'move',
    description: 'Move',
    activities: [],
    ui: {
      section: 'move',
      name: 'rule.dnd-5e-2024.movement.move-walk.name',
      primaryControl: {
        type: 'slider',
        var: 'distance',
        max: { var: 'maxDistance' }
      }
    },
    vars: {
      distance: { default: { fact: 'character.movement.remaining' } },
      maxDistance: { default: { fact: 'character.movement.total' } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

describe('PanelRenderer - slider control', () => {
  it('renders a slider when primaryControl type is slider', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    expect(container.querySelector('input[type="range"]')).toBeTruthy();
  });

  it('sets slider max from resolved value', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.max).toBe('30');
  });

  it('shows current value as text when read-only', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts }
    });
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(container.textContent).toContain('20');
  });

  it('fires onSelectionChange when slider value changes', async () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, onSelectionChange }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '15';
    await fireEvent.input(slider);
    expect(onSelectionChange).toHaveBeenCalledWith({ distance: 15 });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/PanelSlider.test.ts`
Expected: FAIL — slider not rendered

**Step 3: Implement PanelSlider and integrate into PanelRenderer**

Create `PanelSlider.svelte` — receives a `SliderControl`, `editable`, `facts`, `vars`, `selections`, `onSelectionChange`. Renders `<input type="range">` when editable, plain text when read-only.

In `PanelRenderer.svelte`, after title, check `descriptor.primaryControl?.type === 'slider'` and render `<PanelSlider>`.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/PanelSlider.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): slider control
```

---

### Task 6: PanelRenderer — dice-line control

**Files:**

- Modify: `src/lib/components/play/PanelRenderer.svelte`
- Create: `src/lib/components/play/PanelDiceLine.svelte`
- Test: `tests/unit/lib/components/play/PanelDiceLine.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/PanelDiceLine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createDiceLineEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'roll-initiative',
    description: 'Initiative',
    activities: [],
    ui: {
      section: 'free',
      name: 'rule.dnd-5e-2024.initiative.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ expression: 'd20', bonus: { var: 'initiativeBonus' } }]
      }
    },
    vars: {
      initiativeBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

const createAttackEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe',
    description: 'Greataxe',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        ranges: { var: 'ranges' },
        dice: [
          { expression: 'd20', bonus: { var: 'hitBonus' } },
          {
            expression: { var: 'damageDie' },
            bonus: { var: 'damageBonus' },
            damageType: { string: 'slashing' }
          }
        ]
      }
    },
    vars: {
      ranges: { default: { array: [{ distance: 5, type: 'melee' }] } },
      hitBonus: { default: { number: 5 } },
      damageDie: { default: { number: 12 } },
      damageBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - dice-line control', () => {
  it('renders d20 roll with bonus', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('d20');
    expect(container.textContent).toContain('+3');
  });

  it('renders attack with range, hit, and damage', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('d20');
    expect(container.textContent).toContain('d12');
    expect(container.textContent).toContain('slashing');
  });

  it('renders dice line as read-only text when not editable', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: false, facts: {} } });
    // Should show the dice line but not be interactive
    expect(container.textContent).toContain('d20');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/PanelDiceLine.test.ts`
Expected: FAIL — dice-line not rendered

**Step 3: Implement PanelDiceLine and integrate**

Create `PanelDiceLine.svelte` — receives a `DiceLineControl`, `editable`, `facts`, `vars`, `selections`. Renders:

- Range if present (from ranges var → first entry's distance)
- Each dice entry: `[d20+N]`, `[dX+M]` with damage type
- Read-only: same display, no interactivity

This is the most complex control. Start with basic rendering, add interactivity (dice rolling) in a later task.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/PanelDiceLine.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): dice-line control
```

---

### Task 7: PanelRenderer — select control

**Files:**

- Modify: `src/lib/components/play/PanelRenderer.svelte`
- Create: `src/lib/components/play/PanelSelect.svelte`
- Test: `tests/unit/lib/components/play/PanelSelect.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/PanelSelect.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createSelectEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'proficiency-athletics',
    description: 'Athletics',
    activities: [],
    ui: {
      section: 'configuration',
      name: 'rule.dnd-5e-2024.skill-proficiency.athletics.name',
      primaryControl: {
        type: 'select',
        var: 'level',
        options: { var: 'levels' }
      }
    },
    vars: {
      levels: { default: { array: [0, 0.5, 1, 2] } },
      level: { default: { number: 0 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - select control', () => {
  it('renders radio buttons for options', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.querySelectorAll('input[type="radio"]').length).toBeGreaterThan(0);
  });

  it('shows selected value as text when read-only', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {} }
    });
    expect(container.querySelectorAll('input[type="radio"]').length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/PanelSelect.test.ts`
Expected: FAIL

**Step 3: Implement PanelSelect and integrate**

Create `PanelSelect.svelte` — radio buttons when editable, plain text when read-only. Uses `resolveValueSource` for options and current selection.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/PanelSelect.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): select control
```

---

### Task 8: PanelRenderer — text information

**Files:**

- Modify: `src/lib/components/play/PanelRenderer.svelte`
- Test: `tests/unit/lib/components/play/PanelRenderer-information.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/PanelRenderer-information.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createTextInfoEntry = (
  label: string,
  labelValues?: Record<string, unknown>
): AvailableRuleEntry => ({
  rule: {
    id: 'spell-save',
    description: 'Spell Save',
    activities: [],
    ui: {
      name: 'rule.spells.test.name',
      information: [{ type: 'text', label, labelValues }]
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - text information', () => {
  it('renders text information from label', () => {
    const entry = createTextInfoEntry('rule.test.description');
    const { container } = render(PanelRenderer, { props: { entry, facts: {} } });
    // i18n returns the key in test env
    expect(container.textContent).toContain('rule.test.description');
  });

  it('renders text with labelValues resolved from facts', () => {
    const entry = createTextInfoEntry('play.information.saveDc', {
      saveType: { fact: 'spellcasting.saveType' },
      dc: { fact: 'spellcasting.saveDC' }
    });
    const facts = { 'spellcasting.saveType': 'DEX', 'spellcasting.saveDC': 14 };
    const { container } = render(PanelRenderer, { props: { entry, facts } });
    expect(container.textContent).toContain('DEX');
    expect(container.textContent).toContain('14');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer-information.test.ts`
Expected: FAIL

**Step 3: Implement information rendering in PanelRenderer**

After controls, iterate `descriptor.information`. For `type: 'text'`, resolve the i18n key and interpolate `labelValues` using `resolveValueSource`.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer-information.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): text information rendering
```

---

### Task 9: PanelRenderer — countdown information

**Files:**

- Modify: `src/lib/components/play/PanelRenderer.svelte`
- Test: `tests/unit/lib/components/play/PanelRenderer-countdown.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/PanelRenderer-countdown.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule, Facts } from '$lib/rules-engine';

const createCountdownEntry = (filled: number, total: number): AvailableRuleEntry => ({
  rule: {
    id: 'effect-sanctuary',
    description: 'Sanctuary',
    activities: [],
    ui: {
      name: 'rule.spells.sanctuary.effect.name',
      information: [
        {
          type: 'countdown',
          filled: { number: filled },
          total: { number: total }
        }
      ]
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - countdown information', () => {
  it('renders filled and empty markers', () => {
    const entry = createCountdownEntry(7, 10);
    const { container } = render(PanelRenderer, { props: { entry, facts: {} } });
    const filled = container.querySelectorAll('.panel-renderer__marker--filled');
    const empty = container.querySelectorAll('.panel-renderer__marker--empty');
    expect(filled).toHaveLength(7);
    expect(empty).toHaveLength(3);
  });

  it('renders all filled when filled equals total', () => {
    const entry = createCountdownEntry(10, 10);
    const { container } = render(PanelRenderer, { props: { entry, facts: {} } });
    const filled = container.querySelectorAll('.panel-renderer__marker--filled');
    const empty = container.querySelectorAll('.panel-renderer__marker--empty');
    expect(filled).toHaveLength(10);
    expect(empty).toHaveLength(0);
  });

  it('resolves filled and total from facts', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'effect',
        activities: [],
        ui: {
          information: [
            { type: 'countdown', filled: { fact: 'countDown' }, total: { fact: 'duration' } }
          ]
        }
      }
    } as Rule as AvailableRuleEntry;
    const facts: Facts = { countDown: 3, duration: 5 };
    const { container } = render(PanelRenderer, { props: { entry, facts } });
    const filled = container.querySelectorAll('.panel-renderer__marker--filled');
    expect(filled).toHaveLength(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer-countdown.test.ts`
Expected: FAIL

**Step 3: Implement countdown rendering**

For `type: 'countdown'`, resolve `filled` and `total` via `resolveValueSource`, render filled/empty `<span>` markers.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer-countdown.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): countdown information rendering
```

---

### Task 10: PanelRenderer — secondary control with enable button

**Files:**

- Modify: `src/lib/components/play/PanelRenderer.svelte`
- Test: `tests/unit/lib/components/play/PanelRenderer-secondary.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/PanelRenderer-secondary.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createEntryWithSecondary = (conditionMet = true): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe',
    description: 'Greataxe',
    activities: [],
    ui: {
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        dice: [
          { expression: 'd20', bonus: { var: 'hitBonus' } },
          { expression: { var: 'damageDie' }, bonus: { var: 'damageBonus' } }
        ]
      },
      secondaryControl: {
        type: 'dice-line',
        enabled: {
          condition: { fact: 'attack.greataxe.mastery', operator: 'equals', value: 1 },
          button: 'rule.attacks.greataxe-cleave.button'
        },
        dice: [
          { expression: 'd20', bonus: { var: 'hitBonus' } },
          { expression: { var: 'damageDie' }, bonus: { var: 'damageBonus' } }
        ]
      }
    },
    vars: {
      hitBonus: { default: { number: 5 } },
      damageDie: { default: { number: 12 } },
      damageBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - secondary control', () => {
  it('does not render secondary when condition is false', () => {
    const entry = createEntryWithSecondary(false);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Should not show the secondary control or button
    const secondaries = container.querySelectorAll('.panel-renderer__control--secondary');
    expect(secondaries.length).toBe(0);
  });

  it('renders enable button when condition is true but not activated', () => {
    const entry = createEntryWithSecondary(true);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: { 'attack.greataxe.mastery': 1 } }
    });
    expect(container.textContent).toContain('rule.attacks.greataxe-cleave.button');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer-secondary.test.ts`
Expected: FAIL

**Step 3: Implement secondary control with enable button**

- Check `descriptor.secondaryControl?.enabled?.condition` using `evaluateCondition`
- If condition false: render nothing
- If condition true and not activated: render button with `enabled.button` label
- If activated: render full control using same code as primary

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer-secondary.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): secondary control with enable button
```

---

### Task 11: PanelRenderer — annotations integration

**Files:**

- Modify: `src/lib/components/play/PanelRenderer.svelte`
- Test: `tests/unit/lib/components/play/PanelRenderer-annotations.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/lib/components/play/PanelRenderer-annotations.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';
import type { AnnotationDef } from '$lib/play/annotations';

const createEntryWithAnnotations = (): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe',
    description: 'Greataxe',
    activities: [],
    ui: {
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ expression: 'd20', bonus: { var: 'hitBonus' } }],
        annotationLabels: ['attack.any', 'attack.melee']
      }
    },
    vars: { hitBonus: { default: { number: 5 } } }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - annotations', () => {
  it('renders matching annotations', () => {
    const entry = createEntryWithAnnotations();
    const annotations: AnnotationDef[] = [
      { key: 'play.annotations.some-buff', targets: ['attack.any'] }
    ];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, activeAnnotations: annotations }
    });
    expect(container.querySelector('.panel-renderer__annotations')).toBeTruthy();
  });

  it('renders nothing when no annotations match', () => {
    const entry = createEntryWithAnnotations();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, activeAnnotations: [] }
    });
    expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer-annotations.test.ts`
Expected: FAIL

**Step 3: Implement annotation rendering**

Collect `annotationLabels` from `primaryControl` and `secondaryControl`, pass to existing `getMatchingAnnotations`, render matching annotations after controls and information.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/components/play/PanelRenderer-annotations.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(panel-renderer): annotations integration
```

---

### Task 12: PanelRenderer — remove button

**Files:**

- Modify: `src/lib/components/play/PanelRenderer.svelte`
- Test: `tests/unit/lib/components/play/PanelRenderer-remove.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';

const createMockEntry = (): AvailableRuleEntry => ({
  rule: { id: 'test', description: 'Test', activities: [] },
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - remove button', () => {
  it('renders remove button when onRemove is provided', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, onRemove: vi.fn() }
    });
    expect(container.querySelector('.panel-renderer__button--remove')).toBeTruthy();
  });

  it('does not render remove button when onRemove is not provided', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, { props: { entry } });
    expect(container.querySelector('.panel-renderer__button--remove')).toBeNull();
  });

  it('calls onRemove when clicked', async () => {
    const entry = createMockEntry();
    const onRemove = vi.fn();
    const { container } = render(PanelRenderer, { props: { entry, onRemove } });
    await fireEvent.click(container.querySelector('.panel-renderer__button--remove')!);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2-4: TDD cycle, implement, verify, commit**

```
feat(panel-renderer): remove button
```

---

### Task 13: Run all existing tests to verify no regressions

Run: `make test-unit`
Expected: All existing tests pass (PanelRenderer tests + all other existing tests)

If any existing tests fail, fix before proceeding.

Commit if any fixes needed.

---

## Phase 3: YAML Migration

For each group of YAML files, the pattern is:

1. Add `primaryControl`, `secondaryControl`, `information` fields to `ui` block
2. Keep `ui.model` temporarily until consumers are updated
3. Run `make test` to verify

### Task 14: Migrate simple-action rules (no controls)

**Files:**

- Modify: `data/rule-groups/dnd-5e-2024/simple-actions.yaml` (disengage, dodge, improvise, influence, search, study, utilize, help)
- Modify: `data/rule-groups/dnd-5e-2024/dash.yaml`
- Modify: `data/rule-groups/dnd-5e-2024/free-actions.yaml`
- Modify: `data/rule-groups/dnd-5e-2024/turn-rest.yaml`
- Modify: `data/rule-groups/dnd-5e-2024/heroic-inspiration.yaml`

These rules have no controls and no information. Their `ui` blocks only need `section` and `name` — which they already have. No `primaryControl`, `secondaryControl`, or `information` needed.

Verify with: `make test-unit`

Commit: `chore: migrate simple-action rules to panel renderer format`

### Task 15: Migrate slider rules (move, ability-score, smite)

**Files:**

- Modify: `data/rule-groups/dnd-5e-2024/movement.yaml` (5 move entries)
- Modify: `data/rule-groups/dnd-5e-2024/ability-scores.yaml` (6 ability score entries)
- Modify: `data/rule-groups/dnd-5e-2024/hp.yaml` (2 HP entries)
- Modify: `data/rule-groups/class-paladin/lay-on-hands.yaml` (1 heal entry)
- Modify: `data/rule-groups/class-paladin/divine-smite.yaml` (divine-smite)
- Modify: `data/rule-groups/class-paladin/paladin-smite.yaml` (paladin-smite)
- Modify: `data/rule-groups/spells/thunderous-smite.yaml` (thunderous smite)

Add `primaryControl: { type: slider, ... }` to each. For smite entries, also add `information` for damage preview.

Example migration for move:

```yaml
# Before
ui:
  model: move
  section: move
  name: rule.dnd-5e-2024.movement.move-walk.name

# After
ui:
  model: move  # kept temporarily
  section: move
  name: rule.dnd-5e-2024.movement.move-walk.name
  primaryControl:
    type: slider
    var: distance
    max: { var: maxDistance }
```

Verify with: `make test-unit`

Commit: `chore: migrate slider rules to panel renderer format`

### Task 16: Migrate select rules (skill-proficiency)

**Files:**

- Modify: `data/rule-groups/dnd-5e-2024/ability-scores.yaml` (18 proficiency entries)

Add `primaryControl: { type: select, var: level, options: { var: levels } }` to each.

Verify with: `make test-unit`

Commit: `chore: migrate select rules to panel renderer format`

### Task 17: Migrate dice-line rules (attack, d20-roll, contested-action)

**Files:**

- Modify: `data/rule-sources/weapons.yaml` (5 attack entries)
- Modify: `data/rule-groups/dnd-5e-2024/initiative.yaml`
- Modify: `data/rule-groups/dnd-5e-2024/skill-checks.yaml` (18 entries)
- Modify: `data/rule-groups/dnd-5e-2024/shove.yaml`
- Modify: `data/rule-groups/dnd-5e-2024/grapple.yaml`

For attacks with followups (greataxe/cleave), move `ui.followups` into `secondaryControl` with `enabled` button.

Example for greataxe:

```yaml
ui:
  primaryControl:
    type: dice-line
    ranges: { var: ranges }
    advantage: { fact: attack.str.disadvantage }
    dice:
      - expression: d20
        bonus: { var: hitBonus }
      - expression: { var: damageDie }
        bonus: { var: damageBonus }
        damageType: { string: slashing }
    annotationLabels: [attack.any, attack.melee, attack.weapon]
  secondaryControl:
    type: dice-line
    enabled:
      condition: { fact: attack.greataxe.mastery, operator: equals, value: 1 }
      button: rule.dnd-5e-2024.attacks.greataxe-cleave.button
    dice:
      - expression: d20
        bonus: { var: hitBonus }
      - expression: { var: damageDie }
        bonus: { var: damageBonus }
```

Verify with: `make test-unit`

Commit: `chore: migrate dice-line rules to panel renderer format`

### Task 18: Migrate information rules (spell-save, timed-save-effect, divine-sense, emissary-of-peace, spell, rebuke-the-violent, lay-on-hands-purify)

**Files:**

- Modify: `data/rule-groups/spells/protection-from-evil-and-good.yaml`
- Modify: `data/rule-groups/spells/sanctuary.yaml`
- Modify: `data/rule-groups/spells/sleep.yaml`
- Modify: `data/rule-groups/spells/command.yaml`
- Modify: `data/rule-groups/spells/bless.yaml`
- Modify: `data/rule-groups/spells/create-and-destroy-water.yaml`
- Modify: `data/rule-groups/class-paladin/divinity.yaml`
- Modify: `data/rule-groups/class-paladin/oath-redemption-level3.yaml`
- Modify: `data/rule-groups/class-paladin/lay-on-hands.yaml` (purify entry)

For spell-save: add `information: [{ type: text, label: ..., labelValues: { ... } }]`
For timed-save-effect: add `information: [{ type: countdown, ... }, { type: text, ... }]`
For divine-sense/emissary-of-peace: add `information: [{ type: text, label: ... }]`

Verify with: `make test-unit`

Commit: `chore: migrate information rules to panel renderer format`

---

## Phase 4: Consumer Updates & Cleanup

### Task 19: Update SectionCollapsible to use PanelRenderer

**Files:**

- Modify: `src/lib/components/play/SectionCollapsible.svelte`
- Test: `tests/unit/lib/components/play/SectionPanel.test.ts` (update existing SectionCollapsible tests)

Replace the `mode === 'effect'` → EffectPanel / `else` → ChoicePanel dispatch with a single PanelRenderer. The `editable` and `onRemove` props determine behavior.

Before:

```svelte
{#if mode === 'effect'}
  <EffectPanel entry={group.entry} ... />
{:else}
  <ChoicePanel entry={group.entry} editable={false} ... />
{/if}
```

After:

```svelte
<PanelRenderer
  entry={group.entry}
  editable={mode !== 'effect' && false}
  {facts}
  {activeAnnotations}
  onTap={mode === 'choice' ? () => onChoiceTap(group.entry) : undefined}
  onRemove={deletableRuleIds?.has(group.entry.rule.id)
    ? () => onRemoveEffect?.(group.entry.rule.id)
    : undefined}
/>
```

Verify with: `make test-unit`

Commit: `refactor: update SectionCollapsible to use PanelRenderer`

### Task 20: Update PlanColumn and PlanItem to use PanelRenderer

**Files:**

- Modify: `src/lib/components/play/PlanItem.svelte`

PlanItem wraps the panel with move up/down/remove controls. Replace internal ChoicePanel with PanelRenderer (`editable: true`).

Verify with: `make test-unit`

Commit: `refactor: update PlanItem to use PanelRenderer`

### Task 21: Update PackedChoiceGroup to use PanelRenderer

**Files:**

- Modify: `src/lib/components/play/PackedChoiceGroup.svelte`

Replace both the `readOnly` → EffectPanel and `!readOnly` → ChoicePanel dispatch with PanelRenderer.

Verify with: `make test-unit`

Commit: `refactor: update PackedChoiceGroup to use PanelRenderer`

### Task 22: Remove old ChoicePanel and EffectPanel

**Files:**

- Delete: `src/lib/components/play/ChoicePanel.svelte`
- Delete: `src/lib/components/play/EffectPanel.svelte`
- Delete: `tests/unit/lib/components/play/ChoicePanel.test.ts`
- Delete: `tests/unit/lib/components/play/ChoicePanel-santuary.test.ts`
- Delete: `tests/unit/lib/components/play/EffectPanel.test.ts`
- Delete: `tests/unit/lib/components/play/EffectPanel-timed.test.ts`

Also remove `ui.model` from all YAML files now that no code reads it.

Verify with: `make test`

Commit: `refactor: remove old ChoicePanel and EffectPanel, remove ui.model`

### Task 23: Final verification

Run: `make test`
Expected: All tests pass (unit, rules, e2e, lint)

If e2e tests fail, investigate and fix before declaring done.
