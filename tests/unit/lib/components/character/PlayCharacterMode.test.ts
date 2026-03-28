import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';

// English translations for testing
const translations: Record<string, string> = {
  'play.backToSelection': 'Back to Character Selection',
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
        engineOutput: {
          status: { ok: true, legal: true, applicable: true },
          facts: {
            'character.movement.remaining': 25,
            'character.movement.total': 30
          },
          collections: {},
          availableRules: [],
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
        plannedItems: [],
        facts: {
          'character.movement.remaining': 25,
          'character.movement.total': 30
        }
      };
    },
    loadRuleGroups: mockFns.loadRuleGroups,
    reset: mockFns.reset,
    addToPlan: mockFns.addToPlan,
    removeFromPlan: mockFns.removeFromPlan,
    movePlanItem: mockFns.movePlanItem
  }
}));

// Mock child components to avoid complex rendering
// Don't mock PlayLayout - we need it to render the snippets for integration testing
// vi.mock('$lib/components/play/PlayLayout.svelte', () => ({
//   default: vi.fn().mockImplementation(() => class MockPlayLayout {})
// }));

// Don't mock StatsColumn - we want to test the actual integration
// vi.mock('$lib/components/play/StatsColumn.svelte', () => ({
//   default: vi.fn()
// }));

vi.mock('$lib/components/play/ChoicesColumn.svelte', () => ({
  default: vi.fn()
}));

vi.mock('$lib/components/play/PlanColumn.svelte', () => ({
  default: vi.fn()
}));

vi.mock('$lib/components/play/JournalColumn.svelte', () => ({
  default: vi.fn()
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

  it('renders back button', () => {
    mount(PlayCharacterMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    expect(container.textContent).toContain('Back to Character Selection');
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();

    mount(PlayCharacterMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack
      }
    });

    const backButton = container.querySelector('.play-character__back') as HTMLButtonElement;
    backButton?.click();

    expect(onBack).toHaveBeenCalledTimes(1);
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

  it('extracts movement from facts with correct fact names', () => {
    // The playStore mock provides:
    // - character.movement.remaining: 25
    // - character.movement.total: 30
    // This test verifies that PlayCharacterMode correctly extracts these
    // and passes them to StatsColumn

    mount(PlayCharacterMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    // StatsColumn should receive movement prop with current: 25, max: 30
    // If the component uses wrong fact names (movement.current, movement.max),
    // it won't find the facts and will show TODO instead
    const statsColumn = container.querySelector('.stats-column');
    expect(statsColumn).toBeTruthy();

    // Should NOT show TODO - should show actual movement values
    const todoElement = container.querySelector('.stats-column__todo');
    expect(todoElement).toBeFalsy();

    // Should show movement stat item
    const statItem = container.querySelector('.stats-column__item');
    expect(statItem).toBeTruthy();
  });
});
