import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

const createSegmentedEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: {
    id: 'grapple',
    description: 'Grapple',
    activities: [],
    ui: {
      section: 'action',
      name: 'rule.dnd-5e-2024.grapple.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      },
      secondaryControl: {
        type: 'segmented',
        var: 'passed',
        options: [
          { value: -1, label: 'planner.record.outcome.none' },
          { value: 1, label: 'planner.record.passed' },
          { value: 0, label: 'planner.record.failed' }
        ]
      },
      vars: {
        hitBonus: { default: { number: 5 } },
        passed: { default: { number: -1 } }
      }
    }
  } as unknown as Rule,
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

const withPrefix = (): AvailableRuleEntry => {
  const base = createSegmentedEntry();
  return {
    ...base,
    rule: {
      ...base.rule,
      ui: {
        ...base.rule.ui,
        secondaryControl: {
          ...(base.rule.ui!.secondaryControl as object),
          prefix: 'play.choices.grapple.target'
        }
      }
    } as Rule
  };
};

describe('PanelSegmented - summary short form', () => {
  it('shows only the selected option label', () => {
    const entry = createSegmentedEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true, selections: { passed: 1 } }
    });
    const summaryEl = container.querySelector('.panel-renderer__segmented-summary');
    expect(summaryEl?.textContent?.trim()).toBe('planner.record.passed');
    expect(container.textContent).not.toContain('planner.record.failed');
    expect(container.textContent).not.toContain('planner.record.outcome.none');
  });

  it('renders no segments, no buttons, no radio inputs', () => {
    const entry = createSegmentedEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true, selections: { passed: 1 } }
    });
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('fieldset')).toBeNull();
    expect(container.querySelector('.panel-renderer__segment')).toBeNull();
  });

  it('updates the shown label when the selection changes', async () => {
    const entry = createSegmentedEntry();
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true, selections: { passed: -1 } }
    });
    expect(container.querySelector('.panel-renderer__segmented-summary')?.textContent?.trim()).toBe(
      'planner.record.outcome.none'
    );
    await rerender({
      entry,
      editable: true,
      facts: {},
      summary: true,
      selections: { passed: 0 }
    });
    expect(container.querySelector('.panel-renderer__segmented-summary')?.textContent?.trim()).toBe(
      'planner.record.failed'
    );
  });

  it('includes the authored prefix label alongside the selected option', () => {
    const entry = withPrefix();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true, selections: { passed: 1 } }
    });
    const summaryEl = container.querySelector('.panel-renderer__segmented-summary');
    expect(summaryEl?.textContent).toContain('play.choices.grapple.target');
    expect(summaryEl?.textContent).toContain('planner.record.passed');
  });
});
