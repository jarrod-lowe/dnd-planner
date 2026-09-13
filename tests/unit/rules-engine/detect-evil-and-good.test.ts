import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, evaluateOffers, endTurn } from '$lib/rules-engine';
import type { Facts, OfferEntry, PlannedRef } from '$lib/rules-engine';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import concentration from '$lib/rules-engine/rules/concentration';
import detectEvilAndGood from '$lib/rules-engine/rules/detect-evil-and-good';

/**
 * Detect Evil and Good — a Level 1 action concentration divination (10
 * minutes). Structurally the same shape as Protection from Evil and Good:
 * prepare path + L1–5 slot cascade + a cast that spends an action, the turn
 * spell, and a slot, holding concentration via `effect-detect-evil-and-good`
 * (`[turns 10, untilShortRest]`). Everything the spell SENSES (aberrations,
 * celestials, elementals, fey, fiends, undead, Hallow within 30 ft) is world
 * state the app does not track, so the effect is a pure concentration-holding
 * marker — descriptive, like Protection's ward.
 */
const ALL = [actionEconomy, spellcasting, concentration, detectEvilAndGood];
// Paladin L1 kit: two L1 slots + Detect Evil and Good prepared.
const PREPARED: Facts = {
  'spellcasting.slots.level1.total': 2,
  'spell.l1.detectEvilAndGood.prepared': 1
};
const UNPREPARED: Facts = { 'spellcasting.slots.level1.total': 2 };

const cast = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'cast-detect-evil-and-good'
});

const offer = (facts: Facts): OfferEntry | undefined =>
  evaluateOffers(ALL, facts).find((o) => o.id === 'cast-detect-evil-and-good');
const hasCode = (diags: { code: string }[] | undefined, suffix: string): boolean =>
  diags?.some((d) => d.code.endsWith(suffix)) ?? false;

describe('detect-evil-and-good — structural gate', () => {
  it('omits the cast offer until Detect Evil and Good is prepared', () => {
    expect(offer(evaluateSheet(ALL, UNPREPARED))).toBeUndefined();
    expect(offer(evaluateSheet(ALL, PREPARED))).toBeDefined();
  });
});

describe('detect-evil-and-good — casting', () => {
  it('spends the action, the turn spell, and one L1 slot, holding concentration', () => {
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    expect(planDiagnostics.get('c1')).toBeUndefined();
    expect(facts['actions.remaining']).toBe(0);
    expect(facts['spellcasting.remaining']).toBe(0);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(1); // 2 - 1
    expect(facts['concentration.remaining']).toBe(0);
  });

  it('flags a second planned cast illegal-but-visible (already concentrating)', () => {
    const { planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1'), cast('c2')]);
    expect(hasCode(planDiagnostics.get('c2'), 'already_concentrating')).toBe(true);
  });

  it('flags a cast with no slots remaining illegal (no_slots)', () => {
    const noSlots: Facts = { 'spell.l1.detectEvilAndGood.prepared': 1 };
    const { planDiagnostics } = evaluatePlan(ALL, noSlots, [cast('c1')]);
    expect(hasCode(planDiagnostics.get('c1'), 'no_slots')).toBe(true);
  });
});

describe('detect-evil-and-good — effect lifetimes', () => {
  it('across a normal turn: the cost resets, the slot stays spent, concentration holds', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const next = evaluateSheet(ALL, PREPARED, endTurn([], advertised, { longRest: false }));
    expect(next['actions.remaining']).toBe(1); // endOfTurn cost gone → reset
    expect(next['spellcasting.slots.level1.remaining']).toBe(1); // untilLongRest → still spent
    expect(next['concentration.remaining']).toBe(0); // still sensing
  });

  it('ends on any rest, before the duration (multi-predicate expiry)', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const afterLong = evaluateSheet(ALL, PREPARED, endTurn([], advertised, { longRest: true }));
    expect(afterLong['concentration.remaining']).toBe(1); // ward released
    expect(afterLong['spellcasting.slots.level1.remaining']).toBe(2); // slot restored
    const afterShort = evaluateSheet(ALL, PREPARED, endTurn([], advertised, { shortRest: true }));
    expect(afterShort['concentration.remaining']).toBe(1);
  });
});
