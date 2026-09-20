import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { DiceLineControl, RollModifier } from '$lib/components/play/panel-renderer/types';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

// Mirrors the shape the concentration check authors: a d20 save whose KEPT
// NATURAL decides the outcome, persisted through `writeBack` — the natural
// only, with the save bonus resolving live from its var (hit-dice precedent).
const createWriteBackEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'concentration-check',
    description: 'Concentration Check',
    activities: [],
    ui: {
      section: 'free',
      name: 'planner.concentration.check.name',
      primaryControl: {
        type: 'dice-line',
        dice: [
          {
            sides: 20,
            bonus: { var: 'saveBonus' },
            purpose: 'save',
            writeBack: { var: 'roll' }
          }
        ]
      }
    },
    vars: {
      saveBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// The ordinary dice line every other rule authors: no `writeBack`, so its
// rolls are ephemeral and must never ride the plan's selections.
const createPlainEntry = (): AvailableRuleEntry => ({
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

// A band that starts at disadvantage, so a plain chip tap rolls disadvantage
// without cycling ranges first.
const createDisadvantageEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'concentration-check',
    description: 'Concentration Check',
    activities: [],
    ui: {
      section: 'free',
      name: 'planner.concentration.check.name',
      primaryControl: {
        type: 'dice-line',
        ranges: {
          default: { array: [{ distance: 5, type: 'melee', disadvantage: true }] }
        },
        dice: [
          {
            sides: 20,
            bonus: { var: 'saveBonus' },
            purpose: 'save',
            writeBack: { var: 'roll' }
          }
        ]
      }
    },
    vars: {
      saveBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// The concentration check's rider-capturing shape: the same d20 save, but the
// writeBack names a riderVar, so a roll persists the kept natural AND the active
// modifier total (Aura of Protection folded in at roll time — the total the
// engine's apply re-reads as its riderBonus and the outcome chip must judge).
const RIDER_CONTROL = {
  type: 'dice-line',
  dice: [
    {
      sides: 20,
      bonus: { number: 1 },
      purpose: 'save',
      writeBack: { var: 'roll', riderVar: 'riderBonus' }
    }
  ]
} as DiceLineControl;

// The save-scoped modifier the concentration panel surfaces as a toggle chip:
// default-on, so a plain roll folds it into both the shown total and — with a
// riderVar — the persisted rider.
const AURA_MODIFIER: RollModifier = {
  key: 'aura',
  label: 'rule.demo.aura',
  appliesTo: 'save',
  value: 3,
  defaultOn: true
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PanelDiceLine - writeBack roll persistence', () => {
  it('persists the kept natural via onSelectionChange when a writeBack die rolls', async () => {
    const entry = createWriteBackEntry();
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // floor(0.8*20)+1 = 17
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith({ roll: 17 });
  });

  it('persists the KEPT natural under disadvantage, not the dropped one', async () => {
    const entry = createDisadvantageEntry();
    const onSelectionChange = vi.fn();
    // Two rolls: 0.4 -> 9, 0.7 -> 15. Disadvantage keeps the min (9); the
    // write-back must record the kept 9, never the dropped 15.
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.4).mockReturnValueOnce(0.7);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith({ roll: 9 });
  });

  it('re-rolling replaces the persisted natural instead of accumulating', async () => {
    const entry = createWriteBackEntry();
    const onSelectionChange = vi.fn();
    const random = vi.spyOn(Math, 'random');
    random.mockReturnValueOnce(0.8); // floor(0.8*20)+1 = 17
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    random.mockReturnValueOnce(0.1); // floor(0.1*20)+1 = 3
    await fireEvent.click(chip!);
    expect(onSelectionChange).toHaveBeenCalledTimes(2);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ roll: 3 });
  });

  // The load-bearing regression pin: most dice lines are ephemeral attack or
  // damage rolls. Before `writeBack` existed, PanelDiceLine deliberately
  // voided its onSelectionChange prop so no roll ever rode the selections;
  // persistence is strictly opt-in per die.
  it('NEVER writes selections for a die without writeBack', async () => {
    const entry = createPlainEntry();
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('seeds a persisted writeBack roll from selections at mount', () => {
    const entry = createWriteBackEntry();
    const onSelectionChange = vi.fn();
    // A re-mounted row carrying its persisted roll: the chip must show the
    // rolled total (natural 14 + save bonus 3), not the unrolled expression,
    // without writing anything back on mount.
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { roll: 14 }, onSelectionChange }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    expect(chip?.textContent?.trim()).toBe('17');
    expect(container.textContent).not.toContain('d20+3');
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('treats a captured-but-unrolled value of 0 as unrolled', () => {
    // The concentration check captures its `roll` var at add time, so
    // selections ride a 0 until the first roll. Zero means "unrolled" — no
    // seeded chip, the plain expression renders.
    const entry = createWriteBackEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { roll: 0 } }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    expect(chip?.textContent?.trim()).toBe('d20+3');
  });

  it('writes nothing back when not editable', async () => {
    const entry = createWriteBackEntry();
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {}, onSelectionChange }
    });
    // Read-only chips are spans, not buttons — no roll, so no write.
    const span = container.querySelector('.panel-renderer__die-chip');
    expect(span?.tagName).toBe('SPAN');
    await fireEvent.click(span!);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  // The rider half of the persistence: a die whose writeBack carries a
  // `riderVar` persists the ACTIVE modifier total alongside the natural, in the
  // same selections payload — the engine's verdict then sees the total the dice
  // line showed (natural + authored + aura), not the natural alone.
  it('persists the active modifier total alongside the natural when writeBack carries a riderVar', async () => {
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // floor(0.4*20)+1 = 9
    const { container } = render(PanelDiceLine, {
      props: {
        control: RIDER_CONTROL,
        editable: true,
        facts: {},
        vars: {},
        selections: {},
        onSelectionChange,
        modifiers: [AURA_MODIFIER]
      }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith({ roll: 9, riderBonus: 3 });
  });

  it('seeds the persisted rider back into the restored chip total', () => {
    // A re-mounted row carrying its persisted roll AND rider: the chip shows
    // the same total the roll produced (natural 9 + authored 1 + rider 3),
    // restored from BOTH persisted values without writing anything back.
    const onSelectionChange = vi.fn();
    const { container } = render(PanelDiceLine, {
      props: {
        control: RIDER_CONTROL,
        editable: true,
        facts: {},
        vars: {},
        selections: { roll: 9, riderBonus: 3 },
        onSelectionChange
      }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    expect(chip?.textContent?.trim()).toBe('13');
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});

// The toggle-after-roll contract (option (b), the rider-captured-at-roll-time
// discipline): a recorded writeBack roll is FROZEN — the chip keeps showing
// the roll-time total and verdict while a situational modifier toggles,
// because the persisted natural + captured rider keep driving the engine's
// decision either way. Clearing the chip on a toggle would leave the UI
// showing the unrolled expression while the engine still judged the recorded
// roll — UI and engine diverging over display state.
describe('PanelDiceLine - toggle after roll', () => {
  // The concentration-check shape judged end to end: d20 save, authored +1,
  // rider-capturing writeBack, outcomeVs DC 12. One modifier (the aura, +3)
  // starts ON.
  const CHECK_CONTROL = {
    type: 'dice-line',
    outcomeVs: { number: 12 },
    dice: [
      {
        sides: 20,
        bonus: { number: 1 },
        purpose: 'save',
        writeBack: { var: 'roll', riderVar: 'riderBonus' }
      }
    ]
  } as DiceLineControl;
  // One stable array reference across render and rerender: a new instance
  // would needlessly dirty the modifiers-derived signatures the reset effect
  // tracks, muddying which change actually armed it.
  const MODS = [AURA_MODIFIER];
  const propsFor = (selections: Record<string, unknown>) => ({
    control: CHECK_CONTROL,
    editable: true,
    facts: {},
    vars: {},
    selections,
    modifiers: MODS
  });

  it('keeps a rolled writeBack die on its roll-time total and verdict across a toggle', async () => {
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // floor(0.4*20)+1 = 9
    const { container, rerender } = render(PanelDiceLine, {
      props: { ...propsFor({}), onSelectionChange }
    });
    await fireEvent.click(container.querySelector('.panel-renderer__die-chip')!);
    // Roll-time state: 9 + 1 authored + 3 aura = 13 vs DC 12 → passed.
    expect(onSelectionChange).toHaveBeenCalledWith({ roll: 9, riderBonus: 3 });
    // The parent's round-trip: the plan row stores exactly what the roll
    // wrote, and the selections prop flows back down.
    await rerender({ ...propsFor({ roll: 9, riderBonus: 3 }), onSelectionChange });

    // Toggle the aura OFF: the would-be total drops to 10 (a fail), but the
    // recorded roll is what the engine still judges — the chip must keep
    // showing it, not regress to the unrolled expression.
    await fireEvent.click(container.querySelector('button.panel-renderer__modifier')!);
    const chip = container.querySelector('.panel-renderer__die-chip');
    expect(chip?.textContent?.trim()).toBe('13');
    const outcome = container.querySelector('.panel-renderer__outcome');
    expect(outcome).not.toBeNull();
    expect(outcome?.textContent).toBe('planner.record.passed');

    // The engine agreement, by construction: a toggle is display state and
    // NEVER fires onSelectionChange, so the persisted pair { roll: 9,
    // riderBonus: 3 } — the exact inputs whose verdict concentration-check
    // pins ("a captured rider joins the verdict") — is unchanged, and the
    // engine resolves the same pass it did before the toggle. Re-roll to
    // change a recorded outcome; a re-roll captures the new modifier state.
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
  });

  it('still clears a die WITHOUT writeBack when a modifier toggles', async () => {
    // Regression pin of today's behaviour: an ephemeral die's total matched
    // the expression that produced it, and a toggle changes that expression —
    // nothing is persisted to re-seed from, so the chip must reset.
    const control = {
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { number: 1 }, purpose: 'save' }]
    } as DiceLineControl;
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // 9 + 1 + 3 = 13
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars: {}, selections: {}, modifiers: MODS }
    });
    await fireEvent.click(container.querySelector('.panel-renderer__die-chip')!);
    expect(container.querySelector('.panel-renderer__die-chip')?.textContent?.trim()).toBe('13');
    await fireEvent.click(container.querySelector('button.panel-renderer__modifier')!);
    // Aura off now: the expression reads d20+1, not the stale 13.
    expect(container.querySelector('.panel-renderer__die-chip')?.textContent?.trim()).toBe('d20+1');
  });

  it('still clears a writeBack die when the dice change shape', async () => {
    // Only the MODIFIER path preserves; a dice-signature change (the die's
    // shape moved) clears everything, writeBack included — the persisted
    // natural described a die this line no longer rolls. The die's sides
    // resolve from a selection, the smite/slider shape of shape change.
    const control = {
      type: 'dice-line',
      outcomeVs: { number: 10 },
      dice: [
        {
          sides: { var: 'dieSides' },
          bonus: { number: 1 },
          purpose: 'save',
          writeBack: { var: 'roll', riderVar: 'riderBonus' }
        }
      ]
    } as DiceLineControl;
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // d20 → 9
    const { container, rerender } = render(PanelDiceLine, {
      props: {
        control,
        editable: true,
        facts: {},
        vars: {},
        selections: { dieSides: 20 },
        modifiers: MODS,
        onSelectionChange: vi.fn()
      }
    });
    await fireEvent.click(container.querySelector('.panel-renderer__die-chip')!);
    expect(container.querySelector('.panel-renderer__die-chip')?.textContent?.trim()).toBe('13');
    // The die shrinks to a d12 while the rolled values ride the selections —
    // the shape change must win over any re-seed. The aura never toggled, so
    // the restored expression still folds it in (d12 + authored 1 + aura 3).
    await rerender({
      control,
      editable: true,
      facts: {},
      vars: {},
      selections: { dieSides: 12, roll: 9, riderBonus: 3 },
      modifiers: MODS
    });
    expect(container.querySelector('.panel-renderer__die-chip')?.textContent?.trim()).toBe('d12+4');
    expect(container.querySelector('.panel-renderer__outcome')).toBeNull();
  });
});
