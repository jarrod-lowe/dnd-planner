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
  SetClearActivity,
  SetAddActivity,
  Target
} from './types';
import { isPhaseAfter } from './types';
import { createBuiltinFunctionRegistry } from './functions';
import { evaluateCondition, isRuleApplicable } from './conditions';
import { resolveSource, resolveStringSource } from './sources';

/**
 * Sets a value at the target location.
 * For fact targets: writes to workingState.facts
 * For var targets: writes to currentRule's runtime vars
 */
function setTargetValue(target: Target, value: number, context: RuleContext): void {
  if (target.fact !== undefined) {
    context.workingState.facts[target.fact] = value;
  } else if (target.var !== undefined) {
    const rule = context.currentRule;
    if (!rule) {
      throw new Error('Cannot set var target without currentRule in context');
    }
    // Initialize vars runtime store if needed
    if (!rule.varsRuntime) {
      rule.varsRuntime = {};
    }
    rule.varsRuntime[target.var] = value;
  } else {
    throw new Error('Target must have either fact or var');
  }
}

/**
 * Gets a value from the target location for increment operations.
 * For fact targets: reads from workingState.facts
 * For var targets: reads from currentRule's runtime vars
 */
function getTargetValue(target: Target, context: RuleContext): number {
  if (target.fact !== undefined) {
    return (context.workingState.facts[target.fact] as number) ?? 0;
  } else if (target.var !== undefined) {
    const rule = context.currentRule;
    if (!rule) {
      throw new Error('Cannot get var target without currentRule in context');
    }
    return (rule.varsRuntime?.[target.var] as number) ?? 0;
  }
  return 0;
}

/**
 * Executes a single activity by dispatching to the appropriate handler.
 *
 * Uses the activity's `type` field to determine which handler to invoke.
 * Mutates the working state (facts, events, generated rules, etc.).
 *
 * If the activity has a `when` condition that evaluates to false, the activity is skipped.
 *
 * @param activity - The activity to execute
 * @param context - The rule execution context containing working state and all rules
 *
 * @calls executeNumberSet, executeNumberIncrement, executeNumberCopy, executeNumberSum,
 *        executeNumberFunction, executeEmitEvent, executeGenerateRule, executeOfferRule
 * @calledBy executeRuleActivities
 */
