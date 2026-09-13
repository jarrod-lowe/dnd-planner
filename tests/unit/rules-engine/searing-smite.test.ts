import { describe, it, expect } from 'vitest';
import { evaluate, evaluateSheet, evaluatePlan, evaluateOffers } from '$lib/rules-engine';
import type { Facts, OfferEntry, PlannedRef } from '$lib/rules-engine';
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
 * 1-minute duration (no Concentration tag), so the module must neither spend
 * `concentration` nor advertise any self-effect for the ongoing burn (the
 * target's saves are untracked world state, like Thunderous Smite's push).
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

  it('is NOT concentration: no self effect, no concentration spend (SRD 5.2 flat duration)', () => {
    const { advertised, facts } = evaluatePlan(ALL, PREPARED, [unarmed('a1'), cast('c1')]);
    // Only the per-turn cost and the slot spend — the ongoing burn lives on the
    // TARGET (untracked), so nothing of it lands on this sheet.
    const fromCast = advertised.filter((e) => e.id.startsWith('c1#'));
    expect(fromCast).toHaveLength(2);
    expect(fromCast.some((e) => JSON.stringify(e.state).includes('concentration'))).toBe(false);
    expect(fromCast.some((e) => e.id.includes('effect-searing-smite-slot'))).toBe(true);
    // And no fact the concentration group would own is ever written.
    expect(facts['concentration.spent'] ?? 0).toBe(0);
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
