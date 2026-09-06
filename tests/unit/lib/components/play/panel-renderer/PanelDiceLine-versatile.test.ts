import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { AvailableRuleEntry, Rule, VarDefinition } from '$lib/rules-view';
import type { DiceLineControl } from '$lib/components/play/panel-renderer/types';

const createVersatileSpearEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'spear-use-action',
    description: 'Spear',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.dnd-5e-2024.attacks.spear.name',
      annotationLabels: [
        'attack.any',
        'attack.melee',
        'attack.weapon',
        'dice.any',
        'property.versatile'
      ],
      primaryControl: {
        type: 'dice-line',
        ranges: { var: 'ranges' },
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' } },
          {
            sides: { var: 'damageDie' },
            bonus: { var: 'damageBonus' },
            damageType: { string: 'piercing' }
          }
        ]
      }
    },
    vars: {
      ranges: {
        default: {
          array: [
            { distance: 5, type: 'melee', label: '1H' },
            { distance: 5, type: 'melee', label: '2H', damageDie: 8 },
            { distance: 20, type: 'thrown' },
            { distance: 60, type: 'thrown', disadvantage: true }
          ]
        }
      },
      hitBonus: { default: { number: 5 } },
      damageDie: { default: { number: 6 } },
      damageBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - versatile weapon (spear)', () => {
  it('shows range label when present - "5ft 1H" for first range', () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.textContent).toContain('5ft 1H');
  });

  it('cycles to "5ft 2H" when range is tapped once', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Initially shows "5ft 1H"
    expect(container.textContent).toContain('5ft 1H');
    // Tap to cycle
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Now shows "5ft 2H"
    expect(container.textContent).toContain('5ft 2H');
  });

  it('cycles to "20ft" (no label) for thrown range', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    // Cycle twice to reach 20ft thrown
    await fireEvent.click(rangeEl);
    await fireEvent.click(rangeEl);
    expect(container.textContent).toContain('20ft');
    // Should NOT contain "1H" or "2H" label for thrown
    expect(container.textContent).not.toContain('20ft 1H');
    expect(container.textContent).not.toContain('20ft 2H');
  });

  it('cycles to "60ft" with disadvantage indicator for long thrown range', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    // Cycle three times to reach 60ft thrown
    await fireEvent.click(rangeEl);
    await fireEvent.click(rangeEl);
    await fireEvent.click(rangeEl);
    expect(container.textContent).toContain('60ft');
    // Disadvantage indicator should be visible
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeTruthy();
  });

  it('shows d6 damage die for 1H melee range', () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Default range is 1H - damage die should be d6
    expect(container.textContent).toContain('d6');
  });

  it('shows d8 damage die for 2H melee range', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Cycle to 2H range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Damage die should now show d8 (overridden by range entry)
    expect(container.textContent).toContain('d8');
    expect(container.textContent).not.toContain('d6');
  });

  it('shows d6 damage die for thrown range (no override)', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Cycle to thrown range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    await fireEvent.click(rangeEl);
    // Damage die should be d6 (default, no override on thrown entry)
    expect(container.textContent).toContain('d6');
  });

  it('rolls damage die with d8 sides when 2H range is selected', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Cycle to 2H range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Mock: floor(0.5 * 8) + 1 = 5, plus bonus 3 = 8
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // 5 + 3 = 8
    expect(container.textContent).toContain('8');
  });

  it('rolls damage die with d6 sides when 1H range is selected', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Already on 1H range by default
    // Mock: floor(0.5 * 6) + 1 = 4, plus bonus 3 = 7
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // 4 + 3 = 7
    expect(container.textContent).toContain('7');
  });

  it('cycles back to 1H after going through all 4 ranges', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    // Cycle through all 4 ranges: 1H -> 2H -> 20ft -> 60ft -> 1H
    await fireEvent.click(rangeEl); // -> 2H
    await fireEvent.click(rangeEl); // -> 20ft
    await fireEvent.click(rangeEl); // -> 60ft
    await fireEvent.click(rangeEl); // -> back to 1H
    expect(container.textContent).toContain('5ft 1H');
    // Damage die should be d6 again
    expect(container.textContent).toContain('d6');
  });

  // === Range selection feedback ===

  // A range switch reports the new index and nothing else. It used to also write
  // an `extraHands` selection, from the days when a versatile weapon offered a
  // second melee band and the grip was chosen per attack; the loadout owns the
  // grip now, no band carries `extraHands`, and nothing consumes the selection.
  it('reports only the new range index when cycling', async () => {
    const entry = createVersatileSpearEntry();
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    expect(onSelectionChange).toHaveBeenCalledWith({ rangeIndex: 1 });
  });

  it('initializes rangeIndex from selections', () => {
    const entry = createVersatileSpearEntry();
    // Pre-select rangeIndex 1 (2H range)
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        facts: {},
        selections: { rangeIndex: 1 }
      }
    });
    // Should show "5ft 2H" (range index 1)
    expect(container.textContent).toContain('5ft 2H');
    // Damage die should be d8 (2H override)
    expect(container.textContent).toContain('d8');
  });

  // === GWF gating on versatile range selection ===
  // Gating is done in PanelRenderer (effectiveGwfActive), which passes
  // the correct gwfActive value to PanelDiceLine. These tests verify
  // PanelDiceLine correctly applies/suppresses the GWF floor based on
  // the gwfActive prop it receives.

  it('does NOT apply GWF floor when gwfActive is false (1H range)', async () => {
    const entry = createVersatileSpearEntry();
    const control = entry.rule.ui!.primaryControl as DiceLineControl;
    const vars = entry.rule.vars as Record<string, VarDefinition>;
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars, gwfActive: false }
    });
    // Default range is 1H — PanelRenderer sets gwfActive=false for 1H
    vi.spyOn(Math, 'random').mockReturnValue(0); // floor(0 * 6) + 1 = 1
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // Without GWF floor: 1 + 3 = 4
    expect(container.textContent).toContain('4');
    expect(container.textContent).not.toContain('6');
  });

  it('applies GWF floor when gwfActive is true (2H range)', async () => {
    const entry = createVersatileSpearEntry();
    const control = entry.rule.ui!.primaryControl as DiceLineControl;
    const vars = entry.rule.vars as Record<string, VarDefinition>;
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars, gwfActive: true }
    });
    // Cycle to 2H range — PanelRenderer sets gwfActive=true for 2H
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Damage die is d8 in 2H mode, roll a 1 — GWF SHOULD floor it to 3
    vi.spyOn(Math, 'random').mockReturnValue(0); // floor(0 * 8) + 1 = 1
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // With GWF floor: 3 + 3 = 6
    expect(container.textContent).toContain('6');
  });

  it('does NOT apply GWF floor when gwfActive is false (thrown range)', async () => {
    const entry = createVersatileSpearEntry();
    const control = entry.rule.ui!.primaryControl as DiceLineControl;
    const vars = entry.rule.vars as Record<string, VarDefinition>;
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars, gwfActive: false }
    });
    // Cycle to thrown range (20ft). `gwfActive` is row-level and false here; a
    // thrown band is additionally barred by its own `meleeAttack: false` — see
    // PanelDiceLine-gwf.test.ts for the case where the row-level signal is TRUE.
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl); // -> 2H
    await fireEvent.click(rangeEl); // -> 20ft thrown
    vi.spyOn(Math, 'random').mockReturnValue(0); // floor(0 * 6) + 1 = 1
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // Without GWF floor: 1 + 3 = 4
    expect(container.textContent).toContain('4');
    expect(container.textContent).not.toContain('6');
  });
});

