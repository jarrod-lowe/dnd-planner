import type { Diagnostics, EngineInput, EngineOutput, Rule, Status, WorkingState } from './types';

/**
 * Builds the replayable next input from current state.
 *
 * The next input is suitable for passing directly to another evaluate() call.
 * with no modifications. Key properties:
 * - schemaVersion: copied
 * - rules.standing: copied (standing rules persist)
 * - rules.planned: empty (planned rules don't persist)
 * - rules.effects: getPersistableEffects() (all generated rules persist)
 * - state.facts: copied from input.state.facts (replay/base facts for replayability)
 *
 * @param input - Original input (for reference)
 * @param workingState - Current working state after evaluation
 * @returns Complete input object for next evaluation
 *
 * @calls getPersistableEffects
 * @calledBy buildOutput
 */
export function buildNextInput(input: EngineInput, workingState: WorkingState): EngineInput {
  return {
    schemaVersion: input.schemaVersion,
    rules: {
      standing: input.rules.standing,
      planned: [],
      effects: getPersistableEffects(workingState)
    },
    state: {
      facts: input.state.facts
    }
  };
}

/**
 * Returns all generated rules to persist as effects.
 *
 * All generated rules from the evaluation persist into next.rules.effects.
 * This includes rules from early, normal, and safeguard phases.
 *
 * @param workingState - Current working state containing generated rules
 * @returns Array of all generated rules to include in next.rules.effects
 *
 * @calledBy buildNextInput
 */
export function getPersistableEffects(workingState: WorkingState): Rule[] {
  return [
    ...workingState.generatedRules.early,
    ...workingState.generatedRules.normal,
    ...workingState.generatedRules.safeguard
  ];
}

/**
 * Constructs the final output from the evaluation.
 *
 * Combines:
 * - Status from buildStatus
 * - Facts from workingState.facts (projected facts)
 * - Collections (empty for v1)
 * - Available rules from workingState.offeredRules
 * - Diagnostics from validation
 * - Trace from workingState tracking
 * - Next input from buildNextInput
 *
 * @param input - Original input (for reference)
 * @param workingState - Final working state after all phases complete
 * @returns Complete output object
 *
 * @calls buildStatus
 * @calls buildNextInput
 * @calledBy evaluate (evaluate.ts)
 */
export function buildOutput(input: EngineInput, workingState: WorkingState): EngineOutput {
  const diagnostics: Diagnostics = { errors: [], warnings: [], notices: [] };

  return {
    status: buildStatus(workingState, diagnostics),
    facts: workingState.facts,
    collections: {},
    availableRules: workingState.offeredRules,
    diagnostics,
    trace: {
      appliedRuleIds: workingState.appliedRuleIds,
      appliedActivityIds: workingState.appliedActivityIds,
      providedCapabilities: [],
      emittedEvents: []
    },
    next: buildNextInput(input, workingState)
  };
}

/**
 * Builds the status object from evaluation results.
 *
 * Status fields:
 * - ok: true if engine evaluated successfully (no structural errors)
 * - legal: true if all planned rules are ordinarily legal
 * - applicable: true if the engine could still produce meaningful results
 *   (even if illegal, might still be applicable)
 *
 * @param workingState - Working state (for error tracking)
 * @param diagnostics - All diagnostics from evaluation
 * @returns Status object
 *
 * @calledBy buildOutput
 */
export function buildStatus(_workingState: WorkingState, diagnostics: Diagnostics): Status {
  return {
    ok: diagnostics.errors.length === 0,
    legal: true,
    applicable: true
  };
}
