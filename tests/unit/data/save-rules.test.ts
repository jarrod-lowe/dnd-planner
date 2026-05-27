import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

describe('save rules structure', () => {
  const yamlPath = path.resolve(
    process.cwd(),
    'data/rule-groups/dnd-5e-2024/core-events.yaml'
  );
  let rules: {
    id: string;
    activities?: {
      type: string;
      rule?: {
        id?: string;
        ui?: Record<string, unknown>;
        vars?: Record<string, { capture?: boolean; default?: { fact?: string; number?: number } }>;
        activities?: { type: string; target?: { fact: string }; source?: { var: string } }[];
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

  const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  it('has offer rules for all 6 saves', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      expect(offerRule).toBeDefined();
    }
  });

  it('all save offers use dice-line primary control', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const pc = offerActivity!.rule!.ui!.primaryControl as { type: string };
      expect(pc.type).toBe('dice-line');
    }
  });

  it('all save offers use segmented secondary control', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const sc = offerActivity!.rule!.ui!.secondaryControl as { type: string };
      expect(sc.type).toBe('segmented');
    }
  });

  it('all save dice have d20 expression with saveBonus var', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const pc = offerActivity!.rule!.ui!.primaryControl as {
        dice: { expression: string; bonus: { var: string } }[];
      };
      expect(pc.dice).toHaveLength(1);
      expect(pc.dice[0].expression).toBe('d20');
      expect(pc.dice[0].bonus.var).toBe('saveBonus');
    }
  });

  it('all save segmented controls have three options with values -1, 0, 1', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const sc = offerActivity!.rule!.ui!.secondaryControl as {
        var: string;
        options: { value: number; label: string }[];
      };
      expect(sc.var).toBe('passed');
      expect(sc.options).toHaveLength(3);
      const values = sc.options.map((o) => o.value);
      expect(values).toContain(-1);
      expect(values).toContain(0);
      expect(values).toContain(1);
    }
  });

  it('all save offers capture saveBonus from correct ability fact', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const rollBonus = offerActivity!.rule!.vars!.saveBonus;
      expect(rollBonus).toBeDefined();
      expect(rollBonus!.capture).toBe(true);
      expect(rollBonus!.default!.fact).toBe(`${ability}.save`);
    }
  });

  it('all save offers capture passed with default -1', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const passed = offerActivity!.rule!.vars!.passed;
      expect(passed).toBeDefined();
      expect(passed!.capture).toBe(true);
      expect(passed!.default!.number).toBe(-1);
    }
  });

  it('all save offers have SAVE:you intents', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      expect(offerActivity!.rule!.ui!.intents).toEqual({ SAVE: 'you' });
    }
  });

  it('all save offers use free section', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      expect(offerActivity!.rule!.ui!.section).toBe('free');
    }
  });

  it('all save offers have correct name i18n keys', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      expect(offerActivity!.rule!.ui!.name).toBe(`planner.record.save.${ability}`);
    }
  });

  it('all save offers write to event.save-last-result', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const numberSet = offerActivity!.rule!.activities!.find((a) => a.type === 'numberSet');
      expect(numberSet).toBeDefined();
      expect(numberSet!.target!.fact).toBe('event.save-last-result');
      expect(numberSet!.source!.var).toBe('passed');
    }
  });

  it('segmented options use correct i18n labels', () => {
    for (const ability of abilities) {
      const offerRule = rules.find((r) => r.id === `offer-record-save-${ability}`);
      const offerActivity = offerRule!.activities!.find((a) => a.type === 'offerRule');
      const sc = offerActivity!.rule!.ui!.secondaryControl as {
        options: { value: number; label: string }[];
      };
      const noneOption = sc.options.find((o) => o.value === -1);
      const passedOption = sc.options.find((o) => o.value === 1);
      const failedOption = sc.options.find((o) => o.value === 0);
      expect(noneOption!.label).toBe('planner.record.outcome.none');
      expect(passedOption!.label).toBe('planner.record.passed');
      expect(failedOption!.label).toBe('planner.record.failed');
    }
  });
});
