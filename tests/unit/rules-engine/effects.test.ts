import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, endTurn } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef, RuleModule } from '$lib/rules-engine';

/**
 * M0 spike, increment 3a — declarative effects.
 *
 * Persistence is a value with an expiry, aged at end of turn — not a
 * self-advertising rule. An active effect simply CONTRIBUTES to the sheet (a
 * spent L1 slot adds +1 to `...spent`), so `remaining = max - spent` falls out of
 * the dataflow. This replaces the legacy `advertiseEffect self:true` re-advertisement.
 */
const spellcasting: RuleModule = {
  id: 'spellcasting',
  derive: () => [
    { fact: 'spellcasting.slots.level1.max', value: () => 2 },
    {
      fact: 'spellcasting.slots.level1.remaining',
      value: (f) =>
        f.num('spellcasting.slots.level1.max') - f.num('spellcasting.slots.level1.spent')
    }
  ]
};

// Knows how to apply a persisted "slot spent" effect.
const slotSpent: RuleModule = {
  id: 'slot-spent',
  effectContributions: (e) => [
    { fact: `spellcasting.slots.level${e.state!.level}.spent`, combine: 'sum', value: () => 1 }
  ]
};

const longRestSlot = (id: string, level: number): EffectInstance => ({
  id,
  ruleId: 'slot-spent',
  state: { level },
  expiry: { kind: 'untilLongRest' }
});

describe('declarative effects — persistent contributions with expiry', () => {
  const modules = [spellcasting, slotSpent];

  it('an active effect contributes to the sheet while it lives', () => {
    expect(evaluateSheet(modules, {}, [])['spellcasting.slots.level1.remaining']).toBe(2);
    expect(
      evaluateSheet(modules, {}, [longRestSlot('e1', 1)])['spellcasting.slots.level1.remaining']
    ).toBe(1);
    expect(
      evaluateSheet(modules, {}, [longRestSlot('e1', 1), longRestSlot('e2', 1)])[
        'spellcasting.slots.level1.remaining'
      ]
    ).toBe(0);
  });

  it('untilLongRest effects persist across a normal turn and expire on a long rest', () => {
    const committed = [longRestSlot('e1', 1)];

    const afterTurn = endTurn(committed, [], { longRest: false });
    expect(afterTurn).toHaveLength(1);
    expect(evaluateSheet(modules, {}, afterTurn)['spellcasting.slots.level1.remaining']).toBe(1);

    const afterRest = endTurn(committed, [], { longRest: true });
    expect(afterRest).toHaveLength(0);
    expect(evaluateSheet(modules, {}, afterRest)['spellcasting.slots.level1.remaining']).toBe(2);
  });

  it('a planned cast advertises a persistent effect honored on the next turn', () => {
    const caster: RuleModule = {
      id: 'caster',
      offer: () => [
        {
          id: 'cast-l1',
          legalWhen: [
            {
              condition: (f) => f.num('spellcasting.slots.level1.remaining') > 0,
              diagnostics: [{ code: 'no_slot', severity: 'error' }]
            }
          ],
          apply: () => ({ advertise: [longRestSlot('slot:1:x', 1)] })
        }
      ]
    };
    const all = [spellcasting, slotSpent, caster];
    const planned: PlannedRef[] = [{ instanceId: 'c1', ruleId: 'cast-l1' }];

    const { advertised } = evaluatePlan(all, {}, planned);
    expect(advertised).toHaveLength(1);

    const next = endTurn([], advertised, { longRest: false });
    expect(evaluateSheet(all, {}, next)['spellcasting.slots.level1.remaining']).toBe(1);
  });
});

/**
 * M3 / step 0 — short-rest + multi-predicate expiry.
 *
 * A duration spell ends when EITHER its clock runs out OR the caster rests (the legacy
 * Divine Favour buff re-advertised only `when rest.short == 0 && rest.long == 0`).
 * The pre-M3 spike surfaced that the single-predicate `Expiry` couldn't express
 * this. Expiry is now `Expiry | Expiry[]`: an array ends when the EARLIEST
 * predicate fires. `endTurn` also gains a `shortRest` flag; a long rest counts as
 * a short rest too (it grants the same benefits), so `untilShortRest` ends on
 * either.
 */
