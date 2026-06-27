import type { EngineInput, SerializableInput } from './types';

/**
 * Engine-input serialization (the pure, registry-free half).
 *
 * `evaluate` runs resolved `modules`, but a persisted/replayed turn must travel as
 * data — modules carry functions and don't survive JSON. So a turn round-trips as
 * `SerializableInput` (rule-group ids + facts/planned/committed): `serializeInput`
 * strips the modules here; rehydration (`resolveInput`, registry-coupled) lives in
 * `registry.ts` so this module — and the runtime barrel — stay registry-free and
 * don't eager-load every rule module.
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
