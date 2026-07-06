import { describe, it, expect } from 'vitest';
import { buildCharacterExport } from '$lib/character/exportCharacter';
import type { Character } from '$lib/character/types';
import type { EffectInstance } from '$lib/rules-engine-v2';

const baseCharacter: Character = {
  characterId: 'char-1',
  userId: 'user-1',
  name: 'Thorin',
  species: 'human',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('buildCharacterExport', () => {
  it('builds export payload with character data and rule groups', () => {
    const ruleGroupIds = ['dnd-5e-2024', 'species-human', 'class-paladin'];
    const result = buildCharacterExport(baseCharacter, ruleGroupIds, []);

    expect(result.schemaVersion).toBe(2);
    expect(result.name).toBe('Thorin');
    expect(result.species).toBe('human');
    expect(result.ruleGroups).toEqual(['dnd-5e-2024', 'species-human', 'class-paladin']);
    expect(result.effects).toEqual([]);
  });

  it('includes active effects in export', () => {
    const effect: EffectInstance = {
      id: 'effect-bless-1',
      key: 'bless',
      state: { 'concentration.spent': 1 },
      expiry: { kind: 'permanent' }
    };

    const result = buildCharacterExport(baseCharacter, [], [effect]);

    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].id).toBe('effect-bless-1');
  });

  it('copies arrays to avoid mutation', () => {
    const ruleGroupIds = ['dnd-5e-2024'];
    const effects: EffectInstance[] = [{ id: 'effect-1', expiry: { kind: 'permanent' } }];

    const result = buildCharacterExport(baseCharacter, ruleGroupIds, effects);

    ruleGroupIds.push('extra');
    effects.push({ id: 'effect-2', expiry: { kind: 'permanent' } });

    expect(result.ruleGroups).toEqual(['dnd-5e-2024']);
    expect(result.effects).toHaveLength(1);
  });

  it('filters the per-character custom-* group id out of the export', () => {
    // The seeds assign a character-specific `custom-<id>` group; exporting it
    // would pollute imports with a foreign id (and break once seeds stop).
    const result = buildCharacterExport(
      baseCharacter,
      ['dnd-5e-2024', 'custom-char-1', 'class-paladin'],
      []
    );

    expect(result.ruleGroups).toEqual(['dnd-5e-2024', 'class-paladin']);
  });
});
