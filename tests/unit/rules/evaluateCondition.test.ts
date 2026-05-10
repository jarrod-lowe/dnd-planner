import { describe, it, expect } from 'vitest';
import { evaluateRuleGroupConditions } from '$lib/rules/evaluateCondition';
import type { RuleGroupCondition } from '$lib/rules/conditionTypes';
import type { Facts } from '$lib/rules-engine/types';

describe('evaluateRuleGroupConditions', () => {
  describe('no conditions', () => {
    it('returns true when conditions is undefined', () => {
      expect(evaluateRuleGroupConditions(undefined, {})).toBe(true);
    });

    it('returns true when conditions is empty array', () => {
      expect(evaluateRuleGroupConditions([], {})).toBe(true);
    });
  });

  describe('single fact condition', () => {
    it('returns true when equals matches', () => {
      const conditions: RuleGroupCondition[] = [
        { fact: 'str.value', operator: 'equals', value: 14 }
      ];
      const facts: Facts = { 'str.value': 14 };
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(true);
    });

    it('returns false when equals does not match', () => {
      const conditions: RuleGroupCondition[] = [
        { fact: 'str.value', operator: 'equals', value: 14 }
      ];
      const facts: Facts = { 'str.value': 10 };
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(false);
    });

    it('returns true when greaterThanOrEqual passes', () => {
      const conditions: RuleGroupCondition[] = [
        { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 }
      ];
      const facts: Facts = { 'str.value': 14 };
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(true);
    });

    it('returns false when greaterThanOrEqual fails', () => {
      const conditions: RuleGroupCondition[] = [
        { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 }
      ];
      const facts: Facts = { 'str.value': 10 };
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(false);
    });
  });

  describe('AND logic (multiple conditions)', () => {
    it('returns true when all conditions pass', () => {
      const conditions: RuleGroupCondition[] = [
        { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 },
        { fact: 'dex.value', operator: 'greaterThanOrEqual', value: 13 }
      ];
      const facts: Facts = { 'str.value': 14, 'dex.value': 14 };
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(true);
    });

    it('returns false when one condition fails', () => {
      const conditions: RuleGroupCondition[] = [
        { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 },
        { fact: 'dex.value', operator: 'greaterThanOrEqual', value: 13 }
      ];
      const facts: Facts = { 'str.value': 14, 'dex.value': 10 };
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(false);
    });
  });

  describe('OR condition', () => {
    it('returns true when first clause matches', () => {
      const conditions: RuleGroupCondition[] = [
        {
          type: 'or',
          clauses: [
            { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 },
            { fact: 'dex.value', operator: 'greaterThanOrEqual', value: 13 }
          ]
        }
      ];
      const facts: Facts = { 'str.value': 14, 'dex.value': 8 };
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(true);
    });

    it('returns true when second clause matches', () => {
      const conditions: RuleGroupCondition[] = [
        {
          type: 'or',
          clauses: [
            { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 },
            { fact: 'dex.value', operator: 'greaterThanOrEqual', value: 13 }
          ]
        }
      ];
      const facts: Facts = { 'str.value': 10, 'dex.value': 14 };
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(true);
    });

    it('returns false when no clauses match', () => {
      const conditions: RuleGroupCondition[] = [
        {
          type: 'or',
          clauses: [
            { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 },
            { fact: 'dex.value', operator: 'greaterThanOrEqual', value: 13 }
          ]
        }
      ];
      const facts: Facts = { 'str.value': 10, 'dex.value': 10 };
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(false);
    });
  });

  describe('missing facts', () => {
    it('treats missing facts as 0, so greaterThanOrEqual 13 fails', () => {
      const conditions: RuleGroupCondition[] = [
        { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 }
      ];
      const facts: Facts = {};
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(false);
    });

    it('treats missing facts as 0, so equals 0 passes', () => {
      const conditions: RuleGroupCondition[] = [
        { fact: 'str.value', operator: 'equals', value: 0 }
      ];
      const facts: Facts = {};
      expect(evaluateRuleGroupConditions(conditions, facts)).toBe(true);
    });
  });

  describe('all comparison operators', () => {
    const facts: Facts = { 'str.value': 10 };

    it('notEquals', () => {
      expect(
        evaluateRuleGroupConditions([{ fact: 'str.value', operator: 'notEquals', value: 5 }], facts)
      ).toBe(true);
      expect(
        evaluateRuleGroupConditions(
          [{ fact: 'str.value', operator: 'notEquals', value: 10 }],
          facts
        )
      ).toBe(false);
    });

    it('greaterThan', () => {
      expect(
        evaluateRuleGroupConditions(
          [{ fact: 'str.value', operator: 'greaterThan', value: 9 }],
          facts
        )
      ).toBe(true);
      expect(
        evaluateRuleGroupConditions(
          [{ fact: 'str.value', operator: 'greaterThan', value: 10 }],
          facts
        )
      ).toBe(false);
    });

    it('lessThan', () => {
      expect(
        evaluateRuleGroupConditions([{ fact: 'str.value', operator: 'lessThan', value: 11 }], facts)
      ).toBe(true);
      expect(
        evaluateRuleGroupConditions([{ fact: 'str.value', operator: 'lessThan', value: 10 }], facts)
      ).toBe(false);
    });

    it('lessThanOrEqual', () => {
      expect(
        evaluateRuleGroupConditions(
          [{ fact: 'str.value', operator: 'lessThanOrEqual', value: 10 }],
          facts
        )
      ).toBe(true);
      expect(
        evaluateRuleGroupConditions(
          [{ fact: 'str.value', operator: 'lessThanOrEqual', value: 9 }],
          facts
        )
      ).toBe(false);
    });
  });

  describe('Sentinel prerequisite', () => {
    const sentinelCondition: RuleGroupCondition[] = [
      {
        type: 'or',
        clauses: [
          { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 },
          { fact: 'dex.value', operator: 'greaterThanOrEqual', value: 13 }
        ]
      }
    ];

    it('passes with STR 14, DEX 8', () => {
      expect(
        evaluateRuleGroupConditions(sentinelCondition, { 'str.value': 14, 'dex.value': 8 })
      ).toBe(true);
    });

    it('passes with STR 10, DEX 14', () => {
      expect(
        evaluateRuleGroupConditions(sentinelCondition, { 'str.value': 10, 'dex.value': 14 })
      ).toBe(true);
    });

    it('fails with STR 10, DEX 10', () => {
      expect(
        evaluateRuleGroupConditions(sentinelCondition, { 'str.value': 10, 'dex.value': 10 })
      ).toBe(false);
    });

    it('fails with no ability scores set', () => {
      expect(evaluateRuleGroupConditions(sentinelCondition, {})).toBe(false);
    });
  });
});
