import { describe, it, expect, vi } from 'vitest';
import { validateCharacterImport, importCharacter } from '$lib/character/importCharacter';
import type { Rule } from '$lib/rules-engine';

const availableGroups = new Set(['dnd-5e-2024', 'species-human', 'class-paladin', 'class-fighter']);

describe('validateCharacterImport', () => {
  it('rejects JSON without schemaVersion', () => {
    const result = validateCharacterImport(
      { name: 'Thorin', species: 'human', ruleGroups: [] },
      availableGroups
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('rejects JSON with wrong schemaVersion', () => {
    const result = validateCharacterImport(
      { schemaVersion: 99, name: 'Thorin', species: 'human', ruleGroups: [] },
      availableGroups
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('rejects JSON without name', () => {
    const result = validateCharacterImport(
      { schemaVersion: 2, species: 'human', ruleGroups: [] },
      availableGroups
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('rejects JSON with empty name', () => {
    const result = validateCharacterImport(
      { schemaVersion: 2, name: '  ', species: 'human', ruleGroups: [] },
      availableGroups
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('rejects JSON without species', () => {
    const result = validateCharacterImport(
      { schemaVersion: 2, name: 'Thorin', ruleGroups: [] },
      availableGroups
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('rejects JSON without ruleGroups', () => {
    const result = validateCharacterImport(
      { schemaVersion: 2, name: 'Thorin', species: 'human' },
      availableGroups
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('rejects JSON where ruleGroups references unknown IDs', () => {
    const result = validateCharacterImport(
      {
        schemaVersion: 2,
        name: 'Thorin',
        species: 'human',
        ruleGroups: ['dnd-5e-2024', 'nonexistent-pack']
      },
      availableGroups
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(
      result.errors!.some(
        (e) =>
          e.code === 'importMissingRuleGroups' && e.params?.groups?.includes('nonexistent-pack')
      )
    ).toBe(true);
  });

  it('accepts valid JSON with all required fields', () => {
    const result = validateCharacterImport(
      {
        schemaVersion: 2,
        name: 'Thorin',
        species: 'human',
        ruleGroups: ['dnd-5e-2024', 'species-human']
      },
      availableGroups
    );

    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.name).toBe('Thorin');
    expect(result.data!.species).toBe('human');
    expect(result.data!.ruleGroups).toEqual(['dnd-5e-2024', 'species-human']);
    expect(result.data!.effects).toEqual([]);
  });

  it('accepts valid JSON with optional customRules and effects', () => {
    const effect = { id: 'effect-1', state: { 'bless.active': 1 }, expiry: { kind: 'permanent' } };
    const customRule = { id: 'custom-1', phase: 'normal', group: [], activities: [] };

    const result = validateCharacterImport(
      {
        schemaVersion: 2,
        name: 'Thorin',
        species: 'human',
        ruleGroups: ['dnd-5e-2024'],
        customRules: [customRule],
        effects: [effect]
      },
      availableGroups
    );

    expect(result.valid).toBe(true);
    expect(result.data!.customRules).toEqual([customRule]);
    expect(result.data!.effects).toEqual([effect]);
  });

  it('defaults effects to empty array when missing', () => {
    const result = validateCharacterImport(
      {
        schemaVersion: 2,
        name: 'Thorin',
        species: 'human',
        ruleGroups: ['dnd-5e-2024']
      },
      availableGroups
    );

    expect(result.valid).toBe(true);
    expect(result.data!.effects).toEqual([]);
  });

  it('collects multiple errors at once', () => {
    const result = validateCharacterImport({ schemaVersion: 2 }, availableGroups);

    expect(result.valid).toBe(false);
    expect(result.errors!.length).toBeGreaterThanOrEqual(3);
  });
});

describe('importCharacter', () => {
  const baseData = {
    name: 'Thorin',
    species: 'human',
    ruleGroups: ['dnd-5e-2024', 'species-human'],
    effects: []
  };
  const defaultAssigned = [
    'action-economy',
    'proficiency',
    'movement',
    'free-actions',
    'custom-char-new'
  ];

  function createMockDeps(assigned: string[] = []) {
    return {
      createCharacter: vi.fn().mockResolvedValue({ characterId: 'char-new' }),
      fetchAssignedRuleGroups: vi.fn().mockResolvedValue([...assigned]),
      assignRuleGroup: vi.fn().mockResolvedValue(undefined),
      updateCustomRules: vi.fn().mockResolvedValue(undefined),
      saveEffects: vi.fn().mockResolvedValue(undefined)
    };
  }

  it('creates character with the provided name and species', async () => {
    const deps = createMockDeps(defaultAssigned);
    await importCharacter(baseData, 'Thorin Jr', deps);

    expect(deps.createCharacter).toHaveBeenCalledWith('Thorin Jr', 'human');
  });

  it('fetches assigned rule groups after creating character', async () => {
    const deps = createMockDeps(defaultAssigned);
    await importCharacter(baseData, 'Thorin', deps);

    expect(deps.fetchAssignedRuleGroups).toHaveBeenCalledWith('char-new');
  });

  it('assigns only rule groups not already assigned', async () => {
    const deps = createMockDeps(defaultAssigned);
    await importCharacter(baseData, 'Thorin', deps);

    expect(deps.assignRuleGroup).toHaveBeenCalledWith('char-new', 'dnd-5e-2024');
    expect(deps.assignRuleGroup).toHaveBeenCalledWith('char-new', 'species-human');
    expect(deps.assignRuleGroup).toHaveBeenCalledTimes(2);
  });

  it('skips rule groups already assigned by character creation', async () => {
    const data = {
      ...baseData,
      ruleGroups: ['dnd-5e-2024', 'species-human', 'proficiency']
    };
    const deps = createMockDeps(defaultAssigned);
    await importCharacter(data, 'Thorin', deps);

    expect(deps.assignRuleGroup).toHaveBeenCalledWith('char-new', 'dnd-5e-2024');
    expect(deps.assignRuleGroup).toHaveBeenCalledWith('char-new', 'species-human');
    expect(deps.assignRuleGroup).toHaveBeenCalledTimes(2);
  });

  it('does not assign any groups when all are already assigned', async () => {
    const data = {
      ...baseData,
      ruleGroups: ['proficiency', 'movement']
    };
    const deps = createMockDeps(defaultAssigned);
    await importCharacter(data, 'Thorin', deps);

    expect(deps.assignRuleGroup).not.toHaveBeenCalled();
  });

  it('saves effects to the new character', async () => {
    const effect = { id: 'effect-bless', state: { 'bless.active': 1 }, expiry: { kind: 'permanent' as const } };
    const data = { ...baseData, effects: [effect] };
    const deps = createMockDeps(defaultAssigned);

    await importCharacter(data, 'Thorin', deps);

    expect(deps.saveEffects).toHaveBeenCalledWith('char-new', [effect]);
  });

  it('saves custom rules when present', async () => {
    const customRule: Rule = { id: 'custom-1', phase: 'normal', group: [], activities: [] };
    const data = { ...baseData, customRules: [customRule] };
    const deps = createMockDeps(defaultAssigned);

    await importCharacter(data, 'Thorin', deps);

    expect(deps.updateCustomRules).toHaveBeenCalledWith('char-new', [customRule]);
  });

  it('does not call updateCustomRules when no custom rules', async () => {
    const deps = createMockDeps(defaultAssigned);
    await importCharacter(baseData, 'Thorin', deps);

    expect(deps.updateCustomRules).not.toHaveBeenCalled();
  });

  it('returns the new character ID', async () => {
    const deps = createMockDeps(defaultAssigned);
    const result = await importCharacter(baseData, 'Thorin', deps);

    expect(result).toBe('char-new');
  });
});
