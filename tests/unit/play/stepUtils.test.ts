import { describe, it, expect } from 'vitest';
import { deriveVerbFromRule } from '$lib/play/stepUtils';
import type { Rule } from '$lib/rules-engine';

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
