import { describe, it, expect } from 'vitest';
import { evaluatePlan, endTurn } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import paladinL3 from '$lib/rules-engine/rules/class-paladin-level3';
import divinity from '$lib/rules-engine/rules/class-paladin-divinity';

/**
 * Channel Divinity short-rest recoveries are keyless so they STACK (one per
 * unrecovered spend) — which means each emission needs its OWN id: the
 * active-effects strip keys chips by `effect.id` (a duplicate crashes the keyed
 * each) and `removeEffect` removes by exact id (a shared id would dismiss every
 * recovery at once). The recovered count at emission time is the discriminator.
 */

const modules = [coreEvents, paladinL3, divinity];
const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });
const spend = (id: string): EffectInstance => ({
  id,
  state: { 'divinity.spent': 1 },
  expiry: { kind: 'untilLongRest' }
});

describe('divinity short-rest recovery ids', () => {
  it('two stacked recoveries carry DISTINCT ids (and stay keyless)', () => {
    // Both Channel Divinity uses are spent; two short rests over two turns
    // each recover one, so two keyless recovery effects coexist.
    const committed0 = [spend('s1'), spend('s2')];
    const t1 = evaluatePlan(modules, {}, [ref('i0', 'record-short-rest')], committed0);
    const c1 = endTurn(committed0, t1.advertised, {});
    const t2 = evaluatePlan(modules, {}, [ref('i1', 'record-short-rest')], c1);
    const c2 = endTurn(c1, t2.advertised, {});

    const recoveries = c2.filter((e) => e.id.includes('effect-divinity-short-rest'));
    expect(recoveries).toHaveLength(2);
    expect(recoveries.every((e) => e.key === undefined)).toBe(true);
    expect(new Set(recoveries.map((e) => e.id)).size).toBe(2);
  });
});
