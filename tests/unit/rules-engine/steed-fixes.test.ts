import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, endTurn } from '$lib/rules-engine';
import type { EffectInstance, FactReader, PlannedRef } from '$lib/rules-engine';
import findSteed, { steedEffect } from '$lib/rules-engine/rules/find-steed';
import actionEconomy from '$lib/rules-engine/rules/action-economy';

const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });
const plainFacts = (facts: Record<string, number>): FactReader => ({
  num: (k) => facts[k] ?? 0,
  has: (k) => k in facts
});
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

describe('steed summon level persists', () => {
  it('the permanent steed effect carries companion.steed.summonLevel', () => {
    // An L4 summon must expose its level on the permanent state so the slam /
    // healing rollers read it on later turns (not the endOfTurn cast fact).
    const facts = evaluateSheet([findSteed], {}, [steedEffect(4, 0)]);
    expect(facts['companion.steed.summonLevel']).toBe(4);
  });

  it('slam damage and healing-touch read the persistent summon level', () => {
    const offers = findSteed.offer!({ selections: {} });
    const slam = offers.find((o) => o.id === 'steed-slam');
    expect(slam?.vars?.damageBonus).toEqual({
      capture: true,
      default: { fact: 'companion.steed.summonLevel' }
    });
    const heal = offers.find((o) => o.id === 'steed-healing-touch');
    // Healing Touch (celestial) rolls 2d8 + the summon level.
    expect(heal?.ui?.primaryControl).toEqual({
      type: 'dice-line',
      dice: [{ sides: 8, count: 2, bonus: { var: 'spellLevel' }, purpose: 'healing' }]
    });
    expect(heal?.vars?.spellLevel).toEqual({
      capture: true,
      default: { fact: 'companion.steed.summonLevel' }
    });
  });
});

describe('recasting Find Steed evicts the old steed HP records', () => {
  it('a recast advertises the same child-key evictions dismissing does', () => {
    const offers = findSteed.offer!({ selections: {} });
    const cast = offers.find((o) => o.id === 'cast-find-steed');
    // Prepared + an L2 slot so the cast is legal; celestial default.
    const result = cast!.apply!(
      plainFacts({ 'spell.l2.findSteed.prepared': 1, 'find-steed.defaultLevel': 2 }),
      {}
    );
    const evicted = (result.advertise ?? [])
      .filter((e) => e.id.startsWith('evict-'))
      .map((e) => e.key);
    // The damage/heal/modifier child keys are cleared so a new steed starts fresh.
    expect(evicted).toContain('effect-steed-hp-damage');
    expect(evicted).toContain('effect-steed-hp-heal');
    expect(evicted).toContain('effect-steed-hp-modifier-max');
    expect(evicted).toContain('effect-steed-hp-modifier-current');
  });
});

describe('a steed reduced to 0 HP dies and stays dead through a long rest', () => {
  const damage = (amount: number): PlannedRef => ({
    instanceId: 'i0',
    ruleId: 'steed-record-damage',
    selections: { amount }
  });

  it('lethal recorded damage retires the steed, and a long rest does not revive it', () => {
    const committed = [steedEffect(2, 0)]; // L2 celestial: 25 base HP
    const out = evaluatePlan([findSteed], {}, [damage(25)], committed);
    // Retired now: not summoned, marked dismissed, no longer active.
    expect(out.facts['companion.steed.summoned']).toBe(0);
    expect(out.facts['companion.steed.dismissed']).toBe(1);
    expect(out.facts['companion.steed.active'] ?? 0).toBe(0);

    // A long rest expires the untilLongRest damage records; the permanent retire
    // marker must outlast them so the dead steed does NOT revive.
    const next = endTurn(committed, out.advertised, { longRest: true });
    const revived = evaluateSheet([findSteed], {}, next);
    expect(revived['companion.steed.summoned']).toBe(0);
    expect(revived['companion.steed.active'] ?? 0).toBe(0);
  });

  it('non-lethal damage keeps the steed, and a long rest restores its HP', () => {
    const committed = [steedEffect(2, 0)];
    const out = evaluatePlan([findSteed], {}, [damage(10)], committed);
    expect(out.facts['companion.steed.summoned']).toBe(1);
    expect(out.facts['companion.steed.hp.current']).toBe(15);

    const next = endTurn(committed, out.advertised, { longRest: true });
    const rested = evaluateSheet([findSteed], {}, next);
    expect(rested['companion.steed.summoned']).toBe(1);
    expect(rested['companion.steed.hp.current']).toBe(25); // healed to full on a long rest
  });
});

