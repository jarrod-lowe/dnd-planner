import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';

// English translations for testing
const translations: Record<string, string> = {
  'play.choices.loading': 'Loading choices...',
  'play.error.loadRuleGroups': 'Failed to load character data'
};

// Use vi.hoisted to define mocks before they're used
const mockFns = vi.hoisted(() => ({
  loadRuleGroups: vi.fn(),
  reset: vi.fn(),
  addToPlan: vi.fn(),
  removeFromPlan: vi.fn(),
  movePlanItem: vi.fn()
}));

// Mock $lib/i18n module
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

// Mock playStore
vi.mock('$lib/play/playStore.svelte', () => ({
  playStore: {
    get state() {
      return {
        isLoadingRuleGroups: false,
        ruleGroupError: null,
        ruleGroups: [],
        topBarEntries: [],
        resourceEntries: [],
        engineOutput: {
          status: { ok: true, legal: true, applicable: true },
          facts: {
            'character.movement.remaining': 25,
            'character.movement.total': 30
          },
          collections: {},
          availableRules: [],
          annotations: [],
          effects: [],
          diagnostics: { errors: [], warnings: [], notices: [] },
          trace: {
            appliedRuleIds: [],
            appliedActivityIds: [],
            providedCapabilities: [],
            emittedEvents: []
          },
          next: {
            schemaVersion: 1,
            rules: { standing: [], planned: [], effects: [] },
            state: { facts: {} }
          }
        },
        isEvaluating: false,
        effects: [],
        plannedItems: [],
        facts: {
          'character.movement.remaining': 25,
          'character.movement.total': 30
        },
        stats: []
      };
    },
    loadRuleGroups: mockFns.loadRuleGroups,
    reset: mockFns.reset,
    addToPlan: mockFns.addToPlan,
    removeFromPlan: mockFns.removeFromPlan,
    movePlanItem: mockFns.movePlanItem
  }
}));

// Mock child components
vi.mock('$lib/components/play/IntentTopBar.svelte', () => ({
  default: vi.fn()
}));

vi.mock('$lib/components/play/ActiveStateStrip.svelte', () => ({
  default: vi.fn()
}));

vi.mock('$lib/components/play/PlanStack.svelte', () => ({
  default: vi.fn()
}));

vi.mock('$lib/components/play/Ledger.svelte', () => ({
  default: vi.fn()
}));

vi.mock('$lib/play/companionStore.svelte', () => ({
  getCompanionView: vi.fn(() => 'player'),
  setCompanionView: vi.fn()
}));

import PlayCharacterMode from '$lib/components/character/PlayCharacterMode.svelte';
import type { Character } from '$lib/character/types';

const mockCharacter: Character = {
  characterId: 'char-123',
  userId: 'user-1',
  name: 'Aragorn',
  species: 'human',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('PlayCharacterMode', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('calls loadRuleGroups on mount with character ID', async () => {
    mount(PlayCharacterMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    // Wait for onMount to execute
    await vi.waitFor(() => {
      expect(mockFns.loadRuleGroups).toHaveBeenCalledWith('char-123');
    });
  });

  it('has play-character container class', () => {
    mount(PlayCharacterMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    expect(container.querySelector('.play-character')).toBeTruthy();
  });

  it('shows loading state when isLoadingRuleGroups is true', async () => {
    vi.mock('$lib/play/playStore.svelte', () => ({
      playStore: {
        get state() {
          return {
            isLoadingRuleGroups: true,
            ruleGroupError: null,
            topBarEntries: [],
            resourceEntries: [],
            effects: [],
            plannedItems: [],
            facts: {},
            stats: [],
            engineOutput: null,
            isEvaluating: false
          };
        },
        loadRuleGroups: mockFns.loadRuleGroups
      }
    }));

    const { default: PlayCharacterModeLocal } =
      await import('$lib/components/character/PlayCharacterMode.svelte');

    mount(PlayCharacterModeLocal, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    expect(container.querySelector('.play-character__loading')).toBeTruthy();
  });
});
