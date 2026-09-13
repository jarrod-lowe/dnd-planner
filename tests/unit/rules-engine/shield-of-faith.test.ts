import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, evaluateOffers, endTurn } from '$lib/rules-engine';
import type { Facts, OfferEntry, PlannedRef } from '$lib/rules-engine';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import ac from '$lib/rules-engine/rules/ac';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import concentration from '$lib/rules-engine/rules/concentration';
import shieldOfFaith from '$lib/rules-engine/rules/shield-of-faith';

/**
 * Shield of Faith — a Level 1 bonus-action concentration ward (+2 AC for 10
 * rounds). Same shape as Bless/Protection from Evil and Good (prepare path +
 * L1–5 slot cascade + concentration-holding effect), with one addition: the buff
 * contributes `ac.miscBonus` 2, so the sheet's AC rises while it lives.
 *
 * SRD 5.2 targets "a creature of your choice within range"; the app tracks only
 * the character's own AC, so the module models the SELF cast (the ally cast is
 * world state it does not track).
 */
const ALL = [actionEconomy, ac, spellcasting, concentration, shieldOfFaith];
// Paladin L1 kit: two L1 slots, Shield of Faith prepared, Dex +2 (AC 12 naked).
const PREPARED: Facts = {
  'spellcasting.slots.level1.total': 2,
  'spell.l1.shieldOfFaith.prepared': 1,
  'dex.modifier': 2
};
const UNPREPARED: Facts = { 'spellcasting.slots.level1.total': 2, 'dex.modifier': 2 };

const cast = (instanceId: string, target?: number): PlannedRef => ({
  instanceId,
  ruleId: 'cast-shield-of-faith',
  ...(target !== undefined ? { selections: { target } } : {})
});

const offer = (facts: Facts, id: string): OfferEntry | undefined =>
  evaluateOffers(ALL, facts).find((o) => o.id === id);
const hasCode = (diags: { code: string }[] | undefined, suffix: string): boolean =>
  diags?.some((d) => d.code.endsWith(suffix)) ?? false;

describe('shield-of-faith — structural gate', () => {
  it('omits the cast offer until Shield of Faith is prepared', () => {
    expect(offer(evaluateSheet(ALL, UNPREPARED), 'cast-shield-of-faith')).toBeUndefined();
    expect(offer(evaluateSheet(ALL, PREPARED), 'cast-shield-of-faith')).toBeDefined();
  });
});

describe('shield-of-faith — casting', () => {
  it('spends a bonus action, the turn spell, and one L1 slot, raising AC by 2 this turn', () => {
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    expect(planDiagnostics.get('c1')).toBeUndefined();
    expect(facts['bonusActions.remaining']).toBe(0);
    expect(facts['spellcasting.remaining']).toBe(0);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(1); // 2 - 1
    expect(facts['concentration.remaining']).toBe(0); // the ward holds it
    // The buff effect contributes ac.miscBonus 2 and the fold re-derives AC with
    // it, so the +2 lands the SAME turn the spell is cast.
    expect(facts['ac.value']).toBe(14); // 10 base + 2 dex + 2 ward
  });

  it('casts on an ally: spends the slot and holds concentration but grants no self AC', () => {
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1', 0)]);
    expect(planDiagnostics.get('c1')).toBeUndefined();
    expect(facts['bonusActions.remaining']).toBe(0);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(1); // 2 - 1
    expect(facts['concentration.remaining']).toBe(0); // still concentrating — on the ally's ward
    expect(facts['ac.value']).toBe(12); // 10 base + 2 dex; the +2 lives on the ally (untracked)
  });

  it('flags a second planned cast illegal-but-visible (already concentrating)', () => {
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1'), cast('c2')]);
    expect(hasCode(planDiagnostics.get('c2'), 'already_concentrating')).toBe(true);
    // Planned-anyway rows still execute, so the projection shows the over-commit:
    // both wards' effects fold and AC reads +4. The error is the player's signal.
    expect(facts['ac.value']).toBe(16);
  });

  it('flags a cast with no slots remaining illegal (no_slots)', () => {
    const noSlots: Facts = { 'spell.l1.shieldOfFaith.prepared': 1, 'dex.modifier': 2 };
    const { planDiagnostics } = evaluatePlan(ALL, noSlots, [cast('c1')]);
    expect(hasCode(planDiagnostics.get('c1'), 'no_slots')).toBe(true);
  });
});

describe('shield-of-faith — effect lifetimes', () => {
  it('across a normal turn: the cost resets, the slot stays spent, AC stays raised', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const next = evaluateSheet(ALL, PREPARED, endTurn([], advertised, { longRest: false }));
    expect(next['bonusActions.remaining']).toBe(1); // endOfTurn cost gone → reset
    expect(next['spellcasting.slots.level1.remaining']).toBe(1); // untilLongRest → still spent
    expect(next['ac.value']).toBe(14); // the ward carries into the next turn
  });

  it('the ward persists across quiet turns — no round counting, only rests (or dismissal) end it', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    let committed = endTurn([], advertised, { longRest: false });
    expect(evaluateSheet(ALL, PREPARED, committed)['ac.value']).toBe(14);

    // Ten minutes is impractical to count in combat rounds, so the ward carries
    // across any number of quiet turns; the user dismisses it when it lapses and
    // any rest (always 10+ minutes) clears it.
    for (let i = 0; i < 12; i++) committed = endTurn(committed, [], { longRest: false });
    expect(evaluateSheet(ALL, PREPARED, committed)['ac.value']).toBe(14);
    expect(evaluateSheet(ALL, PREPARED, committed)['concentration.remaining']).toBe(0);
  });

  it('ends the ward and restores the slot on a long rest, before the duration', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const afterLong = evaluateSheet(ALL, PREPARED, endTurn([], advertised, { longRest: true }));
    expect(afterLong['ac.value']).toBe(12); // ward dismissed by the rest
    expect(afterLong['spellcasting.slots.level1.remaining']).toBe(2); // slot restored
  });

  it('ends the ward on a short rest too (multi-predicate expiry)', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const afterShort = evaluateSheet(ALL, PREPARED, endTurn([], advertised, { shortRest: true }));
    expect(afterShort['ac.value']).toBe(12);
  });
});
