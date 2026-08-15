import { describe, it, expect } from 'vitest';
import { evaluate, evaluatePlan, endTurn } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import hitDie from '$lib/rules-engine/rules/hit-die';
import hp from '$lib/rules-engine/rules/hp';

/**
 * Hit dice spent on a recorded short rest. The offer's dice control feeds
 * rolled values through `selections.rolls` (`{ d10: { '0': 6 } }` — slot index
 * → NATURAL roll); `apply` heals `max(1, roll + con.modifier)` per rolled slot
 * (capped at the missing HP, the record-heal pattern) and spends the die, one
 * removable untilLongRest chip per rolled slot that carries BOTH the heal and
 * the die spend (so removing a chip refunds the die with the HP).
 */
const rest = (instanceId: string, rolls: Record<string, Record<string, number>>): PlannedRef => ({
  instanceId,
  ruleId: 'record-short-rest',
  selections: { rolls }
});

const damage = (instanceId: string, amount: number): PlannedRef => ({
  instanceId,
  ruleId: 'record-damage',
  selections: { amount }
});

/** A hit die spent on an earlier turn (untilLongRest, ages out on a long rest). */
const spentDie = (n: number, count: number): EffectInstance => ({
  id: `prior-spend-d${n}`,
  state: { [`hitDie.d${n}.spent`]: count },
  expiry: { kind: 'untilLongRest' }
});

/** Damage taken on an earlier turn, so there are missing HP to heal into. */
const damageTaken = (amount: number): EffectInstance => ({
  id: 'prior-damage',
  state: { 'hp.modifier.current': -amount },
  expiry: { kind: 'untilLongRest' }
});

const healChips = (advertised: EffectInstance[]): EffectInstance[] =>
  advertised.filter((e) => e.id.includes('effect-hit-die-heal'));

describe('record-short-rest hit-dice control', () => {
  it('carries one pool per hit-die size, driven by hitDie facts', () => {
    const out = evaluate({ modules: [coreEvents, hitDie] });
    const offer = out.availableRules.find((r) => r.rule.id === 'record-short-rest');
    expect(offer).toBeDefined();
    const control = offer!.rule.ui?.primaryControl as Record<string, unknown>;
    expect(control.type).toBe('hit-dice');
    expect(control.bonus).toEqual({ fact: 'con.modifier' });
    expect(control.pools).toEqual([
      { sides: 6, total: { fact: 'hitDie.d6.total' }, remaining: { fact: 'hitDie.d6.remaining' } },
      { sides: 8, total: { fact: 'hitDie.d8.total' }, remaining: { fact: 'hitDie.d8.remaining' } },
      {
        sides: 10,
        total: { fact: 'hitDie.d10.total' },
        remaining: { fact: 'hitDie.d10.remaining' }
      },
      {
        sides: 12,
        total: { fact: 'hitDie.d12.total' },
        remaining: { fact: 'hitDie.d12.remaining' }
      }
    ]);
  });
});

