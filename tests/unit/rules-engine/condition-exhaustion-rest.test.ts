import { describe, it, expect } from 'vitest';
import { evaluatePlan, endTurn } from '$lib/rules-engine';
import type { EffectInstance, PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import conditionExhaustion from '$lib/rules-engine/rules/condition-exhaustion';

/**
 * The Exhaustion long-rest decrement (docs/plans/ideas/condition-exhaustion.md,
 * PR3): SRD 5.2 "Finishing a Long Rest removes 1 of your Exhaustion levels.
 * When your Exhaustion level reaches 0, the condition ends." Rest EXPIRY
 * cannot decrement (it clears whole effects), so the `onRest` hook does — the
 * Channel Divinity precedent — advertising the SAME keyed effect one level
 * lower (newest-wins replaces the committed one in the very evaluation the
 * rest is recorded). At level 1 the decrement is the condition's END: the
 * EMPTY same-key eviction (the get-up prone-ended idiom) whose display name
 * is the DISTINCT ended label — reusing the effect name would read
 * "Exhaustion" after the condition, its riders, and the notice are all gone.
 * A short rest removes nothing (the yaml grammar cannot see effect display
 * names or hook outputs — hence these pins; the player-visible flow is
 * condition-exhaustion-long-rest-removes-one / -clears-final-level).
 */
const CE = 'rule.dnd-5e-2024.condition-exhaustion';
const ALL = [coreEvents, conditionExhaustion];
const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

/** Commit N same-turn record rows — the turn loop's committed level-N state. */
const committedAt = (records: number): EffectInstance[] => {
  const planned = Array.from({ length: records }, (_, i) => ref(`c${i}`, 'record-exhaustion'));
  return endTurn([], evaluatePlan([conditionExhaustion], {}, planned).advertised, {});
};

describe('condition-exhaustion onRest — the long-rest decrement', () => {
  it('a long rest removes exactly one level: 2 → 1, permanent, replacing the keyed effect', () => {
    const out = evaluatePlan(ALL, {}, [ref('r', 'record-long-rest')], committedAt(2));
    expect(out.facts['condition.exhaustion']).toBe(1);
    const levels = out.advertised
      .filter((e) => e.id.includes('effect-exhaustion'))
      .map((e) => e.state?.['condition.exhaustion']);
    expect(levels, 'ONE keyed effect, at the decremented level').toEqual([1]);
    const effect = out.advertised.find((e) => e.id.includes('effect-exhaustion'))!;
    expect(effect.key).toBe('exhaustion');
    expect(effect.display?.value, 'the chip shows the live post-rest level').toBe(1);
    expect(effect.expiry).toEqual({ kind: 'permanent' });
  });

  it('the decremented level commits — exactly one keyed effect survives the boundary', () => {
    const out = evaluatePlan(ALL, {}, [ref('r', 'record-long-rest')], committedAt(2));
    const committed = endTurn(committedAt(2), out.advertised, {});
    const levels = committed
      .filter((e) => e.id.includes('effect-exhaustion'))
      .map((e) => e.state?.['condition.exhaustion']);
    expect(levels, 'newest-wins keeps the post-rest level, not the pre-rest 2').toEqual([1]);
  });

  it('a long rest at level 1 ENDS the condition: the empty-key eviction with the DISTINCT ended label', () => {
    const out = evaluatePlan(ALL, {}, [ref('r', 'record-long-rest')], committedAt(1));
    // The eviction writes nothing, so the fact reverts to UNSET — which every
    // reader sees as 0 (the guide's unset-fact contract; f.num, the yaml
    // runner's ?? 0, and the annotate guard below all read it that way).
    expect(out.facts['condition.exhaustion'] ?? 0).toBe(0);
    const eviction = out.advertised.find((e) => e.id === 'exhaustion-ended');
    expect(eviction, 'the eviction effect exists').toBeDefined();
    expect(eviction!.key, 'same key — newest-wins drops the level effect').toBe('exhaustion');
    expect(eviction!.state, 'empty: no facts written').toBeUndefined();
    expect(eviction!.expiry).toEqual({ kind: 'permanent' });
    // The off-by-one guard: the ended chip must NOT read "Exhaustion" — the
    // condition, its riders, and its notice are all gone by then.
    expect(eviction!.display?.name, 'the DISTINCT ended label').toBe(`${CE}.long-rest-clear.name`);
    expect(eviction!.display?.name).not.toBe(`${CE}.effect-exhaustion.name`);
  });

  it('a short rest removes nothing at any level', () => {
    for (const level of [1, 2]) {
      const out = evaluatePlan(ALL, {}, [ref('r', 'record-short-rest')], committedAt(level));
      expect(out.facts['condition.exhaustion'], `level ${level} survives a short rest`).toBe(level);
      expect(
        out.advertised.some((e) => e.id === 'exhaustion-ended'),
        'no eviction on a short rest'
      ).toBe(false);
    }
  });

  it('a long rest at level 0 emits nothing — there is no condition to decrement', () => {
    const out = evaluatePlan(ALL, {}, [ref('r', 'record-long-rest')], []);
    expect(out.facts['condition.exhaustion'] ?? 0).toBe(0);
    expect(out.advertised.some((e) => e.id === 'exhaustion-ended')).toBe(false);
  });
});
