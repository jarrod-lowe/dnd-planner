import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import featAlert from '$lib/rules-engine/rules/feat-alert';
import initiative from '$lib/rules-engine/rules/initiative';

/**
 * Notices batch 2 — Alert's unmodelled benefit.
 *
 * "You can't be surprised while you're conscious" has no surprise mechanic in
 * the engine to hook, so the benefit becomes a NOTICE alongside the feat's
 * EXISTING initiative annotations, which must come through this work
 * untouched. The rule module cannot import the constant (rule modules import
 * only the builder), so this test pins its literal 'notice' to NOTICE_TARGET.
 */
const A = 'rule.dnd-5e-2024.feat-alert';

describe('feat-alert annotate — notices', () => {
  it('emits the cannot-be-surprised notice with the feat assigned', () => {
    const out = evaluate({ modules: [featAlert], inputFacts: {}, planned: [] });
    const ann = out.annotations.find((a) => a.key === `${A}.notice-surprise`);
    expect(ann).toBeDefined();
    expect(ann!.targets).toEqual([NOTICE_TARGET]);
    expect(ann!.body).toBe(`${A}.notice-surprise.body`);
  });

  it('leaves the existing initiative annotations untouched', () => {
    const out = evaluate({ modules: [featAlert], inputFacts: {}, planned: [] });
    for (const suffix of ['annotation-swap', 'annotation-proficiency']) {
      const ann = out.annotations.find((a) => a.key === `${A}.${suffix}`);
      expect(ann, `${A}.${suffix} still exists`).toBeDefined();
      expect(ann!.targets).toEqual(['dice.initiative']);
    }
  });

  it('emits no notice without the feat', () => {
    const out = evaluate({ modules: [initiative], inputFacts: {}, planned: [] });
    expect(out.annotations.find((a) => a.key === `${A}.notice-surprise`)).toBeUndefined();
  });
});
