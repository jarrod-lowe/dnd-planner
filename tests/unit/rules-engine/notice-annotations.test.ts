import { describe, it, expect } from 'vitest';
import * as engine from '$lib/rules-engine';
import type { Annotation, RuleModule } from '$lib/rules-engine';

/**
 * Notices — engine types (plan Phase 1; rolls added by the notices-rolls plan).
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
 * `values` (which is printed text).
 */
const GROUP = 'rule.test-notice-group.test-notice-rule';

/** A module whose annotate emits one full notice and one plain annotation. */
const noticeModule: RuleModule = {
  id: 'test-notice-rule',
  annotate: () => {
    const out: Annotation[] = [
      {
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
});
