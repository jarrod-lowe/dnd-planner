import { describe, it, expect } from 'vitest';
import { evaluate, plannedEntries } from '$lib/rules-engine';
import type { PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import divinity from '$lib/rules-engine/rules/class-paladin-divinity';

/**
 * An action planned AFTER a rest recorder is illegal — but it still EXECUTES,
 * like every other illegal planned row. The planner projects over-commitment, it
 * does not prevent it: the spend must land so the projection stays honest.
 *
 * What keeps that honest is the rest hook (`onRest`), which reads the state as
 * it stood at the rest — pre-rest committed effects plus everything advertised
 * up to and including the rest row itself. A spend made after the rest is
 * outside that window, so the rest cannot recover it (a short rest then Divine
 * Sense must not refund the Channel Divinity use).
 *
 * Acting BEFORE the rest is unaffected — that's the legitimate "spend, then rest
 * recovers it" flow, and the regression guard for the window's lower edge.
 */
const MODULES = [coreEvents, divinity];
// A Channel Divinity pool + a bonus action, so Divine Sense is otherwise legal.
const READY = { 'divinity.total': 2, 'bonusActions.remaining': 1 };
const AFTER_REST = 'planner.after-rest';
const NO_BONUS_ACTION = 'rule.class-paladin-divinity.offer-divine-sense.no_bonus_action';

const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

describe('plan — an action planned after a rest', () => {
  it('is illegal but still executes: the spend lands and the rest does not refund it', () => {
    const planned = [ref('i0', 'record-short-rest'), ref('i1', 'divine-sense')];
    const out = evaluate({ modules: MODULES, inputFacts: READY, planned });

    // The rest itself is fine; Divine Sense after it is illegal.
    expect(out.plannedOffers['i0'].legal).toBe(true);
    expect(out.plannedOffers['i1'].legal).toBe(false);
    expect(out.planDiagnostics['i1']?.map((d) => d.code)).toEqual([AFTER_REST]);
    expect(plannedEntries(out, planned)[1].legal).toBe(false);

    // ...and it RAN: the point is spent, and the short-rest hook — reading the
    // pre-rest state — saw nothing outstanding, so it refunded nothing.
    expect(out.facts['divinity.spent']).toBe(1);
    expect(out.facts['divinity.recovered'] ?? 0).toBe(0);
    expect(out.facts['divinity.remaining']).toBe(1);
  });

  it('keeps the AFTER_REST diagnostic alongside the action’s own legalWhen ones', () => {
    // No bonus action left, so Divine Sense fails its own gate TOO. Both the
    // planner's after-rest error and the offer's own must survive.
    const planned = [ref('i0', 'record-short-rest'), ref('i1', 'divine-sense')];
    const out = evaluate({
      modules: MODULES,
      inputFacts: { 'divinity.total': 2, 'bonusActions.remaining': 0 },
      planned
    });

    expect(out.plannedOffers['i1'].legal).toBe(false);
    const codes = out.planDiagnostics['i1']?.map((d) => d.code) ?? [];
    expect(codes).toContain(AFTER_REST);
    expect(codes).toContain(NO_BONUS_ACTION);
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
