import { describe, it, expect } from 'vitest';
import { evaluate, evaluateSheet, evaluatePlan, evaluateOffers, endTurn } from '$lib/rules-engine';
import { NOTICE_TARGET } from '$lib/rules-engine';
import type { Facts, OfferEntry, PlannedRef } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import attacks from '$lib/rules-engine/rules/attacks';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import searingSmite from '$lib/rules-engine/rules/searing-smite';
import spear from '$lib/rules-engine/rules/spear';

/**
 * Searing Smite — a Level 1 bonus-action smite cast after a melee hit (extra
 * 1d6 fire on the hit; 1d6/turn burn with a CON save to end, living on the
 * target). Same resource mechanics as Thunderous Smite — prepare path + L1–5
 * slot cascade + a cast that spends a bonus action, the turn spell, and a slot —
 * but deliberately NOT concentration: SRD 5.2 gives Searing Smite a flat
 * 1-minute duration (no Concentration tag), so the module spends no
 * `concentration`; the ongoing burn is a 10-round marker effect carrying the
 * per-turn fire dice, while the target's CON save (a success ends it early)
 * remains untracked world state — the user dismisses the chip.
 */
const ALL = [actionEconomy, attacks, spellcasting, searingSmite, spear];
// Paladin L1 kit: two L1 slots + Searing Smite prepared, spear in hand.
const PREPARED: Facts = {
  'spellcasting.slots.level1.total': 2,
  'spell.l1.searingSmite.prepared': 1,
  'weapon.spear.equipped': 1
};
const UNPREPARED: Facts = { 'spellcasting.slots.level1.total': 2, 'weapon.spear.equipped': 1 };

/** A spear opportunity attack — a melee hit that spends the REACTION. */
const reaction = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'spear-use-reaction-weapon'
});
/** An unarmed strike — the Attack action and a melee hit. */
const unarmed = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'unarmed-strike-use-action'
});
const cast = (instanceId: string, slotLevel?: number): PlannedRef => ({
  instanceId,
  ruleId: 'cast-searing-smite',
  ...(slotLevel ? { selections: { slotLevel } } : {})
});

const offer = (facts: Facts, id: string): OfferEntry | undefined =>
  evaluateOffers(ALL, facts).find((o) => o.id === id);
const hasCode = (diags: { code: string }[] | undefined, suffix: string): boolean =>
  diags?.some((d) => d.code.endsWith(suffix)) ?? false;

describe('searing-smite — structural gate', () => {
  it('omits the cast offer until Searing Smite is prepared', () => {
    expect(offer(evaluateSheet(ALL, UNPREPARED), 'cast-searing-smite')).toBeUndefined();
    expect(offer(evaluateSheet(ALL, PREPARED), 'cast-searing-smite')).toBeDefined();
  });
});

