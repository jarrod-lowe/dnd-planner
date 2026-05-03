import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';

const createMockEntry = (): AvailableRuleEntry => ({
  rule: { id: 'test', description: 'Test', activities: [] },
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - remove button', () => {
  it('renders remove button when onRemove is provided', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, onRemove: vi.fn() }
    });
    expect(container.querySelector('.panel-renderer__button--remove')).toBeTruthy();
  });

  it('does not render remove button when onRemove is not provided', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, { props: { entry } });
    expect(container.querySelector('.panel-renderer__button--remove')).toBeNull();
  });

  it('calls onRemove when clicked', async () => {
    const entry = createMockEntry();
    const onRemove = vi.fn();
    const { container } = render(PanelRenderer, { props: { entry, onRemove } });
    await fireEvent.click(container.querySelector('.panel-renderer__button--remove')!);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
