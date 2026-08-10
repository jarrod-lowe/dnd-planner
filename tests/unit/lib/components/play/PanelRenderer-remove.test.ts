import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry } from '$lib/rules-view';

const createMockEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: { id: 'test', description: 'Test', activities: [] },
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
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

  it('uses provided removeLabel for the remove button aria-label', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, onRemove: vi.fn(), removeLabel: 'play.effects.remove' }
    });
    const button = container.querySelector('.panel-renderer__button--remove');
    expect(button?.getAttribute('aria-label')).toBe('play.effects.remove');
  });

  it('defaults to play.plan.remove when no removeLabel provided', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, onRemove: vi.fn() }
    });
    const button = container.querySelector('.panel-renderer__button--remove');
    expect(button?.getAttribute('aria-label')).toBe('play.plan.remove');
  });

  it('uses provided removeLabel for the remove button title', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, onRemove: vi.fn(), removeLabel: 'play.effects.remove' }
    });
    const button = container.querySelector('.panel-renderer__button--remove');
    expect(button?.getAttribute('title')).toBe('play.effects.remove');
  });
});

describe('PanelRenderer - aria-label on container', () => {
  it('has aria-label in read-only mode', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false }
    });
    const panel = container.querySelector('.panel-renderer');
    expect(panel?.getAttribute('aria-label')).toContain('Test');
  });

  it('includes illegal warning in aria-label', () => {
    const entry = createMockEntry({ legal: false, applicable: true });
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false }
    });
    const panel = container.querySelector('.panel-renderer');
    const label = panel?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Test');
    expect(label).toContain('play.choices.illegal');
  });

  it('includes inapplicable warning in aria-label', () => {
    const entry = createMockEntry({ legal: true, applicable: false });
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false }
    });
    const panel = container.querySelector('.panel-renderer');
    const label = panel?.getAttribute('aria-label') ?? '';
    expect(label).toContain('Test');
    expect(label).toContain('play.choices.inapplicable');
  });

  it('does not set aria-label when editable', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true }
    });
    const panel = container.querySelector('.panel-renderer');
    expect(panel?.getAttribute('aria-label')).toBeNull();
  });
});
