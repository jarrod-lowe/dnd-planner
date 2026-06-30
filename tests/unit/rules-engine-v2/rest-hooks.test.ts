import { describe, it, expect } from 'vitest';
import { evaluatePlan, evaluateSheet, endTurn } from '$lib/rules-engine-v2';
import type { EffectInstance, PlannedRef, RuleModule } from '$lib/rules-engine-v2';
import coreEvents from '$lib/rules-engine-v2/rules/core-events';

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
      ? [{ id: 'effect-test-recover', state: { 'test.recovered.sum': 1 }, expiry: { kind: 'untilLongRest' } }]
      : []
};

const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

describe('v2 rest hook — onRest', () => {
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
    const r2 = evaluatePlan([coreEvents, grantOnLong], {}, [ref('i1', 'record-long-rest')], committed);
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
});
