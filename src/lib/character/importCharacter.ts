import type { EffectInstance } from '$lib/rules-engine-v2';

export interface CharacterImport {
  name: string;
  species: string;
  ruleGroups: string[];
  effects: EffectInstance[];
}

export interface ImportValidationError {
  code: string;
  params?: Record<string, string>;
}

export interface ImportValidationResult {
  valid: boolean;
  data?: CharacterImport;
  errors?: ImportValidationError[];
}

export function validateCharacterImport(
  raw: unknown,
  availableRuleGroupIds: Set<string>
): ImportValidationResult {
  const errors: ImportValidationError[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: [{ code: 'importInvalidJson' }] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.schemaVersion !== 2) {
    errors.push({ code: 'importInvalidVersion' });
  }

  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    errors.push({ code: 'importErrorMissingName' });
  }

  if (typeof obj.species !== 'string' || obj.species.trim().length === 0) {
    errors.push({ code: 'importErrorMissingSpecies' });
  }

  if (!Array.isArray(obj.ruleGroups)) {
    errors.push({ code: 'importErrorMissingRuleGroups' });
  } else {
    const missing = obj.ruleGroups.filter(
      (id) => typeof id !== 'string' || !availableRuleGroupIds.has(id)
    ) as string[];
    if (missing.length > 0) {
      errors.push({ code: 'importMissingRuleGroups', params: { groups: missing.join(', ') } });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const data: CharacterImport = {
    name: (obj.name as string).trim(),
    species: (obj.species as string).trim(),
    ruleGroups: [...(obj.ruleGroups as string[])],
    effects: Array.isArray(obj.effects) ? [...(obj.effects as EffectInstance[])] : []
  };

  return { valid: true, data };
}

export interface ImportDependencies {
  createCharacter: (name: string, species: string) => Promise<{ characterId: string }>;
  fetchAssignedRuleGroups: (characterId: string) => Promise<string[]>;
  assignRuleGroup: (characterId: string, ruleGroupId: string) => Promise<void>;
  saveEffects: (characterId: string, effects: EffectInstance[]) => Promise<void>;
}

export async function importCharacter(
  data: CharacterImport,
  characterName: string,
  deps: ImportDependencies
): Promise<string> {
  const character = await deps.createCharacter(characterName, data.species);

  const assigned = new Set(await deps.fetchAssignedRuleGroups(character.characterId));
  const toAssign = data.ruleGroups.filter((id) => !assigned.has(id));

  for (const ruleGroupId of toAssign) {
    await deps.assignRuleGroup(character.characterId, ruleGroupId);
  }

  if (data.effects.length > 0) {
    await deps.saveEffects(character.characterId, data.effects);
  }

  return character.characterId;
}