describe('endTurn — short rest + multi-predicate expiry', () => {
  // 10-round buff that also ends on any rest, keyed so re-casts replace.
  const buff = (remaining: number): EffectInstance => ({
    id: 'buff',
    key: 'b',
    state: { active: 1 },
    expiry: [{ kind: 'turns', remaining }, { kind: 'untilShortRest' }]
  });

  it('untilShortRest persists a normal turn, ends on a short rest, and on a long rest too', () => {
    const e: EffectInstance = { id: 's', state: { x: 1 }, expiry: { kind: 'untilShortRest' } };
    expect(endTurn([e], [], { longRest: false })).toHaveLength(1); // normal turn: kept
    expect(endTurn([e], [], { shortRest: true })).toHaveLength(0); // short rest: gone
    expect(endTurn([e], [], { longRest: true })).toHaveLength(0); // long rest includes a short rest
  });

  it('a multi-predicate effect ends on a rest before its duration elapses', () => {
    expect(endTurn([buff(10)], [], { shortRest: true })).toHaveLength(0);
  });

  it('a multi-predicate effect ages by turns when no rest happens, then expires', () => {
    let committed = [buff(3)];
    committed = endTurn(committed, [], { longRest: false }); // 3 -> 2
    expect(committed).toHaveLength(1);
    committed = endTurn(committed, [], { longRest: false }); // 2 -> 1
    expect(committed).toHaveLength(1);
    committed = endTurn(committed, [], { longRest: false }); // 1 -> 0: expires
    expect(committed).toHaveLength(0);
  });

  it('decrements the turns predicate and backfills the original total (for elapsed pips)', () => {
    const after1 = endTurn([buff(10)], [], { longRest: false });
    const expiry = after1[0].expiry;
    const preds = Array.isArray(expiry) ? expiry : [expiry];
    expect(preds.find((p) => p.kind === 'turns')).toEqual({
      kind: 'turns',
      remaining: 9,
      total: 10
    });

    // total records the authored duration — it does not track remaining.
    const after2 = endTurn(after1, [], { longRest: false });
    const expiry2 = after2[0].expiry;
    const preds2 = Array.isArray(expiry2) ? expiry2 : [expiry2];
    expect(preds2.find((p) => p.kind === 'turns')).toEqual({
      kind: 'turns',
      remaining: 8,
      total: 10
    });
  });

  it('preserves single-predicate shape (backward compatible)', () => {
    const after1 = endTurn(
      [{ id: 't', state: { x: 1 }, expiry: { kind: 'turns', remaining: 2 } }],
      [],
      {}
    );
    // still a single object, total backfilled
    expect(after1[0].expiry).toEqual({ kind: 'turns', remaining: 1, total: 2 });
  });
});

/**
 * M3 — rest model. A rest applies the moment it is recorded: a `rest.long` /
 * `rest.short` fact (core-events' recorders advertise it) makes the sheet exclude
 * that rest's scoped effects in the SAME evaluation, so resources read as
 * restored immediately (an in-evaluation rest); `endTurn` then drops
 * them, driven by the same flag. A long rest counts as a short rest too. The
 * explicit endTurn param stays for direct callers.
 */
describe('rest model — recorded rest restores in-eval and ages at endTurn', () => {
  const spentSlot: EffectInstance = {
    id: 'slot',
    state: { 'res.spent': 1 },
    expiry: { kind: 'untilLongRest' }
  };
  const shortBuff: EffectInstance = {
    id: 'buff',
    state: { 'b.active': 1 },
    expiry: { kind: 'untilShortRest' }
  };
  const longRestFlag: EffectInstance = {
    id: 'rest',
    state: { 'rest.long': 1 },
    expiry: { kind: 'endOfTurn' }
  };
  const shortRestFlag: EffectInstance = {
    id: 'rest',
    state: { 'rest.short': 1 },
    expiry: { kind: 'endOfTurn' }
  };

  it('excludes untilLongRest effects in the evaluation a long rest is recorded', () => {
    expect(evaluateSheet([], {}, [spentSlot])['res.spent']).toBe(1); // no rest: spent stands
    expect(evaluateSheet([], {}, [spentSlot, longRestFlag])['res.spent'] ?? 0).toBe(0); // restored
  });

  it('a short rest restores untilShortRest effects but not untilLongRest ones', () => {
    const facts = evaluateSheet([], {}, [shortBuff, spentSlot, shortRestFlag]);
    expect(facts['b.active'] ?? 0).toBe(0); // short-scoped buff gone
    expect(facts['res.spent']).toBe(1); // a slot survives a short rest
  });

  it('a long rest also restores untilShortRest effects (long includes short)', () => {
    expect(evaluateSheet([], {}, [shortBuff, longRestFlag])['b.active'] ?? 0).toBe(0);
  });

  it('endTurn drops rest-scoped effects from a recorded rest flag (no explicit param)', () => {
    const next = endTurn([spentSlot], [longRestFlag]);
    expect(next.some((e) => e.id === 'slot')).toBe(false);
  });

  it('still honors the explicit longRest param (direct callers)', () => {
    expect(endTurn([spentSlot], [], { longRest: true }).some((e) => e.id === 'slot')).toBe(false);
  });
});
