/* eslint-disable @typescript-eslint/no-unused-vars */
// TODO: Remove eslint-disable when implementing functions
import type {
  Activity,
  EmitEventActivity,
  GenerateRuleActivity,
  NumberCopyActivity,
  NumberFunctionActivity,
  NumberIncrementActivity,
  NumberSetActivity,
  NumberSumActivity,
  OfferRuleActivity,
  Rule,
  RuleContext,
  WorkingState
} from './types';

/**
 * Executes a single activity by dispatching to the appropriate handler.
 *
 * Uses the activity's `type` field to determine which handler to invoke.
 * Mutates the working state (facts, events, generated rules, etc.).
 *
 * @param activity - The activity to execute
 * @param context - The rule execution context containing working state and all rules
 *
 * @calls executeNumberSet, executeNumberIncrement, executeNumberCopy, executeNumberSum,
 *        executeNumberFunction, executeEmitEvent, executeGenerateRule, executeOfferRule
 * @calledBy executeRuleActivities
 */
export function executeActivity(activity: Activity, context: RuleContext): void {
  throw new Error('Not implemented');
}

/**
 * Executes all activities in a rule in order.
 *
 * Activities are executed sequentially, and each activity sees the state
 * mutations from previous activities in the same rule.
 *
 * @param activities - Array of activities to execute
 * @param context - The rule execution context
 *
 * @calls executeActivity
 * @calledBy processRulesInOrder (phases.ts)
 */
export function executeRuleActivities(activities: Activity[], context: RuleContext): void {
  throw new Error('Not implemented');
}

/**
 * Sets a numeric fact to a specific value.
 *
 * Overwrites any existing value at the target fact path.
 *
 * @param activity - The number_set activity
 * @param state - Working state to mutate
 *
 * @calledBy executeActivity
 */
export function executeNumberSet(activity: NumberSetActivity, state: WorkingState): void {
  throw new Error('Not implemented');
}

/**
 * Increments a numeric fact by a delta value.
 *
 * If the fact doesn't exist, it's treated as 0 before incrementing.
 * Optional `max` parameter caps the result using another fact's value.
 * Can use negative numbers to decrement.
 *
 * @param activity - The number_increment activity
 * @param state - Working state to mutate
 *
 * @calledBy executeActivity
 */
export function executeNumberIncrement(
  activity: NumberIncrementActivity,
  state: WorkingState
): void {
  throw new Error('Not implemented');
}

/**
 * Copies a value from one fact to another.
 *
 * Reads the source fact and writes to the target fact.
 * If source doesn't exist, behavior depends on implementation (likely undefined/0).
 *
 * @param activity - The number_copy activity
 * @param state - Working state to mutate
 *
 * @calledBy executeActivity
 */
export function executeNumberCopy(activity: NumberCopyActivity, state: WorkingState): void {
  throw new Error('Not implemented');
}

/**
 * Sets a fact to the sum of multiple other facts.
 *
 * Missing facts are treated as 0.
 * Useful for derived stats like hp.max = hp.base + hp.bonus.
 *
 * @param activity - The number_sum activity
 * @param state - Working state to mutate
 *
 * @calledBy executeActivity
 */
export function executeNumberSum(activity: NumberSumActivity, state: WorkingState): void {
  throw new Error('Not implemented');
}

/**
 * Sets a fact using a named function with fact arguments.
 *
 * Looks up the function in the registry, resolves fact references to values,
 * and stores the result in the target fact.
 * Example: statToModifier(str.value) -> str.modifier
 *
 * @param activity - The number_function activity
 * @param state - Working state to mutate
 *
 * @calledBy executeActivity
 * @calls FunctionRegistry (to look up and execute the named function)
 */
export function executeNumberFunction(activity: NumberFunctionActivity, state: WorkingState): void {
  throw new Error('Not implemented');
}

/**
 * Emits an event for this evaluation.
 *
 * Events are transient - they exist only during the current evaluation.
 * Other rules can check for events using EventCondition in their `when` clauses.
 * Events do not appear in the output `next` object.
 *
 * @param activity - The emit_event activity
 * @param state - Working state to mutate (adds to events Set)
 *
 * @calledBy executeActivity
 */
export function executeEmitEvent(activity: EmitEventActivity, state: WorkingState): void {
  throw new Error('Not implemented');
}

/**
 * Generates a new rule during evaluation.
 *
 * The generated rule is added to the appropriate phase's generated rules array.
 * Generated rules can only target a LATER phase than the current rule:
 * - early rules can generate normal or safeguard rules
 * - normal rules can generate safeguard rules
 * - safeguard rules cannot generate any rules
 *
 * If the generated rule should persist, it will be included in next.rules.effects.
 *
 * @param activity - The generate_rule activity
 * @param context - Rule context (needed to access currentPhase and generatedRules)
 *
 * @calledBy executeActivity
 */
export function executeGenerateRule(activity: GenerateRuleActivity, context: RuleContext): void {
  throw new Error('Not implemented');
}

/**
 * Offers a rule as a potential choice for the UI.
 *
 * Does NOT execute the offered rule. Instead, adds it to availableRules
 * with legality metadata based on legalWhen conditions.
 *
 * The offered rule can be added to rules.planned in a subsequent evaluation.
 * Even if legalWhen fails, the rule is still offered (with legal: false).
 *
 * @param activity - The offer_rule activity
 * @param context - Rule context (needed for current facts to evaluate legalWhen)
 *
 * @calledBy executeActivity
 * @calls evaluateWhenConditions (for legalWhen evaluation)
 */
export function executeOfferRule(activity: OfferRuleActivity, context: RuleContext): void {
  throw new Error('Not implemented');
}
