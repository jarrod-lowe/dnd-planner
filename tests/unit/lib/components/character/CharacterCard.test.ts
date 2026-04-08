import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import CharacterCard from '$lib/components/character/CharacterCard.svelte';
import type { Character } from '$lib/character/types';

// English translations for testing
const translations: Record<string, string> = {
  'character.delete': 'Delete'
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

const mockCharacter: Character = {
  characterId: 'char-1',
  userId: 'test-user',
  name: 'Gandalf',
  race: 'human',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('CharacterCard', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('displays character name', () => {
    mount(CharacterCard, {
      target: container,
      props: {
        character: mockCharacter,
        onSelect: vi.fn(),
        onDelete: vi.fn()
      }
    });

    expect(container.textContent).toContain('Gandalf');
  });

  it('calls onSelect when card body is clicked', () => {
    const onSelect = vi.fn();

    mount(CharacterCard, {
      target: container,
      props: {
        character: mockCharacter,
        onSelect,
        onDelete: vi.fn()
      }
    });

    const cardBody = container.querySelector('.character-card__body') as HTMLElement;
    cardBody?.click();

    expect(onSelect).toHaveBeenCalledWith(mockCharacter);
  });

  it('renders a delete button', () => {
    mount(CharacterCard, {
      target: container,
      props: {
        character: mockCharacter,
        onSelect: vi.fn(),
        onDelete: vi.fn()
      }
    });

    const deleteButton = container.querySelector('.character-card__delete');
    expect(deleteButton).toBeTruthy();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();

    mount(CharacterCard, {
      target: container,
      props: {
        character: mockCharacter,
        onSelect: vi.fn(),
        onDelete
      }
    });

    const deleteButton = container.querySelector('.character-card__delete') as HTMLElement;
    deleteButton?.click();

    expect(onDelete).toHaveBeenCalledWith(mockCharacter);
  });

  it('does not call onSelect when delete button is clicked', () => {
    const onSelect = vi.fn();

    mount(CharacterCard, {
      target: container,
      props: {
        character: mockCharacter,
        onSelect,
        onDelete: vi.fn()
      }
    });

    const deleteButton = container.querySelector('.character-card__delete') as HTMLElement;
    deleteButton?.click();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('delete button has aria-label', () => {
    mount(CharacterCard, {
      target: container,
      props: {
        character: mockCharacter,
        onSelect: vi.fn(),
        onDelete: vi.fn()
      }
    });

    const deleteButton = container.querySelector('.character-card__delete');
    expect(deleteButton?.getAttribute('aria-label')).toBeTruthy();
  });
});
