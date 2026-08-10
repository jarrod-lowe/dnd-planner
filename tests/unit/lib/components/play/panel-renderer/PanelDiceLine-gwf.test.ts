import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule, Annotation } from '$lib/rules-view';

const createGreataxeEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe',
    description: 'Greataxe',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.attacks.greataxe.name',
      annotationLabels: [
        'attack.any',
        'attack.melee',
        'attack.weapon',
        'dice.any',
        'property.twoHanded'
      ],
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

const gwfAnnotation: Annotation = {
  key: 'rule.dnd-5e-2024.fighting-style-great-weapon.annotation',
  targets: ['property.twoHanded', 'property.versatile'],
  rider: {
    label: 'rule.dnd-5e-2024.fighting-style-great-weapon.rider',
    type: 'modifier'
  }
};

describe('PanelDiceLine - Great Weapon Fighting', () => {
  it('applies GWF floor when damage die rolls 1', async () => {
    const entry = createGreataxeEntry();
    const onRoll = vi.fn();
    // Roll the damage die (index 1): need 0/12 -> natural=1
    // First mock for the damage die roll itself
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll, activeAnnotations: [gwfAnnotation] }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // damage die
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result] = onRoll.mock.calls[0];
    expect(result.gwfFloor).toBe(1);
    expect(result.natural).toBe(3);
    expect(result.total).toBe(6); // 3 + 3 bonus
  });

  it('applies GWF floor when damage die rolls 2', async () => {
    const entry = createGreataxeEntry();
    const onRoll = vi.fn();
    // 1/12 -> floor(1/12)+1 = 1... need value that gives 2
    // floor(x*12)+1 = 2 => x = 1/12 = 0.0833...
    vi.spyOn(Math, 'random').mockReturnValue(1 / 12);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll, activeAnnotations: [gwfAnnotation] }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // damage die
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result] = onRoll.mock.calls[0];
    expect(result.gwfFloor).toBe(2);
    expect(result.natural).toBe(3);
    expect(result.total).toBe(6);
  });

  it('does not apply GWF floor when damage die rolls above 2', async () => {
    const entry = createGreataxeEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // floor(0.5*12)+1 = 7
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll, activeAnnotations: [gwfAnnotation] }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // damage die
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result] = onRoll.mock.calls[0];
    expect(result.gwfFloor).toBeUndefined();
    expect(result.natural).toBe(7);
    expect(result.total).toBe(10);
  });

  it('does not apply GWF floor to d20 check die', async () => {
    const entry = createGreataxeEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0); // floor(0*20)+1 = 1
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll, activeAnnotations: [gwfAnnotation] }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[0]); // d20 check die
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result] = onRoll.mock.calls[0];
    expect(result.gwfFloor).toBeUndefined();
    expect(result.natural).toBe(1);
  });

  it('does not apply GWF floor when no GWF annotation is present', async () => {
    const entry = createGreataxeEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0); // would roll 1
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll, activeAnnotations: [] }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // damage die
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result] = onRoll.mock.calls[0];
    expect(result.gwfFloor).toBeUndefined();
    expect(result.natural).toBe(1);
  });

  it('floors each die on a critical GWF roll (per-die, not the sum)', async () => {
    const entry = createGreataxeEntry();
    const onRoll = vi.fn();
    // Crit doubles 1d12 to 2d12; both dice roll 1 (random=0). GWF must floor
    // each die to 3 → natural 6, not the buggy sum-based 3.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll, activeAnnotations: [gwfAnnotation] }
    });
    const critItem = container
      .querySelector<HTMLElement>('.panel-renderer__popover[data-die-index="1"]')!
      .querySelector('[data-crit-mode="critical"]')!;
    await fireEvent.click(critItem);

    const [result] = onRoll.mock.calls[0];
    expect(result.critical).toBe(true);
    expect(result.rolls).toEqual([3, 3]);
    expect(result.natural).toBe(6);
    expect(result.total).toBe(9); // 6 + 3 bonus
    expect(result.gwfFloor).toBeUndefined();
  });
});
