import { describe, it, expect } from 'vitest';
import { characterToV2Input } from '$lib/rules-engine-v2/character-input';

/**
 * M4/W3 — assembling a v2 SerializableInput from a persisted v1 character
 * (ruleGroupIds + migrated committed effects; empty inputFacts/planned).
 */

describe('character-input — characterToV2Input', () => {
  it('carries assigned ids and migrates the effect blob to committed effects', () => {
    const { input } = characterToV2Input({
      ruleGroupIds: ['ability-scores', 'class-paladin-level1', 'spell-bless'],
      effects: [
        {
          id: 'effect-str',
          group: ['str-value-base'],
          activities: [
            { type: 'numberSet', target: { fact: 'str.value' }, source: { number: 16 } },
            { type: 'advertiseEffect', self: true }
          ]
        }
      ]
    });
    expect(input.ruleGroupIds).toEqual(['ability-scores', 'class-paladin-level1', 'spell-bless']);
    expect(input.inputFacts).toEqual({});
    expect(input.planned).toEqual([]);
    expect(input.committed).toEqual([
      {
        id: 'effect-str',
        key: 'str-value-base',
        state: { 'str.value': 16 },
        stateCombine: { 'str.value': 'override' },
        expiry: { kind: 'permanent' }
      }
    ]);
  });

  it('layers a supplied plan onto the assembled input', () => {
    const { input } = characterToV2Input(
      { ruleGroupIds: ['attacks'], effects: [] },
      [{ instanceId: 'i0', ruleId: 'unarmed-strike-use-action' }]
    );
    expect(input.planned).toEqual([{ instanceId: 'i0', ruleId: 'unarmed-strike-use-action' }]);
    expect(input.committed).toEqual([]);
  });

  it('surfaces migration unresolved notes (eval-time effect sources)', () => {
    const { unresolved } = characterToV2Input({
      ruleGroupIds: [],
      effects: [{ id: 'effect-derived', activities: [{ type: 'numberSet', target: { fact: 'a' }, source: { fact: 'b' } }] }]
    });
    expect(unresolved).toEqual({ 'effect-derived': ['numberSet a'] });
  });

  it('tolerates a bare character record (missing arrays)', () => {
    const { input } = characterToV2Input({} as never);
    expect(input.ruleGroupIds).toEqual([]);
    expect(input.committed).toEqual([]);
  });
});
