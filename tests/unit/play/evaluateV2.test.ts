import { describe, it, expect } from 'vitest';
import { evaluateCharacterV2, hypotheticalOffers } from '$lib/play/evaluateV2';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine-v2';
import abilityScores from '$lib/rules-engine-v2/rules/ability-scores';
import actionEconomy from '$lib/rules-engine-v2/rules/action-economy';
import attacks from '$lib/rules-engine-v2/rules/attacks';

/**
 * M4/W4 — the store's v2 evaluation entry point, exercised with the real rule
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

describe('evaluateCharacterV2', () => {
  it('produces facts, offers, panels, planned legality, and advertised effects', () => {
    const out = evaluateCharacterV2(MODULES, [STR16], [attack]);

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
    const out = evaluateCharacterV2(MODULES, [STR16], [
      attack,
      { instanceId: 'a2', ruleId: 'unarmed-strike-use-action' }
    ]);
    const byId = Object.fromEntries(out.plannedEntries.map((e) => [e.instanceId, e]));
    expect(byId['a1'].legal).toBe(true);
    expect(byId['a2'].legal).toBe(false); // no action left for the second swing
  });

  it('hypotheticalOffers evaluates the plan minus each item, keyed by instance', () => {
    const map = hypotheticalOffers(MODULES, [STR16], [attack]);
    expect(map.has('a1')).toBe(true);
    // Removing the only attack → the offer is legal again in that hypothetical.
    const entry = map.get('a1')!.find((e) => e.rule.id === 'unarmed-strike-use-action');
    expect(entry?.legal).toBe(true);
  });
});
