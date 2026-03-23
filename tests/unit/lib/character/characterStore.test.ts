import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  apiPost: vi.fn()
}));

import { apiPost } from '$lib/api/client';

describe('characterStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('createCharacter', () => {
    it('sends name and species to the API', async () => {
      const mockApiPost = vi.mocked(apiPost);
      mockApiPost.mockResolvedValue({
        ok: true,
        json: async () => ({
          characterId: 'char-123',
          userId: 'user-1',
          name: 'Aragorn',
          species: 'human',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        })
      } as Response);

      // Import store after mocks are set up
      const { characterStore } = await import('$lib/character/characterStore.svelte');

      await characterStore.createCharacter('Aragorn', 'human');

      expect(mockApiPost).toHaveBeenCalledWith('/api/characters', {
        name: 'Aragorn',
        species: 'human'
      });
    });

    it('adds the new character to the state', async () => {
      const newCharacter = {
        characterId: 'char-123',
        userId: 'user-1',
        name: 'Aragorn',
        species: 'human',
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
      await characterStore.createCharacter('Aragorn', 'human');

      expect(characterStore.state.characters).toContainEqual(newCharacter);
      expect(characterStore.state.selectedCharacter).toEqual(newCharacter);
    });
  });
});
