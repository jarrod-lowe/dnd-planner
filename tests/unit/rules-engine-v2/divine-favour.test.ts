import { describe, it, expect } from 'vitest';
import { evaluate, evaluateSheet, evaluatePlan, evaluateOffers, endTurn } from '$lib/rules-engine-v2';
import type { Facts, OfferEntry, PlannedRef } from '$lib/rules-engine-v2';
import actionEconomy from '$lib/rules-engine-v2/rules/action-economy';
import attacks from '$lib/rules-engine-v2/rules/attacks';
import spellcasting from '$lib/rules-engine-v2/rules/spellcasting';
import divineFavour from '$lib/rules-engine-v2/rules/divine-favour';

/**
 * Pre-M3 spike — Divine Favour end to end.
 *
 * Chosen because one rule exercises the whole v2 contract at once: a bonus-action
 * self-buff (cast offer), a free per-attack damage rider (use offer,
 * illegal-but-visible), a weapon-attack annotation, and — the point of the spike —
 * THREE effect lifetimes from a single action: the per-turn cost (`endOfTurn`),
 * the spent L1 slot (`untilLongRest`), and the buff itself (`turns`, the
 * duration). The fold makes the buff's `divineFavour.active` visible the SAME turn
 * (so a later `use` in the same plan is legal) and `endTurn` ages each lifetime
 * independently across turns.
 *
 * `prepared` is supplied as an input fact (the prepare/unprepare offers are M3
 * proper). One assertion deliberately PINS a known model gap: v1 ends the buff on
 * any rest, which the `turns` expiry cannot express — see the GAP test.
 */
const ALL = [actionEconomy, attacks, spellcasting, divineFavour];
// Paladin L1 kit for the spike: two L1 slots + Divine Favour prepared.
const PREPARED: Facts = {
  'spellcasting.slots.level1.total': 2,
  'spell.l1.divineFavour.prepared': 1
};
const UNPREPARED: Facts = { 'spellcasting.slots.level1.total': 2 };

const attack = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'unarmed-strike-use-action'
});
const cast = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'cast-divine-favour' });
const use = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'use-divine-favour' });

const offer = (facts: Facts, id: string): OfferEntry | undefined =>
  evaluateOffers(ALL, facts).find((o) => o.id === id);
const hasCode = (diags: { code: string }[] | undefined, suffix: string): boolean =>
  diags?.some((d) => d.code.endsWith(suffix)) ?? false;

describe('v2 divine-favour — structural gate', () => {
  it('omits the cast offer until Divine Favour is prepared (v1 `when`)', () => {
    expect(offer(evaluateSheet(ALL, UNPREPARED), 'cast-divine-favour')).toBeUndefined();
    expect(offer(evaluateSheet(ALL, PREPARED), 'cast-divine-favour')).toBeDefined();
  });

  it('always offers the use rider, illegal-but-visible even unprepared (matches v1)', () => {
    // v1 offer-use-divine-favour has no `when`: it is always present, gated only
    // by legalWhen (active + attack). So it shows up even with nothing prepared.
    const u = offer(evaluateSheet(ALL, UNPREPARED), 'use-divine-favour');
    expect(u).toBeDefined();
    expect(u!.legal).toBe(false);
    expect(hasCode(u!.diagnostics, 'not_active')).toBe(true);
  });
});

describe('v2 divine-favour — derive', () => {
  it('eligibleSlotsRemaining tracks L1 slots remaining (L1 only, no upcasting)', () => {
    expect(evaluateSheet(ALL, PREPARED)['divineFavour.eligibleSlotsRemaining']).toBe(2);
  });
});

