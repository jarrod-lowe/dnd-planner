import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Tests that the ability-scores rule group maps intents to the correct
 * sub-buckets under the STAT verb.
 */
describe('ability-scores intent sub-buckets', () => {
  const yamlPath = path.resolve(process.cwd(), 'data/rule-groups/dnd-5e-2024/ability-scores.yaml');
  let rules: { id: string; activities?: unknown[]; ui?: Record<string, unknown> }[];

  beforeAll(() => {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    const sharedDefsPath = path.resolve(process.cwd(), 'data/rule-groups/_shared/definitions.yaml');
    const sharedDefs = fs.readFileSync(sharedDefsPath, 'utf-8');
    const data = yaml.load(sharedDefs + '\n' + content) as {
      ruleGroups: {
        rules: { id: string; activities?: unknown[]; ui?: Record<string, unknown> }[];
      }[];
    };
    rules = data.ruleGroups[0].rules;
  });

  function getIntentOfOfferRule(offerRuleId: string): Record<string, string> | undefined {
    const offerRule = rules.find((r) => r.id === offerRuleId);
    if (!offerRule) return undefined;
    const activities = offerRule.activities as {
      type: string;
      rule?: { ui?: Record<string, unknown> };
    }[];
    const offerActivity = activities.find((a) => a.type === 'offerRule');
    if (!offerActivity?.rule?.ui) return undefined;
    return offerActivity.rule.ui.intents as Record<string, string> | undefined;
  }

  const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const fullNames: Record<string, string> = {
    str: 'strength',
    dex: 'dexterity',
    con: 'constitution',
    int: 'intelligence',
    wis: 'wisdom',
    cha: 'charisma'
  };

  describe('set-* rules map to STAT:set', () => {
    for (const stat of stats) {
      it(`set-${stat} has intents { STAT: set }`, () => {
        const intents = getIntentOfOfferRule(`set-${fullNames[stat]}-offer`);
        expect(intents).toEqual({ STAT: 'set' });
      });
    }
  });

  describe('increase-* rules map to STAT:increase', () => {
    for (const stat of stats) {
      it(`increase-${stat} has intents { STAT: increase }`, () => {
        const intents = getIntentOfOfferRule(`increase-${fullNames[stat]}-offer`);
        expect(intents).toEqual({ STAT: 'increase' });
      });
    }
  });

  describe('save proficiency rules map to PROFICIENCY:save', () => {
    for (const stat of stats) {
      it(`proficiency-${stat} has intents { PROFICIENCY: save }`, () => {
        const intents = getIntentOfOfferRule(`proficiency-${stat}-offer`);
        expect(intents).toEqual({ PROFICIENCY: 'save' });
      });
    }
  });

  describe('topBar uses saving-throw proficiency flags (not modifiers)', () => {
    it('proficiencyFact for each ability uses .proficient flag', () => {
      const resetRule = rules.find((r) => r.id === 'str-value-reset');
      const topBar = resetRule?.ui?.topBar as
        | Array<{
            type: string;
            abilities?: Array<{ name: string; proficiencyFact?: string; saveFact?: string }>;
          }>
        | undefined;
      expect(topBar).toBeDefined();
      const abilityEntry = topBar?.find((e) => e.type === 'ability');
      expect(abilityEntry?.abilities).toBeDefined();
      for (const ability of abilityEntry?.abilities ?? []) {
        expect(ability.proficiencyFact).toMatch(/\.proficient$/);
      }
    });

    it('saveFact for each ability points to the save modifier fact', () => {
      const resetRule = rules.find((r) => r.id === 'str-value-reset');
      const topBar = resetRule?.ui?.topBar as
        | Array<{
            type: string;
            abilities?: Array<{ name: string; saveFact?: string }>;
          }>
        | undefined;
      const abilityEntry = topBar?.find((e) => e.type === 'ability');
      expect(abilityEntry?.abilities).toBeDefined();
      for (const ability of abilityEntry?.abilities ?? []) {
        expect(ability.saveFact).toMatch(/\.save$/);
      }
    });
  });

  describe('skill proficiency rules map to PROFICIENCY:skill', () => {
    const skills = [
      'athletics',
      'acrobatics',
      'animal-handling',
      'arcana',
      'deception',
      'history',
      'insight',
      'intimidation',
      'investigation',
      'medicine',
      'nature',
      'perception',
      'performance',
      'persuasion',
      'religion',
      'sleight-of-hand',
      'stealth',
      'survival'
    ];

    for (const skill of skills) {
      it(`proficiency-${skill} has intents { PROFICIENCY: skill }`, () => {
        const intents = getIntentOfOfferRule(`${skill}-proficiency-offer`);
        expect(intents).toEqual({ PROFICIENCY: 'skill' });
      });
    }
  });
});
