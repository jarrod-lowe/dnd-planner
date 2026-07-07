import type { Character } from './types';
import type { EffectInstance } from '$lib/rules-engine';

/**
 * schemaVersion 2 stores `effects` as `EffectInstance[]` (the committed state),
 * where schemaVersion 1 stored bridged effect `Rule`s. Not backwards-compatible — a schemaVersion 1 export
 * is rejected on import (legacy characters are recreated, not carried forward).
 */
export interface CharacterExport {
  schemaVersion: 2;
  name: string;
  species: string;
  ruleGroups: string[];
  effects: EffectInstance[];
}

export function buildCharacterExport(
  character: Character,
  ruleGroupIds: string[],
  effects: EffectInstance[]
): CharacterExport {
  return {
    schemaVersion: 2,
    name: character.name,
    species: character.species,
    // The seeded per-character `custom-<id>` group is character-specific noise —
    // exporting it would assign a foreign id on import.
    ruleGroups: ruleGroupIds.filter((id) => !id.startsWith('custom-')),
    effects: [...effects]
  };
}
