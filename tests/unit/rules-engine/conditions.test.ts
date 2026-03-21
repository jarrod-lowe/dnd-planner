import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  evaluateWhenConditions,
  isRuleApplicable
} from '$lib/rules-engine/conditions';
import type { Condition, Facts, Rule } from '$lib/rules-engine/types';

describe('evaluateCondition', () => {
  describe('FactExistenceCondition', () => {
    it('returns true when fact exists with truthy value', () => {
      const condition: Condition = { fact: 'hp.current' };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns false when fact does not exist', () => {
      const condition: Condition = { fact: 'hp.current' };
      const facts: Facts = {};
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });

    it('returns false when fact value is 0', () => {
      const condition: Condition = { fact: 'hp.current' };
      const facts: Facts = { 'hp.current': 0 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });
  });

  describe('FactComparisonCondition', () => {
    it('returns true when equals comparison matches', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'equals',
        value: 10
      };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns false when equals comparison does not match', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'equals',
        value: 10
      };
      const facts: Facts = { 'hp.current': 5 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });

    it('returns true when greaterThan comparison matches', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'greaterThan',
        value: 0
      };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns true when lessThan comparison matches', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'lessThan',
        value: 20
      };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns true when notEquals comparison matches', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'notEquals',
        value: 0
      };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });
  });

  describe('EventCondition', () => {
    it('returns true when event was emitted', () => {
      const condition: Condition = { event: 'attack' };
      const facts: Facts = {};
      const events = new Set<string>(['attack']);

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns false when event was not emitted', () => {
      const condition: Condition = { event: 'attack' };
      const facts: Facts = {};
      const events = new Set<string>(['defend']);

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });

    it('returns false when no events emitted', () => {
      const condition: Condition = { event: 'attack' };
      const facts: Facts = {};
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });
  });
});

describe('evaluateWhenConditions', () => {
  it('returns true when all conditions are satisfied', () => {
    const conditions: Condition[] = [
      { fact: 'hp.current' },
      { fact: 'hp.current', operator: 'greaterThan', value: 0 }
    ];
    const facts: Facts = { 'hp.current': 10 };
    const events = new Set<string>();

    expect(evaluateWhenConditions(conditions, facts, events)).toBe(true);
  });

  it('returns false when any condition fails', () => {
    const conditions: Condition[] = [
      { fact: 'hp.current' },
      { fact: 'hp.current', operator: 'greaterThan', value: 100 }
    ];
    const facts: Facts = { 'hp.current': 10 };
    const events = new Set<string>();

    expect(evaluateWhenConditions(conditions, facts, events)).toBe(false);
  });

  it('returns true for empty conditions array (vacuously true)', () => {
    const conditions: Condition[] = [];
    const facts: Facts = {};
    const events = new Set<string>();

    expect(evaluateWhenConditions(conditions, facts, events)).toBe(true);
  });
});

describe('isRuleApplicable', () => {
  it('returns true when enabled is undefined (defaults to true) and conditions pass', () => {
    const rule: Rule = {
      id: 'test-rule',
      when: [{ fact: 'hp.current' }],
      activities: []
    };
    const facts: Facts = { 'hp.current': 10 };
    const events = new Set<string>();

    expect(isRuleApplicable(rule, facts, events)).toBe(true);
  });

  it('returns true when enabled is true and conditions pass', () => {
    const rule: Rule = {
      id: 'test-rule',
      enabled: true,
      when: [{ fact: 'hp.current' }],
      activities: []
    };
    const facts: Facts = { 'hp.current': 10 };
    const events = new Set<string>();

    expect(isRuleApplicable(rule, facts, events)).toBe(true);
  });

  it('returns false when enabled is false', () => {
    const rule: Rule = {
      id: 'test-rule',
      enabled: false,
      when: [{ fact: 'hp.current' }],
      activities: []
    };
    const facts: Facts = { 'hp.current': 10 };
    const events = new Set<string>();

    expect(isRuleApplicable(rule, facts, events)).toBe(false);
  });

  it('returns false when conditions fail', () => {
    const rule: Rule = {
      id: 'test-rule',
      when: [{ fact: 'hp.current', operator: 'greaterThan', value: 100 }],
      activities: []
    };
    const facts: Facts = { 'hp.current': 10 };
    const events = new Set<string>();

    expect(isRuleApplicable(rule, facts, events)).toBe(false);
  });

  it('returns true when no when conditions (empty array)', () => {
    const rule: Rule = {
      id: 'test-rule',
      when: [],
      activities: []
    };
    const facts: Facts = {};
    const events = new Set<string>();

    expect(isRuleApplicable(rule, facts, events)).toBe(true);
  });
});
