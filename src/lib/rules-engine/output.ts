/* eslint-disable @typescript-eslint/no-unused-vars */
// TODO: Remove eslint-disable when implementing functions
import type {
  Diagnostics,
  EngineInput,
  EngineOutput,
  GroupState,
  Rule,
  Status,
  WorkingState
} from './types';

/**
 * Builds the replayable next input from current state.
 *
 * The next input is suitable for passing directly to another evaluate() call.
 * with no modifications. Key properties:
 * - schemaVersion: copied
 * - rules.standing: copied (standing rules persist)
 * - rules.planned: empty (planned rules don't persist)
 * - rules.effects: getPersistableEffects() (only effects that should persist)
 * - state.facts: copied from workingState.facts (these are replay/base facts, not projected facts)
 *
 * @param input - Original input (for reference)
 * @param workingState - Current working state after evaluation
 * @returns Complete input object for next evaluation
 *
 * @calls getPersistableEffects
 * @calledBy buildOutput
 */
export function buildNextInput(input: EngineInput, workingState: WorkingState): EngineInput {
  throw new Error('Not implemented');
}

/**
 * Determines which generated rules should persist as effects.
 *
 * A generated rule should persist if:
 * - It was created by a generate_rule activity
 * - It has a phase of 'safeguard' (normal phase rules with ongoing effects)
 * - It will continue to affect future evaluations
 *
 * Non-persisting generated rules are one-shot effects for the current evaluation only.
 *
 * @param workingState - Current working state containing generated rules
 * @returns Array of rules to include in next.rules.effects
 *
 * @calledBy buildNextInput
 */
export function getPersistableEffects(workingState: WorkingState): Rule[] {
  throw new Error('Not implemented');
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
 * @param groups - All group states (for trace info)
 * @returns Complete output object
 *
 * @calls buildStatus
 * @calls buildNextInput
 * @calledBy evaluate (evaluate.ts)
 */
export function buildOutput(
  input: EngineInput,
  workingState: WorkingState,
  groups: Map<string, GroupState>
): EngineOutput {
  throw new Error('Not implemented');
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
export function buildStatus(workingState: WorkingState, diagnostics: Diagnostics): Status {
  throw new Error('Not implemented');
}
