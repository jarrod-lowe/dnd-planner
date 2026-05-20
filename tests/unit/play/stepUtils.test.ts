import { describe, it, expect } from 'vitest';
import {
  deriveVerbFromRule,
  plannedItemToStep,
  stepToRule,
  stepsToRules,
  stepsToPlannedItems
} from '$lib/play/stepUtils';
import type { Rule } from '$lib/rules-engine';
import type { PlannedItem } from '$lib/play/types';

const makeRule = (overrides: Partial<Rule> & { id: string }): Rule => ({
  activities: [],
  ...overrides
});

describe('deriveVerbFromRule', () => {
  it('derives verb from ui.intents', () => {
    const rule = makeRule({
      id: 'greataxe-attack',
      ui: { section: 'action-attack', intents: { ATTACK: 'weapons' }, actionCost: ['action'] }
    });
    expect(deriveVerbFromRule(rule)).toBe('ATTACK');
  });

  it('picks first intent when multiple are present', () => {
    const rule = makeRule({
      id: 'sanctuary',
      ui: {
        section: 'bonus-action-other',
        intents: { DEFEND: 'ward', AID: 'ally' },
        actionCost: ['bonus']
      }
    });
    expect(deriveVerbFromRule(rule)).toBe('DEFEND');
  });

  it('falls back to section heuristic when no intents', () => {
    const rule = makeRule({
      id: 'old-rule',
      ui: { section: 'action-attack' }
    });
    expect(deriveVerbFromRule(rule)).toBe('ATTACK');
  });

  it('falls back to HANDLE for unknown sections', () => {
    const rule = makeRule({
      id: 'mystery',
      ui: { section: 'unknown-section' }
    });
    expect(deriveVerbFromRule(rule)).toBe('HANDLE');
  });

  it('falls back to HANDLE for rules with no ui', () => {
    const rule = makeRule({ id: 'engine-rule' });
    expect(deriveVerbFromRule(rule)).toBe('HANDLE');
  });
});

describe('plannedItemToStep', () => {
  it('converts a PlannedItem to a Step', () => {
    const rule = makeRule({
      id: 'cast-bless',
      ui: {
        section: 'action-spell',
        intents: { AID: 'ally' },
        actionCost: ['action', 'conc', 'L1']
      },
      selections: { slotLevel: 1 }
    });
    const item: PlannedItem = {
      instanceId: 'inst-1',
      rule,
      order: 0
    };

    const step = plannedItemToStep(item);

    expect(step.id).toBe('inst-1');
    expect(step.verb).toBe('AID');
    expect(step.ruleId).toBe('cast-bless');
    expect(step.modelSelections).toEqual({ slotLevel: 1 });
    expect(step.recordedAt).toBeTruthy();
  });

  it('uses originalRuleId when present instead of rule.id', () => {
    const rule = makeRule({
      id: 'inst-999', // rewritten instanceId
      ui: { section: 'action-attack', intents: { ATTACK: 'weapons' } }
    });
    const item: PlannedItem = {
      instanceId: 'inst-999',
      rule,
      order: 0,
      originalRuleId: 'greataxe-attack'
    };

    const step = plannedItemToStep(item);

    expect(step.ruleId).toBe('greataxe-attack');
    expect(step.id).toBe('inst-999');
  });

  it('falls back to rule.id when originalRuleId is absent', () => {
    const rule = makeRule({
      id: 'cast-bless',
      ui: { section: 'action-spell', intents: { AID: 'ally' } }
    });
    const item: PlannedItem = {
      instanceId: 'inst-1',
      rule,
      order: 0
    };

    const step = plannedItemToStep(item);

    expect(step.ruleId).toBe('cast-bless');
  });
});

