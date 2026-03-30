import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import ViewFactsMode from '$lib/components/character/ViewFactsMode.svelte';

// i18n mock
const translations: Record<string, string> = {
  'facts.viewTitle': 'View Facts',
  'facts.backToPlay': 'Back to Play',
  'facts.empty': 'No facts available',
  'facts.ariaLabel': 'Character facts in YAML format'
};

vi.mock('$lib/i18n', () => ({
  t: readable((key: string) => translations[key] ?? key),
  locale: {
    ...readable('en'),
    set: vi.fn()
  },
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en', 'en-x-tlh']
}));

// Mock playStore with controlled facts
vi.mock('$lib/play/playStore.svelte', () => ({
  playStore: {
    state: {
      facts: {
        'actions.max': 1,
        'actions.remaining': 1,
        'character.movement.remaining': 30,
        'character.movement.total': 30,
        'hp.current': 12,
        'hp.max': 12
      }
    }
  }
}));

describe('ViewFactsMode', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders back button with aria-label', () => {
    mount(ViewFactsMode, {
      target: container,
      props: {
        onBack: vi.fn()
      }
    });

    const backButton = container.querySelector('button');
    expect(backButton).toBeTruthy();
    expect(backButton?.getAttribute('aria-label')).toContain('Back to Play');
  });

  it('renders View Facts heading', () => {
    mount(ViewFactsMode, {
      target: container,
      props: {
        onBack: vi.fn()
      }
    });

    const heading = container.querySelector('h1');
    expect(heading?.textContent).toContain('View Facts');
  });

  it('renders facts as YAML text', () => {
    mount(ViewFactsMode, {
      target: container,
      props: {
        onBack: vi.fn()
      }
    });

    const factsRegion = container.querySelector('[role="region"]');
    expect(factsRegion).toBeTruthy();
    expect(factsRegion?.textContent).toContain('actions.max: 1');
    expect(factsRegion?.textContent).toContain('hp.current: 12');
    expect(factsRegion?.textContent).toContain('character.movement.total: 30');
  });

  it('renders facts with keys sorted alphabetically', () => {
    mount(ViewFactsMode, {
      target: container,
      props: {
        onBack: vi.fn()
      }
    });

    const factsRegion = container.querySelector('[role="region"]');
    const text = factsRegion?.textContent ?? '';
    const actionsMaxIdx = text.indexOf('actions.max');
    const characterIdx = text.indexOf('character.movement');
    const hpIdx = text.indexOf('hp.current');

    expect(actionsMaxIdx).toBeLessThan(characterIdx);
    expect(characterIdx).toBeLessThan(hpIdx);
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();

    mount(ViewFactsMode, {
      target: container,
      props: {
        onBack
      }
    });

    const backButton = container.querySelector('button');
    backButton?.click();

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('facts region has aria-label for accessibility', () => {
    mount(ViewFactsMode, {
      target: container,
      props: {
        onBack: vi.fn()
      }
    });

    const factsRegion = container.querySelector('[role="region"]');
    expect(factsRegion?.getAttribute('aria-label')).toBeTruthy();
    expect(factsRegion?.getAttribute('aria-label')).toContain('Character facts');
  });

  it('facts region is keyboard accessible with tabindex', () => {
    mount(ViewFactsMode, {
      target: container,
      props: {
        onBack: vi.fn()
      }
    });

    const factsRegion = container.querySelector('[role="region"]');
    expect(factsRegion?.getAttribute('tabindex')).toBe('0');
  });
});
