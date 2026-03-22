import type {
  Activity,
  AvailableRuleEntry,
  EmitEventActivity,
  GenerateRuleActivity,
  NumberCopyActivity,
  NumberFunctionActivity,
  NumberIncrementActivity,
  NumberSetActivity,
  NumberSumActivity,
  OfferRuleActivity,
  RuleContext,
  WorkingState
} from './types';
import { isPhaseAfter } from './types';
import { createBuiltinFunctionRegistry } from './functions';
import { evaluateCondition, isRuleApplicable } from './conditions';

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
  switch (activity.type) {
    case 'numberSet':
      executeNumberSet(activity, context.workingState);
      break;
    case 'numberIncrement':
      executeNumberIncrement(activity, context.workingState);
      break;
    case 'numberCopy':
      executeNumberCopy(activity, context.workingState);
      break;
    case 'numberSum':
      executeNumberSum(activity, context.workingState);
      break;
    case 'numberFunction':
      executeNumberFunction(activity, context.workingState);
      break;
    case 'emitEvent':
      executeEmitEvent(activity, context.workingState);
      break;
    case 'generateRule':
      executeGenerateRule(activity, context);
      break;
    case 'offerRule':
      executeOfferRule(activity, context);
      break;
    default:
      throw new Error(`Unknown activity type: ${(activity as { type: string }).type}`);
  }
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
  for (const activity of activities) {
    executeActivity(activity, context);
  }
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
  state.facts[activity.target] = activity.number;
}

/**
 * Increments a numeric fact by a delta value.
 *
 * If the fact doesn't exist, it's treated as 0 before incrementing.
 * Optional `max` parameter caps the result using another fact's value.
 * Can use negative numbers to decrement.
 *
 * The increment value can come from either `number` (literal) or `source` (fact reference).
 * When `subtract` is true, the value is negated before applying.
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
  const current = (state.facts[activity.target] as number) ?? 0;

  // Get the increment value from either `number` or `source`
  let delta: number;
  if (activity.source !== undefined) {
    delta = (state.facts[activity.source] as number) ?? 0;
  } else if (activity.number !== undefined) {
    delta = activity.number;
  } else {
    throw new Error('numberIncrement activity requires either number or source');
  }

  // Apply subtract flag
  if (activity.subtract === true) {
    delta = -delta;
  }

  let result = current + delta;

  if (activity.max !== undefined) {
    const maxValue = (state.facts[activity.max] as number) ?? 0;
    result = Math.min(result, maxValue);
  }

  state.facts[activity.target] = result;
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
  state.facts[activity.target] = state.facts[activity.source] as number;
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
  let sum = 0;
  for (const arg of activity.args) {
    sum += (state.facts[arg] as number) ?? 0;
  }
  state.facts[activity.target] = sum;
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
  const registry = createBuiltinFunctionRegistry();
  const handler = registry.get(activity.function);

  if (!handler) {
    throw new Error(`Unknown function: ${activity.function}`);
  }

  const args = activity.args.map((arg) => state.facts[arg] as number | undefined);
  const result = handler(args);
  state.facts[activity.target] = result;
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
  state.events.add(activity.event);
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
  const rule = activity.rule;
  const targetPhase = rule.phase ?? 'normal';
  const currentPhase = context.currentPhase;

  // Can only generate rules for later phases
  if (!isPhaseAfter(targetPhase, currentPhase)) {
    throw new Error('Cannot generate rule for earlier or same phase');
  }

  context.workingState.generatedRules[targetPhase].push(rule);
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
  const { rule } = activity;
  const { workingState } = context;

  // Determine if the rule is applicable (its 'when' conditions are satisfied)
  const applicable = isRuleApplicable(rule, workingState.facts, workingState.events);

  // Determine legality based on legalWhen conditions
  // legalWhen contains conditions that make the rule LEGAL when they pass
  // If ANY condition fails, the rule is illegal with that entry's diagnostics
  let legal = true;
  const diagnostics: AvailableRuleEntry['diagnostics'] = [];

  if (activity.legalWhen) {
    for (const entry of activity.legalWhen) {
      if (!evaluateCondition(entry.condition, workingState.facts, workingState.events)) {
        // Condition failed - rule is illegal
        legal = false;
        diagnostics.push(...entry.illegalDiagnostics);
      }
    }
  }

  const entry: AvailableRuleEntry = {
    rule,
    legal,
    applicable,
    diagnostics
  };

  workingState.offeredRules.push(entry);
}
