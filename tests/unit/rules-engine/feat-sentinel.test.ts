import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import featSentinel from '$lib/rules-engine/rules/feat-sentinel';

/**
 * Notices plan, Phase 2 — Sentinel's three reminders become NOTICES.
 *
 * They render in the notices strip (source eyebrow + label + body sentence),
 * not on reaction panels: each annotation targets ONLY the reserved notice
 * label, names the feat as its `source`, carries a `body` key, and the legacy
 * `annotation-*` panel keys are gone (replaced, not kept alongside). The rule
 * module cannot import the constant (rule modules import only the builder), so
 * this test is what pins its literal `'notice'` to `NOTICE_TARGET`.
 */
const S = 'rule.dnd-5e-2024.feat-sentinel';

describe('feat-sentinel annotate — notices', () => {
  it('emits exactly the three notices, each targeting only the reserved label', () => {
    const out = evaluate({ modules: [featSentinel], inputFacts: {}, planned: [] });
    expect(out.annotations.map((a) => a.key).sort()).toEqual([
      `${S}.notice-disengage`,
      `${S}.notice-retaliate`,
      `${S}.notice-speed`
    ]);
    for (const a of out.annotations) {
      expect(a.targets, `${a.key} targets only the notice label`).toEqual([NOTICE_TARGET]);
    }
  });

  it('each notice names the feat as its source and carries a body key', () => {
    const out = evaluate({ modules: [featSentinel], inputFacts: {}, planned: [] });
    for (const suffix of ['notice-disengage', 'notice-retaliate', 'notice-speed']) {
      const ann = out.annotations.find((a) => a.key === `${S}.${suffix}`);
      expect(ann, `${S}.${suffix} exists`).toBeDefined();
      expect(ann!.source).toBe(`${S}.name`);
      expect(ann!.body).toBe(`${S}.${suffix}.body`);
    }
  });
});
