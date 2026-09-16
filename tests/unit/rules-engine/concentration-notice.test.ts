import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import concentration from '$lib/rules-engine/rules/concentration';

/**
 * Notices batch 2 — the concentration reminder.
 *
 * While the concentration slot is held (`concentration.remaining` at 0 — the
 * same gate the check offer uses), the module emits a NOTICE carrying the
 * damage-save rule (DC 10, or half the damage taken, whichever is higher). The
 * notice keys follow the module's existing `planner.concentration.*`
 * namespace (its check offer's name key), not `rule.*`. The rule module
 * cannot import the constant (rule modules import only the builder), so this
 * test pins its literal 'notice' to NOTICE_TARGET.
 */
const KEY = 'planner.concentration.notice';

describe('concentration annotate — notice', () => {
  it('emits the notice while the concentration slot is held', () => {
    // `concentration.spent` is written by concentration spells' committed
    // effects, not derived here — a genuine input fact for this module set.
    const out = evaluate({
      modules: [concentration],
      inputFacts: { 'concentration.spent': 1 },
      planned: []
    });
    const ann = out.annotations.find((a) => a.key === KEY);
    expect(ann).toBeDefined();
    expect(ann!.targets).toEqual([NOTICE_TARGET]);
    expect(ann!.body).toBe(`${KEY}.body`);
  });

  it('emits no notice while the slot is free', () => {
    const out = evaluate({ modules: [concentration], inputFacts: {}, planned: [] });
    expect(out.annotations.find((a) => a.key === KEY)).toBeUndefined();
  });
});
