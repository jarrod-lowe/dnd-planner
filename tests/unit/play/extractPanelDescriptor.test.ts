import { describe, it, expect } from 'vitest';
import { extractPanelDescriptor } from '$lib/components/play/panel-renderer/extractPanelDescriptor';
import type { Rule } from '$lib/rules-engine';

const makeRule = (overrides: Partial<Rule> & { id: string }): Rule => ({
  activities: [],
  ...overrides
});

describe('extractPanelDescriptor', () => {
  it('extracts the description i18n key from ui.description', () => {
    const rule = makeRule({
      id: 'cast-sanctuary',
      ui: { name: 'rule.x.name', description: 'rule.x.description' }
    });
    expect(extractPanelDescriptor(rule).description).toBe('rule.x.description');
  });

  it('leaves description undefined when ui.description is absent', () => {
    const rule = makeRule({ id: 'cast-sanctuary', ui: { name: 'rule.x.name' } });
    expect(extractPanelDescriptor(rule).description).toBeUndefined();
  });
});
