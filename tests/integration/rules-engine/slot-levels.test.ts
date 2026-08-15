import { describe, it, expect } from 'vitest';
import { evaluate, endTurn } from '$lib/rules-engine';
import { resolveModules } from '$lib/rules-engine/registry';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import { deriveSlotLevels } from '$lib/play/slotLevels';

/**
 * Phase 1 proof — `deriveSlotLevels` over a REAL evaluation, not hand-built facts.
 *
 * The unit tests pin the arithmetic against synthetic fact maps. This one pins
 * the *contract*: that the pair the store actually feeds the derivation —
 * `engineOutput.facts` (projected post-plan) and `engineOutput.effects`
 * (= `plan.advertised`, this turn only) — really does carry a planned slot spend
 * as `thisTurn`, and that ageing the turn boundary with the engine's own
 * `endTurn` helper (the one `playStore.endTurn()` calls) moves that spend out of
 * `thisTurn` while leaving `spent`/`open` where they were.
 *
 * A level-1 paladin has two level-1 slots; Bless defaults its `slotLevel`
 * selection to `bless.lowestAvailableSlotLevel`, so casting it spends level 1.
 */

/** The bless-cast scenario's group list (canonical ids, no directory prefix). */
const GROUPS = [
  'ability-scores',
  'proficiency',
  'action-economy',
  'free-actions',
  'spellcasting',
  'concentration',
  'core-events',
  'class-paladin-level1',
  'spell-bless'
];

const SLOT_L1_SPENT = 'spellcasting.slots.level1.spent';

function planned(instanceId: string, ruleId: string): PlannedRef {
  return { instanceId, ruleId };
}

describe('deriveSlotLevels over a real engine evaluation', () => {
  it('reports a planned Bless as thisTurn, then as spent once the turn is ended', () => {
    const { modules, missing } = resolveModules(GROUPS);
    expect(missing, 'every rule group resolves to a module').toEqual([]);

    // --- Turn 1: prepare Bless and end the turn, so the prepared flag is a
    // committed (permanent) effect rather than part of the plan under test.
    let committed: EffectInstance[] = [];
    const prepare = evaluate({
      modules,
      inputFacts: {},
      planned: [planned('p1', 'prepare-bless')],
      committed
    });
    committed = endTurn(committed, prepare.effects);

    // Baseline: two level-1 slots, none spent, nothing planned.
    const baseline = evaluate({ modules, inputFacts: {}, planned: [], committed });
    expect(deriveSlotLevels(baseline.facts, baseline.effects)).toEqual([
      { level: 1, total: 2, open: 2, thisTurn: 0, spent: 0 }
    ]);

    // --- Turn 2: plan Bless. It is not committed — the turn has not ended.
    const cast = evaluate({
      modules,
      inputFacts: {},
      planned: [planned('c1', 'cast-bless')],
      committed
    });
    expect(cast.status.legal, 'casting Bless is a legal plan').toBe(true);

    // The engine really advertises the slot spend at level 1 (not a prefix match
    // on some other level-shaped key), which is what the derivation counts.
    const slotSpends = cast.effects.filter((e) => e.state?.[SLOT_L1_SPENT] !== undefined);
    expect(slotSpends).toHaveLength(1);
    expect(slotSpends[0]!.state?.[SLOT_L1_SPENT]).toBe(1);

    expect(deriveSlotLevels(cast.facts, cast.effects)).toEqual([
      { level: 1, total: 2, open: 1, thisTurn: 1, spent: 1 }
    ]);

    // --- End the turn exactly as the store does: age this turn's advertised
    // effects into the committed set, then re-evaluate with an empty plan.
    committed = endTurn(committed, cast.effects);
    const afterEndTurn = evaluate({ modules, inputFacts: {}, planned: [], committed });

    // The spend survived the boundary as a committed effect…
    expect(
      committed.some((e) => e.state?.[SLOT_L1_SPENT] === 1),
      'the slot spend is committed after End Turn'
    ).toBe(true);
    // …and is no longer advertised, so it must read as spent, never as this turn.
    expect(afterEndTurn.effects.some((e) => e.state?.[SLOT_L1_SPENT] !== undefined)).toBe(false);

    expect(deriveSlotLevels(afterEndTurn.facts, afterEndTurn.effects)).toEqual([
      { level: 1, total: 2, open: 1, thisTurn: 0, spent: 1 }
    ]);
  });
});
