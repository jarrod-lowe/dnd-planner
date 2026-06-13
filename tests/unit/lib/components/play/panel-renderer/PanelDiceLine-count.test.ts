import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

// A healing dice-line whose die *count* is driven by a var (e.g. a spell's
// chosen slot level). Mirrors Prayer of Healing: N d8 where N == slotLevel.
const createVarCountEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'cast-prayer-of-healing',
    description: 'Prayer of Healing',
    activities: [],
    ui: {
      section: 'action-spell',
      name: 'Prayer of Healing',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 8, count: { var: 'dieCount' } }]
      }
    },
    vars: {
      dieCount: { default: { number: 2 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - dice-line variable count', () => {
  it('renders dice count from a var default', () => {
    const entry = createVarCountEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('2d8');
  });

  it('renders dice count from a selection override (simulating a slider)', () => {
    const entry = createVarCountEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { dieCount: 3 } }
    });
    expect(container.textContent).toContain('3d8');
  });

  it('renders dice count from a fact', () => {
    const entry = createVarCountEntry();
    entry.rule = {
      ...entry.rule,
      ui: {
        ...entry.rule.ui,
        primaryControl: {
          type: 'dice-line',
          dice: [{ sides: 8, count: { fact: 'heal.dice' } }]
        }
      }
    } as Rule;
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: { 'heal.dice': 4 } }
    });
    expect(container.textContent).toContain('4d8');
  });

  it('rolls the number of dice given by the var count', async () => {
    const entry = createVarCountEntry(); // 2d8
    // floor(0.5 * 8) + 1 = 5 per die, two dice => 10
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(container.textContent).toContain('10');
  });

  it('resolves count from a var whose default is a fact (Prayer of Healing L2 → 2d8)', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'cast-prayer-of-healing',
        description: 'Prayer of Healing',
        activities: [],
        ui: {
          section: 'action-spell',
          name: 'Prayer of Healing',
          primaryControl: {
            type: 'slider',
            var: 'slotLevel',
            notches: [{ value: 2, enabled: { fact: 'spellcasting.slots.level2.total' } }],
            valueFormat: 'spellLevel'
          },
          secondaryControl: {
            type: 'dice-line',
            dice: [{ sides: 8, count: { var: 'slotLevel' }, unit: 'hp' }]
          }
        },
        vars: {
          slotLevel: {
            capture: true,
            default: { fact: 'prayerOfHealing.lowestAvailableSlotLevel' }
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const facts = {
      'prayerOfHealing.lowestAvailableSlotLevel': 2,
      'spellcasting.slots.level2.total': 1
    };
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts } });
    expect(container.textContent).toContain('2d8');
  });

  it('recovers to 2d8 after the slot-level slider syncs a stale slotLevel=0 (Prayer of Healing)', async () => {
    // Repro of the "rolls 1d8 at L2" bug: the planned cast captured slotLevel=0
    // (the lowest-slot fact was absent at capture, so resolveInitialSelections
    // defaulted to 0). The notch slider must sync that stale 0 up to the first
    // active notch (L2), which makes the healing dice resolve to 2d8.
    const makeEntry = (): AvailableRuleEntry => ({
      rule: {
        id: 'cast-prayer-of-healing',
        description: 'Prayer of Healing',
        activities: [],
        ui: {
          section: 'action-spell',
          name: 'Prayer of Healing',
          primaryControl: {
            type: 'slider',
            var: 'slotLevel',
            notches: [{ value: 2, enabled: { fact: 'spellcasting.slots.level2.total' } }],
            valueFormat: 'spellLevel'
          },
          secondaryControl: {
            type: 'dice-line',
            dice: [{ sides: 8, count: { var: 'slotLevel' }, unit: 'hp' }]
          }
        },
        vars: {
          slotLevel: {
            capture: true,
            default: { fact: 'prayerOfHealing.lowestAvailableSlotLevel' }
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    });
    // L2 slot owned (notch active) but the lowest-slot fact is absent.
    const facts = { 'spellcasting.slots.level2.total': 1 };
    let selections: Record<string, unknown> = { slotLevel: 0 };
    const onSelectionChange = vi.fn((s: Record<string, unknown>) => {
      selections = { ...selections, ...s };
    });

    const { container, rerender } = render(PanelRenderer, {
      props: { entry: makeEntry(), editable: true, facts, selections, onSelectionChange }
    });
    // The slider syncs the stale 0 up to the first active notch (L2).
    expect(onSelectionChange).toHaveBeenCalledWith({ slotLevel: 2 });

    // Apply the corrected selection (as the play store would) and re-render.
    await rerender({ entry: makeEntry(), editable: true, facts, selections, onSelectionChange });
    expect(container.textContent).toContain('2d8');
  });

  it('still supports a literal numeric count (backward compatible)', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'fixed',
        description: 'Fixed',
        activities: [],
        ui: {
          section: 'free',
          name: 'Fixed',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 8, count: 2 }]
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('2d8');
  });
});
