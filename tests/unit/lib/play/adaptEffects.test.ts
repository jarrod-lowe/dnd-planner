import { describe, it, expect } from 'vitest';
import { adaptEffectsAsEntries } from '$lib/play/adaptEffects';
import type { Rule } from '$lib/rules-engine';

const createMockRule = (id: string, overrides?: Partial<Rule>): Rule => ({
  id,
  activities: [],
  ...overrides
});

describe('adaptEffectsAsEntries', () => {
  it('returns empty array for empty input', () => {
    const result = adaptEffectsAsEntries([]);
    expect(result).toEqual([]);
  });

  it('wraps each rule with legal=true, applicable=true, empty diagnostics', () => {
    const rule = createMockRule('effect-1');
    const result = adaptEffectsAsEntries([rule]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      rule,
      legal: true,
      applicable: true,
      diagnostics: []
    });
  });

  it('preserves rule reference', () => {
    const rule = createMockRule('effect-1');
    const result = adaptEffectsAsEntries([rule]);

    expect(result[0].rule).toBe(rule);
  });

  it('wraps multiple rules', () => {
    const rules = [
      createMockRule('effect-1'),
      createMockRule('effect-2'),
      createMockRule('effect-3')
    ];
    const result = adaptEffectsAsEntries(rules);

    expect(result).toHaveLength(3);
    expect(result[0].rule.id).toBe('effect-1');
    expect(result[1].rule.id).toBe('effect-2');
    expect(result[2].rule.id).toBe('effect-3');
  });

  it('preserves rule ui fields', () => {
    const rule = createMockRule('effect-1', {
      ui: { section: 'action-spell', name: 'rule.effect.name' }
    });
    const result = adaptEffectsAsEntries([rule]);

    expect(result[0].rule.ui).toEqual({ section: 'action-spell', name: 'rule.effect.name' });
  });
});
