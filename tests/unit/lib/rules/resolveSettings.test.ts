import { describe, it, expect } from 'vitest';
import { resolveSettings, discoverSettingsSteps } from '$lib/rules/resolveSettings';
import type { SettingDefinition } from '$lib/rules/settingsTypes';

describe('resolveSettings', () => {
  const selectSetting: SettingDefinition = {
    id: 'skill-1',
    type: 'select',
    translations: { en: { name: 'Skill Proficiency' } },
    options: [
      { value: 'athletics', translations: { en: { name: 'Athletics' } } },
      { value: 'insight', translations: { en: { name: 'Insight' } } }
    ],
    effect: {
      id: 'skill-proficiency-${value}',
      activities: [
        {
          type: 'numberSet',
          target: { fact: 'skill.${value}.proficiency' },
          source: { value: 1 }
        }
      ]
    }
  };

  const selectRuleGroupSetting: SettingDefinition = {
    id: 'mastery-1',
    type: 'select-rule-group',
    translations: { en: { name: 'Weapon Mastery' } },
    options: [
      { value: 'greataxe-mastery', translations: { en: { name: 'Greataxe' } } },
      { value: 'dagger-mastery', translations: { en: { name: 'Dagger' } } }
    ]
  };

  it('creates effects from select settings', () => {
    const result = resolveSettings(
      [
        {
          ruleGroupId: 'class-paladin-level1',
          settings: [selectSetting],
          values: { 'skill-1': 'athletics' }
        }
      ],
      () => undefined
    );
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].id).toBe('class-paladin-level1::skill-proficiency-athletics');
    expect(result.additionalRuleGroupIds).toHaveLength(0);
  });

  it('collects rule group IDs from select-rule-group settings', () => {
    const result = resolveSettings(
      [
        {
          ruleGroupId: 'class-paladin-level1',
          settings: [selectRuleGroupSetting],
          values: { 'mastery-1': 'greataxe-mastery' }
        }
      ],
      () => undefined
    );
    expect(result.effects).toHaveLength(0);
    expect(result.additionalRuleGroupIds).toEqual(['greataxe-mastery']);
  });

  it('includes dependencies of select-rule-group targets', () => {
    const lookupMeta = (id: string) => {
      if (id === 'greataxe-mastery') return { requires: ['weapon-mastery-base'] };
      return undefined;
    };
    const result = resolveSettings(
      [
        {
          ruleGroupId: 'class-paladin-level1',
          settings: [selectRuleGroupSetting],
          values: { 'mastery-1': 'greataxe-mastery' }
        }
      ],
      lookupMeta
    );
    expect(result.additionalRuleGroupIds).toEqual(['greataxe-mastery', 'weapon-mastery-base']);
  });

  it('handles mixed settings types', () => {
    const lookupMeta = (id: string) => {
      if (id === 'greataxe-mastery') return { requires: [] };
      return undefined;
    };
    const result = resolveSettings(
      [
        {
          ruleGroupId: 'class-paladin-level1',
          settings: [selectSetting, selectRuleGroupSetting],
          values: {
            'skill-1': 'athletics',
            'mastery-1': 'greataxe-mastery'
          }
        }
      ],
      lookupMeta
    );
    expect(result.effects).toHaveLength(1);
    expect(result.additionalRuleGroupIds).toEqual(['greataxe-mastery']);
  });

  it('skips unanswered settings', () => {
    const result = resolveSettings(
      [
        {
          ruleGroupId: 'class-paladin-level1',
          settings: [selectSetting],
          values: {}
        }
      ],
      () => undefined
    );
    expect(result.effects).toHaveLength(0);
    expect(result.additionalRuleGroupIds).toHaveLength(0);
  });

  it('handles empty groups', () => {
    const result = resolveSettings([], () => undefined);
    expect(result.effects).toHaveLength(0);
    expect(result.additionalRuleGroupIds).toHaveLength(0);
  });

  it('deduplicates additional rule group IDs', () => {
    const lookupMeta = (id: string) => {
      if (id === 'greataxe-mastery') return { requires: ['shared-dep'] };
      if (id === 'dagger-mastery') return { requires: ['shared-dep'] };
      return undefined;
    };
    const result = resolveSettings(
      [
        {
          ruleGroupId: 'class-paladin-level1',
          settings: [
            { ...selectRuleGroupSetting, id: 'mastery-1' },
            { ...selectRuleGroupSetting, id: 'mastery-2' }
          ],
          values: {
            'mastery-1': 'greataxe-mastery',
            'mastery-2': 'dagger-mastery'
          }
        }
      ],
      lookupMeta
    );
    expect(result.additionalRuleGroupIds).toEqual([
      'greataxe-mastery',
      'shared-dep',
      'dagger-mastery'
    ]);
  });
});

describe('discoverSettingsSteps', () => {
  it('returns empty when no rule groups have settings', () => {
    const lookupMeta = () => ({
      name: '',
      description: '',
      requires: [],
      settings: []
    });
    const steps = discoverSettingsSteps(['species-human', 'movement'], lookupMeta);
    expect(steps).toEqual([]);
  });

  it('returns groups that have settings', () => {
    const settings: SettingDefinition[] = [
      {
        id: 's1',
        type: 'select',
        translations: { en: { name: 'S1' } },
        options: []
      }
    ];
    const lookupMeta = (id: string) => {
      if (id === 'class-paladin-level1')
        return {
          name: 'Paladin Level 1',
          description: '',
          requires: [],
          settings
        };
      return { name: id, description: '', requires: [], settings: [] };
    };
    const steps = discoverSettingsSteps(['species-human', 'class-paladin-level1'], lookupMeta);
    expect(steps).toHaveLength(1);
    expect(steps[0].ruleGroupId).toBe('class-paladin-level1');
    expect(steps[0].settings).toEqual(settings);
  });

  it('returns empty for unknown rule groups', () => {
    const lookupMeta = () => undefined;
    const steps = discoverSettingsSteps(['unknown-group'], lookupMeta);
    expect(steps).toEqual([]);
  });
});
