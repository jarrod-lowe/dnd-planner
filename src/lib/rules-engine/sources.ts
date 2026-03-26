/**
 * Source resolution for the rules engine.
 *
 * Sources are unified value references used in activities.
 * They can be:
 * - { number: x } - A literal numeric value
 * - { fact: "name" } - Reference to a fact in working state
 * - { var: "name" } - Reference to a rule variable (resolved via selections or vars.default)
 */

import type { Source, WorkingState, Rule } from './types';
import { evaluateCondition } from './conditions';

/**
 * Validates that a Source has exactly one of fact, number, var, condition, or string.
 * Throws an error if the source is invalid.
 */
export function validateSource(source: Source): void {
  const keys = Object.keys(source);
  const validKeys = ['fact', 'number', 'var', 'condition', 'string'];
  const presentKeys = keys.filter((k) => validKeys.includes(k));

  if (presentKeys.length !== 1) {
    throw new Error(
      `Invalid source: must have exactly one of fact, number, var, condition, or string. Got: ${JSON.stringify(source)}`
    );
  }
}

/**
 * Resolves a Source to a concrete numeric value.
 *
 * Resolution order:
 * 1. { number: x } → return x directly
 * 2. { fact: "name" } → look up in workingState.facts
 * 3. { var: "varName" } → selections[varName] ?? vars[varName].default, then resolve default
 *
 * @param source - The source to resolve
 * @param workingState - The current working state containing facts
 * @param rule - The rule containing vars and selections
 * @returns The resolved number, or undefined if not found
 */
export function resolveSource(
  source: Source,
  workingState: WorkingState,
  rule: Rule
): number | undefined {
  // { number: x } - literal value
  if (source.number !== undefined) {
    return source.number;
  }

  // { fact: "name" } - fact reference
  if (source.fact !== undefined) {
    return workingState.facts[source.fact] as number | undefined;
  }

  // { var: "name" } - variable reference
  if (source.var !== undefined) {
    const varName = source.var;

    // Check selections first (user-provided value)
    if (rule.selections && varName in rule.selections) {
      return rule.selections[varName] as number;
    }

    // Check varsRuntime (activity-set values)
    if (rule.varsRuntime && varName in rule.varsRuntime) {
      return rule.varsRuntime[varName];
    }

    // Fall back to vars.default
    const varDef = rule.vars?.[varName];
    if (!varDef) {
      return undefined;
    }

    const defaultSource = varDef.default;

    // default is flat - only { number } or { fact }, not { var }
    if (defaultSource.number !== undefined) {
      return defaultSource.number;
    }

    if (defaultSource.fact !== undefined) {
      return workingState.facts[defaultSource.fact] as number | undefined;
    }

    return undefined;
  }

  // { condition: {...} } - evaluate condition, return 1 if true, 0 if false
  if (source.condition !== undefined) {
    const result = evaluateCondition(source.condition, workingState.facts, workingState.events);
    return result ? 1 : 0;
  }

  return undefined;
}

/**
 * Resolves a Source to a string value.
 * Only handles string sources - use resolveSource for numeric values.
 *
 * @param source - The source to resolve
 * @returns The string value, or undefined if not a string source
 */
export function resolveStringSource(source: Source): string | undefined {
  // { string: "value" } - literal string value
  if (source.string !== undefined) {
    return source.string;
  }

  return undefined;
}
