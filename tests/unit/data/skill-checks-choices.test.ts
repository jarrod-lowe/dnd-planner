import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Tests that the skill-checks rule group includes offer rules
 * for all 18 skills with the correct structure.
 */
describe('skill-checks rule group structure', () => {
  const yamlPath = path.resolve(process.cwd(), 'data/rule-groups/dnd-5e-2024/skill-checks.yaml');
  let rules: {
    id: string;
    activities?: {
      type: string;
      rule?: {
        id?: string;
        ui?: Record<string, unknown>;
        vars?: Record<string, { capture?: boolean; default?: { fact?: string } }>;
        activities?: unknown[];
      };
    }[];
  }[];

  beforeAll(() => {
    const content = fs.readFileSync(yamlPath, 'utf-8');
    const data = yaml.load(content) as {
      ruleGroups: {
        rules: typeof rules;
      }[];
    };
    rules = data.ruleGroups[0].rules;
  });

  const skillKeys = [
    'acrobatics',
    'animal-handling',
    'arcana',
    'athletics',
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

  it('has offer rules for all 18 skills', () => {
    for (const skill of skillKeys) {
      const offerRule = rules.find((r) => r.id === `roll-skill-${skill}-offer`);
      expect(offerRule).toBeDefined();
    }
  });

  it('all skill offers use dice-line primary control', () => {
    for (const skill of skillKeys) {
      const offerRule = rules.find((r) => r.id === `roll-skill-${skill}-offer`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const pc = offerActivity!.rule!.ui!.primaryControl as { type: string };
      expect(pc.type).toBe('dice-line');
    }
  });

  it('all skill offers use free section', () => {
    for (const skill of skillKeys) {
      const offerRule = rules.find((r) => r.id === `roll-skill-${skill}-offer`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      expect(offerActivity!.rule!.ui!.section).toBe('free');
    }
  });

  it('all skill offers have rollBonus var capturing skill value', () => {
    for (const skill of skillKeys) {
      const offerRule = rules.find((r) => r.id === `roll-skill-${skill}-offer`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const rollBonus = offerActivity!.rule!.vars!.rollBonus;
      expect(rollBonus).toBeDefined();
      expect(rollBonus!.capture).toBe(true);
      expect(rollBonus!.default!.fact).toBe(`skill.${skill}.value`);
    }
  });

  it('acrobatics is the leader with no packBehind', () => {
    const offerRule = rules.find((r) => r.id === 'roll-skill-acrobatics-offer');
    const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
    expect(offerActivity!.rule!.ui!.packBehind).toBeUndefined();
  });

  it('all other skills pack behind acrobatics', () => {
    const followers = skillKeys.filter((s) => s !== 'acrobatics');
    for (const skill of followers) {
      const offerRule = rules.find((r) => r.id === `roll-skill-${skill}-offer`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      expect(offerActivity!.rule!.ui!.packBehind).toBe('roll-skill-acrobatics');
    }
  });

  it('all skill offers have empty activities (no persistent effects)', () => {
    for (const skill of skillKeys) {
      const offerRule = rules.find((r) => r.id === `roll-skill-${skill}-offer`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      expect(offerActivity!.rule!.activities).toEqual([]);
    }
  });

  it('all skill offers use existing skill name i18n keys', () => {
    for (const skill of skillKeys) {
      const offerRule = rules.find((r) => r.id === `roll-skill-${skill}-offer`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      expect(offerActivity!.rule!.ui!.name).toBe(`play.stats.skills.${skill}`);
    }
  });
});
