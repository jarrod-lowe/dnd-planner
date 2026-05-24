import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Tests that the ability-scores rule group includes proficiency choices
 * with the correct structure.
 */
describe('ability-scores proficiency choices', () => {
  const yamlPath = path.resolve(process.cwd(), 'data/rule-groups/dnd-5e-2024/ability-scores.yaml');
  let rules: { id: string; activities?: unknown[]; ui?: Record<string, unknown> }[];

  beforeAll(() => {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    // Prepend shared definitions so YAML anchors like *error-clear resolve
    const sharedDefsPath = path.resolve(process.cwd(), 'data/rule-groups/_shared/definitions.yaml');
    const sharedDefs = fs.readFileSync(sharedDefsPath, 'utf-8');
    const data = yaml.load(sharedDefs + '\n' + content) as {
      ruleGroups: {
        rules: { id: string; activities?: unknown[]; ui?: Record<string, unknown> }[];
      }[];
    };
    rules = data.ruleGroups[0].rules;
  });

  it('has proficiency offer rules for all six stats', () => {
    const statNames = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const stat of statNames) {
      const offerRule = rules.find((r) => r.id === `proficiency-${stat}-offer`);
      expect(offerRule).toBeDefined();
    }
  });

  it('proficiency offers use configuration section', () => {
    const strOffer = rules.find((r) => r.id === 'proficiency-str-offer');
    expect(strOffer).toBeDefined();

    // Navigate into the offerRule activity to find the inner rule's ui
    const activities = strOffer!.activities as {
      type: string;
      rule?: { ui?: Record<string, unknown> };
    }[];
    const offerActivity = activities.find((a) => a.type === 'offerRule');
    expect(offerActivity).toBeDefined();
    expect(offerActivity!.rule!.ui!.section).toBe('configuration');
    // Verify name references the proficiency key
    expect(offerActivity!.rule!.ui!.name).toBe(
      'rule.dnd-5e-2024.ability-scores.proficiency-str.name'
    );
  });

  it('proficiency choices pack behind proficiency-str', () => {
    const statNames = ['dex', 'con', 'int', 'wis', 'cha'];
    for (const stat of statNames) {
      const offerRule = rules.find((r) => r.id === `proficiency-${stat}-offer`);
      expect(offerRule).toBeDefined();
      const activities = offerRule!.activities as {
        type: string;
        rule?: { ui?: Record<string, unknown> };
      }[];
      const offerActivity = activities.find((a) => a.type === 'offerRule');
      expect(offerActivity!.rule!.ui!.packBehind).toBe('proficiency-str');
    }
  });

  it('has standing rules that increment save by modifier', () => {
    const statNames = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const stat of statNames) {
      const saveModifier = rules.find((r) => r.id === `${stat}-save-modifier`);
      expect(saveModifier).toBeDefined();
    }
  });

  it('reset rules have no activities', () => {
    const statNames = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const stat of statNames) {
      const resetRule = rules.find((r) => r.id === `${stat}-value-reset`);
      expect(resetRule).toBeDefined();
      expect(resetRule!.activities).toEqual([]);
    }
  });

  it('ability score effects do NOT copy modifier to save', () => {
    // After the redesign, effects should NOT have numberCopy from modifier to save
    const statNames = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const stat of statNames) {
      const offerRule = rules.find(
        (r) =>
          r.id ===
          `set-${stat === 'str' ? 'strength' : stat === 'dex' ? 'dexterity' : stat === 'con' ? 'constitution' : stat === 'int' ? 'intelligence' : stat === 'wis' ? 'wisdom' : 'charisma'}-offer`
      );
      expect(offerRule).toBeDefined();
      // Check that the effect rule inside doesn't have a numberCopy targeting save
      const activities = offerRule!.activities as {
        type: string;
        rule?: { activities?: { type: string; target?: { fact?: string } }[] };
      }[];
      const offerActivity = activities.find((a) => a.type === 'offerRule');
      const effectActivities = offerActivity!.rule!.activities!;
      const saveCopy = effectActivities.find(
        (a) => a.type === 'numberCopy' && (a.target as { fact: string })?.fact === `${stat}.save`
      );
      expect(saveCopy).toBeUndefined();
    }
  });

  it('ability score effects have group for ordering', () => {
    const statNames = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const stat of statNames) {
      const offerRule = rules.find(
        (r) =>
          r.id ===
          `set-${stat === 'str' ? 'strength' : stat === 'dex' ? 'dexterity' : stat === 'con' ? 'constitution' : stat === 'int' ? 'intelligence' : stat === 'wis' ? 'wisdom' : 'charisma'}-offer`
      );
      // Navigate: offerRule -> offerRule activity -> rule -> advertiseEffect activity -> effect rule
      const activities = offerRule!.activities as {
        type: string;
        rule?: { activities?: { type: string; rule?: { group?: string[] } }[] };
      }[];
      const offerActivity = activities.find((a) => a.type === 'offerRule');
      const innerActivities = offerActivity!.rule!.activities!;
      const advertiseEffect = innerActivities.find((a) => a.type === 'advertiseEffect');
      const group = advertiseEffect!.rule!.group;
      expect(group).toContain(`${stat}-values`);
    }
  });
});
