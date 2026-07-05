import type { Character } from './types';
import type { Rule } from '$lib/rules-engine';
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
  customRules?: Rule[];
  effects: EffectInstance[];
}

export function buildCharacterExport(
  character: Character,
  ruleGroupIds: string[],
  effects: EffectInstance[],
  ruleGroupRulesMap?: Record<string, Rule[]>
): CharacterExport {
  const customGroupId = `custom-${character.characterId}`;
  const customRules = ruleGroupRulesMap?.[customGroupId];

  const result: CharacterExport = {
    schemaVersion: 2,
    name: character.name,
    species: character.species,
    ruleGroups: ruleGroupIds.filter((id) => id !== customGroupId),
    effects: [...effects]
  };

  if (customRules && customRules.length > 0) {
    result.customRules = [...customRules];
  }

  return result;
}
