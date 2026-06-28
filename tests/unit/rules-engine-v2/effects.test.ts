import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, endTurn } from '$lib/rules-engine-v2';
import type { EffectInstance, PlannedRef, RuleModule } from '$lib/rules-engine-v2';

/**
 * M0 spike, increment 3a — declarative effects.
 *
 * Persistence is a value with an expiry, aged at end of turn — not a
 * self-advertising rule. An active effect simply CONTRIBUTES to the sheet (a
 * spent L1 slot adds +1 to `...spent`), so `remaining = max - spent` falls out of
 * the dataflow. This replaces v1's `advertiseEffect self:true` re-advertisement.
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

describe('v2 declarative effects — persistent contributions with expiry', () => {
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
 * A duration spell ends when EITHER its clock runs out OR the caster rests (v1's
 * Divine Favour buff re-advertised only `when rest.short == 0 && rest.long == 0`).
 * The pre-M3 spike surfaced that the single-predicate `Expiry` couldn't express
 * this. Expiry is now `Expiry | Expiry[]`: an array ends when the EARLIEST
 * predicate fires. `endTurn` also gains a `shortRest` flag; a long rest counts as
 * a short rest too (it grants the same benefits), so `untilShortRest` ends on
 * either.
 */
describe('v2 endTurn — short rest + multi-predicate expiry', () => {
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

  it('decrements the turns predicate in the survivor (it does not reset)', () => {
    const after1 = endTurn([buff(10)], [], { longRest: false });
    const expiry = after1[0].expiry;
    const preds = Array.isArray(expiry) ? expiry : [expiry];
    expect(preds.find((p) => p.kind === 'turns')).toEqual({ kind: 'turns', remaining: 9 });
  });

  it('preserves single-predicate shape (backward compatible)', () => {
    const after1 = endTurn(
      [{ id: 't', state: { x: 1 }, expiry: { kind: 'turns', remaining: 2 } }],
      [],
      {}
    );
    expect(after1[0].expiry).toEqual({ kind: 'turns', remaining: 1 }); // still a single object
  });
});
