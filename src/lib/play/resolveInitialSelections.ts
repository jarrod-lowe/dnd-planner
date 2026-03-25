/**
 * Resolves initial selections for vars marked with `capture: true`.
 *
 * When a rule with capture vars is added to the plan, this utility resolves
 * the var defaults from the current facts and returns them as selections.
 * This "captures" the state at add time rather than deriving from final facts.
 *
 * @param rule - The rule being added to the plan
 * @param facts - Current facts from the engine output
 * @returns Selections object with captured values
 */
import type { Rule, Facts } from '$lib/rules-engine';

export function resolveInitialSelections(rule: Rule, facts: Facts): Record<string, unknown> {
  const selections: Record<string, unknown> = {};

  if (!rule.vars) {
    return selections;
  }

  for (const [varName, varDef] of Object.entries(rule.vars)) {
    // Only process vars with capture: true
    if (!varDef.capture) {
      continue;
    }

    const defaultSource = varDef.default;

    // Resolve number default
    if (defaultSource.number !== undefined) {
      selections[varName] = defaultSource.number;
      continue;
    }

    // Resolve fact default
    if (defaultSource.fact !== undefined) {
      const factValue = facts[defaultSource.fact];
      // Only include if fact exists and is not null/undefined
      if (factValue !== undefined && factValue !== null) {
        selections[varName] = factValue;
      }
      continue;
    }
  }

  return selections;
}
