import type { Condition, Facts } from '$lib/rules-view/types';

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
 * Used by the panel renderer to gate secondary controls and effect facts on
 * `when`-style conditions authored in rule metadata. Operates purely on the
 * engine→UI view types (`Condition`/`Facts`); it does not touch the engine.
 *
 * Handles three condition types:
 * - FactExistenceCondition: checks if a fact exists (truthy)
 * - FactComparisonCondition: compares a fact value using operators
 * - EventCondition: checks if an event is present in the supplied set
 *
 * @param condition - The condition to evaluate
 * @param facts - Current facts
 * @param events - Events to test EventConditions against
 * @returns true if the condition is satisfied, false otherwise
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
    const actual = facts[condition.fact] ?? 0;
    if (typeof actual !== 'number') return false;
    return compareValues(actual, condition.operator, condition.value);
  }

  // EventCondition: has 'event' key
  if ('event' in condition) {
    return events.has(condition.event);
  }

  throw new Error('Unknown condition type');
}
