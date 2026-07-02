import { migratePersistedEffects, type V1EffectRule } from './migrate';
import type { PlannedRef, SerializableInput } from './types';

/**
 * M4/W3 — assemble a v2 `SerializableInput` from a persisted (v1) character.
 *
 * A persisted character is its assigned rule-group ids plus a stored effect blob
 * (see DATA_MODEL.md: `CHAR#{id}` / `RULEGROUP#{id}` rows + the `/effects` array).
 * In v2 those map cleanly:
 *  - assigned ids → `ruleGroupIds` (the lazy loader resolves them to modules),
 *  - the effect blob → committed `EffectInstance`s (the W2 migration),
 *  - `inputFacts` is **empty** — the v2 build (abilities, equipment, prepared
 *    spells, proficiencies) lives entirely in committed effects, and everything
 *    else is a module derive; only ~4 parity scenarios ever set an input fact, all
 *    for state a real character carries as an effect or a derive.
 *  - `planned` starts empty; the turn's plan is layered on at play time.
 *
 * Pure and unit-tested; wiring it into the play store (loading the modules, running
 * `evaluate`) is W4, and proving the effect migration against real stored blobs is
 * W5 (env-gated).
 */
export interface PersistedCharacterV1 {
  /** The character's assigned rule-group ids (canonical bare ids). */
  ruleGroupIds: string[];
  /** The persisted v1 effect rules (the stored `/effects` blob). */
  effects: V1EffectRule[];
}

export interface CharacterInputResult {
  input: SerializableInput;
  /** Per-effect activities the migration could not statically resolve (W2). */
  unresolved: Record<string, string[]>;
}

export function characterToV2Input(
  character: PersistedCharacterV1,
  planned: PlannedRef[] = []
): CharacterInputResult {
  const { effects: committed, unresolved } = migratePersistedEffects(character.effects ?? []);
  return {
    input: {
      ruleGroupIds: character.ruleGroupIds ?? [],
      inputFacts: {},
      committed,
      planned
    },
    unresolved
  };
}
