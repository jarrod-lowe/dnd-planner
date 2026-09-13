import { describe, it, expect } from 'vitest';
import { evaluatePlan, evaluateSheet, endTurn } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef, RuleModule } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';

/**
 * The rest hook (`RuleModule.onRest`): a passive module emits persistent effects
 * when a rest is recorded this turn. It is the one path for a non-planned module
 * to contribute effects — see the divinity short-rest / human HI-on-long-rest
 * cases. These tests use synthetic modules so the mechanism is pinned independent
 * of any one feature.
 */

// Grants a keyed point on a LONG rest (idempotent via the key).
const grantOnLong: RuleModule = {
  id: 'test-grant-on-long',
  derive: () => [{ fact: 'test.points', value: (f) => f.num('test.points.granted') }],
  onRest: (kind): EffectInstance[] =>
    kind === 'long'
      ? [
          {
            id: 'effect-test-grant',
            key: 'test-grant',
            state: { 'test.points.granted': 1 },
            expiry: { kind: 'permanent' }
          }
        ]
      : []
};

// Accumulates a point on each SHORT rest (keyless → stacks across rests).
const recoverOnShort: RuleModule = {
  id: 'test-recover-on-short',
  derive: () => [{ fact: 'test.recovered', value: (f) => f.num('test.recovered.sum') }],
  onRest: (kind): EffectInstance[] =>
    kind === 'short'
      ? [
          {
            id: 'effect-test-recover',
            state: { 'test.recovered.sum': 1 },
            expiry: { kind: 'untilLongRest' }
          }
        ]
      : []
};

// Refunds on a SHORT rest only while a spend is outstanding — the shape of the
// Channel Divinity recovery, reduced to the mechanism. If the hook could see a
// spend made AFTER the rest, this would hand the point straight back.
const refundOutstanding: RuleModule = {
  id: 'test-refund-outstanding',
  derive: () => [
    { fact: 'test.spent', value: (f) => f.num('test.spent.sum') },
    { fact: 'test.refunded', value: (f) => f.num('test.refunded.sum') }
  ],
  onRest: (kind, f): EffectInstance[] =>
    kind === 'short' && f.num('test.spent') > f.num('test.refunded')
      ? [
          {
            id: 'effect-test-refund',
            state: { 'test.refunded.sum': 1 },
            expiry: { kind: 'untilLongRest' }
          }
        ]
      : []
};

// Spends a point. Costs nothing else, so it is legal wherever it is planned.
const spendPoint: RuleModule = {
  id: 'test-spend-point',
  offer: () => [
    {
      id: 'test-spend',
      ui: { section: 'action-other', name: 'test.spend' },
      apply: () => ({
        advertise: [
          {
            id: 'effect-test-spend',
            state: { 'test.spent.sum': 1 },
            expiry: { kind: 'untilLongRest' as const }
          }
        ]
      })
    }
  ]
};

const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

