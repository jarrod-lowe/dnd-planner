import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

const createSelectEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: {
    id: 'proficiency-athletics',
    description: 'Athletics',
    activities: [],
    ui: {
      section: 'configuration',
      name: 'rule.dnd-5e-2024.skill-proficiency.athletics.name',
      primaryControl: {
        type: 'select',
        var: 'level',
        options: [
          { value: 0.5, label: '○' },
          { value: 1, label: '●' },
          { value: 2, label: '◉' }
        ]
      }
    },
    vars: {
      level: { default: { number: 1 } }
    }
  } as unknown as Rule,
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

describe('PanelSelect - summary short form', () => {
  it('shows only the selected option label', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    const summaryEl = container.querySelector('.panel-renderer__select-summary');
    expect(summaryEl?.textContent?.trim()).toBe('●');
    expect(container.textContent).not.toContain('○');
    expect(container.textContent).not.toContain('◉');
  });

  it('renders no select, no button, and no radio options', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.querySelector('select')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('.panel-renderer__radio-option')).toBeNull();
  });

  it('updates the shown label when the selection changes', async () => {
    const entry = createSelectEntry();
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true, selections: { level: 0.5 } }
    });
    expect(container.querySelector('.panel-renderer__select-summary')?.textContent?.trim()).toBe(
      '○'
    );
    await rerender({
      entry,
      editable: true,
      facts: {},
      summary: true,
      selections: { level: 2 }
    });
    expect(container.querySelector('.panel-renderer__select-summary')?.textContent?.trim()).toBe(
      '◉'
    );
  });

  it('resolves option labels from a ValueSource-backed option list', () => {
    const entry = createSelectEntry({
      rule: {
        ...createSelectEntry().rule,
        ui: {
          ...createSelectEntry().rule.ui,
          primaryControl: {
            type: 'select',
            var: 'level',
            options: { var: 'levels' }
          }
        },
        vars: {
          levels: { default: { array: [0, 0.5, 1, 2] } },
          level: { default: { number: 0 } }
        }
      } as unknown as Rule
    });
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.querySelector('.panel-renderer__select-summary')?.textContent?.trim()).toBe(
      '0'
    );
  });
});
