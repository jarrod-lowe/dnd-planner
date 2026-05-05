import type { Character } from './types';
import type { Rule } from '$lib/rules-engine';

export interface CharacterExport {
  schemaVersion: 1;
  name: string;
  species: string;
  ruleGroups: string[];
  customRules?: Rule[];
  effects: Rule[];
}

export function buildCharacterExport(
  character: Character,
  ruleGroupIds: string[],
  effects: Rule[],
  ruleGroupRulesMap?: Record<string, Rule[]>
): CharacterExport {
  const customGroupId = `custom-${character.characterId}`;
  const customRules = ruleGroupRulesMap?.[customGroupId];

  const result: CharacterExport = {
    schemaVersion: 1,
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
