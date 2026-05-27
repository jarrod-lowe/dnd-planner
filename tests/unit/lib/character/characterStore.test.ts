import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Character } from '$lib/character/types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    })
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Mock $lib/api/client
vi.mock('$lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn()
}));

import { apiPost, apiDelete } from '$lib/api/client';

describe('characterStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('createCharacter', () => {
    it('sends name, species, and class to the API', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({
        ok: true,
        json: async () => ({
          characterId: 'char-123',
          userId: 'user-1',
          name: 'Aragorn',
          species: 'human',
          class: 'paladin-level1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        })
      } as Response);

      // Import store after mocks are set up
      const { characterStore } = await import('$lib/character/characterStore.svelte');

      await characterStore.createCharacter({
        name: 'Aragorn',
        species: 'human',
        class: 'paladin-level1',
      });

      expect(mockApiPost).toHaveBeenCalledWith('/api/characters', {
        name: 'Aragorn',
        species: 'human',
        class: 'paladin-level1',
        additionalRuleGroupIds: [],
        effects: [],
      });
    });

    it('adds the new character to the state', async () => {
      const newCharacter = {
        characterId: 'char-123',
        userId: 'user-1',
        name: 'Aragorn',
        species: 'human',
        class: 'paladin-level1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({
        ok: true,
        json: async () => newCharacter
      } as Response);

      const { characterStore } = await import('$lib/character/characterStore.svelte');

      characterStore.reset();
      await characterStore.createCharacter({
        name: 'Aragorn',
        species: 'human',
        class: 'paladin-level1',
      });

      expect(characterStore.state.characters).toContainEqual(newCharacter);
      expect(characterStore.state.selectedCharacter).toEqual(newCharacter);
    });
  });

  describe('deleteCharacter', () => {
    it('sends DELETE request to the correct URL', async () => {
      const mockApiDelete = vi.mocked(apiDelete);
      mockApiDelete.mockResolvedValue({ ok: true } as Response);

      const { characterStore } = await import('$lib/character/characterStore.svelte');
      characterStore.reset();

      await characterStore.deleteCharacter('char-123');

      expect(mockApiDelete).toHaveBeenCalledWith('/api/characters/char-123');
    });

    it('removes the character from state', async () => {
      const mockApiDelete = vi.mocked(apiDelete);
      mockApiDelete.mockResolvedValue({ ok: true } as Response);

      const { characterStore } = await import('$lib/character/characterStore.svelte');
      characterStore.reset();

      // Manually populate state with characters
      const char1: Character = {
        characterId: 'char-1',
        userId: 'user-1',
        name: 'Aragorn',
        species: 'human',
        class: 'paladin-level1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      const char2: Character = {
        characterId: 'char-2',
        userId: 'user-1',
        name: 'Legolas',
        species: 'elf',
        class: 'paladin-level1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      characterStore.state.characters = [char1, char2];

      await characterStore.deleteCharacter('char-1');

      expect(characterStore.state.characters).toHaveLength(1);
      expect(characterStore.state.characters[0].characterId).toBe('char-2');
    });

    it('clears selection when deleting the selected character', async () => {
      const mockApiDelete = vi.mocked(apiDelete);
      mockApiDelete.mockResolvedValue({ ok: true } as Response);

      const { characterStore } = await import('$lib/character/characterStore.svelte');
      characterStore.reset();

      const char1: Character = {
        characterId: 'char-1',
        userId: 'user-1',
        name: 'Aragorn',
        species: 'human',
        class: 'paladin-level1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      const char2: Character = {
        characterId: 'char-2',
        userId: 'user-1',
        name: 'Legolas',
        species: 'elf',
        class: 'paladin-level1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      characterStore.state.characters = [char1, char2];
      characterStore.state.selectedCharacter = char1;

      await characterStore.deleteCharacter('char-1');

      expect(characterStore.state.selectedCharacter).toBeNull();
    });

    it('does not clear selection when deleting a different character', async () => {
      const mockApiDelete = vi.mocked(apiDelete);
      mockApiDelete.mockResolvedValue({ ok: true } as Response);

      const { characterStore } = await import('$lib/character/characterStore.svelte');
      characterStore.reset();

      const char1: Character = {
        characterId: 'char-1',
        userId: 'user-1',
        name: 'Aragorn',
        species: 'human',
        class: 'paladin-level1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      const char2: Character = {
        characterId: 'char-2',
        userId: 'user-1',
        name: 'Legolas',
        species: 'elf',
        class: 'paladin-level1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      characterStore.state.characters = [char1, char2];
      characterStore.state.selectedCharacter = char2;

      await characterStore.deleteCharacter('char-1');

      expect(characterStore.state.selectedCharacter?.characterId).toBe('char-2');
    });

    it('throws on API failure', async () => {
      const mockApiDelete = vi.mocked(apiDelete);
      mockApiDelete.mockResolvedValue({ ok: false, status: 500 } as Response);

      const { characterStore } = await import('$lib/character/characterStore.svelte');
      characterStore.reset();

      await expect(characterStore.deleteCharacter('char-123')).rejects.toThrow();
    });
  });
});
