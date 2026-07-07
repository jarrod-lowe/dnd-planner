import { describe, it, expect } from 'vitest';
import { evaluate, defineRule, EngineTimeoutError } from '$lib/rules-engine';
import attacks from '$lib/rules-engine/rules/attacks';

/**
 * M1 / W3 — termination watchdog + the defineRule guard.
 *
 * The watchdog is a wall-clock budget threaded through the fold. A non-positive
 * budget yields an already-passed deadline, so the first checkpoint trips —
 * deterministic, no timing flake. Real evaluations never come near the default.
 */
const attack = { instanceId: 'a1', ruleId: 'unarmed-strike-use-action' };

describe('watchdog', () => {
  it('throws EngineTimeoutError when the time budget is exceeded', () => {
    expect(() =>
      evaluate({ modules: [attacks], inputFacts: {}, planned: [attack] }, { budgetMs: -1 })
    ).toThrow(EngineTimeoutError);
  });

  it('does not trip for a normal evaluation', () => {
    expect(() => evaluate({ modules: [attacks], inputFacts: {}, planned: [attack] })).not.toThrow();
  });
});

describe('defineRule guard', () => {
  it('rejects a module with no id', () => {
    expect(() => defineRule({ id: '' })).toThrow(/non-empty id/);
  });

  it('returns the module unchanged for a valid id', () => {
    const m = { id: 'ok' };
    expect(defineRule(m)).toBe(m);
  });
});
