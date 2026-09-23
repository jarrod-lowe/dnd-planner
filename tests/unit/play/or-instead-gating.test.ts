import { describe, it, expect } from 'vitest';
import { hypotheticalOffers } from '$lib/play/evaluateCharacter';
import { evaluate } from '$lib/rules-engine';
import type { AvailableRuleEntry, PlannedRef } from '$lib/rules-engine';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import simpleActions from '$lib/rules-engine/rules/simple-actions';

/**
 * Regression: the OR INSTEAD panel's gating contract.
 *
 * Taking an alternative means the row's CURRENT option is not taken, so the
 * current option's advertised effects must not influence the alternative's
 * gates. More generally (the stated contract): an alternative's conditions are
 * calculated on the character state BEFORE the choice for the panel it is
 * listed in — the plan prefix ahead of that row, not "the plan minus that one
 * ref". A LATER row's spend happens after this row's choice, so it must not
 * gate this row's alternatives either.
 *
 * Fixture (real modules, no committed effects needed):
 *  - `dodge-action` (row 1) and `search-action` (row 2, a later row) each
 *    advertise `actions.spent: 1` (an endOfTurn spend).
 *  - `disengage-action` is the alternative under test — it sits in the same
 *    DEFEND/'evade' bucket as Dodge (what the OR INSTEAD panel lists for a
 *    Dodge row) and its `legalWhen` reads `actions.remaining > 0`, which the
 *    action spend flips. `action-economy` derives `actions.remaining` from the
 *    summed spend, completing the effect → gate chain.
 */

const MODULES = [actionEconomy, simpleActions];
const ALT_ID = 'disengage-action';

/** The alternative's catalog entry for a given plan (the engine seam). */
function catalogEntry(planned: PlannedRef[]): AvailableRuleEntry {
  const entry = evaluate({ modules: MODULES, planned }).availableRules.find(
    (e) => e.rule.id === ALT_ID
  );
  if (!entry) throw new Error(`${ALT_ID} missing from the offer catalog`);
  return entry;
}

/** The alternative's entry in one row's hypothetical (OR INSTEAD) catalog. */
function hypotheticalEntry(map: Map<string, AvailableRuleEntry[]>, instanceId: string) {
  const entry = map.get(instanceId)?.find((e) => e.rule.id === ALT_ID);
  if (!entry) throw new Error(`${ALT_ID} missing from the hypothetical catalog of ${instanceId}`);
  return entry;
}

/** The fields the OR INSTEAD panel renders: legality and its diagnostics. */
function gate(entry: AvailableRuleEntry) {
  return { legal: entry.legal, applicable: entry.applicable, diagnostics: entry.diagnostics };
}

describe('hypotheticalOffers gates OR INSTEAD alternatives on the pre-choice state', () => {
  it("fixture check: the row's advertised spend really flips the alternative's gate", () => {
    // If Dodge's spend did not close Disengage's gate, the assertions below
    // would be vacuous — this pins the effect → gate chain the bug rides on.
    const before = catalogEntry([]);
    const withDodge = catalogEntry([{ instanceId: 'row-1', ruleId: 'dodge-action' }]);
    expect(before.legal).toBe(true);
    expect(withDodge.legal).toBe(false);
    expect(withDodge.diagnostics.length).toBeGreaterThan(0);
  });

  it("a row's own advertised effect does not gate its alternatives (own-row exclusion)", () => {
    const row1: PlannedRef = { instanceId: 'row-1', ruleId: 'dodge-action' };
    const map = hypotheticalOffers(MODULES, [], [row1]);

    // The alternative must read as if Dodge were NOT taken: the empty-plan
    // catalog is exactly that state.
    expect(gate(hypotheticalEntry(map, 'row-1'))).toEqual(gate(catalogEntry([])));
  });

  // CONFLICT NOTE: the code and docs describe minus-one semantics —
  // RULES_ENGINE_V2_M4_PLAN.md:79 "v2's `evaluatePlan` over the plan minus one
  // ref", and evaluateCharacter.ts's own comment "one hypothetical evaluation
  // per planned item, with that item removed". Minus-one still folds LATER
  // rows into an earlier row's hypothetical. The user-stated contract is
  // pre-choice: the state before this row's choice, which excludes later rows
  // (they are chosen after it). This test pins the pre-choice semantics.
  it("a LATER row's advertised effect does not gate an earlier row's alternatives (pre-choice prefix)", () => {
    const row1: PlannedRef = { instanceId: 'row-1', ruleId: 'dodge-action' };
    const row2: PlannedRef = { instanceId: 'row-2', ruleId: 'search-action' };
    const map = hypotheticalOffers(MODULES, [], [row1, row2]);

    // Row 1's alternatives must be gated on the state before row 1's choice:
    // neither row1 nor row2 taken — the empty-plan catalog.
    expect(gate(hypotheticalEntry(map, 'row-1'))).toEqual(gate(catalogEntry([])));

    // Control (semantics-independent): row 2's pre-choice state includes row
    // 1's spend either way, so its alternatives stay illegal under both the
    // minus-one and pre-choice readings — the fix must only change earlier
    // rows' views.
    expect(gate(hypotheticalEntry(map, 'row-2'))).toEqual(gate(catalogEntry([row1])));
    expect(hypotheticalEntry(map, 'row-2').legal).toBe(false);
  });
});
