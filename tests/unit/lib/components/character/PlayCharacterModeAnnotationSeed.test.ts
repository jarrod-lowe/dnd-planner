import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, tick } from 'svelte';
import { readable } from 'svelte/store';

/**
 * The Life Bond reminder end to end through the component chain.
 *
 * Every hop between the tap and the store is a prop handed down by name —
 * PanelRenderer → PlanRow (which adds the row's instance id) → PlanStack →
 * PlayCharacterMode → playStore.addOfferToPlan — and each hop was covered only
 * at its own boundary. That left the joins untested, and one of them dropped
 * the third argument: PlayCharacterMode wrapped the store call in an arrow
 * naming just `(offerId, seed)`, which TypeScript accepts for the wider type,
 * so the source row's instance id was silently discarded and the steed's heal
 * row opened on 0 instead of the HP the player had regained.
 *
 * So this test mocks only the store and PlayCharacterMode's unrelated
 * siblings — the whole PlanStack subtree is the real thing — and asserts on
 * what reaches the store, which is the only place all three arguments have to
 * be present at once.
 */

const translations: Record<string, string> = {
  'play.planStack.title': 'This Turn I Want To...',
  'rule.dnd-5e-2024.find-steed.annotate-life-bond.text': 'Your steed regains the same HP'
};

vi.mock('$lib/i18n', () => ({
  t: readable((key: string) => translations[key] ?? key),
  locale: { ...readable('en'), set: vi.fn() },
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en', 'en-x-tlh']
}));

// The player's Record Healing row, already in the plan — the row the reminder
// rides on and the row whose instance id must reach the store.
const HEAL_ROW_INSTANCE_ID = 'inst-record-heal';

const healRowUi = {
  section: 'free',
  name: 'planner.record.heal',
  annotationLabels: ['healing.any'],
  primaryControl: {
    type: 'slider',
    var: 'amount',
    min: { number: 0 },
    max: { fact: 'hp.max' },
    unit: 'hp'
  },
  intents: { HEALTH: 'hp' },
  actionCost: []
};

const healEntry = {
  rule: { id: 'record-heal', phase: 'normal', ui: healRowUi, vars: {}, activities: [] },
  legal: true,
  applicable: true,
  diagnostics: []
};

// The offer the reminder adds. It has to be in `availableRules`, because that
// list IS the addable catalog PlanStack gates the button on.
const steedHealEntry = {
  rule: {
    id: 'steed-record-heal',
    phase: 'normal',
    ui: {
      section: 'free',
      subject: 'steed',
      name: 'steed.heal',
      primaryControl: {
        type: 'slider',
        var: 'amount',
        min: { number: 0 },
        max: { fact: 'companion.steed.hp.max' },
        unit: 'hp'
      },
      intents: { HEALTH: 'hp' },
      actionCost: []
    },
    vars: {},
    activities: []
  },
  legal: true,
  applicable: true,
  diagnostics: []
};

const lifeBondSeed = { amount: { effect: 'hp.modifier.current' } };

const lifeBondAnnotation = {
  key: 'rule.dnd-5e-2024.find-steed.annotate-life-bond.text',
  targets: ['healing.any'],
  addsToPlan: { offer: 'steed-record-heal', seed: lifeBondSeed }
};

const mockFns = vi.hoisted(() => ({
  loadRuleGroups: vi.fn(),
  addOfferToPlan: vi.fn(),
  addToPlan: vi.fn(),
  removeFromPlan: vi.fn(),
  movePlanItem: vi.fn(),
  updateSelections: vi.fn(),
  swapPlanItemRule: vi.fn(),
  removeEffect: vi.fn(),
  addFollowupEffect: vi.fn(),
  endTurn: vi.fn(),
  getAlternativeEntries: vi.fn(() => []),
  getPlannedEntry: vi.fn(() => undefined)
}));

vi.mock('$lib/play/playStore.svelte', () => ({
  playStore: {
    get state() {
      return {
        isLoadingRuleGroups: false,
        ruleGroupError: null,
        ruleGroups: [],
        topBarEntries: [],
        resourceEntries: [],
        modules: [],
        advertised: [],
        isEvaluating: false,
        effects: [],
        stats: [],
        facts: { 'hp.max': 30, 'companion.steed.hp.max': 19 },
        plannedItems: [
          {
            instanceId: HEAL_ROW_INSTANCE_ID,
            rule: { id: 'record-heal', phase: 'normal', ui: healRowUi, selections: { amount: 15 } },
            order: 0,
            originalRuleId: 'record-heal',
            verb: 'HEALTH'
          }
        ],
        engineOutput: {
          status: { ok: true, legal: true, applicable: true },
          facts: { 'hp.max': 30, 'companion.steed.hp.max': 19 },
          collections: {},
          availableRules: [healEntry, steedHealEntry],
          annotations: [lifeBondAnnotation],
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
        }
      };
    },
    ...mockFns
  }
}));

// PlayCharacterMode's other children are irrelevant here; the PlanStack subtree
// (PlanStack → PlanRow → PanelRenderer) is deliberately left real.
vi.mock('$lib/components/play/IntentTopBar.svelte', () => ({ default: vi.fn() }));
vi.mock('$lib/components/play/ActiveStateStrip.svelte', () => ({ default: vi.fn() }));
vi.mock('$lib/components/play/Ledger.svelte', () => ({ default: vi.fn() }));

vi.mock('$lib/play/companionStore.svelte', () => ({
  getCompanionView: vi.fn(() => 'player'),
  setCompanionView: vi.fn()
}));

import PlayCharacterMode from '$lib/components/character/PlayCharacterMode.svelte';
import type { Character } from '$lib/character/types';

const character: Character = {
  characterId: 'char-123',
  userId: 'user-1',
  name: 'Aragorn',
  species: 'human',
  class: 'paladin',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('PlayCharacterMode annotation seeding', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('carries the offer, the seed spec AND the tapped row to the store', async () => {
    mount(PlayCharacterMode, {
      target: container,
      props: { character, email: 'test@example.com', onLogout: vi.fn(), onBack: vi.fn() }
    });
    await tick();

    const button = container.querySelector<HTMLButtonElement>(
      'button.panel-renderer__annotation--action'
    );
    expect(button, 'the Life Bond reminder should render as a tappable button').toBeTruthy();

    button!.click();
    await tick();

    // All three arguments, and the third one especially: without the source row
    // the store cannot resolve `{ effect: 'hp.modifier.current' }` and the new
    // row falls back to its own default of 0.
    expect(mockFns.addOfferToPlan).toHaveBeenCalledWith(
      'steed-record-heal',
      lifeBondSeed,
      HEAL_ROW_INSTANCE_ID
    );
  });
});
