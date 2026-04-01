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

  it('renders ChoicePanel by default (mode=choice)', () => {
    const { container } = render(SectionCollapsible, {
      props: {
        section: 'move',
        packedGroups: [singleGroup],
        hasLegalEntries: true,
        facts: {},
        onChoiceTap: vi.fn()
      }
    });

    // ChoicePanel renders as a button
    const button = container.querySelector('button.choice-panel');
    expect(button).toBeTruthy();
  });

  it('renders EffectPanel when mode=effect', () => {
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

    // EffectPanel renders as div.effect-panel, not a button
    const effectPanel = container.querySelector('.effect-panel');
    expect(effectPanel).toBeTruthy();
    expect(effectPanel?.tagName).toBe('DIV');
  });

  it('passes deletable and onRemoveEffect to EffectPanel in effect mode', () => {
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

    // Should render delete button from EffectPanel
    const deleteButton = container.querySelector('.effect-panel__button--remove');
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

    const deleteButton = container.querySelector('.effect-panel__button--remove');
    await fireEvent.click(deleteButton!);

    expect(onRemoveEffect).toHaveBeenCalledWith('rule-1');
  });
});
