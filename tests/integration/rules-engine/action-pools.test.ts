import { describe, it, expect } from 'vitest';
import { evaluate, endTurn } from '$lib/rules-engine';
import { resolveModules } from '$lib/rules-engine/registry';
import type { PlannedRef } from '$lib/rules-engine';
import { deriveActionPools } from '$lib/play/actionPools';

/**
 * Phase 1 proof — `deriveActionPools` over a REAL evaluation, not hand-built facts.
 *
 * The unit tests pin the arithmetic against synthetic fact maps. This one pins
 * the *contract*: that the pair the store actually feeds the derivation —
 * `engineOutput.facts` (projected post-plan) and `engineOutput.effects`
 * (= `plan.advertised`, this turn only) — really does carry a planned action spend
 * as `thisTurn`, and that ageing the turn boundary with the engine's own
 * `endTurn` helper (the one `playStore.endTurn()` calls) ages out the spend
 * entirely (unlike spell slots, action spends never commit across turns).
 *
 * An attack action advertises `actions.spent: 1` with `endOfTurn` expiry.
 */

/** The attack scenario's group list (canonical ids, no directory prefix). */
const GROUPS = [
  'ability-scores',
  'proficiency',
  'action-economy',
  'free-actions',
  'core-events',
  'attacks'
];

const ACTIONS_SPENT = 'actions.spent';

function planned(instanceId: string, ruleId: string): PlannedRef {
  return { instanceId, ruleId };
}

describe('deriveActionPools over a real engine evaluation', () => {
  it('reports a planned attack as thisTurn, then as spent once the turn is ended', () => {
    const { modules, missing } = resolveModules(GROUPS);
    expect(missing, 'every rule group resolves to a module').toEqual([]);

    // Baseline: one action, none spent, nothing planned.
    const baseline = evaluate({ modules, inputFacts: {}, planned: [], committed: [] });
    expect(deriveActionPools(baseline.facts, baseline.effects)).toEqual([
      { key: 'actions', total: 1, open: 1, thisTurn: 0, spent: 0 },
      { key: 'bonusActions', total: 1, open: 1, thisTurn: 0, spent: 0 },
      { key: 'reactions', total: 1, open: 1, thisTurn: 0, spent: 0 }
    ]);

    // Plan an unarmed strike attack. It is not committed — the turn has not ended.
    const attack = evaluate({
      modules,
      inputFacts: {},
      planned: [planned('a1', 'unarmed-strike-use-action')],
      committed: []
    });
    expect(attack.status.legal, 'attacking is a legal plan').toBe(true);

    // The engine really advertises the action spend, which is what the derivation counts.
    const actionSpends = attack.effects.filter((e) => e.state?.[ACTIONS_SPENT] !== undefined);
    expect(actionSpends).toHaveLength(1);
    expect(actionSpends[0]!.state?.[ACTIONS_SPENT]).toBe(1);
    expect(actionSpends[0]!.expiry).toEqual({ kind: 'endOfTurn' });

    expect(deriveActionPools(attack.facts, attack.effects)).toEqual([
      { key: 'actions', total: 1, open: 0, thisTurn: 1, spent: 1 },
      { key: 'bonusActions', total: 1, open: 1, thisTurn: 0, spent: 0 },
      { key: 'reactions', total: 1, open: 1, thisTurn: 0, spent: 0 }
    ]);

    // --- End the turn exactly as the store does: age this turn's advertised
    // effects into the committed set, then re-evaluate with an empty plan.
    const committed = endTurn([], attack.effects);
    const afterEndTurn = evaluate({ modules, inputFacts: {}, planned: [], committed });

    // Unlike spell slots, action spends are NOT committed across turns —
    // `endOfTurn` effects age out and actions are refreshed at turn start
    // (the action-economy rule sets `actions.spent: 0` each turn).
    expect(
      committed.some((e) => e.state?.[ACTIONS_SPENT] === 1),
      'action spends are not committed across turns'
    ).toBe(false);
    expect(afterEndTurn.effects.some((e) => e.state?.[ACTIONS_SPENT] !== undefined)).toBe(false);

    expect(deriveActionPools(afterEndTurn.facts, afterEndTurn.effects)).toEqual([
      { key: 'actions', total: 1, open: 1, thisTurn: 0, spent: 0 },
      { key: 'bonusActions', total: 1, open: 1, thisTurn: 0, spent: 0 },
      { key: 'reactions', total: 1, open: 1, thisTurn: 0, spent: 0 }
    ]);
  });
});
