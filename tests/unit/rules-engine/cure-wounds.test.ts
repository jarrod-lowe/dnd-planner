import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, evaluateOffers } from '$lib/rules-engine';
import type { Facts, OfferEntry, PlannedRef } from '$lib/rules-engine';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import cureWounds from '$lib/rules-engine/rules/cure-wounds';

/**
 * Cure Wounds — a Level 1 action heal (2d8 + spellcasting modifier, +2d8 per
 * slot level above 1). The Prayer of Healing resource shape (prepare path +
 * slot cascade + a cast that spends an action, the turn spell, and a slot) with
 * the Lay on Hands heal-offer conventions on the panel (hp unit, captured
 * values, natural-roll + modifier dice display).
 *
 * The healing lands on the touched CREATURE — world state the app does not
 * track (the Prayer of Healing precedent), so the cast advertises no HP effect:
 * a self-heal is recorded separately through the core-events heal recorder.
 */
const ALL = [actionEconomy, spellcasting, cureWounds];
// Paladin L1 kit: two L1 slots + Cure Wounds prepared, CHA +3 (the spellcasting
// modifier the heal dice add).
const PREPARED: Facts = {
  'spellcasting.slots.level1.total': 2,
  'spell.l1.cureWounds.prepared': 1,
  'spellcasting.modifier': 3
};
const UNPREPARED: Facts = { 'spellcasting.slots.level1.total': 2, 'spellcasting.modifier': 3 };

const cast = (instanceId: string, slotLevel?: number): PlannedRef => ({
  instanceId,
  ruleId: 'cast-cure-wounds',
  ...(slotLevel ? { selections: { slotLevel } } : {})
});

const offer = (facts: Facts): OfferEntry | undefined =>
  evaluateOffers(ALL, facts).find((o) => o.id === 'cast-cure-wounds');
const hasCode = (diags: { code: string }[] | undefined, suffix: string): boolean =>
  diags?.some((d) => d.code.endsWith(suffix)) ?? false;

describe('cure-wounds — structural gate', () => {
  it('omits the cast offer until Cure Wounds is prepared', () => {
    expect(offer(evaluateSheet(ALL, UNPREPARED))).toBeUndefined();
    expect(offer(evaluateSheet(ALL, PREPARED))).toBeDefined();
  });
});

describe('cure-wounds — casting', () => {
  it('spends the action, the turn spell, and one L1 slot — and no HP effect', () => {
    const { facts, planDiagnostics, advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    expect(planDiagnostics.get('c1')).toBeUndefined();
    expect(facts['actions.remaining']).toBe(0);
    expect(facts['spellcasting.remaining']).toBe(0);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(1); // 2 - 1
    // Only the per-turn cost and the slot spend: the healing itself lands on the
    // touched creature (untracked), not on any fact this sheet derives.
    const fromCast = advertised.filter((e) => e.id.startsWith('c1#'));
    expect(fromCast).toHaveLength(2);
    expect(JSON.stringify(fromCast)).not.toContain('hp.');
  });

  it('upcasts to a chosen higher slot (+2d8 per level above 1)', () => {
    const UP: Facts = {
      'spellcasting.slots.level2.total': 1,
      'spell.l1.cureWounds.prepared': 1,
      'spellcasting.modifier': 3
    };
    expect(evaluateSheet(ALL, UP)['cureWounds.maxCastLevel']).toBe(2); // slider ceiling
    const { facts, planDiagnostics } = evaluatePlan(ALL, UP, [cast('c1', 2)]);
    expect(planDiagnostics.get('c1')).toBeUndefined();
    expect(facts['spellcasting.slots.level2.remaining']).toBe(0);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(0); // untouched (none owned)
  });

  it('the slot default floors at L1 after the slot is spent, so the dice stay 2d8', () => {
    // Prayer of Healing's precedent: lowestAvailableSlotLevel floors at the
    // spell's base level once no slot remains, or the healing dice count
    // (2 × slotLevel) would collapse after the cast.
    const ONE: Facts = {
      'spellcasting.slots.level1.total': 1,
      'spell.l1.cureWounds.prepared': 1,
      'spellcasting.modifier': 3
    };
    const { facts } = evaluatePlan(ALL, ONE, [cast('c1')]);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(0);
    expect(facts['cureWounds.lowestAvailableSlotLevel']).toBe(1);
  });

  it('flags a cast with no slots remaining illegal (no_slots)', () => {
    const noSlots: Facts = { 'spell.l1.cureWounds.prepared': 1, 'spellcasting.modifier': 3 };
    const { planDiagnostics } = evaluatePlan(ALL, noSlots, [cast('c1')]);
    expect(hasCode(planDiagnostics.get('c1'), 'no_slots')).toBe(true);
  });
});
