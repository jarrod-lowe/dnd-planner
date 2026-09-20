import { describe, it, expect } from 'vitest';
import * as engine from '$lib/rules-engine';
import type { Annotation, EffectInstance, RuleModule } from '$lib/rules-engine';

/**
 * Notices — engine types (plan Phase 1; rolls added by the notices-rolls plan;
 * per-instance `id` + the committed-effects param by the Phase R amendment).
 *
 * A notice is an ordinary `annotate` annotation that targets the reserved
 * `NOTICE_TARGET` label — one no panel's `ui.annotationLabels` ever declares, so
 * `getMatchingAnnotations` never claims it and the notice strip owns it instead.
 * The engine adds no new pass for this: `source` (the eyebrow naming the feat or
 * spell), `body` (the longer sentence under the label) and `values` (i18n
 * interpolation params for the body) must simply ride through `evaluate()`
 * untouched, exactly as `key`/`targets` do — and stay OPTIONAL, so existing
 * panel annotations that omit them are unchanged. `roll` (a dice roll the PLAYER
 * makes on the notice's cadence, e.g. Searing Smite's per-turn burn) rides
 * through the same way: dice live in their own structured field, never in
 * `values` (which is printed text). `id` rides through too: a rule emitting one
 * annotation PER committed effect gives each the effect's instance id, so
 * several same-`key` notices stay distinct for keyed rendering.
 */
const GROUP = 'rule.test-notice-group.test-notice-rule';

/** A module whose annotate emits one full notice and one plain annotation. */
const noticeModule: RuleModule = {
  id: 'test-notice-rule',
  annotate: () => {
    const out: Annotation[] = [
      {
        id: 'instance-3#1#effect-searing-smite',
        key: `${GROUP}.notice-burning`,
        targets: ['notice'],
        source: `${GROUP}.name`,
        body: `${GROUP}.notice-burning.body`,
        values: { dc: 13 },
        roll: { sides: 6, count: 2, purpose: 'damage', damageType: 'fire' }
      },
      // The optional fields of `roll` are independent: a healing roll carries
      // `unit` instead of `damageType`.
      {
        key: `${GROUP}.notice-regrowth`,
        targets: ['notice'],
        roll: { sides: 8, count: 1, purpose: 'healing', unit: 'hp' }
      },
      // A plain panel annotation: the new fields are optional, and one that
      // omits them must come through with them absent, not defaulted.
      { key: `${GROUP}.annotation-plain`, targets: ['attack.melee'] }
    ];
    return out;
  }
};

describe('notice annotations — engine types', () => {
  it('exports the reserved NOTICE_TARGET label', () => {
    expect(engine.NOTICE_TARGET).toBe('notice');
  });

  it('carries source/body/values through evaluate() intact', () => {
    const out = engine.evaluate({ modules: [noticeModule], inputFacts: {} });
    const notice = out.annotations.find((a) => a.key === `${GROUP}.notice-burning`);
    expect(notice).toBeDefined();
    expect(notice!.targets).toEqual(['notice']);
    expect(notice!.source).toBe(`${GROUP}.name`);
    expect(notice!.body).toBe(`${GROUP}.notice-burning.body`);
    expect(notice!.values).toEqual({ dc: 13 });
  });

  it('leaves annotations that omit the notice fields unchanged', () => {
    const out = engine.evaluate({ modules: [noticeModule], inputFacts: {} });
    const plain = out.annotations.find((a) => a.key === `${GROUP}.annotation-plain`);
    expect(plain).toBeDefined();
    expect(plain!.targets).toEqual(['attack.melee']);
    expect(plain!.source).toBeUndefined();
    expect(plain!.body).toBeUndefined();
    expect(plain!.values).toBeUndefined();
    expect(plain!.roll).toBeUndefined();
    expect(plain!.id).toBeUndefined();
  });

  it('carries a roll through evaluate() with every field intact', () => {
    const out = engine.evaluate({ modules: [noticeModule], inputFacts: {} });
    const burning = out.annotations.find((a) => a.key === `${GROUP}.notice-burning`);
    expect(burning).toBeDefined();
    expect(burning!.roll).toEqual({ sides: 6, count: 2, purpose: 'damage', damageType: 'fire' });
    const regrowth = out.annotations.find((a) => a.key === `${GROUP}.notice-regrowth`);
    expect(regrowth).toBeDefined();
    expect(regrowth!.roll).toEqual({ sides: 8, count: 1, purpose: 'healing', unit: 'hp' });
  });

  it('carries a per-instance id through evaluate() intact', () => {
    const out = engine.evaluate({ modules: [noticeModule], inputFacts: {} });
    const burning = out.annotations.find((a) => a.key === `${GROUP}.notice-burning`);
    expect(burning).toBeDefined();
    expect(burning!.id).toBe('instance-3#1#effect-searing-smite');
  });
});

describe('annotate — the effects-in-force list', () => {
  /**
   * Phase R amendment: `annotate` gains a second parameter — the committed
   * effects, i.e. every effect in force when annotate runs. That is the input
   * committed list PLUS this turn's advertised effects (the exact set whose
   * `state` the sheet folded to settle the facts `f` reads), key-deduped
   * newest-wins like the sheet. It is what lets a rule emit one annotation per
   * LIVE effect (Searing Smite: one burn notice per burning target) instead of
   * re-deriving per-effect state from summed facts.
   */
  const BURN: EffectInstance = {
    id: 'instance-3#1#effect-searing-smite',
    state: { 'ssmite.burnDice': 1 },
    expiry: { kind: 'turns', remaining: 10 }
  };
  const ADVERTISED: EffectInstance = {
    id: 'effect-probe',
    state: { 'probe.flag': 1 },
    expiry: { kind: 'endOfTurn' }
  };

  it('receives the committed effects evaluate was given', () => {
    let seen: EffectInstance[] | undefined;
    const probe: RuleModule = {
      id: 'test-annotate-probe',
      annotate: (_f, committed) => {
        seen = committed;
        return [];
      }
    };
    engine.evaluate({ modules: [probe], inputFacts: {}, committed: [BURN] });
    expect(seen).toEqual([BURN]);
  });

  it('also receives effects advertised this turn — a cast planned now is live to annotate', () => {
    let seen: EffectInstance[] | undefined;
    const probe: RuleModule = {
      id: 'test-annotate-probe',
      offer: () => [{ id: 'probe-cast', apply: () => ({ advertise: [ADVERTISED] }) }],
      annotate: (_f, committed) => {
        seen = committed;
        return [];
      }
    };
    engine.evaluate({
      modules: [probe],
      inputFacts: {},
      planned: [{ instanceId: 'p1', ruleId: 'probe-cast' }]
    });
    // The fold hands annotate the effect in its committed shape: id
    // namespaced by the planned instance (`instance#index#effectId`).
    expect(seen).toEqual([
      { ...ADVERTISED, id: 'p1#0#effect-probe', ruleGroupId: 'test-annotate-probe' }
    ]);
  });
});