describe('searing-smite — casting', () => {
  it('spends a bonus action, the turn spell, and one L1 slot after a melee hit', () => {
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [unarmed('a1'), cast('c1')]);
    expect(planDiagnostics.get('c1')).toBeUndefined();
    expect(facts['bonusActions.remaining']).toBe(0);
    expect(facts['spellcasting.remaining']).toBe(0);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(1); // 2 - 1
  });

  it('is NOT concentration, but leaves a 10-round burn marker (SRD 5.2 flat duration)', () => {
    const { advertised, facts } = evaluatePlan(ALL, PREPARED, [unarmed('a1'), cast('c1')]);
    // The per-turn cost, the slot spend, and the burn marker — no concentration.
    const fromCast = advertised.filter((e) => e.id.startsWith('c1#'));
    expect(fromCast).toHaveLength(3);
    expect(fromCast.some((e) => JSON.stringify(e.state).includes('concentration'))).toBe(false);
    expect(fromCast.some((e) => e.id.includes('effect-searing-smite-slot'))).toBe(true);
    // And no fact the concentration group would own is ever written.
    expect(facts['concentration.spent'] ?? 0).toBe(0);
  });

  it('the burn marker carries the roll — dice count follows the slot level', () => {
    const L3: Facts = {
      'spellcasting.slots.level3.total': 1,
      'spell.l1.searingSmite.prepared': 1,
      'attack.last.melee': 1
    };
    const { facts } = evaluatePlan(ALL, L3, [cast('c1', 3)]);
    expect(facts['ssmite.burnDice']).toBe(3); // 3d6 fire/turn for a slot-3 cast
  });

  it("keeps each burn's dice on its own effect — two targets, two slot levels", () => {
    const TWO: Facts = {
      'spellcasting.slots.level1.total': 1,
      'spellcasting.slots.level3.total': 1,
      'spell.l1.searingSmite.prepared': 1,
      'attack.last.melee': 1
    };
    // The second cast is bonus-action-starved (planned anyway) but still
    // advertises its burn — the two chips must each carry their OWN dice,
    // not the summed fact.
    const { advertised } = evaluatePlan(ALL, TWO, [cast('c1'), cast('c2', 3)]);
    const burns = advertised.filter((e) => e.id.split('#').pop() === 'effect-searing-smite');
    expect(burns).toHaveLength(2);
    expect(burns.map((e) => (e.display as { value?: number }).value ?? 0).sort()).toEqual([1, 3]);
  });

  it('the burn ages out after its 10-round duration (1 minute)', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [unarmed('a1'), cast('c1')]);
    let committed = endTurn([], advertised, { longRest: false }); // 9 rounds left
    for (let i = 0; i < 8; i++) committed = endTurn(committed, [], { longRest: false });
    // Nine quiet turns in: still burning (a successful target save would have
    // the user dismiss the chip early).
    expect(evaluateSheet(ALL, PREPARED, committed)['ssmite.burnDice']).toBe(1);
    committed = endTurn(committed, [], { longRest: false }); // the 10th drops it
    expect(evaluateSheet(ALL, PREPARED, committed)['ssmite.burnDice'] ?? 0).toBe(0);
  });

  it('is illegal without a melee attack first (no_attack)', () => {
    const { planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    expect(hasCode(planDiagnostics.get('c1'), 'no_attack')).toBe(true);
  });

  it('is legal after a spear opportunity attack — melee hit, no Attack action', () => {
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [reaction('r1'), cast('c1')]);
    expect(facts['attack.last.melee']).toBe(1);
    expect(facts['attack.last.activation.action'] ?? 0).toBe(0);
    expect(planDiagnostics.get('c1')).toBeUndefined();
  });

  it('upcasts to a chosen higher slot (+1d6 per level above 1)', () => {
    const UP: Facts = {
      'spellcasting.slots.level2.total': 1,
      'spell.l1.searingSmite.prepared': 1,
      'weapon.spear.equipped': 1
    };
    const { facts, planDiagnostics } = evaluatePlan(ALL, UP, [unarmed('a1'), cast('c1', 2)]);
    expect(planDiagnostics.get('c1')).toBeUndefined();
    expect(facts['spellcasting.slots.level2.remaining']).toBe(0);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(0); // untouched (none owned)
    // The slider/dice default tracks the lowest available slot: 1 die at L1,
    // +1 per level above → 2 at L2.
    expect(evaluateSheet(ALL, UP)['ssmite.defaultDieCount']).toBe(2);
  });

  it('flags a cast with no slots remaining illegal (no_slots)', () => {
    const noSlots: Facts = { 'spell.l1.searingSmite.prepared': 1, 'weapon.spear.equipped': 1 };
    const { planDiagnostics } = evaluatePlan(ALL, noSlots, [unarmed('a1'), cast('c1')]);
    expect(hasCode(planDiagnostics.get('c1'), 'no_slots')).toBe(true);
  });
});

describe('searing-smite — annotation', () => {
  it('annotates melee attacks only while actually castable, handing the player the row', () => {
    // Prepared but no melee hit yet: the reminder would offer an illegal row.
    const before = evaluate({ modules: ALL, inputFacts: PREPARED, planned: [] });
    expect(before.annotations.some((a) => a.key === 'rule.spell-searing-smite.annotation')).toBe(
      false
    );

    const after = evaluate({
      modules: ALL,
      inputFacts: PREPARED,
      planned: [unarmed('a1')]
    });
    const ann = after.annotations.find((a) => a.key === 'rule.spell-searing-smite.annotation');
    expect(ann?.targets).toEqual(['attack.melee', 'attack.unarmed']);
    expect(ann?.addsToPlan).toEqual({ offer: 'cast-searing-smite' });
  });

  it('the reminder withdraws once the slot (or bonus action) is spent', () => {
    const after = evaluate({
      modules: ALL,
      inputFacts: PREPARED,
      planned: [unarmed('a1'), cast('c1')]
    });
    expect(after.annotations.some((a) => a.key === 'rule.spell-searing-smite.annotation')).toBe(
      false
    );
  });
});

