import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, tick } from 'svelte';
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

// Vitest hoists EVERY vi.mock call in the file, even one written inside a test,
// so a second in-test playStore mock would hijack the whole file's store. One
// registration with a mutable flag instead; the loading test flips it.
const mockState = vi.hoisted(() => ({ isLoading: false }));

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
        isLoadingRuleGroups: mockState.isLoading,
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
          // One notice-targeted annotation (must reach the notice strip) and
          // one panel-targeted (must NOT — proves PlayCharacterMode filters
          // through getNotices rather than passing the raw list).
          annotations: [
            {
              key: 'rule.dnd-5e-2024.feat-sentinel.notice-disengage',
              targets: ['notice'],
              source: 'rule.dnd-5e-2024.feat-sentinel.name',
              body: 'rule.dnd-5e-2024.feat-sentinel.notice-disengage.body'
            },
            {
              key: 'rule.dnd-5e-2024.find-steed.annotate-life-bond.text',
              targets: ['healing.any']
            }
          ],
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

// The strips we assert ORDER against are stubbed to single marker elements
// carrying their real root class, so compareDocumentPosition can see where
// PlayCharacterMode places them in the DOM. A bare vi.fn() renders nothing,
// leaving no anchor to compare against.
function stubStrip(className: string) {
  return vi.fn((anchor: ChildNode) => {
    const marker = document.createElement('div');
    marker.className = className;
    anchor.before(marker);
  });
}

// Mock child components
vi.mock('$lib/components/play/IntentTopBar.svelte', () => ({
  default: vi.fn()
}));

vi.mock('$lib/components/play/ActiveStateStrip.svelte', () => ({
  default: stubStrip('active-state-strip')
}));

vi.mock('$lib/components/play/PlanStack.svelte', () => ({
  default: stubStrip('plan-stack')
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
  class: 'paladin',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('PlayCharacterMode', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
    mockState.isLoading = false;
  });

  it('calls loadRuleGroups on mount with character ID', async () => {
    mount(PlayCharacterMode, {
      target: container,
      props: {
        character: mockCharacter,
        email: 'test@example.com',
        onLogout: vi.fn(),
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
        email: 'test@example.com',
        onLogout: vi.fn(),
        onBack: vi.fn()
      }
    });

    expect(container.querySelector('.play-character')).toBeTruthy();
  });

  it('mounts the notice strip between the active states and the plan stack', async () => {
    mount(PlayCharacterMode, {
      target: container,
      props: {
        character: mockCharacter,
        email: 'test@example.com',
        onLogout: vi.fn(),
        onBack: vi.fn()
      }
    });
    await tick();

    const noticeStrip = container.querySelector('.notice-strip');
    expect(noticeStrip, 'NoticeStrip should be mounted').toBeTruthy();

    const activeStates = container.querySelector('.active-state-strip');
    const planStack = container.querySelector('.plan-stack');
    expect(activeStates, 'active states marker should render').toBeTruthy();
    expect(planStack, 'plan stack marker should render').toBeTruthy();

    expect(
      activeStates!.compareDocumentPosition(noticeStrip!) & Node.DOCUMENT_POSITION_FOLLOWING,
      'notices come after the active states'
    ).toBeTruthy();
    expect(
      noticeStrip!.compareDocumentPosition(planStack!) & Node.DOCUMENT_POSITION_FOLLOWING,
      'notices come before the plan stack'
    ).toBeTruthy();

    // Only the notice-targeted annotation reaches the strip — the raw engine
    // annotation list must be filtered through getNotices on the way in.
    const cells = container.querySelectorAll('.notice-strip__cell');
    expect(cells).toHaveLength(1);
    expect(cells[0].querySelector('.notice-strip__label')?.textContent).toContain(
      'rule.dnd-5e-2024.feat-sentinel.notice-disengage'
    );
  });

  it('shows loading state when isLoadingRuleGroups is true', async () => {
    mockState.isLoading = true;

    mount(PlayCharacterMode, {
      target: container,
      props: {
        character: mockCharacter,
        email: 'test@example.com',
        onLogout: vi.fn(),
        onBack: vi.fn()
      }
    });

    expect(container.querySelector('.play-character__loading')).toBeTruthy();
  });
});