describe('rest hook — onRest', () => {
  it('does not fire when no rest is recorded', () => {
    const out = evaluatePlan([coreEvents, grantOnLong], {}, []);
    expect(out.facts['test.points'] ?? 0).toBe(0);
    expect(out.advertised.some((e) => e.id.includes('effect-test-grant'))).toBe(false);
  });

  it('emits its effect in-evaluation on the matching rest and commits it', () => {
    const out = evaluatePlan([coreEvents, grantOnLong], {}, [ref('i0', 'record-long-rest')]);
    // Visible the same turn the rest is recorded.
    expect(out.facts['rest.long']).toBe(1);
    expect(out.facts['test.points']).toBe(1);
    const eff = out.advertised.find((e) => e.id.includes('effect-test-grant'));
    expect(eff?.expiry).toEqual({ kind: 'permanent' });

    // Persists across the turn boundary (committed), so the grant sticks.
    const committed = endTurn([], out.advertised, {});
    expect(evaluateSheet([coreEvents, grantOnLong], {}, committed)['test.points']).toBe(1);
  });

  it('only fires for its own rest kind', () => {
    const shortOut = evaluatePlan([coreEvents, grantOnLong], {}, [ref('i0', 'record-short-rest')]);
    expect(shortOut.facts['test.points'] ?? 0).toBe(0); // grantOnLong ignores short rests

    const longOut = evaluatePlan([coreEvents, recoverOnShort], {}, [ref('i0', 'record-long-rest')]);
    expect(longOut.facts['test.recovered'] ?? 0).toBe(0); // recoverOnShort ignores long rests
  });

  it('a keyed grant does not stack when the rest repeats (idempotent)', () => {
    // First long rest grants the point.
    const r1 = evaluatePlan([coreEvents, grantOnLong], {}, [ref('i0', 'record-long-rest')]);
    const committed = endTurn([], r1.advertised, {});
    // A second long rest with the grant already committed must not double it.
    const r2 = evaluatePlan(
      [coreEvents, grantOnLong],
      {},
      [ref('i1', 'record-long-rest')],
      committed
    );
    expect(r2.facts['test.points']).toBe(1);
  });

  it('keyless recovery accumulates across short rests and clears on a long rest', () => {
    // Two short rests over two turns → two recovery effects (committed carries
    // forward across endTurn, as the real turn loop does).
    const t1 = evaluatePlan([coreEvents, recoverOnShort], {}, [ref('i0', 'record-short-rest')]);
    const c1 = endTurn([], t1.advertised, {});
    const t2 = evaluatePlan([coreEvents, recoverOnShort], {}, [ref('i1', 'record-short-rest')], c1);
    const c2 = endTurn(c1, t2.advertised, {});
    expect(evaluateSheet([coreEvents, recoverOnShort], {}, c2)['test.recovered']).toBe(2);

    // A long rest ages out the untilLongRest recovery effects.
    const t3 = evaluatePlan([coreEvents, recoverOnShort], {}, [ref('i2', 'record-long-rest')], c2);
    const c3 = endTurn(c2, t3.advertised, {});
    expect(evaluateSheet([coreEvents, recoverOnShort], {}, c3)['test.recovered'] ?? 0).toBe(0);
  });

  it('reads the state as it stood at the rest — a spend planned AFTER it is invisible', () => {
    const MODULES = [coreEvents, refundOutstanding, spendPoint];

    // Spend BEFORE the rest: outstanding at the rest, so it is refunded.
    const before = evaluatePlan(MODULES, {}, [
      ref('i0', 'test-spend'),
      ref('i1', 'record-short-rest')
    ]);
    expect(before.facts['test.spent']).toBe(1);
    expect(before.facts['test.refunded']).toBe(1);

    // Spend AFTER the rest: it still executes (illegal-but-visible), but it did
    // not exist when the rest happened — the hook must not refund it.
    const after = evaluatePlan(MODULES, {}, [
      ref('i0', 'record-short-rest'),
      ref('i1', 'test-spend')
    ]);
    expect(after.facts['test.spent']).toBe(1);
    expect(after.facts['test.refunded'] ?? 0).toBe(0);
  });

  it('takes the KIND of the rest at the boundary, not of the last rest in the plan', () => {
    const MODULES = [coreEvents, grantOnLong];

    // Short rest FIRST. Only the first rest is processed (ISSUES.md §1.41) and
    // it is a SHORT one, so a long-rest-only hook must not fire. Deriving the
    // kind from the settled facts (which carry BOTH flags, long winning) would
    // run the LATER rest's hooks at the EARLIER rest's position.
    const shortFirst = evaluatePlan(MODULES, {}, [
      ref('i0', 'record-short-rest'),
      ref('i1', 'record-long-rest')
    ]);
    expect(shortFirst.facts['test.points'] ?? 0).toBe(0);
    expect(shortFirst.advertised.some((e) => e.id.includes('effect-test-grant'))).toBe(false);

    // Long rest FIRST: that IS the processed rest, so the grant fires.
    const longFirst = evaluatePlan(MODULES, {}, [
      ref('i0', 'record-long-rest'),
      ref('i1', 'record-short-rest')
    ]);
    expect(longFirst.facts['test.points']).toBe(1);
  });

  it('still reads the kind from the settled facts when the rest is the plan’s last row', () => {
    // A rest row that is the last step never trips the in-fold check (the flag
    // only reads true at the NEXT step's top), so neither boundary nor kind is
    // captured. Such a plan has exactly one rest, so the settled facts describe
    // it unambiguously — the fallback must still fire its hooks.
    const long = evaluatePlan([coreEvents, grantOnLong], {}, [ref('i0', 'record-long-rest')]);
    expect(long.facts['test.points']).toBe(1);

    const short = evaluatePlan([coreEvents, recoverOnShort], {}, [ref('i0', 'record-short-rest')]);
    expect(short.facts['test.recovered']).toBe(1);
  });
});