describe('searing-smite — burning notice', () => {
  /**
   * Notices plan, Phase 3 — a live burn raises a NOTICE: source eyebrow (the
   * spell name) + label + a body sentence interpolating ONLY the save DC.
   * `ssmite.burnDice` folds `combine: 'sum'`, so burns on several targets would
   * read as one wrong number — the dice deliberately never enter the string
   * (plan Decisions table); per-target dice live on each effect chip.
   */
  const R = 'rule.spell-searing-smite';
  // The flat-dotted en body template, as sveltekit-i18n flattens it. The cast
  // goes through unknown: the nested catalog mixes leaf strings and sub-objects.
  const enSmite = (enCommon.rule as unknown as Record<string, Record<string, string | undefined>>)[
    'spell-searing-smite'
  ];
  const enBody = enSmite?.['notice-burning.body'];

  it('a committed burn raises a notice carrying the spell save DC', () => {
    const out = evaluate({
      modules: ALL,
      inputFacts: PREPARED,
      planned: [unarmed('a1'), cast('c1')]
    });
    expect(out.facts['ssmite.burnDice'], 'the burn is live in this state').toBe(1);
    const notice = out.annotations.find((a) => a.key === `${R}.notice-burning`);
    expect(notice, 'notice exists while a burn is live').toBeDefined();
    expect(notice!.targets).toEqual([NOTICE_TARGET]);
    expect(notice!.source).toBe(`${R}.offer-searing-smite.name`);
    expect(notice!.body).toBe(`${R}.notice-burning.body`);
    expect(notice!.values).toEqual({ dc: out.facts['spellcasting.saveDC'] });
  });

  it('the en body template interpolates only the DC — no dice placeholder', () => {
    expect(enBody, 'en body template exists').toBeDefined();
    // {{dc}} double-brace (sveltekit-i18n), and it is the ONLY param: any dice
    // placeholder here would render the summed burnDice as one wrong number.
    expect(enBody?.match(/{{[a-zA-Z]+}}/g)).toEqual(['{{dc}}']);
  });

  it('no notice while nothing burns', () => {
    const before = evaluate({
      modules: ALL,
      inputFacts: PREPARED,
      planned: [unarmed('a1')]
    });
    expect(before.facts['ssmite.burnDice'] ?? 0).toBe(0);
    expect(
      before.annotations.some((a) => a.key === `${R}.notice-burning`),
      'no burn committed, no notice'
    ).toBe(false);
  });

  /**
   * Notices-rolls plan, Phase 3 — the burn notice carries its per-turn fire
   * dice as a structured `roll` (the player rolls THEM at each burning turn's
   * start; the target's save is the target's). The dice still never enter the
   * body string — `roll` is the dice channel, `values` stays text-only.
   */
  it("a committed burn carries the notice's per-turn fire dice as a roll", () => {
    const out = evaluate({
      modules: ALL,
      inputFacts: PREPARED,
      planned: [unarmed('a1'), cast('c1')]
    });
    expect(out.facts['ssmite.burnDice'], 'the burn is live in this state').toBe(1);
    const notice = out.annotations.find((a) => a.key === `${R}.notice-burning`);
    expect(notice, 'notice exists while a burn is live').toBeDefined();
    expect(notice!.roll).toEqual({ sides: 6, count: 1, damageType: 'fire', purpose: 'damage' });
  });

  it('two concurrent burns sum their dice on the roll — the d6s are one fungible pool', () => {
    // Two slot-1 casts (the second is bonus-action-starved but planned anyway,
    // and still advertises its burn — see the two-targets test above): two
    // level-1 burns fold `ssmite.burnDice` to 2, and the notice hands the
    // player both dice as one 2d6 roll to split across the burning targets.
    const out = evaluate({
      modules: ALL,
      inputFacts: PREPARED,
      planned: [unarmed('a1'), cast('c1'), cast('c2')]
    });
    expect(out.facts['ssmite.burnDice'], 'both burns are live').toBe(2);
    const notice = out.annotations.find((a) => a.key === `${R}.notice-burning`);
    expect(notice).toBeDefined();
    expect(notice!.roll).toEqual({ sides: 6, count: 2, damageType: 'fire', purpose: 'damage' });
  });
});
