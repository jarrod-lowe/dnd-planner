import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SectionCollapsible from '$lib/components/play/SectionCollapsible.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';
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

  it('renders PanelRenderer in editable mode when mode=effect', () => {
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

    // PanelRenderer renders as editable div (no onclick)
    const panel = container.querySelector('.panel-renderer--editable');
    expect(panel).toBeTruthy();
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
});
