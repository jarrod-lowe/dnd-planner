import { describe, it, expect } from 'vitest';
import { evaluate, plannedEntries } from '$lib/rules-engine';
import type { PlannedRef } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import divinity from '$lib/rules-engine/rules/class-paladin-divinity';
import speciesHuman from '$lib/rules-engine/rules/species-human';
import heroicInspiration from '$lib/rules-engine/rules/heroic-inspiration';

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
// A Human (grants Heroic Inspiration on a long rest) who can also spend it.
const HUMAN_MODULES = [coreEvents, speciesHuman, heroicInspiration];
// A Channel Divinity pool + a bonus action, so Divine Sense is otherwise legal.
const READY = { 'divinity.total': 2, 'bonusActions.remaining': 1 };
const AFTER_REST = 'planner.after-rest';
const NO_BONUS_ACTION = 'rule.class-paladin-divinity.offer-divine-sense.no_bonus_action';
const NO_INSPIRATION = 'rule.dnd-5e-2024.heroic-inspiration.use-hi-offer.no_inspiration';

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

/**
 * The other half of "a post-rest row executes": the rest hook's OWN effects must
 * stay chronologically where the rest happened, so a planned row after it is
 * still newer. Heroic Inspiration is the case that proves it — the Human grant
 * and the `use-hi` consumption deliberately share a key, and `dedupeByKey` keeps
 * the LAST entry. If the hook's grant were appended after the fold it would win
 * over a `use-hi` planned later, and the player would spend HI and still have it.
 *
 * This ordering is not optional for HI: a long-rest grant can only ever be
 * followed by the spend, never preceded by it.
 */
describe('plan — rest-hook effects sit at the rest, not after the whole plan', () => {
  it('lets a use-hi planned after a long rest consume the rest’s own grant', () => {
    const planned = [ref('i0', 'record-long-rest'), ref('i1', 'use-hi')];
    const out = evaluate({ modules: HUMAN_MODULES, inputFacts: {}, planned });

    expect(out.plannedOffers['i1'].legal).toBe(false);
    expect(out.planDiagnostics['i1']?.map((d) => d.code)).toContain(AFTER_REST);

    // It RAN: the consumption effect is newer than the hook's grant, so
    // newest-key-wins leaves HI spent, not sitting there unspent.
    expect(out.facts['heroicInspiration.consumed']).toBe(1);
    expect(out.facts['heroicInspiration.remaining'] ?? 0).toBe(0);
  });

  it('KNOWN LIMITATION: the post-rest row cannot see the hook grant at its own step', () => {
    // `onRest` runs once, post-settle (RULES_ENGINE.md), so during the fold
    // `use-hi` still reads remaining = 0 and reports its own no_inspiration
    // error on top of the after-rest one. The outcome above is right; only this
    // row's diagnostics are pessimistic. Pinned as an ACCEPTED imperfection, not
    // as correct behaviour — `planner.after-rest` now warns the player that a
    // post-rest row's projection may be inaccurate. See ISSUES.md §1.41.
    const planned = [ref('i0', 'record-long-rest'), ref('i1', 'use-hi')];
    const out = evaluate({ modules: HUMAN_MODULES, inputFacts: {}, planned });
    expect(out.planDiagnostics['i1']?.map((d) => d.code)).toContain(NO_INSPIRATION);
  });

  it('still grants Heroic Inspiration on a long rest with nothing planned after it', () => {
    const planned = [ref('i0', 'record-long-rest')];
    const out = evaluate({ modules: HUMAN_MODULES, inputFacts: {}, planned });
    expect(out.facts['heroicInspiration.remaining']).toBe(1);
    expect(out.facts['heroicInspiration.consumed'] ?? 0).toBe(0);
  });

  it('runs the FIRST rest’s hooks, never a later rest’s kind at the first rest’s place', () => {
    // short rest → use-hi → long rest. Only the FIRST rest is processed
    // (ISSUES.md §1.41), and that rest is the SHORT one — so the Human's
    // long-rest grant does not fire at all. The kind and the boundary must
    // describe the SAME rest: pairing the LATER rest's kind with the EARLIER
    // rest's position would splice the long-rest grant in *before* `use-hi`,
    // letting the use consume a grant that, coherently, was never made.
    const planned = [
      ref('i0', 'record-short-rest'),
      ref('i1', 'use-hi'),
      ref('i2', 'record-long-rest')
    ];
    const out = evaluate({ modules: HUMAN_MODULES, inputFacts: {}, planned });

    // No grant was emitted — the processed rest was the short one.
    expect(out.effects.filter((e) => e.id.includes('effect-hi-set'))).toEqual([]);
    expect(out.facts['heroicInspiration.remaining'] ?? 0).toBe(0);
    // `use-hi` still executed (illegal-but-visible), spending nothing it had.
    expect(out.facts['heroicInspiration.consumed']).toBe(1);
    expect(out.planDiagnostics['i1']?.map((d) => d.code)).toContain(AFTER_REST);
  });
});
