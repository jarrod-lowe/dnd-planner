import type { Phase, Rule, RuleContext } from './types';
import { isRuleApplicable } from './conditions';
import { areDependenciesSatisfied, markRuleExecuted, markRuleSkipped } from './ordering';
import { executeRuleActivities } from './activities';

/**
 * Executes all rules in a single phase.
 *
 * This is the main evaluation loop for a phase:
 * 1. Get rules for this phase (standing + planned + effects + generated)
 * 2. Validate ordering within the phase
 * 3. Process rules in dependency order
 *
 * Phase execution order: early -> normal -> safeguard
 * Generated rules from earlier phases are available to later phases.
 *
 * @param phase - The phase to execute
 * @param context - The rule execution context
 *
 * @calls getRulesForPhase, processRulesInOrder
 * @calledBy evaluate (evaluate.ts) - once per phase (early, normal, safeguard)
 */
export function executePhase(phase: Phase, context: RuleContext): void {
  // Set the current phase in context
  context.currentPhase = phase;

  // Get all rules for this phase
  const rules = getRulesForPhase(context, phase);

  // Process rules in dependency order
  processRulesInOrder(rules, context);
}

/**
 * Collects all rules that should execute in a given phase.
 *
 * Combines rules from:
 * - input.rules.standing (if matching phase)
 * - input.rules.planned (if matching phase)
 * - input.rules.effects (if matching phase)
 * - workingState.generatedRules[phase] (rules generated during earlier phases)
 *
 * @param context - The rule execution context
 * @param phase - The phase to get rules for
 * @returns Array of rules for this phase
 *
 * @calledBy executePhase
 */
export function getRulesForPhase(context: RuleContext, phase: Phase): Rule[] {
  const rules: Rule[] = [];

  // Collect from standing rules
  for (const rule of context.input.rules.standing) {
    const rulePhase = rule.phase ?? 'normal';
    if (rulePhase === phase) {
      rules.push(rule);
    }
  }

  // Collect from planned rules
  for (const rule of context.input.rules.planned) {
    const rulePhase = rule.phase ?? 'normal';
    if (rulePhase === phase) {
      rules.push(rule);
    }
  }

  // Collect from effects rules
  for (const rule of context.input.rules.effects) {
    const rulePhase = rule.phase ?? 'normal';
    if (rulePhase === phase) {
      rules.push(rule);
    }
  }

  // Collect from generated rules
  for (const rule of context.workingState.generatedRules[phase]) {
    rules.push(rule);
  }

  return rules;
}

/**
 * Processes rules in dependency order within a single phase.
 *
 * Algorithm (iterative for v1):
 * 1. Loop until no more rules can be processed:
 *    a. Find rules where dependencies are satisfied (areDependenciesSatisfied)
 *    b. For each such rule:
 *       - If applicable (isRuleApplicable): execute, mark as executed
 *       - If not applicable: skip, mark as skipped
 *    c. If no rules were processed in this iteration, we're deadlocked
 * 2. After all rules processed, check for any that couldn't execute (cycle detection)
 *
 * Note: Implementation can be changed to queue-based later without API changes.
 *
 * @param rules - All rules in this phase to process
 * @param context - The rule execution context
 *
 * @calls isRuleApplicable (conditions.ts)
 * @calls areDependenciesSatisfied (ordering.ts)
 * @calls executeRuleActivities (activities.ts)
 * @calls markRuleExecuted (ordering.ts)
 * @calls markRuleSkipped (ordering.ts)
 * @calledBy executePhase
 */
export function processRulesInOrder(rules: Rule[], context: RuleContext): void {
  if (rules.length === 0) return;

  const processed = new Set<string>();

  // Iterative processing until no more rules can be processed
  let madeProgress = true;
  while (madeProgress) {
    madeProgress = false;

    for (const rule of rules) {
      // Skip already processed rules
      if (processed.has(rule.id)) continue;

      // Check if dependencies are satisfied
      if (!areDependenciesSatisfied(rule, context.groups)) {
        continue;
      }

      // Dependencies satisfied - check if applicable
      const applicable = isRuleApplicable(rule, context.workingState.facts, context.workingState.events);

      if (applicable) {
        executeRuleActivities(rule.activities, context);
        markRuleExecuted(rule, context.groups);
      } else {
        markRuleSkipped(rule, context.groups);
      }

      processed.add(rule.id);
      madeProgress = true;
    }
  }
}
