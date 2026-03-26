/**
 * Tests for source resolution in the rules engine.
 */
import { describe, it, expect } from 'vitest';
import { resolveSource, validateSource } from '$lib/rules-engine';
import type { Source, WorkingState, Rule } from '$lib/rules-engine';

describe('validateSource', () => {
  it('accepts a valid fact source', () => {
    expect(() => validateSource({ fact: 'hp.max' })).not.toThrow();
  });

  it('accepts a valid number source', () => {
    expect(() => validateSource({ number: 10 })).not.toThrow();
  });

  it('accepts a valid var source', () => {
    expect(() => validateSource({ var: 'distance' })).not.toThrow();
  });

  it('accepts a valid condition source', () => {
    expect(() =>
      validateSource({
        condition: { fact: 'hp.current', operator: 'greaterThan', value: 0 }
      })
    ).not.toThrow();
  });

  it('rejects an empty source', () => {
    expect(() => validateSource({})).toThrow();
  });

  it('rejects a source with multiple keys', () => {
    expect(() => validateSource({ fact: 'hp.max', number: 10 })).toThrow();
  });

  it('rejects a source with no valid keys', () => {
    expect(() => validateSource({ invalid: 'value' } as unknown as Source)).toThrow();
  });
});

describe('resolveSource', () => {
  // Helper to create minimal working state
  const createWorkingState = (facts: Record<string, number>): WorkingState => ({
    facts,
    events: new Set(),
    generatedRules: { early: [], normal: [], safeguard: [] },
    offeredRules: [],
    appliedRuleIds: [],
    appliedActivityIds: []
  });

  // Helper to create minimal rule
  const createRule = (overrides?: Partial<Rule>): Rule => ({
    id: 'test-rule',
    activities: [],
    ...overrides
  });

  describe('number source', () => {
    it('returns the literal number', () => {
      const source: Source = { number: 42 };
      const workingState = createWorkingState({});
      const rule = createRule();

      const result = resolveSource(source, workingState, rule);

      expect(result).toBe(42);
    });

    it('returns 0 for literal zero', () => {
      const source: Source = { number: 0 };
      const workingState = createWorkingState({});
      const rule = createRule();

      const result = resolveSource(source, workingState, rule);

      expect(result).toBe(0);
    });

    it('returns negative numbers', () => {
      const source: Source = { number: -5 };
      const workingState = createWorkingState({});
      const rule = createRule();

      const result = resolveSource(source, workingState, rule);

      expect(result).toBe(-5);
    });
  });

  describe('fact source', () => {
    it('returns the fact value from working state', () => {
      const source: Source = { fact: 'hp.current' };
      const workingState = createWorkingState({ 'hp.current': 25 });
      const rule = createRule();

      const result = resolveSource(source, workingState, rule);

      expect(result).toBe(25);
    });

    it('returns undefined for missing fact', () => {
      const source: Source = { fact: 'nonexistent' };
      const workingState = createWorkingState({});
      const rule = createRule();

      const result = resolveSource(source, workingState, rule);

      expect(result).toBeUndefined();
    });

    it('returns 0 for fact with value 0', () => {
      const source: Source = { fact: 'counter' };
      const workingState = createWorkingState({ counter: 0 });
      const rule = createRule();

      const result = resolveSource(source, workingState, rule);

      expect(result).toBe(0);
    });
  });

  describe('var source with selections', () => {
    it('returns the selection value when present', () => {
      const source: Source = { var: 'distance' };
      const workingState = createWorkingState({});
      const rule = createRule({
        selections: { distance: 15 }
      });

      const result = resolveSource(source, workingState, rule);

      expect(result).toBe(15);
    });

    it('ignores vars.default when selection is present', () => {
      const source: Source = { var: 'distance' };
      const workingState = createWorkingState({ 'movement.current': 30 });
      const rule = createRule({
        vars: { distance: { default: { fact: 'movement.current' } } },
        selections: { distance: 10 }
      });

      const result = resolveSource(source, workingState, rule);

      expect(result).toBe(10);
    });
  });

  describe('var source without selections (uses default)', () => {
    it('returns number from vars.default', () => {
      const source: Source = { var: 'distance' };
      const workingState = createWorkingState({});
      const rule = createRule({
        vars: { distance: { default: { number: 20 } } }
      });

      const result = resolveSource(source, workingState, rule);

      expect(result).toBe(20);
    });

    it('returns resolved fact from vars.default', () => {
      const source: Source = { var: 'distance' };
      const workingState = createWorkingState({ 'movement.current': 25 });
      const rule = createRule({
        vars: { distance: { default: { fact: 'movement.current' } } }
      });

      const result = resolveSource(source, workingState, rule);

      expect(result).toBe(25);
    });

    it('returns undefined when var is not defined in vars or selections', () => {
      const source: Source = { var: 'unknown' };
      const workingState = createWorkingState({});
      const rule = createRule();

      const result = resolveSource(source, workingState, rule);

      expect(result).toBeUndefined();
    });

    it('returns undefined when vars.default references missing fact', () => {
      const source: Source = { var: 'distance' };
      const workingState = createWorkingState({});
      const rule = createRule({
        vars: { distance: { default: { fact: 'nonexistent' } } }
      });

      const result = resolveSource(source, workingState, rule);

      expect(result).toBeUndefined();
    });
  });

  describe('condition source', () => {
    it('returns 1 when fact comparison is true (greaterThanOrEqual)', () => {
      const source: Source = {
        condition: {
          fact: 'character.movement.current',
          operator: 'greaterThanOrEqual',
          value: 5
        }
      };
      const workingState = createWorkingState({ 'character.movement.current': 10 });
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(1);
    });

    it('returns 0 when fact comparison is false (greaterThanOrEqual)', () => {
      const source: Source = {
        condition: {
          fact: 'character.movement.current',
          operator: 'greaterThanOrEqual',
          value: 5
        }
      };
      const workingState = createWorkingState({ 'character.movement.current': 2 });
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(0);
    });

    it('returns 1 when fact exists (fact existence condition)', () => {
      const source: Source = {
        condition: { fact: 'character.movement.current' }
      };
      const workingState = createWorkingState({ 'character.movement.current': 10 });
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(1);
    });

    it('returns 0 when fact does not exist (fact existence condition)', () => {
      const source: Source = {
        condition: { fact: 'character.movement.nonexistent' }
      };
      const workingState = createWorkingState({});
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(0);
    });

    it('returns 1 when event was emitted', () => {
      const source: Source = {
        condition: { event: 'some-event' }
      };
      const workingState: WorkingState = {
        facts: {},
        events: new Set(['some-event']),
        generatedRules: { early: [], normal: [], safeguard: [] },
        offeredRules: [],
        appliedRuleIds: [],
        appliedActivityIds: []
      };
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(1);
    });

    it('returns 0 when event was not emitted', () => {
      const source: Source = {
        condition: { event: 'some-event' }
      };
      const workingState = createWorkingState({});
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(0);
    });

    it('returns 1 when equals comparison is true', () => {
      const source: Source = {
        condition: {
          fact: 'hp.current',
          operator: 'equals',
          value: 10
        }
      };
      const workingState = createWorkingState({ 'hp.current': 10 });
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(1);
    });

    it('returns 0 when equals comparison is false', () => {
      const source: Source = {
        condition: {
          fact: 'hp.current',
          operator: 'equals',
          value: 10
        }
      };
      const workingState = createWorkingState({ 'hp.current': 5 });
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(0);
    });

    it('returns 1 when notEquals comparison is true', () => {
      const source: Source = {
        condition: {
          fact: 'hp.current',
          operator: 'notEquals',
          value: 10
        }
      };
      const workingState = createWorkingState({ 'hp.current': 5 });
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(1);
    });

    it('returns 1 when lessThan comparison is true', () => {
      const source: Source = {
        condition: {
          fact: 'hp.current',
          operator: 'lessThan',
          value: 10
        }
      };
      const workingState = createWorkingState({ 'hp.current': 5 });
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(1);
    });

    it('returns 1 when lessThanOrEqual comparison is true', () => {
      const source: Source = {
        condition: {
          fact: 'hp.current',
          operator: 'lessThanOrEqual',
          value: 10
        }
      };
      const workingState = createWorkingState({ 'hp.current': 10 });
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(1);
    });

    it('returns 1 when greaterThan comparison is true', () => {
      const source: Source = {
        condition: {
          fact: 'hp.current',
          operator: 'greaterThan',
          value: 5
        }
      };
      const workingState = createWorkingState({ 'hp.current': 10 });
      const rule = createRule();

      expect(resolveSource(source, workingState, rule)).toBe(1);
    });
  });
});
