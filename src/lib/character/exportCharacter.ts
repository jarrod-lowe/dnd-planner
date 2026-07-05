import type { Character } from './types';
import type { EffectInstance } from '$lib/rules-engine-v2';

/**
 * schemaVersion 2 stores `effects` as v2 `EffectInstance[]` (the committed state),
 * where v1 stored bridged effect `Rule`s. Not backwards-compatible — a v1 export
 * is rejected on import (pre-v2 characters are recreated, not carried forward).
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
    ruleGroups: [...ruleGroupIds],
    effects: [...effects]
  };
}
