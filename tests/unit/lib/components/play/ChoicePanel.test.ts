import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ChoicePanel from '$lib/components/play/ChoicePanel.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';

const createMockEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: { id: 'test-rule', description: 'Test Rule', activities: [] },
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

describe('ChoicePanel', () => {
  it('renders the rule description', () => {
    const entry = createMockEntry({
      rule: { id: 'attack', description: 'Attack with sword', activities: [] }
    });

    const { getByText } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    expect(getByText('Attack with sword')).toBeTruthy();
  });

  it('calls onTap when clicked', async () => {
    const entry = createMockEntry();
    const onTap = vi.fn();

    const { container } = render(ChoicePanel, {
      props: { entry, onTap }
    });

    const button = container.querySelector('button');
    button?.click();

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('shows warning indicator for illegal choice', () => {
    const entry = createMockEntry({ legal: false });

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    expect(container.querySelector('.warning-indicator--illegal')).toBeTruthy();
  });

  it('shows warning indicator for inapplicable choice', () => {
    const entry = createMockEntry({ applicable: false });

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    expect(container.querySelector('.warning-indicator--inapplicable')).toBeTruthy();
  });

  it('does not show warning for legal and applicable choice', () => {
    const entry = createMockEntry({ legal: true, applicable: true });

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    expect(container.querySelector('.warning-indicator')).toBeFalsy();
  });

  it('has accessible button with aria-label', () => {
    const entry = createMockEntry({
      rule: { id: 'attack', description: 'Attack', activities: [] }
    });

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toContain('Attack');
  });
});
