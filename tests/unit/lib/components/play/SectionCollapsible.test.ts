import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
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
});
