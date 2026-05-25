import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SectionCollapsible from '$lib/components/play/SectionCollapsible.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';
import type { ChoiceGroup } from '$lib/play/groupPackedChoices';

const createMockEntry = (
  id: string,
  options?: { section?: string; description?: string }
): AvailableRuleEntry => ({
  rule: {
    id,
    description: options?.description,
    activities: [],
    ui: options?.section ? { section: options.section } : undefined
  },
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('SectionCollapsible', () => {
  const singleGroup: ChoiceGroup = {
    type: 'single',
    entry: createMockEntry('rule-1', { description: 'Test Rule' })
  };

  it('renders PanelRenderer by default (mode=choice)', () => {
    const { container } = render(SectionCollapsible, {
      props: {
        section: 'move',
        packedGroups: [singleGroup],
        hasLegalEntries: true,
        facts: {},
        onChoiceTap: vi.fn()
      }
    });

    // PanelRenderer renders as a non-editable div with role=button
    const panel = container.querySelector('.panel-renderer');
    expect(panel).toBeTruthy();
  });

  it('renders PanelRenderer as read-only when mode=effect', () => {
    const { container } = render(SectionCollapsible, {
      props: {
        section: 'action-spell',
        packedGroups: [singleGroup],
        hasLegalEntries: true,
        facts: {},
        onChoiceTap: vi.fn(),
        mode: 'effect'
      }
    });

    // PanelRenderer renders as non-editable div (no --editable class)
    const panel = container.querySelector('.panel-renderer');
    expect(panel).toBeTruthy();
    expect(panel?.classList.contains('panel-renderer--editable')).toBe(false);
  });

  it('passes onRemove to PanelRenderer in effect mode when deletable', () => {
    const onRemoveEffect = vi.fn();
    const { container } = render(SectionCollapsible, {
      props: {
        section: 'action-spell',
        packedGroups: [singleGroup],
        hasLegalEntries: true,
        facts: {},
        onChoiceTap: vi.fn(),
        mode: 'effect',
        deletableRuleIds: new Set(['rule-1']),
        onRemoveEffect
      }
    });

    // Should render delete button from PanelRenderer
    const deleteButton = container.querySelector('.panel-renderer__button--remove');
    expect(deleteButton).toBeTruthy();
  });

  it('calls onRemoveEffect with rule ID when effect delete is clicked', async () => {
    const onRemoveEffect = vi.fn();
    const { container } = render(SectionCollapsible, {
      props: {
        section: 'action-spell',
        packedGroups: [singleGroup],
        hasLegalEntries: true,
        facts: {},
        onChoiceTap: vi.fn(),
        mode: 'effect',
        deletableRuleIds: new Set(['rule-1']),
        onRemoveEffect
      }
    });

    const deleteButton = container.querySelector('.panel-renderer__button--remove');
    await fireEvent.click(deleteButton!);

    expect(onRemoveEffect).toHaveBeenCalledWith('rule-1');
  });

  it('passes rule selections to PanelRenderer for effects', () => {
    // Half-proficiency (0.5) selected, but default is 1
    const entryWithSelections: AvailableRuleEntry = {
      rule: {
        id: 'proficiency-athletics',
        description: 'Athletics',
        activities: [],
        ui: {
          section: 'proficiency',
          name: 'Athletics',
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
        },
        selections: { level: 0.5 }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const groupWithSelections: ChoiceGroup = {
      type: 'single',
      entry: entryWithSelections
    };

    const { container } = render(SectionCollapsible, {
      props: {
        section: 'proficiency',
        packedGroups: [groupWithSelections],
        hasLegalEntries: true,
        facts: {},
        onChoiceTap: vi.fn(),
        mode: 'effect'
      }
    });

    // The ○ option (value=0.5) should be marked active since selections.level=0.5
    const activeOption = container.querySelector('.panel-renderer__radio-option--active');
    expect(activeOption).toBeTruthy();
    expect(activeOption?.textContent?.trim()).toBe('○');
  });
});
