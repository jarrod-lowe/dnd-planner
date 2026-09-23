import { describe, it, expect } from 'vitest';
import { evaluateCharacter, hypotheticalOffers, factsBeforeRow } from '$lib/play/evaluateCharacter';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import abilityScores from '$lib/rules-engine/rules/ability-scores';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import attacks from '$lib/rules-engine/rules/attacks';
import speciesHuman from '$lib/rules-engine/rules/species-human';
import movement from '$lib/rules-engine/rules/movement';

/**
 * The store's evaluation entry point, exercised with the real rule
 * modules: modules + committed effects + plan → the adapted bundle the UI consumes.
 */

const MODULES = [abilityScores, actionEconomy, attacks];
// STR 16 as a committed build effect (what a set-strength offer would have advertised).
const STR16: EffectInstance = {
  id: 'effect-str',
  key: 'str-value-base',
  state: { 'str.value': 16 },
  stateCombine: { 'str.value': 'override' },
  expiry: { kind: 'permanent' }
};
const attack: PlannedRef = { instanceId: 'a1', ruleId: 'unarmed-strike-use-action' };

describe('evaluateCharacter', () => {
  it('produces facts, offers, panels, planned legality, and advertised effects', () => {
    const out = evaluateCharacter(MODULES, [STR16], [attack]);

    // Facts: the committed build effect + module derives.
    expect(out.facts['str.value']).toBe(16);
    expect(out.facts['str.modifier']).toBe(3);
    expect(out.facts['attack.unarmed.hitBonus']).toBe(3); // STR +3 (+0 proficiency here)

    // Offer catalog carries the unarmed strike.
    expect(out.availableRules.some((e) => e.rule.id === 'unarmed-strike-use-action')).toBe(true);

    // Planned instance: legal (an action is available), with its instanceId.
    expect(out.plannedEntries.map((e) => e.instanceId)).toEqual(['a1']);
    expect(out.plannedEntries[0].legal).toBe(true);

    // Panels: abilities in the top bar; actions pool in resources.
    expect(out.topBarEntries.some((e) => e.type === 'ability')).toBe(true);
    expect(out.resourceEntries.some((e) => e.label === 'play.stats.actions')).toBe(true);

    // The swing advertises the action spend for the End-Turn commit.
    expect(out.advertised.some((e) => e.state?.['actions.spent'] === 1)).toBe(true);
  });

  it('flags an over-committed second attack as illegal per instance', () => {
    const out = evaluateCharacter(
      MODULES,
      [STR16],
      [attack, { instanceId: 'a2', ruleId: 'unarmed-strike-use-action' }]
    );
    const byId = Object.fromEntries(out.plannedEntries.map((e) => [e.instanceId, e]));
    expect(byId['a1'].legal).toBe(true);
    expect(byId['a2'].legal).toBe(false); // no action left for the second swing
  });

  it('hypotheticalOffers evaluates the plan prefix ahead of each item, keyed by instance', () => {
    const map = hypotheticalOffers(MODULES, [STR16], [attack]);
    expect(map.has('a1')).toBe(true);
    // The only row's prefix is the empty plan → the offer is legal there.
    const entry = map.get('a1')!.find((e) => e.rule.id === 'unarmed-strike-use-action');
    expect(entry?.legal).toBe(true);
  });
});

/**
 * `factsBeforeRow` — the facts at a row's POSITION in the fold, for capture-var
 * resolution at add/swap time (the seam the store's `captureSelections` uses).
 * A row must open on the prefix (committed + earlier rows): its own spend — and
 * every later row's — happens after its choice, so neither may reach the facts
 * its default is read from. Same prefix semantics `hypotheticalOffers` gives the
 * OR INSTEAD panel (#438), but returning the view facts.
 *
 * Fixture: real `species-human` (speed 30) + `movement` modules, a Walk row
 * spending 15 via its `distance` selection.
 */
describe('factsBeforeRow', () => {
  const MOVE_MODULES = [speciesHuman, movement];
  const REMAINING = 'character.movement.remaining';
  const walk = (instanceId: string, distance: number): PlannedRef => ({
    instanceId,
    ruleId: 'move-walk',
    selections: { distance }
  });

  it("index 0 of [Walk 15] excludes the row's own spend — remaining is the full 30", () => {
    const facts = factsBeforeRow(MOVE_MODULES, [], [walk('w1', 15)], 0);
    expect(facts[REMAINING]).toBe(30);
  });

  it("index 1 of [Walk 15, Walk 10] counts earlier rows but not the row's own", () => {
    const facts = factsBeforeRow(MOVE_MODULES, [], [walk('w1', 15), walk('w2', 10)], 1);
    // Row 1's prefix is [Walk 15]: 30 − 15 spent. Row 1's own 10 never enters.
    expect(facts[REMAINING]).toBe(15);
  });

  it('index 0 of an empty plan is the committed-only state', () => {
    // A committed spend from a prior turn (e.g. a durable Dash-style boost's
    // cost shape is out of scope; a plain permanent spent contribution pins
    // that `committed` flows into the prefix the same way the fold uses it).
    const SPENT10: EffectInstance = {
      id: 'effect-spent',
      state: { 'character.movement.spent': 10 },
      expiry: { kind: 'permanent' }
    };
    const facts = factsBeforeRow(MOVE_MODULES, [SPENT10], [], 0);
    expect(facts[REMAINING]).toBe(20);
  });
});
