import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createTextInfoEntry = (
  label: string,
  labelValues?: Record<string, unknown>
): AvailableRuleEntry => ({
  rule: {
    id: 'spell-save',
    description: 'Spell Save',
    activities: [],
    ui: {
      name: 'rule.spells.test.name',
      information: [{ type: 'text', label, labelValues }]
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - text information', () => {
  it('renders text information from label', () => {
    const entry = createTextInfoEntry('rule.test.description');
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {} }
    });
    expect(container.textContent).toContain('rule.test.description');
  });

  it('renders text with labelValues resolved from facts', () => {
    const entry = createTextInfoEntry('play.information.saveDc', {
      saveType: { fact: 'spellcasting.saveType' },
      dc: { fact: 'spellcasting.saveDC' }
    });
    const facts = { 'spellcasting.saveType': 'DEX', 'spellcasting.saveDC': 14 };
    const { container } = render(PanelRenderer, {
      props: { entry, facts }
    });
    expect(container.textContent).toContain('DEX');
    expect(container.textContent).toContain('14');
  });

  it('renders text information with correct CSS class', () => {
    const entry = createTextInfoEntry('rule.test.description');
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {} }
    });
    expect(
      container.querySelector('.panel-renderer__information--text')
    ).toBeTruthy();
  });

  it('renders text information in editable mode', () => {
    const entry = createTextInfoEntry('rule.test.description');
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {}, editable: true }
    });
    expect(container.textContent).toContain('rule.test.description');
    expect(
      container.querySelector('.panel-renderer__information--text')
    ).toBeTruthy();
  });

  it('renders nothing when information is absent', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'no-info',
        description: 'No Info',
        activities: []
      },
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {} }
    });
    expect(
      container.querySelector('.panel-renderer__information')
    ).toBeNull();
  });
});
