import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import findSteed, { steedEffect } from '$lib/rules-engine/rules/find-steed';
import actionEconomy from '$lib/rules-engine/rules/action-economy';

const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });
const maxModifier = (n: number): EffectInstance => ({
  id: 'effect-steed-hp-modifier-max',
  key: 'effect-steed-hp-modifier-max',
  state: { 'companion.steed.hp.modifier.max': n },
  expiry: { kind: 'permanent' }
});

describe('steed current HP is capped at the derived max', () => {
  it('a negative max-HP modifier lowers current HP with it (no impossible 25/15)', () => {
    // Summoned celestial steed at L2: base 25 HP. A −10 max modifier drops the
    // max to 15; current must follow the max, not stay at base.
    const facts = evaluateSheet([findSteed], {}, [steedEffect(2, 0), maxModifier(-10)]);
    expect(facts['companion.steed.hp.max']).toBe(15);
    expect(facts['companion.steed.hp.current']).toBe(15); // capped at max, not 25
  });
});

describe('Dismiss Steed is a real HANDLE action', () => {
  const offers = findSteed.offer!({ selections: {} });
  const dismiss = offers.find((o) => o.id === 'offer-dismiss-steed');

  it('uses a valid verb (so the picker keeps it) and costs an action', () => {
    if (!dismiss?.ui) throw new Error('dismiss offer with a ui payload expected');
    // ACTION was not in the Verb union; HANDLE is (the picker drops unknown verbs).
    expect(dismiss.ui.intents).toEqual({ HANDLE: 'steed' });
    expect(dismiss.ui.actionCost).toEqual(['action']);
  });

  it('spends the action and is illegal with none remaining', () => {
    // Summon a steed; dismissing it spends the player's action.
    const out = evaluatePlan(
      [actionEconomy, findSteed],
      {},
      [ref('i0', 'offer-dismiss-steed')],
      [steedEffect(2, 0)]
    );
    expect(out.facts['actions.remaining']).toBe(0); // action spent
    expect(out.planDiagnostics.has('i0')).toBe(false); // legal while an action remained

    // With the action already gone (a committed spend), dismiss is illegal.
    const noAction: EffectInstance = {
      id: 'spent',
      state: { 'actions.spent': 1 },
      expiry: { kind: 'endOfTurn' }
    };
    const blocked = evaluatePlan(
      [actionEconomy, findSteed],
      {},
      [ref('i0', 'offer-dismiss-steed')],
      [steedEffect(2, 0), noAction]
    );
    expect(blocked.planDiagnostics.get('i0')?.some((d) => d.code.includes('no_action'))).toBe(true);
  });
});
