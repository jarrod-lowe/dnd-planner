import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import EffectsColumn from '$lib/components/play/EffectsColumn.svelte';
import type { Rule } from '$lib/rules-engine';

// Mock element.animate for JSDOM (used by Svelte transitions)
beforeAll(() => {
  Element.prototype.animate = vi.fn().mockImplementation(function () {
    const animation = {
      finished: Promise.resolve(),
      cancel: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(),
      reverse: vi.fn(),
      onfinish: null as (() => void) | null,
      oncancel: null as (() => void) | null
    };
    setTimeout(() => {
      if (animation.onfinish) animation.onfinish();
    }, 0);
    return animation;
  });
});

const createMockRule = (
  id: string,
  options?: { section?: string; description?: string }
): Rule => ({
  id,
  description: options?.description,
  activities: [],
  ui: options?.section ? { section: options.section } : undefined
});

describe('EffectsColumn', () => {
  it('renders empty state when no effects', () => {
    const { getByText } = render(EffectsColumn, { props: { effects: [] } });

    expect(getByText('play.effects.empty')).toBeTruthy();
  });

  it('has proper container structure', () => {
    const { container } = render(EffectsColumn, { props: { effects: [] } });

    expect(container.querySelector('.effects-column')).toBeTruthy();
  });

  it('renders effect panels for provided effects', () => {
    const effects = [
      createMockRule('effect-1', { description: 'Slot consumed' }),
      createMockRule('effect-2', { description: 'Shield active' })
    ];
    const { container } = render(EffectsColumn, { props: { effects } });

    // Should render effect panels
    const panels = container.querySelectorAll('.effect-panel');
    expect(panels).toHaveLength(2);
  });

  it('groups effects by section', () => {
    const effects = [
      createMockRule('effect-1', { section: 'move', description: 'Hasted' }),
      createMockRule('effect-2', { section: 'action-spell', description: 'Slot used' }),
      createMockRule('effect-3', { section: 'move', description: 'Slowed' })
    ];
    const { container } = render(EffectsColumn, { props: { effects } });

    // Should have section headers
    const sectionHeaders = container.querySelectorAll('.section-collapsible__header');
    expect(sectionHeaders.length).toBeGreaterThanOrEqual(2);
  });

  it('renders effects without section in "Other" group', () => {
    const effects = [createMockRule('effect-no-section', { description: 'Mystery effect' })];
    const { container } = render(EffectsColumn, { props: { effects } });

    // Should still render the effect
    const panels = container.querySelectorAll('.effect-panel');
    expect(panels).toHaveLength(1);
  });
});
