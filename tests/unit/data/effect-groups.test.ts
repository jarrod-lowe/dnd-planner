import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface Rule {
  id: string;
  activities?: { type: string; rule?: Rule; self?: boolean }[];
  ui?: Record<string, unknown>;
  group?: string[];
}

interface Setting {
  id: string;
  effect?: Rule;
}

interface RuleGroup {
  rules: Rule[];
  settings?: Setting[];
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

function loadYaml(relativePath: string): RuleGroup[] {
  const content = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf-8');
  const sharedDefs = fs.readFileSync(
    path.resolve(process.cwd(), 'data/rule-groups/_shared/definitions.yaml'),
    'utf-8'
  );
  const data = yaml.load(sharedDefs + '\n' + content) as { ruleGroups: RuleGroup[] };
  return data.ruleGroups;
}

/**
 * Find an effect rule nested inside an offerRule activity.
 * Pattern: offerRuleId -> offerRule activity -> rule -> advertiseEffect activity -> rule
 */
function findEffectInOffer(rules: Rule[], offerRuleId: string): Rule | undefined {
  const offerRule = rules.find((r) => r.id === offerRuleId);
  if (!offerRule?.activities) return undefined;
  const offerActivity = offerRule.activities.find((a) => a.type === 'offerRule');
  if (!offerActivity?.rule?.activities) return undefined;
  const effectActivity = offerActivity.rule.activities.find((a) => a.type === 'advertiseEffect');
  return effectActivity?.rule;
}

// ============================================================
// ability-scores.yaml
// ============================================================

describe('ability-scores effect groups', () => {
  let rules: Rule[];

  beforeAll(() => {
    const groups = loadYaml('data/rule-groups/dnd-5e-2024/ability-scores.yaml');
    rules = groups[0].rules;
  });

  describe('stat set effects have Stats group and are hidden', () => {
    const displayFacts: Record<string, string> = {
      str: 'str.value',
      dex: 'dex.value',
      con: 'con.value',
      int: 'int.value',
      wis: 'wis.value',
      cha: 'cha.value'
    };
    for (const stat of stats) {
      it(`effect-${fullNames[stat]} has group Stats, ui.hidden, and displayFact`, () => {
        const effect = findEffectInOffer(rules, `set-${fullNames[stat]}-offer`);
        expect(effect).toBeDefined();
        expect(effect!.group).toContain('Stats');
        expect(effect!.ui?.hidden).toBe(true);
        expect(effect!.ui?.displayFact).toBe(displayFacts[stat]);
      });
    }
  });

  describe('stat increase effects have Stats group and are hidden', () => {
    for (const stat of stats) {
      it(`effect-increase-${fullNames[stat]} has group Stats and ui.hidden`, () => {
        const effect = findEffectInOffer(rules, `increase-${fullNames[stat]}-offer`);
        expect(effect).toBeDefined();
        expect(effect!.group).toContain('Stats');
        expect(effect!.ui?.hidden).toBe(true);
      });
    }
  });

  describe('save proficiency effects have Proficiency group and are hidden', () => {
    for (const stat of stats) {
      it(`effect-${stat}-save-proficiency has group Proficiency and ui.hidden`, () => {
        const effect = findEffectInOffer(rules, `proficiency-${stat}-offer`);
        expect(effect).toBeDefined();
        expect(effect!.group).toContain('Proficiency');
        expect(effect!.ui?.hidden).toBe(true);
      });
    }
  });

  describe('skill proficiency effects have Proficiency group, hidden, and levelFact', () => {
    for (const skill of skills) {
      it(`effect-${skill}-proficiency has group Proficiency, ui.hidden, and levelFact`, () => {
        const effect = findEffectInOffer(rules, `${skill}-proficiency-offer`);
        expect(effect).toBeDefined();
        expect(effect!.group).toContain('Proficiency');
        expect(effect!.ui?.hidden).toBe(true);
        expect(effect!.ui?.levelFact).toBe(`skill.${skill}.proficiency`);
      });
    }
  });
});

// ============================================================
// class-paladin/level1.yaml
// ============================================================

describe('paladin level1 effect groups', () => {
  let groups: RuleGroup[];

  beforeAll(() => {
    groups = loadYaml('data/rule-groups/class-paladin/level1.yaml');
  });

  it('paladin skill effect has group Proficiency and ui.hidden', () => {
    const settings = groups[0].settings;
    expect(settings).toBeDefined();
    const skillSetting = settings!.find((s) => s.id === 'paladin-skill-1');
    expect(skillSetting).toBeDefined();
    const effect = skillSetting!.effect;
    expect(effect).toBeDefined();
    expect(effect!.group).toContain('Proficiency');
    expect(effect!.ui?.hidden).toBe(true);
  });
});

// ============================================================
// feat-sentinel.yaml
// ============================================================

describe('sentinel effect groups', () => {
  let groups: RuleGroup[];

  beforeAll(() => {
    groups = loadYaml('data/rule-groups/dnd-5e-2024/feat-sentinel.yaml');
  });

  it('sentinel ASI effect has group Stats and ui.hidden', () => {
    const settings = groups[0].settings;
    expect(settings).toBeDefined();
    const asiSetting = settings!.find((s) => s.id === 'sentinel-ability-score');
    expect(asiSetting).toBeDefined();
    const effect = asiSetting!.effect;
    expect(effect).toBeDefined();
    expect(effect!.group).toContain('Stats');
    expect(effect!.ui?.hidden).toBe(true);
  });
});

// ============================================================
// hp.yaml
// ============================================================

describe('hp effect groups', () => {
  let rules: Rule[];

  beforeAll(() => {
    const groups = loadYaml('data/rule-groups/dnd-5e-2024/hp.yaml');
    rules = groups[0].rules;
  });

  it('effect-hp-modifier-max has displayFact and health section', () => {
    const effect = findEffectInOffer(rules, 'set-hp-modifier-max-offer');
    expect(effect).toBeDefined();
    expect(effect!.ui?.displayFact).toBe('hp.modifier.max');
    expect(effect!.ui?.section).toBe('health');
  });

  it('effect-hp-modifier-current has displayFact and health section', () => {
    const effect = findEffectInOffer(rules, 'set-hp-modifier-current-offer');
    expect(effect).toBeDefined();
    expect(effect!.ui?.displayFact).toBe('hp.modifier.current');
    expect(effect!.ui?.section).toBe('health');
  });
});
