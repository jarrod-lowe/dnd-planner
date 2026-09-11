import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';
import type { EffectInstance } from '$lib/rules-engine';

// Mirrors the control authored on `record-short-rest` (core-events.ts):
// pools per die size resolved from `hitDie.*` facts, CON bonus, hp unit.
const createHitDiceEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'record-short-rest',
    description: 'Short Rest',
    activities: [],
    ui: {
      section: 'rest',
      name: 'planner.record.rest.short',
      primaryControl: {
        type: 'hit-dice',
        unit: 'hp',
        bonus: { fact: 'con.modifier' },
        pools: [6, 8, 10, 12].map((sides) => ({
          sides,
          total: { fact: `hitDie.d${sides}.total` },
          remaining: { fact: `hitDie.d${sides}.remaining` }
        }))
      }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

const baseFacts = (): Record<string, number> => ({
  'con.modifier': 2,
  'hp.modifier.current': -20,
  'hitDie.d6.total': 0,
  'hitDie.d6.remaining': 0,
  'hitDie.d8.total': 0,
  'hitDie.d8.remaining': 0,
  'hitDie.d10.total': 4,
  'hitDie.d10.remaining': 3,
  'hitDie.d12.total': 0,
  'hitDie.d12.remaining': 0
});

// One of the row's own advertised `effect-hit-die-heal` effects (state
// carrying the engine's CAPPED/floored effective heal plus the die spend) —
// matches the shape `healEffect` uses in `PanelHitDice.test.ts`.
const healEffect = (heal: number, sides: number): EffectInstance => ({
  id: `i0#${sides}#effect-hit-die-heal`,
  state: { 'hp.modifier.current': heal, [`hitDie.d${sides}.spent`]: 1 },
  expiry: { kind: 'untilLongRest' }
});

describe('PanelHitDice - summary short form', () => {
  it('renders "remaining/total dSize" for a single unrolled pool, with no heal segment', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), summary: true }
    });
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    expect(hitDice?.textContent?.trim()).toBe('3/4 d10');
    expect(container.querySelector('.panel-renderer__hit-dice-summary-heal')).toBeNull();
  });

  it('renders every pool with a die total > 0, one after another', () => {
    const entry = createHitDiceEntry();
    const facts = {
      ...baseFacts(),
      'hitDie.d8.total': 2,
      'hitDie.d8.remaining': 2
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, summary: true }
    });
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    const text = hitDice?.textContent?.replace(/\s+/g, ' ').trim();
    expect(text).toContain('2/2 d8');
    expect(text).toContain('3/4 d10');
  });

  it('skips pools whose total resolves to 0', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), summary: true }
    });
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    expect(hitDice?.textContent).not.toContain('d6');
    expect(hitDice?.textContent).not.toContain('d8');
    expect(hitDice?.textContent).not.toContain('d12');
  });

  it('renders no buttons (nothing focusable) in summary mode', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), summary: true }
    });
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  // Codex P2 finding: two pools rendered back-to-back with no separator read
  // as "2/2 d83/4 d10" — the d8 pool's trailing digit runs into the d10
  // pool's leading digit. Component tests here render with no stylesheet
  // attached to jsdom (see the sibling `getComputedStyle`-avoidance note in
  // `PanelRendererSummaryComposition.test.ts`), so a CSS-only fix (a flex
  // gap) is invisible to this suite and to a screen reader alike. Assert on
  // the actual DOM: each pool is its own element, AND a real text node sits
  // between consecutive pools (never before the first) — the same thing a
  // screen reader would need to read the two pools as separate words.
  it('keeps two pools visibly separated, not run together', () => {
    const entry = createHitDiceEntry();
    const facts = {
      ...baseFacts(),
      'hitDie.d8.total': 2,
      'hitDie.d8.remaining': 2
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, summary: true }
    });
    const pools = container.querySelectorAll('.panel-renderer__hit-dice-summary-pool');
    expect(pools).toHaveLength(2);
    expect(pools[0].textContent).toBe('2/2 d8');
    expect(pools[1].textContent).toBe('3/4 d10');

    // A real separating text node sits between the two pool spans (not
    // before the first one) — a whitespace-only sibling, not CSS.
    const wrapper = container.querySelector('.panel-renderer__hit-dice-summary');
    expect(wrapper).not.toBeNull();
    const nodeTexts = Array.from(wrapper!.childNodes).map((n) => n.textContent);
    const separatorIndex = nodeTexts.findIndex((t, idx) => idx > 0 && /^\s+$/.test(t ?? ''));
    expect(separatorIndex).toBeGreaterThan(-1);

    // Complementary text-level check, now meaningful because it runs
    // alongside the structural assertion above.
    const text = container.textContent ?? '';
    expect(text).toContain('2/2 d8');
    expect(text).toContain('3/4 d10');
    expect(text).not.toContain('d83/4');
  });

  it('reduces the shown remaining count for slots spent by an earlier rest', () => {
    // 6 d10 total, 5 remaining (post-plan): one committed spend from an
    // earlier rest, no rolls of this row's own — same committed-based
    // threshold the non-summary pool aria-label announces.
    const entry = createHitDiceEntry();
    const facts = {
      ...baseFacts(),
      'hitDie.d10.total': 6,
      'hitDie.d10.remaining': 5
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, summary: true }
    });
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    expect(hitDice?.textContent?.trim()).toBe('5/6 d10');
  });

  // The owner's correction: "pooling" means ADDING the rolled results
  // together, not omitting them. A rolled slot's heal must show — summed,
  // per the whole control's pooled hit dice, not per-slot.
  //
  // The pool tail must ALSO count this row's own pending roll as spent: the
  // raw `remaining` fact is resolved against POST-plan facts, so it already
  // reflects the die this row just rolled (4 total, 3 remaining) — unlike
  // `pool.threshold` (used by the expanded roller to decide which chips stay
  // tappable), which deliberately offsets that back open. The summary is
  // read-only informational text, not a tappability gate, so it must show
  // the true count a player would get by counting blank (unrolled) chips in
  // the expanded roller: 3/4, never 4/4.
  it('leads with the summed heal of a rolled slot, followed by the decremented pool notation', () => {
    const entry = createHitDiceEntry();
    // 4 total, 3 remaining post-plan (this row's own accepted roll already
    // shrank it) — one accepted roll (natural 3 + CON 2 = 5, no cap in play,
    // so effective === raw).
    const facts = { ...baseFacts(), 'hitDie.d10.total': 4, 'hitDie.d10.remaining': 3 };
    const selections = { rolls: { d10: { '0': 3 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(5, 10)] },
        editable: true,
        facts,
        selections,
        summary: true
      }
    });
    const heal = container.querySelector('.panel-renderer__hit-dice-summary-heal');
    expect(heal?.textContent).toBe('5 hp');
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    expect(hitDice?.textContent?.replace(/\s+/g, ' ').trim()).toBe('5 hp 3/4 d10');
  });

  // The defect report: rolling a d8 and a d10 in the same rest must decrement
  // BOTH pools' remaining counts, not just add to the heal total.
  it('decrements every pool rolled in this rest, not just the heal total', () => {
    const entry = createHitDiceEntry();
    // d8: 2 total, 1 remaining post-plan (one rolled this row). d10: 4
    // total, 3 remaining post-plan (one rolled this row).
    const facts = {
      ...baseFacts(),
      'hitDie.d8.total': 2,
      'hitDie.d8.remaining': 1,
      'hitDie.d10.total': 4,
      'hitDie.d10.remaining': 3
    };
    const selections = { rolls: { d8: { '0': 5 }, d10: { '0': 3 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(7, 8), healEffect(5, 10)] },
        editable: true,
        facts,
        selections,
        summary: true
      }
    });
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    expect(hitDice?.textContent?.replace(/\s+/g, ' ').trim()).toBe('12 hp 1/2 d8 3/4 d10');
  });

  // A pool fully spent within this rest (every die of that size rolled) must
  // read 0/total, not total/total.
  it('shows 0 remaining when a pool is fully spent within this rest', () => {
    const entry = createHitDiceEntry();
    const facts = { ...baseFacts(), 'hitDie.d8.total': 2, 'hitDie.d8.remaining': 0 };
    const selections = { rolls: { d8: { '0': 4, '1': 6 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(6, 8), healEffect(8, 8)] },
        editable: true,
        facts,
        selections,
        summary: true
      }
    });
    const pool = container.querySelector('.panel-renderer__hit-dice-summary-pool');
    expect(pool?.textContent).toBe('0/2 d8');
  });

  it('shows the effective (capped) heal, not the raw roll + bonus, when they differ', () => {
    const entry = createHitDiceEntry();
    // Natural roll 6 + CON 2 = 8 raw, but only 2 HP is missing — the engine
    // caps the committed heal at 2 and advertises exactly that. The summary
    // must show the engine's capped value, never a recomputed 8.
    const facts = {
      ...baseFacts(),
      'hitDie.d10.total': 4,
      'hitDie.d10.remaining': 3,
      'hp.modifier.current': -2
    };
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(2, 10)] },
        editable: true,
        facts,
        selections,
        summary: true
      }
    });
    const heal = container.querySelector('.panel-renderer__hit-dice-summary-heal');
    expect(heal?.textContent).toBe('2 hp');
  });

  it('sums heals across multiple rolled slots and pools', () => {
    const entry = createHitDiceEntry();
    const facts = {
      ...baseFacts(),
      'hitDie.d8.total': 2,
      'hitDie.d8.remaining': 1,
      'hitDie.d10.total': 4,
      'hitDie.d10.remaining': 3
    };
    const selections = { rolls: { d8: { '0': 5 }, d10: { '0': 3 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(7, 8), healEffect(5, 10)] },
        editable: true,
        facts,
        selections,
        summary: true
      }
    });
    const heal = container.querySelector('.panel-renderer__hit-dice-summary-heal');
    expect(heal?.textContent).toBe('12 hp');
    // Both pools still show their remaining/total tail alongside the sum,
    // decremented for the die each pool spent in this very rest.
    const pools = container.querySelectorAll('.panel-renderer__hit-dice-summary-pool');
    expect(pools).toHaveLength(2);
    expect(pools[0].textContent).toBe('1/2 d8');
    expect(pools[1].textContent).toBe('3/4 d10');
  });

  // A partially-rolled pool shows BOTH the heal it has already produced AND
  // the remaining/total notation for what's left to decide.
  it('shows both the heal total and the pool remaining/total for a partially-rolled pool', () => {
    const entry = createHitDiceEntry();
    const facts = { ...baseFacts(), 'hitDie.d10.total': 4, 'hitDie.d10.remaining': 3 };
    const selections = { rolls: { d10: { '0': 3 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(5, 10)] },
        editable: true,
        facts,
        selections,
        summary: true
      }
    });
    expect(container.querySelector('.panel-renderer__hit-dice-summary-heal')?.textContent).toBe(
      '5 hp'
    );
    expect(container.querySelector('.panel-renderer__hit-dice-summary-pool')?.textContent).toBe(
      '3/4 d10'
    );
  });

  it('renders no buttons (nothing focusable) in summary mode even with a rolled slot', () => {
    const entry = createHitDiceEntry();
    const facts = { ...baseFacts(), 'hitDie.d10.total': 4, 'hitDie.d10.remaining': 3 };
    const selections = { rolls: { d10: { '0': 3 } } };
    const { container } = render(PanelRenderer, {
      props: {
        entry: { ...entry, advertisedEffects: [healEffect(5, 10)] },
        editable: true,
        facts,
        selections,
        summary: true
      }
    });
    expect(container.querySelectorAll('button').length).toBe(0);
  });
});
