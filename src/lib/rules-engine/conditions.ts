import type { Condition, Facts, Rule } from './types';

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

/**
 * Evaluates a single condition against the current facts and events.
 *
 * Handles three condition types:
 * - FactExistenceCondition: checks if a fact exists
 * - FactComparisonCondition: compares a fact value using operators (equals, greaterThan, etc.)
 * - EventCondition: checks if an event was emitted during this evaluation
 *
 * @param condition - The condition to evaluate
 * @param facts - Current working facts
 * @param events - Events emitted during this evaluation
 * @returns true if the condition is satisfied, false otherwise
 *
 * @calledBy evaluateWhenConditions
 */
export function evaluateCondition(
  condition: Condition,
  facts: Facts,
  events: Set<string>
): boolean {
  // FactExistenceCondition: check if 'fact' key exists but not 'operator'
  if ('fact' in condition && !('operator' in condition)) {
    const value = facts[condition.fact];
    return Boolean(value);
  }

  // FactComparisonCondition: has 'fact', 'operator', and 'value'
  if ('operator' in condition) {
    const actual = facts[condition.fact];
    if (typeof actual !== 'number') return false;
    return compareValues(actual, condition.operator, condition.value);
  }

  // EventCondition: has 'event' key
  if ('event' in condition) {
    return events.has(condition.event);
  }

  throw new Error('Unknown condition type');
}

/**
 * Evaluates all conditions in a `when` array (AND logic).
 *
 * All conditions must be satisfied for this to return true.
 * An empty conditions array returns true (vacuously true).
 *
 * @param conditions - Array of conditions to evaluate
 * @param facts - Current working facts
 * @param events - Events emitted during this evaluation
 * @returns true if all conditions are satisfied, false otherwise
 *
 * @calls evaluateCondition
 * @calledBy isRuleApplicable
 */
export function evaluateWhenConditions(
  conditions: Condition[],
  facts: Facts,
  events: Set<string>
): boolean {
  return conditions.every((condition) => evaluateCondition(condition, facts, events));
}

/**
 * Determines if a rule is applicable for execution.
 *
 * A rule is applicable if:
 * - `enabled` is not `false` (defaults to true)
 * - all `when` conditions are satisfied
 *
 * Note: This does NOT check `after` dependencies - that's handled separately
 * in ordering.ts via areDependenciesSatisfied().
 *
 * @param rule - The rule to check
 * @param facts - Current working facts
 * @param events - Events emitted during this evaluation
 * @returns true if the rule should be considered for execution
 *
 * @calls evaluateWhenConditions
 * @calledBy processRulesInOrder (phases.ts)
 */
export function isRuleApplicable(rule: Rule, facts: Facts, events: Set<string>): boolean {
  // Check if rule is explicitly disabled
  if (rule.enabled === false) {
    return false;
  }

  // Evaluate when conditions (defaults to empty array = vacuously true)
  return evaluateWhenConditions(rule.when ?? [], facts, events);
}
