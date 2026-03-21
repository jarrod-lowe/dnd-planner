/* eslint-disable @typescript-eslint/no-unused-vars */
// TODO: Remove eslint-disable when implementing functions
import type { EngineInput, EngineOutput } from './types';
// TODO: Uncomment when implementing
// import { createBuiltinFunctionRegistry } from './functions';
// import { buildGroupStates } from './ordering';
// import { executePhase } from './phases';
// import { buildOutput } from './output';

/**
 * Main entry point for the rules engine.
 *
 * Evaluates all rules against the input state and returns:
 * - Projected facts (what would happen)
 * - Available rules (choices the UI can offer)
 * - Diagnostics (errors, warnings, notices)
 * - Trace information (what executed)
 * - Next input (replayable state for subsequent calls)
 *
 * ## Evaluation Flow
 *
 * 1. **Initialization**
 *    - Create working state from input facts
 *    - Build group states for ordering
 *    - Create function registry
 *    - Validate ordering constraints
 *
 * 2. **Phase Execution** (in order: early -> normal -> safeguard)
 *    - Get rules for phase
 *    - Process rules in dependency order
 *    - Execute activities, mutate working state
 *    - Collect generated rules for later phases
 *
 * 3. **Output Construction**
 *    - Build next input from working state
 *    - Construct final output object
 *
 * ## Statelessness
 *
 * The engine is fully stateless. Same input always produces equivalent output.
 * No side effects. All state is in the input/output.
 *
 * @param input - Complete input including schema version, rules, and state
 * @returns Complete output including status, facts, availableRules, diagnostics, trace, and next
 *
 * @calls createBuiltinFunctionRegistry
 * @calls buildGroupStates
 * @calls executePhase (3 times: early, normal, safeguard)
 * @calls buildOutput
 */
export function evaluate(_input: EngineInput): EngineOutput {
  throw new Error('Not implemented');
}
