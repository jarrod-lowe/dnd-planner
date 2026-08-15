import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';
import type { EffectInstance } from '$lib/rules-engine';

// Mirrors the control authored on `record-short-rest` (core-events.ts):
// pools per die size resolved from `hitDie.*` facts, CON bonus, hp unit.
const createHitDiceEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'record-short-rest',
    description: 'Short Rest',
    activities: [],
    ui: {
      section: 'rest',
      name: 'planner.record.rest.short',
      primaryControl: {
        type: 'hit-dice',
        unit: 'hp',
        bonus: { fact: 'con.modifier' },
        pools: [6, 8, 10, 12].map((sides) => ({
          sides,
          total: { fact: `hitDie.d${sides}.total` },
          remaining: { fact: `hitDie.d${sides}.remaining` }
        }))
      }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

const baseFacts = (): Record<string, number> => ({
  'con.modifier': 2,
  // 20 HP missing: generous, so the uncapped heal (roll + CON) previews intact
  // unless a test narrows it to exercise the missing-HP cap.
  'hp.modifier.current': -20,
  'hitDie.d6.total': 0,
  'hitDie.d6.remaining': 0,
  'hitDie.d8.total': 2,
  'hitDie.d8.remaining': 2,
  'hitDie.d10.total': 3,
  'hitDie.d10.remaining': 1,
  'hitDie.d12.total': 0,
  'hitDie.d12.remaining': 0
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PanelRenderer - hit-dice control', () => {
  // The real play flow resolves panel facts POST-plan, so the open rest row's
  // own ACCEPTED rolls already shrank `remaining`, and the row's
  // `advertisedEffects` carry one hit-die spend per accepted roll. Availability
  // must be COMMITTED-based: threshold = remaining + this row's advertised
  // spends, so the row's own rolls disable nothing — only an earlier rest's
  // committed spends (and rolls the engine rejected) disable slots.
  const d10OnlyFacts = (total: number, remaining: number): Record<string, number> => ({
    ...baseFacts(),
    'hitDie.d8.total': 0,
    'hitDie.d8.remaining': 0,
    'hitDie.d10.total': total,
    'hitDie.d10.remaining': remaining
  });

  // One of the row's own advertised `effect-hit-die-heal` effects (ids
  // namespaced by instance, state carrying the engine's CAPPED effective heal
  // plus the die spend). The panel rebuilds the engine's committed-only heal
  // budget from these — see the post-plan tests at the bottom of this suite.
  const healEffect = (heal: number, sides: number): EffectInstance => ({
    id: 'i0#1#effect-hit-die-heal',
    state: { 'hp.modifier.current': heal, [`hitDie.d${sides}.spent`]: 1 },
    expiry: { kind: 'untilLongRest' }
  });

  it('disables only slots blocked by committed spends (no rolls in the row)', () => {
    const entry = createHitDiceEntry();
    // remaining 5 of 6 with NO rolls of our own: one die was spent by an
    // EARLIER rest (committed), so the highest slot is blocked.
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: d10OnlyFacts(6, 5) }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    expect(chips.length).toBe(6);
    for (let i = 0; i < 5; i++) expect(chips[i].disabled).toBe(false);
    expect(chips[5].disabled).toBe(true);
    const pool = container.querySelector('.panel-renderer__hit-dice-pool[data-die-sides="10"]');
    expect(pool?.getAttribute('aria-label')).toBe('d10 hit dice, 5 of 6 unspent');
  });

  it('keeps every slot available while the row rolls its own dice', () => {
    const entry = createHitDiceEntry();
    // Same facts (remaining 5, one committed spend) but the row itself has
    // rolled slot 0 (natural 6 + CON 2 = 8, advertised): that accepted roll
    // shrank the POST-plan remaining, not the committed pool. Threshold =
    // 5 + 1 advertised spend = 6 → nothing disabled, and the pool announces
    // the committed-based count, not the raw remaining.
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(8, 10)] },
        editable: true,
        facts: d10OnlyFacts(6, 5),
        selections
      }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    for (const chip of chips) expect(chip.disabled).toBe(false);
    const pool = container.querySelector('.panel-renderer__hit-dice-pool[data-die-sides="10"]');
    expect(pool?.getAttribute('aria-label')).toBe('d10 hit dice, 6 of 6 unspent');
  });

  it('rolls the highest slot after a lower one in the same open row', async () => {
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d10 -> 6
    // Roll slot 0 (payload already in selections, spend advertised), then tap
    // slot 5: both are the row's own spends, so slot 5 must stay rollable.
    const selections = { rolls: { d10: { '0': 4 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(6, 10)] },
        editable: true,
        facts: d10OnlyFacts(6, 5),
        selections,
        onSelectionChange
      }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    await fireEvent.click(chips[5]);
    expect(onSelectionChange).toHaveBeenCalledWith({
      rolls: { d10: { '0': 4, '5': 6 } }
    });
  });

  it('counts distinct rolled slots, not re-rolls, toward availability', () => {
    const entry = createHitDiceEntry();
    // Re-rolling slot 0 replaces its entry and its advertised spend (one
    // hitDie.d10.spent), so the threshold is 5 + 1 = 6, not 5 + 2.
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(8, 10)] },
        editable: true,
        facts: d10OnlyFacts(6, 5),
        selections
      }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    expect(chips[5].disabled).toBe(false);
  });

  it('offsets availability by advertised spends, not retained rejected rolls', async () => {
    // The reported scenario: 6 d10s, 1 committed spend, retained rolls in
    // slots 0 and 5. Only slot 0's die was ACCEPTED (the row advertises exactly
    // one hitDie.d10.spent); slot 5's roll was REJECTED (die_already_spent),
    // so it still rides selections but the engine advertises no spend for it
    // and the post-plan remaining (4 = 6 − 1 committed − 1 accepted) does not
    // reflect it. Counting selection KEYS would offset by 2 (threshold 6) and
    // leave slot 5 tappable as a re-roll — stuck on the diagnostic. Offsetting
    // by the ADVERTISED spends yields threshold 4 + 1 = 5: slot 5 is blocked
    // (and, carrying a roll, clearable), slot 4 is free.
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    const selections = { rolls: { d10: { '0': 6, '5': 4 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(8, 10)] },
        editable: true,
        facts: { ...d10OnlyFacts(6, 4), 'hp.modifier.current': -12 },
        selections,
        onSelectionChange
      }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    const pool = container.querySelector('.panel-renderer__hit-dice-pool[data-die-sides="10"]');
    expect(pool?.getAttribute('aria-label')).toBe('d10 hit dice, 5 of 6 unspent');
    expect(chips[4].disabled).toBe(false);
    expect(chips[4].getAttribute('aria-label')).toBe('d10 hit die 5 of 6');
    expect(chips[5].getAttribute('aria-label')).toBe(
      'd10 hit die 6 of 6 (spent), rolled 4, heals 6 hp, tap to clear'
    );
    // Tapping the blocked-but-rolled slot CLEARS the stranded roll instead of
    // re-rolling it.
    await fireEvent.click(chips[5]);
    expect(onSelectionChange).toHaveBeenCalledWith({ rolls: { d10: { '0': 6 } } });
  });

  it('keeps every slot available with two accepted rolls the row advertises', () => {
    // Sanity pin of the earlier fix via the new computation: no committed
    // spends, two accepted rolls, both advertised — the post-plan remaining
    // (4 = 6 − 2) plus the 2 advertised spends recovers the full 6, so nothing
    // the row's own rolls disabled stays disabled.
    const entry = createHitDiceEntry();
    const selections = { rolls: { d10: { '0': 6, '1': 4 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(8, 10), healEffect(6, 10)] },
        editable: true,
        facts: { ...d10OnlyFacts(6, 4), 'hp.modifier.current': -6 },
        selections
      }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    for (const chip of chips) expect(chip.disabled).toBe(false);
    const pool = container.querySelector('.panel-renderer__hit-dice-pool[data-die-sides="10"]');
    expect(pool?.getAttribute('aria-label')).toBe('d10 hit dice, 6 of 6 unspent');
  });

  it('renders one roller per slot and skips pools with no dice', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts() }
    });
    // d8 pool (2 slots) + d10 pool (3 slots); d6/d12 pools resolve total 0.
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    expect(chips.length).toBe(5);
    expect(container.textContent).not.toContain('d6');
    expect(container.textContent).not.toContain('d12');
  });

  it('disables spent slots but keeps them visible', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts() }
    });
    // DOM order: d8 slots 0-1, then d10 slots 0-2. d10 remaining is 1, so
    // d10 slots 1 and 2 (index >= remaining) are spent.
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    expect(chips[3].disabled).toBe(true);
    expect(chips[4].disabled).toBe(true);
    expect(chips[0].disabled).toBe(false);
    expect(chips[2].disabled).toBe(false);
  });

  it('emits the natural roll via onSelectionChange keyed by size and slot', async () => {
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // floor(0.5*10)+1 = 6
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), onSelectionChange }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    await fireEvent.click(chips[2]); // d10 slot 0
    expect(onSelectionChange).toHaveBeenCalledWith({
      rolls: { d10: { '0': 6 } }
    });
  });

  it('re-rolling a slot replaces its value instead of accumulating', async () => {
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.2); // floor(0.2*10)+1 = 3
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        facts: baseFacts(),
        selections: { rolls: { d10: { '0': 6 } } },
        onSelectionChange
      }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    await fireEvent.click(chips[2]); // d10 slot 0 again
    const calls = onSelectionChange.mock.calls;
    expect(calls[calls.length - 1][0]).toEqual({
      rolls: { d10: { '0': 3 } }
    });
  });

  it('keeps rolls when the dice signature changes (spent boundary moves)', async () => {
    const entry = createHitDiceEntry();
    const facts = baseFacts();
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts, selections }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chip.textContent?.trim()).toBe('8'); // 6 + CON 2
    // The pending row re-evaluates as other plan items commit: the d10 pool's
    // spent boundary moves (1 remaining -> 0). The rolled slot 0 keeps its roll.
    await rerender({
      entry,
      editable: true,
      facts: { ...facts, 'hitDie.d10.remaining': 0 },
      selections
    });
    const chipAfter = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chipAfter.textContent?.trim()).toBe('8');
  });

  it('fires onRoll with natural, CON bonus, and the floored heal', async () => {
    const entry = createHitDiceEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d10 -> 6
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    await fireEvent.click(chips[2]);
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result, slotIndex] = onRoll.mock.calls[0];
    expect(result.natural).toBe(6);
    expect(result.bonus).toBe(2);
    expect(result.total).toBe(8);
    expect(result.sides).toBe(10);
    expect(result.unit).toBe('hp');
    expect(result.purpose).toBe('healing');
    expect(slotIndex).toBe(0);
  });

  it('floors the heal at 1 HP when the roll plus CON is lower', async () => {
    const entry = createHitDiceEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0); // d10 -> 1
    const facts = { ...baseFacts(), 'con.modifier': -2 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    await fireEvent.click(chips[2]);
    const [result] = onRoll.mock.calls[0];
    expect(result.natural).toBe(1);
    expect(result.total).toBe(1);
  });

  it('does not roll spent slots or fire callbacks when read-only', async () => {
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: baseFacts(), onSelectionChange, onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    expect(chips.length).toBe(5);
    for (const chip of chips) {
      expect(chip.tagName).toBe('SPAN');
    }
    // Spans have no click handlers; nothing should fire.
    await fireEvent.click(chips[2]);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onRoll).not.toHaveBeenCalled();
  });

  it('labels each roller with size and slot, and spent rollers as spent', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts() }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    expect(chips[2].getAttribute('aria-label')).toBe('d10 hit die 1 of 3');
    expect(chips[3].getAttribute('aria-label')).toBe('d10 hit die 2 of 3 (spent)');
    const pool = container.querySelector('.panel-renderer__hit-dice-pool[data-die-sides="10"]');
    expect(pool?.getAttribute('aria-label')).toBe('d10 hit dice, 1 of 3 unspent');
  });

  it('announces a rolled slot with its roll and heal', async () => {
    const entry = createHitDiceEntry();
    // Post-plan: committed missing 20, the rolled d10 advertised an 8-HP heal,
    // so the facts read 12 missing.
    const selections = { rolls: { d10: { '0': 6 } } };
    const facts = { ...baseFacts(), 'hp.modifier.current': -12 };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(8, 10)] },
        editable: true,
        facts,
        selections
      }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chip.getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 6, heals 8 hp');
  });

  it('announces the roll of a slot blocked by a committed spend, with a clear affordance', () => {
    const entry = createHitDiceEntry();
    // d10 pool 3, 1 committed spend, two rolled slots — only slot 0's roll was
    // accepted (1 advertised spend), so post-plan remaining is 3 − 1 − 1 = 1
    // and the committed-based threshold is 1 + 1 = 2: slot 2 is blocked by the
    // EARLIER rest's spend but still carries its (rejected) roll. The slot
    // stays tappable SOLELY to clear the stranded roll (committing it would
    // error die_already_spent).
    const facts = { ...baseFacts(), 'hitDie.d10.remaining': 1, 'hp.modifier.current': -12 };
    const selections = { rolls: { d10: { '0': 6, '2': 4 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(8, 10)] },
        editable: true,
        facts,
        selections
      }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    // DOM order: d8 slots 0-1, then d10 slots 0-2.
    expect(chips[4].disabled).toBe(false);
    expect(chips[4].getAttribute('aria-label')).toBe(
      'd10 hit die 3 of 3 (spent), rolled 4, heals 6 hp, tap to clear'
    );
    // The row's OWN rolled slot 0 is not blocked by the committed spend: the
    // threshold counts its advertised spend back in, so it announces a plain
    // roll.
    expect(chips[2].getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 6, heals 8 hp');
    // Only ONE committed spend exists (total 3 − remaining 1 − 1 accepted
    // roll), so unrolled slot 1 stays available — the block lands on the
    // highest slot.
    expect(chips[3].getAttribute('aria-label')).toBe('d10 hit die 2 of 3');
  });

  it('clears a roll stranded on a slot a committed spend blocked', async () => {
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    // Same construction as above: slot 2 is blocked by an earlier rest's
    // committed spend but carries a (rejected) roll — tapping it must UN-roll
    // it (the only fix for the die_already_spent commit error short of
    // deleting the row).
    const facts = { ...baseFacts(), 'hitDie.d10.remaining': 1, 'hp.modifier.current': -12 };
    const selections = { rolls: { d10: { '0': 6, '2': 4 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(8, 10)] },
        editable: true,
        facts,
        selections,
        onSelectionChange
      }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    await fireEvent.click(chips[4]); // d10 slot 2
    expect(onSelectionChange).toHaveBeenCalledWith({ rolls: { d10: { '0': 6 } } });
  });

  it('keeps the last roll of a size when another slot of it is cleared', async () => {
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    // d8 pool 3, 1 committed spend, slots 0 and 2 rolled with only slot 0
    // accepted (advertised): post-plan remaining is 1, so the threshold is
    // 1 + 1 = 2 — slot 2 is blocked (committed spend) and clearable while
    // slot 0 stays available. Clearing slot 2 drops only that slot, not the
    // whole d8 map.
    const facts = { ...baseFacts(), 'hitDie.d8.total': 3, 'hitDie.d8.remaining': 1 };
    const selections = { rolls: { d8: { '0': 3, '2': 4 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(5, 8)] },
        editable: true,
        facts,
        selections,
        onSelectionChange
      }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    await fireEvent.click(chips[2]); // d8 slot 2
    expect(onSelectionChange).toHaveBeenCalledWith({ rolls: { d8: { '0': 3 } } });
  });

  it('caps the announced heal at the missing HP (the engine commits the same cap)', async () => {
    const entry = createHitDiceEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d10 -> 6, roll + CON = 8
    // Only 3 HP missing: the engine commits min(8, 3) = 3, so the aria-label
    // and the toast's roll result must announce 3 — never a heal that lands 0.
    // Post-plan, that 3-HP heal leaves nothing missing.
    const facts = { ...baseFacts(), 'hp.modifier.current': 0 };
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(3, 10)] },
        editable: true,
        facts,
        selections
      }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chip.getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 6, heals 3 hp');

    // Nothing rolled yet: the committed 3 HP missing IS the budget the fresh
    // roll lands against.
    const { container: c2 } = render(PanelRenderer, {
      props: { entry, editable: true, facts: { ...baseFacts(), 'hp.modifier.current': -3 }, onRoll }
    });
    await fireEvent.click(
      c2.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip')[2]
    );
    expect(onRoll.mock.calls[0][0].total).toBe(3);
  });

  it('decrements the missing-HP budget across rolled slots in engine order', () => {
    const entry = createHitDiceEntry();
    // 3 HP missing, two d8s rolled at 6 (+2 = 8 each): the engine consumes
    // the budget ascending size-then-slot, so slot 0 heals 3 and slot 1 heals 0
    // (its die is still spent). The preview walks the same order. Both d8 slots
    // are unspent (remaining 2), so both get the plain rolled label. Post-plan,
    // the 3-HP heal leaves nothing missing.
    const facts = { ...baseFacts(), 'hp.modifier.current': 0 };
    const selections = { rolls: { d8: { '0': 6, '1': 6 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(3, 8), healEffect(0, 8)] },
        editable: true,
        facts,
        selections
      }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    expect(chips[0].getAttribute('aria-label')).toBe('d8 hit die 1 of 2, rolled 6, heals 3 hp');
    expect(chips[1].getAttribute('aria-label')).toBe('d8 hit die 2 of 2, rolled 6, heals 0 hp');
  });

  it('announces a heal of 0 at full HP (the die is still spent)', () => {
    const entry = createHitDiceEntry();
    // No missing HP: the announced heal is 0, never the uncapped roll + CON.
    const facts = { ...baseFacts(), 'hp.modifier.current': 0 };
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(0, 10)] },
        editable: true,
        facts,
        selections
      }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chip.getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 6, heals 0 hp');
  });

  it('treats a bonus that resolves to a non-number as no bonus', () => {
    const entry = createHitDiceEntry();
    // A string fact must not string-concatenate into the arithmetic ("62").
    // Post-plan: committed missing 20, the rolled d10 advertised a 6-HP heal.
    const facts = {
      ...baseFacts(),
      'con.modifier': '2',
      'hp.modifier.current': -14
    } as unknown as Record<string, number>;
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(6, 10)] },
        editable: true,
        facts,
        selections
      }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chip.textContent?.trim()).toBe('6');
    expect(chip.getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 6, heals 6 hp');
  });

  it('renders nothing when every pool is empty', () => {
    const entry = createHitDiceEntry();
    const facts: Record<string, number> = { 'con.modifier': 2 };
    for (const sides of [6, 8, 10, 12]) {
      facts[`hitDie.d${sides}.total`] = 0;
      facts[`hitDie.d${sides}.remaining`] = 0;
    }
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    expect(container.querySelector('.panel-renderer__hit-dice')).toBeNull();
    expect(container.textContent).not.toContain('Each die');
  });

  it('shows the CON modifier on the chip like any other dice line', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts() }
    });
    // No bespoke bonus line — the modifier rides the chip expression itself,
    // exactly as a dice-line's "d20+3" chip does.
    expect(container.querySelector('.panel-renderer__hit-dice-bonus')).toBeNull();
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    expect(chips[0].textContent?.trim()).toBe('d8+2');
    expect(chips[2].textContent?.trim()).toBe('d10+2');
  });

  it('shows the natural roll plus the modifier on a rolled chip, without the heal floor', () => {
    const entry = createHitDiceEntry();
    // CON -2 and a natural 1: the 1-HP floor is engine-side (it shows in the
    // structural HP preview and the toast), so the chip itself reads 1 - 2 = -1,
    // the same natural-plus-modifier total any other dice line would show.
    const facts = { ...baseFacts(), 'con.modifier': -2 };
    const selections = { rolls: { d10: { '0': 1 } } };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, selections }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chip.textContent?.trim()).toBe('-1');
  });

  // The tests below model the real post-plan construction: facts carry the
  // POST-plan missing (the row's own heals already subtracted) and the entry
  // carries the row's own advertised heal effects to add back.
  it('announces the heal the engine commits, not one shrunk by its own pending heal', () => {
    // Committed missing 20; slot 0 already rolled 9 (9 + CON 2 = 11), so the
    // post-plan missing is 9 and the row advertises an 11-HP heal effect.
    const entry = createHitDiceEntry();
    const facts = { ...d10OnlyFacts(3, 2), 'hp.modifier.current': -9 };
    const selections = { rolls: { d10: { '0': 9 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(11, 10)] },
        editable: true,
        facts,
        selections
      }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[0];
    expect(chip.getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 9, heals 11 hp');
  });

  it('announces the next die against the committed missing, not the post-plan missing', async () => {
    // Same construction as above; rolling slot 1 (natural 6 + CON 2 = 8) must
    // promise 8 — 11 of the committed 20 is consumed, 9 remain, 8 fits. The
    // toast may never promise 0 (or under-promise) while committed-missing HP
    // remains.
    const entry = createHitDiceEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d10 -> 6
    const facts = { ...d10OnlyFacts(3, 2), 'hp.modifier.current': -9 };
    const selections = { rolls: { d10: { '0': 9 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(11, 10)] },
        editable: true,
        facts,
        selections,
        onRoll
      }
    });
    await fireEvent.click(
      container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip')[1]
    );
    expect(onRoll.mock.calls[0][0].total).toBe(8);
  });

  it('announces a heal of 0 at full HP even with the row advertising its own heal', () => {
    // Committed missing 0: the die is still spent, the advertised heal is 0,
    // and the post-plan missing stays 0 — the announcement is 0, never the
    // uncapped roll + CON.
    const entry = createHitDiceEntry();
    const facts = { ...d10OnlyFacts(3, 2), 'hp.modifier.current': 0 };
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(0, 10)] },
        editable: true,
        facts,
        selections
      }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[0];
    expect(chip.getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 6, heals 0 hp');
  });

  it('announces only the final rolls after a slot is re-rolled (the plan re-evaluates)', () => {
    // Re-rolling replaces the slot's entry and the plan re-evaluates from
    // scratch, so no stale roll (nor its heal effect) may linger in the budget.
    // Committed missing 20; slot 0 re-rolled from 9 (heal 11) down to 1
    // (heal 3): the post-plan missing is 17 and the row advertises a 3-HP heal.
    const entry = createHitDiceEntry();
    const facts = { ...d10OnlyFacts(3, 2), 'hp.modifier.current': -17 };
    const selections = { rolls: { d10: { '0': 1 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(3, 10)] },
        editable: true,
        facts,
        selections
      }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[0];
    expect(chip.textContent?.trim()).toBe('3');
    expect(chip.getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 1, heals 3 hp');
  });
});
