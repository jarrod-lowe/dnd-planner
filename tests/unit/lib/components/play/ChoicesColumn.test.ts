import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ChoicesColumn from '$lib/components/play/ChoicesColumn.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';

const createMockEntry = (id: string, description?: string): AvailableRuleEntry => ({
  rule: { id, description: description || `Rule ${id}`, activities: [] },
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('ChoicesColumn', () => {
  it('renders list of choice panels', () => {
    const entries = [createMockEntry('rule-1', 'Attack'), createMockEntry('rule-2', 'Move')];

    const { getByText } = render(ChoicesColumn, {
      props: { entries, onChoiceTap: vi.fn() }
    });

    expect(getByText('Attack')).toBeTruthy();
    expect(getByText('Move')).toBeTruthy();
  });

  it('shows loading state', () => {
    const { getByText } = render(ChoicesColumn, {
      props: { entries: [], isLoading: true, onChoiceTap: vi.fn() }
    });

    expect(getByText('play.choices.loading')).toBeTruthy();
  });

  it('shows empty state when no choices', () => {
    const { getByText } = render(ChoicesColumn, {
      props: { entries: [], isLoading: false, onChoiceTap: vi.fn() }
    });

    expect(getByText('play.choices.empty')).toBeTruthy();
  });

  it('calls onChoiceTap with correct entry when choice is tapped', async () => {
    const entry = createMockEntry('rule-1', 'Attack');
    const onChoiceTap = vi.fn();

    const { container } = render(ChoicesColumn, {
      props: { entries: [entry], onChoiceTap }
    });

    // Find the choice panel (not the section header)
    const choicePanel = container.querySelector('.choice-panel');
    choicePanel?.click();

    expect(onChoiceTap).toHaveBeenCalledWith(entry);
  });

  it('has accessible list structure', () => {
    const entries = [createMockEntry('rule-1'), createMockEntry('rule-2')];

    const { container } = render(ChoicesColumn, {
      props: { entries, onChoiceTap: vi.fn() }
    });

    const list = container.querySelector('.choices-column__list');
    expect(list).toBeTruthy();
  });
});
