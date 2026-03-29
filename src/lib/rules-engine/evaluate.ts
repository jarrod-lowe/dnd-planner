import type { EngineInput, EngineOutput, WorkingState, RuleContext } from './types';
import { createBuiltinFunctionRegistry } from './functions';
import { buildGroupStates } from './ordering';
import { executePhase } from './phases';
import { buildOutput } from './output';

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
 * The engine is deterministic: the same input must produce a semantically equivalent output.
 * The engine is idempotent: calling it multiple times with the same input must not change the result.
 * The output must include a next object that is a complete, valid input document.
 * If the engine is called again using the returned next as input (with no changes), the result must be semantically equivalent to the previous output.
 * next must contain only durable, replayable state (no transient evaluation data).
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
export function evaluate(input: EngineInput): EngineOutput {
  // 1. Initialize working state
  // Seed the effect counter from existing effects to avoid ID collisions.
  // When effects persist across turns (e.g. self-sustaining effects), their IDs
  // contain a numeric suffix like "effect-foo-1". If the counter resets to 0,
  // newly advertised effects would produce colliding IDs (e.g. "effect-foo-1" again).
  // By scanning existing effect IDs for their max numeric suffix, we ensure new
  // effects always get unique IDs.
  const existingEffectCounter = input.rules.effects.reduce((max, rule) => {
    const match = rule.id.match(/-(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);

  const workingState: WorkingState = {
    facts: { ...input.state.facts },
    events: new Set(),
    generatedRules: { early: [], normal: [], safeguard: [] },
    advertisedEffects: [],
    advertisedEffectCounter: existingEffectCounter,
    offeredRules: [],
    appliedRuleIds: [],
    appliedActivityIds: []
  };

  // 2. Build group states for each phase
  const allRules = [...input.rules.standing, ...input.rules.planned, ...input.rules.effects];

  // Build groups for each phase (groups are phase-specific)
  const groups = new Map<string, import('./types').GroupState>();
  const earlyGroups = buildGroupStates(
    allRules.filter((r) => (r.phase ?? 'normal') === 'early'),
    'early'
  );
  const normalGroups = buildGroupStates(
    allRules.filter((r) => (r.phase ?? 'normal') === 'normal'),
    'normal'
  );
  const safeguardGroups = buildGroupStates(
    allRules.filter((r) => (r.phase ?? 'normal') === 'safeguard'),
    'safeguard'
  );

  // Merge all groups into single map
  for (const [key, value] of earlyGroups) groups.set(key, value);
  for (const [key, value] of normalGroups) groups.set(key, value);
  for (const [key, value] of safeguardGroups) groups.set(key, value);

  // 3. Create function registry (unused in v1 but required for completeness)
  createBuiltinFunctionRegistry();

  // 4. Execute phases in order
  const context: RuleContext = {
    input,
    workingState,
    groups,
    currentPhase: 'early',
    allRules
  };

  executePhase('early', context);
  executePhase('normal', context);
  executePhase('safeguard', context);

  // 5. Build and return output
  return buildOutput(input, workingState);
}