// === Grip on the melee band (the shape the builder actually emits today) ===
//
// The grip is fixed by the LOADOUT, so a versatile weapon has ONE melee band and
// the only thing that moved with the grip was the damage die. The band's label is
// a ValueSource that follows `weapon.<id>.twoHanded` onto the loadout's own grip
// i18n keys, so the attack row states the grip in words. `$t` is mocked to the
// identity, so the assertions below name the keys.

const ONE_HANDED = 'rule.dnd-5e-2024.loadout.grip.one-handed';
const TWO_HANDED = 'rule.dnd-5e-2024.loadout.grip.two-handed';

const gripSpearControl = (): DiceLineControl => ({
  type: 'dice-line',
  ranges: { var: 'ranges' },
  dice: [
    { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
    {
      sides: { var: 'damageDie' },
      bonus: { var: 'damageBonus' },
      purpose: 'damage',
      damageType: { string: 'piercing' }
    }
  ]
});

const gripSpearVars = (): Record<string, VarDefinition> =>
  ({
    ranges: {
      default: {
        array: [
          {
            distance: 5,
            type: 'melee',
            label: { fact: 'weapon.spear.twoHanded', map: { 0: ONE_HANDED, 1: TWO_HANDED } }
          },
          { distance: 20, type: 'thrown', damageDie: 6 },
          { distance: 60, type: 'thrown', disadvantage: true, damageDie: 6 }
        ]
      }
    },
    hitBonus: { default: { number: 5 } },
    damageDie: { default: { fact: 'attack.spear.damageDie' } },
    damageBonus: { default: { number: 3 } }
  }) as unknown as Record<string, VarDefinition>;

const renderGripSpear = (facts: Record<string, number>) =>
  render(PanelDiceLine, {
    props: {
      control: gripSpearControl(),
      editable: true,
      facts,
      vars: gripSpearVars()
    }
  });

describe('PanelDiceLine - versatile grip label follows the loadout', () => {
  it('reads one-handed when the grip fact is unset', () => {
    const { container } = renderGripSpear({ 'attack.spear.damageDie': 6 });
    expect(container.querySelector('.panel-renderer__range')?.textContent?.trim()).toBe(
      `5ft ${ONE_HANDED}`
    );
    expect(container.textContent).toContain('d6');
  });

  it('reads two-handed when the loadout set the grip fact', () => {
    const { container } = renderGripSpear({
      'weapon.spear.twoHanded': 1,
      'attack.spear.damageDie': 8
    });
    expect(container.querySelector('.panel-renderer__range')?.textContent?.trim()).toBe(
      `5ft ${TWO_HANDED}`
    );
    expect(container.textContent).toContain('d8');
  });

  it('leaves the thrown bands free of any grip wording', async () => {
    const { container } = renderGripSpear({
      'weapon.spear.twoHanded': 1,
      'attack.spear.damageDie': 8
    });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl); // -> 20ft thrown
    expect(container.querySelector('.panel-renderer__range')?.textContent?.trim()).toBe('20ft');
    expect(container.textContent).not.toContain(TWO_HANDED);
    expect(container.textContent).not.toContain(ONE_HANDED);
  });

  it('translates a plain-string range label instead of rendering the raw key', () => {
    // A range label is an i18n KEY, not display text — it used to render raw,
    // which is why the cosmetic 1H/2H labels had to be deleted. Uses a key the
    // test dictionary actually translates, so a missing `$t` call would show.
    const control = gripSpearControl();
    const vars = gripSpearVars();
    (vars.ranges.default as unknown as { array: Array<{ label?: unknown }> }).array[0].label =
      'play.loadout.handsFree.one';
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars }
    });
    expect(container.querySelector('.panel-renderer__range')?.textContent?.trim()).toBe(
      '5ft 1 hand free'
    );
  });

  it('puts the grip in the die chips accessible name, not just the visible text', () => {
    const { container } = renderGripSpear({
      'weapon.spear.twoHanded': 1,
      'attack.spear.damageDie': 8
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    expect(chips.length).toBe(2);
    for (const chip of chips) {
      expect(chip.getAttribute('aria-label')).toContain(TWO_HANDED);
    }
  });

  it('does NOT put a thrown bands (absent) grip into the accessible name', async () => {
    const { container } = renderGripSpear({
      'weapon.spear.twoHanded': 1,
      'attack.spear.damageDie': 8
    });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl); // -> 20ft thrown
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    for (const chip of chips) {
      expect(chip.getAttribute('aria-label')).not.toContain(TWO_HANDED);
    }
  });
});
