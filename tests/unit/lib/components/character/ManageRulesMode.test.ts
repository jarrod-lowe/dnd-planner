import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import ManageRulesMode from '$lib/components/character/ManageRulesMode.svelte';
import type { Character } from '$lib/character/types';

// i18n mock - returns key as text
const translations: Record<string, string> = {
  'rules.manageTitle': 'Manage Rules',
  'rules.searchPlaceholder': 'Search rule groups...',
  'rules.backToPlay': 'Back to Play'
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

const mockCharacter: Character = {
  characterId: 'char-1',
  userId: 'test-user',
  name: 'Gandalf',
  species: 'human',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('ManageRulesMode', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders back button', () => {
    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const backButton = container.querySelector('button');
    expect(backButton).toBeTruthy();
    expect(backButton?.getAttribute('aria-label')).toContain('Back to Play');
  });

  it('renders title', () => {
    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const heading = container.querySelector('h1');
    expect(heading?.textContent).toContain('Manage Rules');
  });

  it('renders search input', () => {
    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input?.getAttribute('placeholder')).toContain('Search rule groups');
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack
      }
    });

    const backButton = container.querySelector('button');
    backButton?.click();

    expect(onBack).toHaveBeenCalledOnce();
  });
});
