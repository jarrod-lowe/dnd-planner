import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
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
        dice: [{ sides: 20, bonus: { var: 'initiativeBonus' } }]
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
          { sides: 20, bonus: { var: 'hitBonus' } },
          {
            sides: { var: 'damageDie' },
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

describe('PanelDiceLine - onRoll callback', () => {
  it('fires onRoll with result when d20 is rolled', async () => {
    const entry = createDiceLineEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // floor(0.8*20)+1 = 17
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result, dieIndex] = onRoll.mock.calls[0];
    expect(result.natural).toBe(17);
    expect(result.bonus).toBe(3);
    expect(result.total).toBe(20);
    expect(result.sides).toBe(20);
    expect(dieIndex).toBe(0);
  });

  it('fires onRoll with damage type for damage die', async () => {
    const entry = createAttackEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // floor(0.5*12)+1 = 7
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // damage die
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result, dieIndex] = onRoll.mock.calls[0];
    expect(result.natural).toBe(7);
    expect(result.bonus).toBe(3);
    expect(result.total).toBe(10);
    expect(result.sides).toBe(12);
    expect(result.damageType).toBe('slashing');
    expect(dieIndex).toBe(1);
  });

  it('fires onRoll with droppedRoll for disadvantage', async () => {
    const entry = createAttackEntry();
    entry.rule = {
      ...entry.rule,
      vars: {
        ...entry.rule.vars,
        ranges: {
          default: {
            array: [
              { distance: 5, type: 'melee' },
              { distance: 60, type: 'ranged', disadvantage: true }
            ]
          }
        }
      }
    } as Rule;
    const onRoll = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll }
    });
    // Cycle to disadvantaged range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Mock two rolls: 0.4->9, 0.7->15 => disadvantage takes min=9
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.4).mockReturnValueOnce(0.7);
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[0]);
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result] = onRoll.mock.calls[0];
    expect(result.natural).toBe(9);
    expect(result.droppedRoll).toBe(15);
    expect(result.mode).toBe('disadvantage');
  });

  it('fires onRoll without droppedRoll for normal roll', async () => {
    const entry = createDiceLineEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // floor(0.5*20)+1 = 11
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result] = onRoll.mock.calls[0];
    expect(result.natural).toBe(11);
    expect(result.mode).toBe('normal');
    expect(result.droppedRoll).toBeUndefined();
  });

  it('does not fire onRoll when not editable', async () => {
    const entry = createDiceLineEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {}, onRoll }
    });
    // Read-only chips are spans, not buttons
    const span = container.querySelector('.panel-renderer__die-chip');
    expect(span?.tagName).toBe('SPAN');
    expect(onRoll).not.toHaveBeenCalled();
  });

  it('fires onRoll with bonus undefined when no bonus', async () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'simple-roll',
        description: 'Simple Roll',
        activities: [],
        ui: {
          section: 'free',
          name: 'Simple Roll',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20 }]
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // floor(0.5*20)+1 = 11
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result] = onRoll.mock.calls[0];
    expect(result.natural).toBe(11);
    expect(result.total).toBe(11);
    expect(result.bonus).toBeUndefined();
  });
});
