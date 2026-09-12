import { describe, it, expect } from 'vitest';
import { evaluate, evaluateSheet, evaluatePlan, evaluateOffers, endTurn } from '$lib/rules-engine';
import type { Facts, OfferEntry, PlannedRef } from '$lib/rules-engine';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import attacks from '$lib/rules-engine/rules/attacks';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import divineFavour from '$lib/rules-engine/rules/divine-favour';
import spear from '$lib/rules-engine/rules/spear';

/**
 * Pre-M3 spike — Divine Favour end to end.
 *
 * Chosen because one rule exercises the whole module contract at once: a bonus-action
 * self-buff (cast offer), a free per-attack damage rider (use offer,
 * illegal-but-visible), a weapon-attack annotation, and — the point of the spike —
 * THREE effect lifetimes from a single action: the per-turn cost (`endOfTurn`),
 * the spent L1 slot (`untilLongRest`), and the buff itself (`turns`, the
 * duration). The fold makes the buff's `divineFavour.active` visible the SAME turn
 * (so a later `use` in the same plan is legal) and `endTurn` ages each lifetime
 * independently across turns.
 *
 * `prepared` is supplied as an input fact (the prepare/unprepare offers are M3
 * proper). One assertion deliberately PINS a known model gap: the legacy engine ended the buff on
 * any rest, which the `turns` expiry cannot express — see the GAP test.
 */
const ALL = [actionEconomy, attacks, spellcasting, divineFavour, spear];
// Paladin L1 kit for the spike: two L1 slots + Divine Favour prepared, spear in
// hand (the rider rides on WEAPON attacks, so the fixture needs a weapon).
const PREPARED: Facts = {
  'spellcasting.slots.level1.total': 2,
  'spell.l1.divineFavour.prepared': 1,
  'weapon.spear.equipped': 1
};
const UNPREPARED: Facts = { 'spellcasting.slots.level1.total': 2, 'weapon.spear.equipped': 1 };

/** A spear swing with the Attack action — a weapon attack. */
const attack = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'spear-use-action'
});
/** A spear opportunity attack — a weapon attack that spends the REACTION. */
const reaction = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'spear-use-reaction-weapon'
});
/** An unarmed strike — the Attack action, but NOT a weapon attack. */
const unarmed = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'unarmed-strike-use-action'
});
const cast = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'cast-divine-favour' });
const use = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'use-divine-favour' });

const offer = (facts: Facts, id: string): OfferEntry | undefined =>
  evaluateOffers(ALL, facts).find((o) => o.id === id);
const hasCode = (diags: { code: string }[] | undefined, suffix: string): boolean =>
  diags?.some((d) => d.code.endsWith(suffix)) ?? false;

describe('divine-favour — structural gate', () => {
  it('omits the cast offer until Divine Favour is prepared', () => {
    expect(offer(evaluateSheet(ALL, UNPREPARED), 'cast-divine-favour')).toBeUndefined();
    expect(offer(evaluateSheet(ALL, PREPARED), 'cast-divine-favour')).toBeDefined();
  });

  it('always offers the use rider, illegal-but-visible even unprepared', () => {
    // The legacy offer-use-divine-favour had no `when`: it is always present, gated only
    // by legalWhen (active + attack). So it shows up even with nothing prepared.
    const u = offer(evaluateSheet(ALL, UNPREPARED), 'use-divine-favour');
    expect(u).toBeDefined();
    expect(u!.legal).toBe(false);
    expect(hasCode(u!.diagnostics, 'not_active')).toBe(true);
  });
});

describe('divine-favour — derive', () => {
  it('eligibleSlotsRemaining tracks L1 slots remaining (L1 only, no upcasting)', () => {
    expect(evaluateSheet(ALL, PREPARED)['divineFavour.eligibleSlotsRemaining']).toBe(2);
  });
});

