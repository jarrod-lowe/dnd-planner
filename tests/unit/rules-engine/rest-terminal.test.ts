import { describe, it, expect } from 'vitest';
import { evaluate, plannedEntries } from '$lib/rules-engine';
import type { PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import divinity from '$lib/rules-engine/rules/class-paladin-divinity';

/**
 * A rest is terminal for a plan: any action planned AFTER a rest recorder is
 * illegal and does NOT execute, so the post-fold rest hook can't recover/expire
 * effects that action would have created (e.g. refunding a Channel Divinity use).
 * Acting BEFORE the rest is unaffected — that's the legitimate "spend, then rest
 * recovers it" flow.
 */
const MODULES = [coreEvents, divinity];
// A Channel Divinity pool + a bonus action, so Divine Sense is otherwise legal.
const READY = { 'divinity.total': 2, 'bonusActions.remaining': 1 };
const AFTER_REST = 'planner.after-rest';

const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

describe('plan — a rest is terminal', () => {
  it('gates an action planned after a short rest: illegal, and it does not spend', () => {
    const planned = [ref('i0', 'record-short-rest'), ref('i1', 'divine-sense')];
    const out = evaluate({ modules: MODULES, inputFacts: READY, planned });

    // The rest itself is fine; Divine Sense after it is illegal + does not run.
    expect(out.plannedOffers['i0'].legal).toBe(true);
    expect(out.plannedOffers['i1'].legal).toBe(false);
    expect(out.planDiagnostics['i1']?.map((d) => d.code)).toEqual([AFTER_REST]);
    expect(plannedEntries(out, planned)[1].legal).toBe(false);

    // Divine Sense never ran → nothing spent → the short rest recovers nothing,
    // so the pool stays full because no use was spent (not because of a refund).
    expect(out.facts['divinity.spent'] ?? 0).toBe(0);
    expect(out.facts['divinity.recovered'] ?? 0).toBe(0);
    expect(out.facts['divinity.remaining']).toBe(2);
  });

  it('leaves an action planned BEFORE the rest legal — the rest legitimately recovers it', () => {
    const planned = [ref('i0', 'divine-sense'), ref('i1', 'record-short-rest')];
    const out = evaluate({ modules: MODULES, inputFacts: READY, planned });

    expect(out.plannedOffers['i0'].legal).toBe(true);
    expect(out.plannedOffers['i1'].legal).toBe(true);
    // Divine Sense spent a use; the short rest recovered exactly one.
    expect(out.facts['divinity.spent']).toBe(1);
    expect(out.facts['divinity.recovered']).toBe(1);
    expect(out.facts['divinity.remaining']).toBe(2);
  });
});