describe('steed damage subtracts from the capped max HP, not the raw base', () => {
  const damage = (amount: number): PlannedRef => ({
    instanceId: 'i0',
    ruleId: 'steed-record-damage',
    selections: { amount }
  });
  // L2 celestial (base 25) with a -10 max modifier: 15/15, not 25/15.
  const committed = [steedEffect(2, 0), maxModifier(-10)];

  it('subtracts damage from the reduced max (15 - 5 = 10, not clamped 25 - 5 = 20 → 15)', () => {
    const out = evaluatePlan([findSteed], {}, [damage(5)], committed);
    expect(out.facts['companion.steed.hp.max']).toBe(15);
    expect(out.facts['companion.steed.hp.current']).toBe(10);
    expect(out.facts['companion.steed.summoned']).toBe(1);
  });

  it('retires the steed when damage reaches the reduced max (15 damage on a 15-HP steed)', () => {
    const out = evaluatePlan([findSteed], {}, [damage(15)], committed);
    expect(out.facts['companion.steed.hp.current']).toBe(0);
    expect(out.facts['companion.steed.summoned']).toBe(0);
    expect(out.facts['companion.steed.dismissed']).toBe(1);
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

describe('steed healing offsets any missing HP, like the player recorder', () => {
  const currentModifier = (n: number): EffectInstance => ({
    id: 'effect-steed-hp-modifier-current',
    key: 'effect-steed-hp-modifier-current',
    state: { 'companion.steed.hp.modifier.current': n },
    expiry: { kind: 'permanent' }
  });
  const heal = (amount: number): PlannedRef => ({
    instanceId: 'i0',
    ruleId: 'steed-record-heal',
    selections: { amount }
  });

  it('a heal offsets HP lost to a manual current modifier (15/25 → 25/25), capped at missing', () => {
    // L2 celestial (25 base). A manual −10 current modifier makes it 15/25 with NO
    // recorded damage. Like the player heal recorder, healing must offset the net
    // missing HP — not cap at damageRecorded (0), which would record nothing.
    const committed = [steedEffect(2, 0), currentModifier(-10)];
    expect(evaluateSheet([findSteed], {}, committed)['companion.steed.hp.current']).toBe(15);

    const out = evaluatePlan([findSteed], {}, [heal(15)], committed);
    // Capped at the 10 missing HP (no overheal banking), restoring full HP.
    expect(out.facts['companion.steed.hp.healRecorded']).toBe(10);
    expect(out.facts['companion.steed.hp.current']).toBe(25);
  });
});

describe('steed current HP follows a raised max, like the player', () => {
  const damage = (amount: number): PlannedRef => ({
    instanceId: 'i0',
    ruleId: 'steed-record-damage',
    selections: { amount }
  });
  const heal = (amount: number): PlannedRef => ({
    instanceId: 'i1',
    ruleId: 'steed-record-heal',
    selections: { amount }
  });

  it('a positive max modifier raises current with it (35/35, not an unfillable 25/35)', () => {
    // Player parity: hp.current = hp.max + min(0, modifier.current), so raising
    // the max (Aid-style) raises current too — the same as the player's hp rule.
    const committed = [steedEffect(2, 0), maxModifier(10)];
    const facts = evaluateSheet([findSteed], {}, committed);
    expect(facts['companion.steed.hp.max']).toBe(35);
    expect(facts['companion.steed.hp.current']).toBe(35);
  });

  it('damage and healing work against the raised max (35 → 30 → 35)', () => {
    const committed = [steedEffect(2, 0), maxModifier(10)];
    const damaged = evaluatePlan([findSteed], {}, [damage(5)], committed);
    expect(damaged.facts['companion.steed.hp.current']).toBe(30);

    const healed = evaluatePlan([findSteed], {}, [damage(5), heal(5)], committed);
    expect(healed.facts['companion.steed.hp.current']).toBe(35);
  });
});
