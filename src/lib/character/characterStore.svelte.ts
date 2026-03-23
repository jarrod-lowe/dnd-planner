/**
 * Character store for managing character state.
 * Uses Svelte 5 $state rune for reactivity.
 */
import { apiGet, apiPost } from '$lib/api/client';
import type { Character, CharacterState } from './types';

const STORAGE_KEY = 'dnd-planner-selected-character';

// Initial state
const initialState: CharacterState = {
  selectedCharacter: null,
  characters: [],
  isLoading: false,
  error: null
};

// Reactive state using Svelte 5 $state rune
let state = $state<CharacterState>({ ...initialState });

/**
 * Load characters from the API.
 * Fetches from /api/user and filters for CHAR records.
 */
async function loadCharacters(): Promise<void> {
  state = { ...state, isLoading: true, error: null };

  try {
    const response = await apiGet('/api/user');

    if (!response.ok) {
      throw new Error(`Failed to load characters: ${response.status}`);
    }

    const data = await response.json();
    const characters = data.filter((item: { type?: string }) => item.type === 'CHAR');

    state = {
      ...state,
      characters,
      isLoading: false
    };

    // Restore selected character from localStorage if it exists
    restoreSelectedCharacter();
  } catch (error) {
    state = {
      ...state,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Failed to load characters'
    };
  }
}

/**
 * Restore selected character from localStorage.
 */
function restoreSelectedCharacter(): void {
  const storedId = localStorage.getItem(STORAGE_KEY);
  if (storedId && state.characters.length > 0) {
    const character = state.characters.find((c) => c.characterId === storedId);
    if (character) {
      state = { ...state, selectedCharacter: character };
    } else {
      // Stored ID not found, clear it
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}

/**
 * Select a character and persist to localStorage.
 */
function selectCharacter(character: Character): void {
  state = { ...state, selectedCharacter: character };
  localStorage.setItem(STORAGE_KEY, character.characterId);
}

/**
 * Clear the selected character and return to select mode.
 */
function clearSelection(): void {
  state = { ...state, selectedCharacter: null };
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Create a new character.
 * POSTs to /api/characters and auto-selects the new character.
 */
async function createCharacter(name: string, species: string): Promise<void> {
  state = { ...state, isLoading: true, error: null };

  try {
    const response = await apiPost('/api/characters', { name, species });

    if (!response.ok) {
      throw new Error(`Failed to create character: ${response.status}`);
    }

    const newCharacter = await response.json();

    state = {
      ...state,
      characters: [...state.characters, newCharacter],
      selectedCharacter: newCharacter,
      isLoading: false
    };

    localStorage.setItem(STORAGE_KEY, newCharacter.characterId);
  } catch (error) {
    state = {
      ...state,
      isLoading: false,
      error: error instanceof Error ? error.message : 'Failed to create character'
    };
    throw error;
  }
}

/**
 * Reset store to initial state (for testing).
 */
function reset(): void {
  state = { ...initialState };
}

export const characterStore = {
  get state() {
    return state;
  },
  loadCharacters,
  selectCharacter,
  clearSelection,
  createCharacter,
  reset
};
