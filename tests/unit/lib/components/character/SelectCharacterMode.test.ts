import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import SelectCharacterMode from '$lib/components/character/SelectCharacterMode.svelte';
import type { Character } from '$lib/character/types';

// English translations for testing
const translations: Record<string, string> = {
  'character.selectTitle': 'Select Your Character',
  'character.createNew': 'Create New Character',
  'character.noCharacters': "You don't have any characters yet.",
  'character.loading': 'Loading characters...'
};

// Mock $lib/i18n module for this test file
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

// Mock authStore
vi.mock('$lib/auth/authStore.svelte', () => ({
  authStore: {
    state: {
      isAuthenticated: true,
      isLoading: false,
      userId: 'test-user',
      email: 'test@example.com',
      groups: []
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    hasGroup: (group: string) => false
  }
}));

const mockCharacters: Character[] = [
  {
    characterId: 'char-1',
    userId: 'test-user',
    name: 'Gandalf',
    race: 'human',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    characterId: 'char-2',
    userId: 'test-user',
    name: 'Frodo',
    race: 'halfling',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  }
];

describe('SelectCharacterMode', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('shows loading state when isLoading is true', () => {
    mount(SelectCharacterMode, {
      target: container,
      props: {
        characters: [],
        isLoading: true,
        canCreateCharacter: false,
        onSelect: vi.fn(),
        onCreateCharacter: vi.fn()
      }
    });

    expect(container.textContent).toContain('Loading characters');
  });

  it('shows empty state when no characters', () => {
    mount(SelectCharacterMode, {
      target: container,
      props: {
        characters: [],
        isLoading: false,
        canCreateCharacter: false,
        onSelect: vi.fn(),
        onCreateCharacter: vi.fn()
      }
    });

    expect(container.textContent).toContain("don't have any characters");
  });

  it('shows title', () => {
    mount(SelectCharacterMode, {
      target: container,
      props: {
        characters: mockCharacters,
        isLoading: false,
        canCreateCharacter: false,
        onSelect: vi.fn(),
        onCreateCharacter: vi.fn()
      }
    });

    expect(container.textContent).toContain('Select Your Character');
  });

  it('displays character cards', () => {
    mount(SelectCharacterMode, {
      target: container,
      props: {
        characters: mockCharacters,
        isLoading: false,
        canCreateCharacter: false,
        onSelect: vi.fn(),
        onCreateCharacter: vi.fn()
      }
    });

    expect(container.textContent).toContain('Gandalf');
    expect(container.textContent).toContain('Frodo');
  });

  it('calls onSelect when a character card is clicked', () => {
    const onSelect = vi.fn();

    mount(SelectCharacterMode, {
      target: container,
      props: {
        characters: mockCharacters,
        isLoading: false,
        canCreateCharacter: false,
        onSelect,
        onCreateCharacter: vi.fn()
      }
    });

    const firstCard = container.querySelector('.character-card') as HTMLElement;
    firstCard?.click();

    expect(onSelect).toHaveBeenCalledWith(mockCharacters[0]);
  });

  it('hides create button when canCreateCharacter is false', () => {
    mount(SelectCharacterMode, {
      target: container,
      props: {
        characters: mockCharacters,
        isLoading: false,
        canCreateCharacter: false,
        onSelect: vi.fn(),
        onCreateCharacter: vi.fn()
      }
    });

    expect(container.textContent).not.toContain('Create New Character');
  });

  it('shows create button when canCreateCharacter is true', () => {
    mount(SelectCharacterMode, {
      target: container,
      props: {
        characters: mockCharacters,
        isLoading: false,
        canCreateCharacter: true,
        onSelect: vi.fn(),
        onCreateCharacter: vi.fn()
      }
    });

    expect(container.textContent).toContain('Create New Character');
  });

  it('calls onCreateCharacter when create button is clicked', () => {
    const onCreateCharacter = vi.fn();

    mount(SelectCharacterMode, {
      target: container,
      props: {
        characters: mockCharacters,
        isLoading: false,
        canCreateCharacter: true,
        onSelect: vi.fn(),
        onCreateCharacter
      }
    });

    const createButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Create New Character')
    );
    createButton?.click();

    expect(onCreateCharacter).toHaveBeenCalledOnce();
  });
});
