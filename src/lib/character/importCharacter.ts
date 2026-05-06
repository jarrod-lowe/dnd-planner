import type { Rule } from '$lib/rules-engine';

export interface CharacterImport {
  name: string;
  species: string;
  ruleGroups: string[];
  customRules?: Rule[];
  effects: Rule[];
}

export interface ImportValidationResult {
  valid: boolean;
  data?: CharacterImport;
  errors?: string[];
}

export function validateCharacterImport(
  raw: unknown,
  availableRuleGroupIds: Set<string>
): ImportValidationResult {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['Invalid JSON: expected an object'] };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.schemaVersion !== 1) {
    errors.push('Unsupported schema version: expected 1');
  }

  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    errors.push('Missing or empty name');
  }

  if (typeof obj.species !== 'string' || obj.species.trim().length === 0) {
    errors.push('Missing or empty species');
  }

  if (!Array.isArray(obj.ruleGroups)) {
    errors.push('Missing or invalid ruleGroups: expected an array');
  } else {
    const missing = obj.ruleGroups.filter(
      (id) => typeof id !== 'string' || !availableRuleGroupIds.has(id)
    ) as string[];
    if (missing.length > 0) {
      errors.push(`Unknown rule groups: ${missing.join(', ')}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const data: CharacterImport = {
    name: (obj.name as string).trim(),
    species: (obj.species as string).trim(),
    ruleGroups: [...(obj.ruleGroups as string[])],
    effects: Array.isArray(obj.effects) ? [...(obj.effects as Rule[])] : []
  };

  if (Array.isArray(obj.customRules) && obj.customRules.length > 0) {
    data.customRules = [...(obj.customRules as Rule[])];
  }

  return { valid: true, data };
}

export interface ImportDependencies {
  createCharacter: (name: string, species: string) => Promise<{ characterId: string }>;
  fetchAssignedRuleGroups: (characterId: string) => Promise<string[]>;
  assignRuleGroup: (characterId: string, ruleGroupId: string) => Promise<void>;
  updateCustomRules: (characterId: string, rules: Rule[]) => Promise<void>;
  saveEffects: (characterId: string, effects: Rule[]) => Promise<void>;
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

  if (data.customRules && data.customRules.length > 0) {
    await deps.updateCustomRules(character.characterId, data.customRules);
  }

  if (data.effects.length > 0) {
    await deps.saveEffects(character.characterId, data.effects);
  }

  return character.characterId;
}