describe('v2 divine-favour — casting', () => {
  it('spends a bonus action, the turn spell, and one L1 slot, lighting the buff this turn', () => {
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    expect(planDiagnostics.get('c1')).toBeUndefined(); // bonus + spell + slot all available
    expect(facts['bonusActions.remaining']).toBe(0);
    expect(facts['spellcasting.remaining']).toBe(0);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(1); // 2 - 1
    // The buff EFFECT contributes active=1 and the fold re-derives with it, so it
    // is visible the same turn — no direct numberSet needed (unlike v1).
    expect(facts['divineFavour.active']).toBe(1);
  });

  it('marks the cast offer illegal once active (no double-cast)', () => {
    const { facts } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const c = offer(facts, 'cast-divine-favour');
    expect(c!.legal).toBe(false);
    expect(hasCode(c!.diagnostics, 'already_active')).toBe(true);
  });

  it('flags a second planned cast illegal-but-visible (already active)', () => {
    const { planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1'), cast('c2')]);
    expect(hasCode(planDiagnostics.get('c2'), 'already_active')).toBe(true);
  });

  it('flags a cast with no slots remaining illegal (no_slots)', () => {
    const noSlots: Facts = { 'spell.l1.divineFavour.prepared': 1 }; // prepared, zero L1 slots
    const { planDiagnostics } = evaluatePlan(ALL, noSlots, [cast('c1')]);
    expect(hasCode(planDiagnostics.get('c1'), 'no_slots')).toBe(true);
  });
});

describe('v2 divine-favour — use rider (illegal-but-visible)', () => {
  it('is legal once the buff is active AND an attack was made (same turn)', () => {
    // attack → cast → use in one plan: `use` sees the cast buff via the fold.
    const { planDiagnostics } = evaluatePlan(ALL, PREPARED, [attack('a1'), cast('c1'), use('u1')]);
    expect(planDiagnostics.get('u1')).toBeUndefined();
  });

  it('is illegal without an attack, even while active (no_attack)', () => {
    const { planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1'), use('u1')]);
    expect(hasCode(planDiagnostics.get('u1'), 'no_attack')).toBe(true);
  });

  it('is illegal without the buff, even after an attack (not_active)', () => {
    const { planDiagnostics } = evaluatePlan(ALL, PREPARED, [attack('a1'), use('u1')]);
    expect(hasCode(planDiagnostics.get('u1'), 'not_active')).toBe(true);
  });

  it('advertises no effect — free and repeatable', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [
      attack('a1'),
      cast('c1'),
      use('u1'),
      use('u2')
    ]);
    const fromUses = advertised.filter((e) => e.id.startsWith('u1#') || e.id.startsWith('u2#'));
    expect(fromUses).toHaveLength(0);
  });
});

describe('v2 divine-favour — annotation', () => {
  it('annotates weapon attacks only while the buff is active', () => {
    const before = evaluate({ modules: ALL, inputFacts: PREPARED, planned: [] });
    expect(before.annotations.some((a) => a.key === 'rule.spell-divine-favour.annotation')).toBe(
      false
    );

    const after = evaluate({ modules: ALL, inputFacts: PREPARED, planned: [cast('c1')] });
    const ann = after.annotations.find((a) => a.key === 'rule.spell-divine-favour.annotation');
    expect(ann?.targets).toEqual(['attack.weapon']);
  });
});

describe('v2 divine-favour — effect lifetimes (the spike core)', () => {
  it('across a normal turn: the cost resets, the slot stays spent, the buff persists', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const afterTurn = endTurn([], advertised, { longRest: false });
    const next = evaluateSheet(ALL, PREPARED, afterTurn);

    expect(next['bonusActions.remaining']).toBe(1); // endOfTurn cost gone → reset
    expect(next['spellcasting.remaining']).toBe(1); // endOfTurn cost gone → reset
    expect(next['spellcasting.slots.level1.remaining']).toBe(1); // untilLongRest → still spent
    expect(next['divineFavour.active']).toBe(1); // turns buff → carries into next turn
  });

  it('the buff ages out after its 10-round duration', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    let committed = endTurn([], advertised, { longRest: false }); // round 1 ends → 9 left
    expect(evaluateSheet(ALL, PREPARED, committed)['divineFavour.active']).toBe(1);

    // Nine more quiet turns drain the remaining rounds; the 10th drops it.
    for (let i = 0; i < 9; i++) committed = endTurn(committed, [], { longRest: false });
    // `divineFavour.active` is contributed ONLY by the buff effect (no derive
    // defaults it to 0, matching v1). Once the buff is gone, nothing writes the
    // fact, so it is absent from the raw map — which the engine's FactReader reads
    // as 0 (how this module's own legalWhen/annotate see "inactive").
    expect(evaluateSheet(ALL, PREPARED, committed)['divineFavour.active'] ?? 0).toBe(0);
  });

  it('the spent slot restores on a long rest', () => {
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const afterRest = endTurn([], advertised, { longRest: true });
    expect(evaluateSheet(ALL, PREPARED, afterRest)['spellcasting.slots.level1.remaining']).toBe(2);
  });

  it('ends the buff on a rest, before its duration (multi-predicate expiry)', () => {
    // The buff ends when the EARLIEST predicate fires: 10 rounds OR any rest —
    // matching v1's `when rest.short == 0 && rest.long == 0`. (Was the pre-M3
    // KNOWN GAP, resolved by the multi-predicate Expiry + shortRest in M3 step 0.)
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const afterLong = endTurn([], advertised, { longRest: true });
    expect(evaluateSheet(ALL, PREPARED, afterLong)['divineFavour.active'] ?? 0).toBe(0);
    const afterShort = endTurn([], advertised, { shortRest: true });
    expect(evaluateSheet(ALL, PREPARED, afterShort)['divineFavour.active'] ?? 0).toBe(0);
  });
});
