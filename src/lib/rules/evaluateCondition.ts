import type { RuleGroupCondition } from './conditionTypes';
import type { Facts } from '$lib/rules-engine/types';

function compareValues(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case 'equals':
      return actual === expected;
    case 'notEquals':
      return actual !== expected;
    case 'greaterThan':
      return actual > expected;
    case 'greaterThanOrEqual':
      return actual >= expected;
    case 'lessThan':
      return actual < expected;
    case 'lessThanOrEqual':
      return actual <= expected;
    default:
      return false;
  }
}

function evaluateSingle(condition: RuleGroupCondition, facts: Facts): boolean {
  // Only OrCondition carries `type`, so `in` narrows the union both ways.
  if ('type' in condition) {
    return condition.clauses.some((clause) => evaluateSingle(clause, facts));
  }
  const actual = facts[condition.fact] ?? 0;
  if (typeof actual !== 'number') return false;
  return compareValues(actual, condition.operator, condition.value);
}

export function evaluateRuleGroupConditions(
  conditions: RuleGroupCondition[] | undefined,
  facts: Facts
): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((condition) => evaluateSingle(condition, facts));
}