describe('stepToRule', () => {
  it('resolves a step to a rule with merged selections', () => {
    const baseRule = makeRule({
      id: 'cast-bless',
      ui: { section: 'action-spell', intents: { AID: 'ally' } },
      selections: { existing: 'value' }
    });
    const lookup = new Map<string, Rule>([['cast-bless', baseRule]]);

    const step = {
      id: 'step-1',
      verb: 'AID' as const,
      ruleId: 'cast-bless',
      modelSelections: { slotLevel: 2 },
      recordedAt: '2025-01-01T00:00:00Z'
    };

    const result = stepToRule(step, lookup);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('cast-bless');
    expect(result!.selections).toEqual({ existing: 'value', slotLevel: 2 });
  });

  it('returns null for unknown ruleId', () => {
    const lookup = new Map<string, Rule>();
    const step = {
      id: 'step-1',
      verb: 'ATTACK' as const,
      ruleId: 'nonexistent',
      modelSelections: {},
      recordedAt: '2025-01-01T00:00:00Z'
    };

    expect(stepToRule(step, lookup)).toBeNull();
  });
});

describe('stepsToRules', () => {
  it('converts multiple steps, skipping unresolvable ones', () => {
    const rule1 = makeRule({ id: 'rule-a', activities: [] });
    const rule2 = makeRule({ id: 'rule-b', activities: [] });
    const lookup = new Map<string, Rule>([
      ['rule-a', rule1],
      ['rule-b', rule2]
    ]);

    const steps = [
      { id: 's1', verb: 'ATTACK' as const, ruleId: 'rule-a', modelSelections: {}, recordedAt: '' },
      {
        id: 's2',
        verb: 'MOVE' as const,
        ruleId: 'nonexistent',
        modelSelections: {},
        recordedAt: ''
      },
      {
        id: 's3',
        verb: 'AID' as const,
        ruleId: 'rule-b',
        modelSelections: { amount: 5 },
        recordedAt: ''
      }
    ];

    const rules = stepsToRules(steps, lookup);

    expect(rules).toHaveLength(2);
    expect(rules[0].id).toBe('rule-a');
    expect(rules[1].id).toBe('rule-b');
    expect(rules[1].selections).toEqual({ amount: 5 });
  });
});

describe('stepsToPlannedItems', () => {
  it('converts steps to planned items with correct fields', () => {
    const baseRule = makeRule({
      id: 'cast-bless',
      ui: { section: 'action-spell', intents: { AID: 'ally' } },
      selections: { existing: 'value' }
    });
    const lookup = new Map<string, Rule>([['cast-bless', baseRule]]);

    const steps = [
      {
        id: 'step-1',
        verb: 'AID' as const,
        ruleId: 'cast-bless',
        modelSelections: { slotLevel: 2 },
        recordedAt: '2025-01-01T00:00:00Z'
      },
      {
        id: 'step-2',
        verb: 'AID' as const,
        ruleId: 'cast-bless',
        modelSelections: { slotLevel: 3 },
        recordedAt: '2025-01-01T00:01:00Z'
      }
    ];

    const items = stepsToPlannedItems(steps, lookup);

    expect(items).toHaveLength(2);

    // First item
    expect(items[0].instanceId).toBe('step-1');
    expect(items[0].rule.id).toBe('step-1'); // rewritten to instanceId
    expect(items[0].rule.selections).toEqual({ existing: 'value', slotLevel: 2 });
    expect(items[0].order).toBe(0);
    expect(items[0].originalRuleId).toBe('cast-bless');

    // Second item (duplicate rule, different instance)
    expect(items[1].instanceId).toBe('step-2');
    expect(items[1].rule.id).toBe('step-2');
    expect(items[1].rule.selections).toEqual({ existing: 'value', slotLevel: 3 });
    expect(items[1].order).toBe(1);
    expect(items[1].originalRuleId).toBe('cast-bless');
  });

  it('skips steps whose ruleId cannot be resolved', () => {
    const baseRule = makeRule({ id: 'rule-a' });
    const lookup = new Map<string, Rule>([['rule-a', baseRule]]);

    const steps = [
      {
        id: 's1',
        verb: 'ATTACK' as const,
        ruleId: 'rule-a',
        modelSelections: {},
        recordedAt: ''
      },
      {
        id: 's2',
        verb: 'MOVE' as const,
        ruleId: 'nonexistent',
        modelSelections: {},
        recordedAt: ''
      }
    ];

    const items = stepsToPlannedItems(steps, lookup);

    expect(items).toHaveLength(1);
    expect(items[0].instanceId).toBe('s1');
  });
});
