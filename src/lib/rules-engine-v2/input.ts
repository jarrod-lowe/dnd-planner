import type { EngineInput, SerializableInput } from './types';
import { resolveModules } from './registry';

/**
 * Engine-input serialization.
 *
 * `evaluate` runs resolved `modules`, but a persisted/replayed turn must travel as
 * data — modules carry functions and don't survive JSON. So a turn round-trips as
 * `SerializableInput` (rule-group ids + facts/planned/committed): `serializeInput`
 * strips the modules, `resolveInput` rehydrates them via the registry. Keeping
 * resolution here (not in `evaluate`) is what lets `evaluate` stay pure and
 * registry-free — and lets M2 swap this sync resolver for the lazy chunk loader
 * without touching the engine.
 */

/** Project an input to its JSON-safe form (ids, not modules). Requires ids. */
export function serializeInput(input: EngineInput): SerializableInput {
  if (!input.ruleGroupIds) {
    throw new Error(
      'serializeInput: input has no ruleGroupIds; a modules-only input cannot be serialized'
    );
  }
  return {
    ruleGroupIds: input.ruleGroupIds,
    inputFacts: input.inputFacts,
    planned: input.planned,
    committed: input.committed
  };
}

/**
 * Rehydrate a serialized input into a runnable `EngineInput` using the static
 * registry. Unported ids are dropped (the registry's lenient resolution); M2's
 * lazy loader adds version/missing handling for the runtime path.
 */
export function resolveInput(serialized: SerializableInput): EngineInput {
  const { modules } = resolveModules(serialized.ruleGroupIds);
  return {
    modules,
    ruleGroupIds: serialized.ruleGroupIds,
    inputFacts: serialized.inputFacts,
    planned: serialized.planned,
    committed: serialized.committed
  };
}