export function executeActivity(activity: Activity, context: RuleContext): void {
  // Check if activity has a when condition that gates execution
  if (activity.when !== undefined) {
    const conditionMet = evaluateCondition(
      activity.when,
      context.workingState.facts,
      context.workingState.events
    );
    if (!conditionMet) {
      return; // Skip this activity
    }
  }

  switch (activity.type) {
    case 'numberSet':
      executeNumberSet(activity, context);
      break;
    case 'numberIncrement':
      executeNumberIncrement(activity, context);
      break;
    case 'numberCopy':
      executeNumberCopy(activity, context);
      break;
    case 'numberSum':
      executeNumberSum(activity, context);
      break;
    case 'numberFunction':
      executeNumberFunction(activity, context);
      break;
    case 'emitEvent':
      executeEmitEvent(activity, context);
      break;
    case 'generateRule':
      executeGenerateRule(activity, context);
      break;
    case 'offerRule':
      executeOfferRule(activity, context);
      break;
    case 'setClear':
      executeSetClear(activity, context);
      break;
    case 'setAdd':
      executeSetAdd(activity, context);
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
 * @param context - Rule context containing working state and current rule
 *
 * @calledBy executeActivity
 */
export function executeNumberSet(activity: NumberSetActivity, context: RuleContext): void {
  const rule = context.currentRule;
  if (!rule) {
    throw new Error('executeNumberSet requires currentRule in context');
  }
  const value = resolveSource(activity.source, context.workingState, rule);
  setTargetValue(activity.target, value ?? 0, context);
}

/**
 * Increments a numeric fact by a delta value.
 *
 * If the fact doesn't exist, it's treated as 0 before incrementing.
 * Optional `max` parameter caps the result using another fact's value.
 * When `subtract` is true, the value is negated before applying.
 *
 * @param activity - The number_increment activity
 * @param context - Rule context containing working state and current rule
 *
 * @calledBy executeActivity
 */
export function executeNumberIncrement(
  activity: NumberIncrementActivity,
  context: RuleContext
): void {
  const rule = context.currentRule;
  if (!rule) {
    throw new Error('executeNumberIncrement requires currentRule in context');
  }

  const current = getTargetValue(activity.target, context);
  const delta = resolveSource(activity.source, context.workingState, rule) ?? 0;

  // Apply subtract flag
  const effectiveDelta = activity.subtract === true ? -delta : delta;

  let result = current + effectiveDelta;

  if (activity.max !== undefined) {
    const maxValue = (context.workingState.facts[activity.max] as number) ?? 0;
    result = Math.min(result, maxValue);
  }

  setTargetValue(activity.target, result, context);
}

/**
 * Copies a value from one fact to another.
 *
 * Reads the source and writes to the target fact.
 * If source doesn't exist, behavior depends on implementation (likely undefined/0).
 *
 * @param activity - The number_copy activity
 * @param context - Rule context containing working state and current rule
 *
 * @calledBy executeActivity
 */
export function executeNumberCopy(activity: NumberCopyActivity, context: RuleContext): void {
  const rule = context.currentRule;
  if (!rule) {
    throw new Error('executeNumberCopy requires currentRule in context');
  }
  const value = resolveSource(activity.source, context.workingState, rule);
  if (value !== undefined) {
    setTargetValue(activity.target, value, context);
  }
}

/**
 * Sets a fact to the sum of multiple sources.
 *
 * Missing values are treated as 0.
 * Useful for derived stats like hp.max = hp.base + hp.bonus.
 *
 * @param activity - The number_sum activity
 * @param context - Rule context containing working state and current rule
 *
 * @calledBy executeActivity
 */
export function executeNumberSum(activity: NumberSumActivity, context: RuleContext): void {
  const rule = context.currentRule;
  if (!rule) {
    throw new Error('executeNumberSum requires currentRule in context');
  }

  let sum = 0;
  for (const source of activity.sources) {
    sum += resolveSource(source, context.workingState, rule) ?? 0;
  }
  setTargetValue(activity.target, sum, context);
}

/**
 * Sets a fact using a named function with source arguments.
 *
 * Looks up the function in the registry, resolves sources to values,
 * and stores the result in the target fact.
 * Example: statToModifier(str.value) -> str.modifier
 * Example: multiply(movement.remaining, { multiplier: 0.5 }) -> movement.half
 *
 * @param activity - The number_function activity
 * @param context - Rule context containing working state and current rule
 *
 * @calledBy executeActivity
 * @calls FunctionRegistry (to look up and execute the named function)
 */
export function executeNumberFunction(
  activity: NumberFunctionActivity,
  context: RuleContext
): void {
  const rule = context.currentRule;
  if (!rule) {
    throw new Error('executeNumberFunction requires currentRule in context');
  }

  const registry = createBuiltinFunctionRegistry();
  const handler = registry.get(activity.function);

  if (!handler) {
    throw new Error(`Unknown function: ${activity.function}`);
  }

  const sourceArgs = activity.sources.map((source) =>
    resolveSource(source, context.workingState, rule)
  );
  const result = handler(sourceArgs, activity.args);
  setTargetValue(activity.target, result, context);
}

/**
 * Emits an event for this evaluation.
 *
 * Events are transient - they exist only during the current evaluation.
 * Other rules can check for events using EventCondition in their `when` clauses.
 * Events do not appear in the output `next` object.
 *
 * @param activity - The emit_event activity
 * @param context - Rule context containing working state
 *
 * @calledBy executeActivity
 */
export function executeEmitEvent(activity: EmitEventActivity, context: RuleContext): void {
  context.workingState.events.add(activity.event);
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
        if (entry.illegalDiagnostics) {
          diagnostics.push(...entry.illegalDiagnostics);
        }
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

/**
 * Clears a var target, initializing it to an empty array.
 *
 * Used to reset collection vars like error message lists before
 * conditionally adding items with setAdd.
 *
 * @param activity - The setClear activity
 * @param context - Rule context containing current rule with varsRuntime
 *
 * @calledBy executeActivity
 */
export function executeSetClear(activity: SetClearActivity, context: RuleContext): void {
  if (activity.target.var !== undefined) {
    const rule = context.currentRule;
    if (!rule) {
      throw new Error('executeSetClear requires currentRule in context');
    }
    if (!rule.varsRuntime) {
      rule.varsRuntime = {};
    }
    rule.varsRuntime[activity.target.var] = [];
  } else {
    throw new Error('setClear activity requires a var target');
  }
}

/**
 * Adds a string to a var target array (deduplicates).
 *
 * Used for collecting error message i18n keys. If the string is already
 * present in the array, it will not be added again.
 *
 * @param activity - The setAdd activity
 * @param context - Rule context containing current rule with varsRuntime
 *
 * @calledBy executeActivity
 */
export function executeSetAdd(activity: SetAddActivity, context: RuleContext): void {
  if (activity.target.var !== undefined) {
    const rule = context.currentRule;
    if (!rule) {
      throw new Error('executeSetAdd requires currentRule in context');
    }

    const value = resolveStringSource(activity.source);
    if (value === undefined) {
      return; // No string value to add
    }

    if (!rule.varsRuntime) {
      rule.varsRuntime = {};
    }

    // Get existing array or initialize empty
    const existing = rule.varsRuntime[activity.target.var];
    const arr: unknown[] = Array.isArray(existing) ? existing : [];

    // Deduplicate - only add if not already present
    if (!arr.includes(value)) {
      arr.push(value);
    }

    rule.varsRuntime[activity.target.var] = arr;
  } else {
    throw new Error('setAdd activity requires a var target');
  }
}