describe('divine-favour — casting', () => {
  it('spends a bonus action, the turn spell, and one L1 slot, lighting the buff this turn', () => {
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    expect(planDiagnostics.get('c1')).toBeUndefined(); // bonus + spell + slot all available
    expect(facts['bonusActions.remaining']).toBe(0);
    expect(facts['spellcasting.remaining']).toBe(0);
    expect(facts['spellcasting.slots.level1.remaining']).toBe(1); // 2 - 1
    // The buff EFFECT contributes active=1 and the fold re-derives with it, so it
    // is visible the same turn — no direct write needed.
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

describe('divine-favour — use rider (illegal-but-visible)', () => {
  it('is legal once the buff is active AND a weapon attack was made (same turn)', () => {
    // attack → cast → use in one plan: `use` sees the cast buff via the fold.
    const { planDiagnostics } = evaluatePlan(ALL, PREPARED, [attack('a1'), cast('c1'), use('u1')]);
    expect(planDiagnostics.get('u1')).toBeUndefined();
  });

  it('is legal after a weapon REACTION, with no Attack action taken at all', () => {
    // SRD 5.2: "your attacks with weapons deal an extra 1d4 Radiant damage on a
    // hit" — no Attack-action qualifier. An Opportunity Attack is "one melee
    // attack with a weapon", so the spear branch of one carries the rider.
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [
      cast('c1'),
      reaction('r1'),
      use('u1')
    ]);
    expect(facts['attack.last.weapon']).toBe(1);
    expect(facts['attack.last.activation.action'] ?? 0).toBe(0); // no Attack action
    expect(facts['actions.remaining']).toBe(1);
    expect(planDiagnostics.get('u1')).toBeUndefined();
  });

  it('is illegal after an unarmed strike alone — not a weapon attack (no_attack)', () => {
    // An Unarmed Strike is not a weapon ("A weapon is an object that is in the
    // Simple or Martial weapon category"), so it earns no 1d4 — even though it
    // IS the Attack action.
    const { facts, planDiagnostics } = evaluatePlan(ALL, PREPARED, [
      cast('c1'),
      unarmed('a1'),
      use('u1')
    ]);
    expect(facts['attack.last.activation.action']).toBe(1); // the Attack action WAS taken
    expect(facts['attack.last.weapon'] ?? 0).toBe(0); // but no weapon attack
    expect(hasCode(planDiagnostics.get('u1'), 'no_attack')).toBe(true);
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

describe('divine-favour — annotation', () => {
  it('annotates weapon attacks only while the buff is active AND a weapon attack was made', () => {
    const before = evaluate({ modules: ALL, inputFacts: PREPARED, planned: [] });
    expect(before.annotations.some((a) => a.key === 'rule.spell-divine-favour.annotation')).toBe(
      false
    );

    // Buff up but no weapon attack yet: the reminder would offer an action that
    // is still illegal, so it stays away (the gates must agree exactly).
    const buffedOnly = evaluate({ modules: ALL, inputFacts: PREPARED, planned: [cast('c1')] });
    expect(
      buffedOnly.annotations.some((a) => a.key === 'rule.spell-divine-favour.annotation')
    ).toBe(false);

    const after = evaluate({
      modules: ALL,
      inputFacts: PREPARED,
      planned: [cast('c1'), attack('a1')]
    });
    const ann = after.annotations.find((a) => a.key === 'rule.spell-divine-favour.annotation');
    expect(ann?.targets).toEqual(['attack.weapon']);
  });

  it('the reminder adds the rider to the plan (its gate matches the offer exactly)', () => {
    const after = evaluate({
      modules: ALL,
      inputFacts: PREPARED,
      planned: [cast('c1'), attack('a1')]
    });
    const ann = after.annotations.find((a) => a.key === 'rule.spell-divine-favour.annotation');
    expect(ann?.addsToPlan).toEqual({ offer: 'use-divine-favour' });
  });
});

describe('divine-favour — effect lifetimes (the spike core)', () => {
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
    // defaults it to 0). Once the buff is gone, nothing writes the
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
    // the legacy re-advertise guard was `when rest.short == 0 && rest.long == 0`. (Was the pre-M3
    // KNOWN GAP, resolved by the multi-predicate Expiry + shortRest in M3 step 0.)
    const { advertised } = evaluatePlan(ALL, PREPARED, [cast('c1')]);
    const afterLong = endTurn([], advertised, { longRest: true });
    expect(evaluateSheet(ALL, PREPARED, afterLong)['divineFavour.active'] ?? 0).toBe(0);
    const afterShort = endTurn([], advertised, { shortRest: true });
    expect(evaluateSheet(ALL, PREPARED, afterShort)['divineFavour.active'] ?? 0).toBe(0);
  });
});