describe('spending hit dice on a short rest', () => {
  const modules = [coreEvents, hitDie, hp];

  it('heals max(1, roll + con.modifier) and spends the die', () => {
    const { facts, advertised } = evaluatePlan(
      modules,
      { 'hitDie.d10.total': 1 },
      [rest('r1', { d10: { '0': 4 } })],
      [damageTaken(8)]
    );
    expect(facts['hitDie.d10.spent']).toBe(1);
    expect(facts['hp.modifier.current']).toBe(-4);
    expect(healChips(advertised)).toHaveLength(1);
  });

  it('floors a low roll at 1 HP per die (CON penalty cannot heal 0)', () => {
    const { facts } = evaluatePlan(
      modules,
      { 'hitDie.d10.total': 1, 'con.modifier': -3 },
      [rest('r1', { d10: { '0': 1 } })],
      [damageTaken(8)]
    );
    expect(facts['hp.modifier.current']).toBe(-7);
    expect(facts['hitDie.d10.spent']).toBe(1);
  });

  it('caps the total at the missing HP (record-heal pattern)', () => {
    const { facts } = evaluatePlan(modules, { 'hitDie.d10.total': 2 }, [
      damage('d1', 3),
      rest('r1', { d10: { '0': 6, '1': 6 } })
    ]);
    // 12 rolled healing, only 3 missing: the first die heals 3, the second 0 —
    // but BOTH dice are spent (5e: a spent die is spent even on wasted healing).
    expect(facts['hp.modifier.current']).toBe(0);
    expect(facts['hitDie.d10.spent']).toBe(2);
  });

  it('rejects a roll on an already-spent slot and spends nothing', () => {
    const { facts, planDiagnostics, advertised } = evaluatePlan(
      modules,
      { 'hitDie.d10.total': 2 },
      [rest('r1', { d10: { '1': 5 } })],
      [spentDie(10, 1)]
    );
    expect(facts['hitDie.d10.spent']).toBe(1);
    expect(healChips(advertised)).toHaveLength(0);
    expect(planDiagnostics.get('r1')?.map((d) => d.code)).toEqual([
      'rule.dnd-5e-2024.core-events.record-short-rest-offer.die_already_spent'
    ]);
  });

  it('rejects an out-of-range slot index, reported before an invalid roll', () => {
    // Slot 5 is past the 2-die pool AND the roll is 0: the slot check fires
    // first, so the diagnostic is invalid_slot alone (one diagnostic per slot).
    const { facts, planDiagnostics, advertised } = evaluatePlan(
      modules,
      { 'hitDie.d10.total': 2 },
      [rest('r1', { d10: { '5': 0 } })]
    );
    expect(facts['hitDie.d10.spent'] ?? 0).toBe(0);
    expect(healChips(advertised)).toHaveLength(0);
    expect(planDiagnostics.get('r1')?.map((d) => d.code)).toEqual([
      'rule.dnd-5e-2024.core-events.record-short-rest-offer.invalid_slot'
    ]);
  });

  it('rejects a zero or non-integer roll on a valid slot', () => {
    for (const roll of [0, 1.5]) {
      const { facts, planDiagnostics, advertised } = evaluatePlan(
        modules,
        { 'hitDie.d10.total': 1 },
        [rest('r1', { d10: { '0': roll } })],
        [damageTaken(8)]
      );
      expect(facts['hp.modifier.current']).toBe(-8);
      expect(facts['hitDie.d10.spent'] ?? 0).toBe(0);
      expect(healChips(advertised)).toHaveLength(0);
      expect(planDiagnostics.get('r1')?.map((d) => d.code)).toEqual([
        'rule.dnd-5e-2024.core-events.record-short-rest-offer.invalid_roll'
      ]);
    }
  });

  it('re-rolling a slot replaces the earlier result (no double heal or spend)', () => {
    const first = evaluatePlan(
      modules,
      { 'hitDie.d10.total': 1 },
      [rest('r1', { d10: { '0': 2 } })],
      [damageTaken(8)]
    );
    expect(first.facts['hp.modifier.current']).toBe(-6);
    // The plan re-evaluates from scratch on every selection change: the new roll
    // replaces the old slot value rather than stacking onto it.
    const second = evaluatePlan(
      modules,
      { 'hitDie.d10.total': 1 },
      [rest('r1', { d10: { '0': 7 } })],
      [damageTaken(8)]
    );
    expect(second.facts['hp.modifier.current']).toBe(-1);
    expect(second.facts['hitDie.d10.spent']).toBe(1);
    expect(healChips(second.advertised)).toHaveLength(1);
  });

  it('each rolled slot is one removable chip carrying its heal AND its die spend', () => {
    const { advertised } = evaluatePlan(
      modules,
      { 'hitDie.d10.total': 1 },
      [rest('r1', { d10: { '0': 4 } })],
      [damageTaken(8)]
    );
    const chip = healChips(advertised)[0]!;
    expect(chip.state).toEqual({ 'hp.modifier.current': 4, 'hitDie.d10.spent': 1 });
    expect(chip.expiry).toEqual({ kind: 'untilLongRest' });
    expect(chip.display?.value).toBe(4);
  });

  // The committed path: two dice rolled in ONE rest must remain independently
  // removable after End Turn commits them. The strip keys chips by effect.id and
  // removeEffect filters by exact id, so a shared id would (a) break the keyed
  // each with a duplicate-key error and (b) drop BOTH heals+spends at once.
  it('commits two dice from one rest with distinct ids; removing one chip keeps the other', () => {
    const { advertised } = evaluatePlan(
      modules,
      { 'hitDie.d10.total': 2 },
      [rest('r1', { d10: { '0': 4, '1': 5 } })],
      [damageTaken(20)]
    );
    const committed = endTurn([damageTaken(20)], advertised);
    const chips = healChips(committed);
    expect(chips).toHaveLength(2);
    // Distinct committed ids: no duplicate key for the strip's keyed each, and
    // an exact-id removal cannot sweep both.
    expect(new Set(chips.map((c) => c.id)).size).toBe(2);

    // playStore.removeEffect: filter the committed set by exact id, re-evaluate.
    const kept = committed.filter((e) => e.id !== chips[0]!.id);
    const after = evaluate({ modules, committed: kept });
    expect(after.facts['hitDie.d10.spent']).toBe(1);
    // 20 damage, heals 4 + 5; removing the 4-heal chip refunds it with the die.
    expect(after.facts['hp.modifier.current']).toBe(-15);
  });

  // A plan may carry rolls under a rule set lacking the hit-die group (the
  // character's groups changed after the plan was built). Mirror record-damage's
  // concentration guard: absent facts mean the rolls silently no-op — never a
  // spurious invalid_slot ERROR against a pool that does not exist.
  it('silently ignores rolls when the hit-die group is not loaded', () => {
    const { facts, planDiagnostics, advertised } = evaluatePlan(
      [coreEvents, hp],
      {},
      [rest('r1', { d10: { '0': 4 } })],
      [damageTaken(8)]
    );
    expect(planDiagnostics.get('r1')).toBeUndefined();
    expect(healChips(advertised)).toHaveLength(0);
    expect(facts['hp.modifier.current']).toBe(-8);
    expect(facts['hitDie.d10.spent'] ?? 0).toBe(0);
  });
});
