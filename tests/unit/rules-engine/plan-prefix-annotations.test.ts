import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import type { Annotation, PlannedRef, RuleModule } from '$lib/rules-engine';
import actionEconomy from '$lib/rules-engine/rules/action-economy';
import attacks from '$lib/rules-engine/rules/attacks';
import spellcasting from '$lib/rules-engine/rules/spellcasting';
import paladinSmite from '$lib/rules-engine/rules/paladin-smite';
import divineSmite from '$lib/rules-engine/rules/divine-smite';

/**
 * Per-item PREFIX annotations — the annotations a plan row SHOWS are evaluated
 * against the state at the END of that row (committed + rows 1..N inclusive,
 * never later rows). The engine exposes this as `annotationsByRow`, keyed by
 * instanceId, alongside the unchanged full-plan `annotations` list (the notices
 * strip / toggle captures keep the global semantics).
 *
 * The synthetic pair below keeps the pin minimal and exact: `test-set-flag`
 * advertises an effect that makes `test.flag` read 1, and the annotator turns
 * that fact into one annotation. Where the annotation appears therefore pins
 * WHICH state each list was evaluated against — nothing else varies.
 */
const FLAG_KEY = 'test.flag-annotation';

const flagModules: RuleModule[] = [
  {
    id: 'test-flag-offers',
    offer: () => [
      // Advertises nothing — a row that changes no state.
      { id: 'test-noop' },
      {
        id: 'test-set-flag',
        apply: () => ({
          advertise: [{ id: 'flag-on', state: { 'test.flag': 1 }, expiry: { kind: 'endOfTurn' } }]
        })
      }
    ]
  },
  {
    id: 'test-flag-annotator',
    annotate: (f): Annotation[] =>
      f.num('test.flag') > 0 ? [{ key: FLAG_KEY, targets: ['test.panel'] }] : []
  }
];

const has = (annotations: Annotation[] | undefined): boolean =>
  (annotations ?? []).some((a) => a.key === FLAG_KEY);

describe('evaluate — annotationsByRow (per-item prefix annotations)', () => {
  it('a later row never reaches an earlier row; the later row does see it; the last row equals the global list', () => {
    const noop: PlannedRef = { instanceId: 'i0', ruleId: 'test-noop' };
    const set: PlannedRef = { instanceId: 'i1', ruleId: 'test-set-flag' };
    const out = evaluate({ modules: flagModules, planned: [noop, set] });

    // The setter is the SECOND row: at the end of row i0 its effect has not
    // happened yet, so the earlier row's list must not contain the annotation.
    expect(has(out.annotationsByRow['i0'])).toBe(false);
    // The setter's own row is prefix-INCLUSIVE — its own effect is in force at
    // its own end, so the later row sees it.
    expect(has(out.annotationsByRow['i1'])).toBe(true);
    // The global list is unchanged (full plan): the annotation is live.
    expect(has(out.annotations)).toBe(true);
    // The LAST row's list is exactly the global list — same state, same call.
    expect(out.annotationsByRow['i1']).toEqual(out.annotations);
  });

  it('two instances of the same offer key separately, each inclusive of its own effect', () => {
    const first: PlannedRef = { instanceId: 'a', ruleId: 'test-set-flag' };
    const second: PlannedRef = { instanceId: 'b', ruleId: 'test-set-flag' };
    const out = evaluate({ modules: flagModules, planned: [first, second] });

    // Row `a`'s own apply set the flag at its own end; row `b` inherits it.
    // Both lists carry the annotation, keyed to each instance — instances of
    // one offer never share an entry.
    expect(has(out.annotationsByRow['a'])).toBe(true);
    expect(has(out.annotationsByRow['b'])).toBe(true);
    expect(out.annotationsByRow['b']).toEqual(out.annotations);
  });

  it('reordering the rows moves the lists with position, not instance', () => {
    const noop: PlannedRef = { instanceId: 'i0', ruleId: 'test-noop' };
    const set: PlannedRef = { instanceId: 'i1', ruleId: 'test-set-flag' };

    const before = evaluate({ modules: flagModules, planned: [noop, set] });
    expect(has(before.annotationsByRow['i0'])).toBe(false);

    // The same two rows, swapped: i0 now sits AFTER the setter, so its list
    // must pick the annotation up — the list follows the row's POSITION in
    // the fold, not anything about the instance itself.
    const after = evaluate({ modules: flagModules, planned: [set, noop] });
    expect(has(after.annotationsByRow['i0'])).toBe(true);
    expect(has(after.annotationsByRow['i1'])).toBe(true);
  });

  it('an empty plan yields an empty map (the global list still evaluates)', () => {
    const out = evaluate({ modules: flagModules, planned: [] });
    expect(out.annotationsByRow).toEqual({});
    expect(has(out.annotations)).toBe(false);
  });
});

/**
 * The same contract on the real corpus: an annotation a LATER row globally
 * consumed used to vanish from the earlier row that still had it. Divine Smite
 * is the measured case — once the smite is cast, the global list drops the
 * "+Nd8 radiant" reminder, but at the END of the attack row the spell was
 * still uncast, so that row keeps its reminder.
 */
const DS_MODULES = [actionEconomy, attacks, spellcasting, paladinSmite, divineSmite];
const DS_PREPARED = { 'spellcasting.slots.level1.total': 2 };
const DS_KEY = 'rule.spell-divine-smite.annotation';

describe('evaluate — per-row annotations on the real corpus (Divine Smite)', () => {
  it('the attack row keeps the smite reminder a later smite row globally consumed', () => {
    const attack: PlannedRef = { instanceId: 'a1', ruleId: 'unarmed-strike-use-action' };
    const smite: PlannedRef = { instanceId: 's1', ruleId: 'cast-divine-smite' };
    const out = evaluate({
      modules: DS_MODULES,
      inputFacts: DS_PREPARED,
      planned: [attack, smite]
    });

    // Global semantics unchanged: the smite was cast, so the reminder is gone
    // from the full-plan list (pinned by annotate.test.ts since M1).
    expect(out.annotations.some((a) => a.key === DS_KEY)).toBe(false);
    // The ATTACK row, judged at its own end, still had a usable smite.
    expect(out.annotationsByRow['a1']!.some((a) => a.key === DS_KEY)).toBe(true);
    // The smite row's own end state is the final one — no reminder there.
    expect(out.annotationsByRow['s1']!.some((a) => a.key === DS_KEY)).toBe(false);
    expect(out.annotationsByRow['s1']).toEqual(out.annotations);
  });
});
