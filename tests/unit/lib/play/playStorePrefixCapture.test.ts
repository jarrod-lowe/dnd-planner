import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock $lib/api/client
vi.mock('$lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn()
}));

// Mock $lib/i18n with a proper mock store (the real one loads catalogues).
vi.mock('$lib/i18n', () => {
  let currentValue = 'en';
  const subscribers = new Set<(value: string) => void>();

  const mockLocale = {
    subscribe: (callback: (value: string) => void) => {
      subscribers.add(callback);
      callback(currentValue);
      return { unsubscribe: () => subscribers.delete(callback) };
    },
    set: (value: string) => {
      currentValue = value;
      subscribers.forEach((callback) => callback(value));
    },
    update: (fn: (value: string) => string) => {
      mockLocale.set(fn(currentValue));
    }
  };

  const mockT = {
    subscribe: (callback: (value: (key: string) => string) => void) => {
      callback((key: string) => key);
      return { unsubscribe: () => {} };
    }
  };

  return {
    locale: mockLocale,
    locales: ['en', 'en-x-tlh'],
    t: mockT
  };
});

// Mock svelte-sonner
vi.mock('svelte-sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}));

import { apiGet, apiPost } from '$lib/api/client';
import type { Rule } from '$lib/rules-view';

/**
 * Capture-var regression at the store seam — the real engine path, no
 * evaluation mocks: a character whose loader pulls `species-human` (speed 30)
 * + `movement`, loaded through the store's own `loadRuleGroups`.
 *
 * The contract: a row's captured defaults are a pure function of the plan
 * PREFIX at the row's position (committed + earlier rows). The 300ms debounce
 * on `state.facts` is display throttling and can never affect what a new row
 * opens on. The second row here is another Walk rather than Fly because a
 * human cannot fly (the species writes `fly.can` 0 as the module's single
 * override writer) — the capture seam is generic across every `capture: true`
 * var, and Walk is the offer whose default reads `character.movement.remaining`
 * directly.
 */

/** The store under test (dynamically imported, so the type is spelled out). */
type PlayStore = (typeof import('$lib/play/playStore.svelte'))['playStore'];

/**
 * A loaded, settled store: modules loaded, initial evaluation run (empty plan).
 * The probe pins one fact so a wrong group list fails loudly at load, not as a
 * mysterious capture mismatch later.
 */
async function loadedPlayStore(
  ruleGroups: string[] = ['species-human', 'movement'],
  probe: readonly [fact: string, expected: number] = ['character.movement.remaining', 30]
): Promise<{ playStore: PlayStore }> {
  // Character load: the assigned groups, no persisted effects, no group
  // metadata (the batch response's metadata is cache-only).
  vi.mocked(apiGet)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ruleGroups })
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ effects: null })
    } as Response);
  vi.mocked(apiPost).mockResolvedValue({
    ok: true,
    json: async () => ({ ruleGroups: [] })
  } as Response);

  const { playStore } = await import('$lib/play/playStore.svelte');
  playStore.reset();
  await playStore.loadRuleGroups('char-1');

  // The initial (synchronous, empty-plan) evaluation has settled.
  expect(playStore.state.facts[probe[0]]).toBe(probe[1]);
  return { playStore };
}

/** The catalog's live Rule for an offer id — the object addToPlan takes. */
function catalogRule(playStore: PlayStore, id: string): Rule {
  const rule =
    playStore.state.engineOutput?.availableRules.find((e) => e.rule.id === id)?.rule ?? undefined;
  if (!rule) throw new Error(`${id} missing from the offer catalog`);
  return rule;
}

describe('playStore addToPlan captures from the plan prefix', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('a second Walk added inside the debounce window opens on the dragged-to distance (not the stale 30)', async () => {
    const { playStore } = await loadedPlayStore();
    const walk = catalogRule(playStore, 'move-walk');

    playStore.addToPlan(walk); // captures 30 — the empty-plan facts
    const first = playStore.state.plannedItems[0].instanceId;
    // The drag to 15. NO timer advance: the debounced re-evaluation is still
    // pending, so state.facts still reads the empty-plan evaluation (30).
    playStore.updateSelections(first, { distance: 15 });
    expect(playStore.state.facts['character.movement.remaining']).toBe(30); // the stale cache
    playStore.addToPlan(walk); // inside the 300ms window

    // The new row's prefix is [Walk 15] → 30 − 15 = 15 feet legal.
    expect(playStore.state.plannedItems[1].rule.selections).toEqual({ distance: 15 });
  });

  it('a second Walk added after the first row settled at a full spend opens on the dragged-to distance (not the stale 0)', async () => {
    const { playStore } = await loadedPlayStore();
    const walk = catalogRule(playStore, 'move-walk');

    playStore.addToPlan(walk); // captures 30
    vi.advanceTimersByTime(300); // the fold sees Walk@30 → facts remaining 0
    expect(playStore.state.facts['character.movement.remaining']).toBe(0); // the stale cache

    const first = playStore.state.plannedItems[0].instanceId;
    // Drag down to 15; the debounced re-evaluation is pending again.
    playStore.updateSelections(first, { distance: 15 });
    playStore.addToPlan(walk); // state.facts still reads the Walk@30 evaluation

    // The new row's prefix is [Walk 15] — the drag IS in plannedItems, the
    // source of truth, so the capture sees it despite the pending debounce.
    expect(playStore.state.plannedItems[1].rule.selections).toEqual({ distance: 15 });
  });
});

/**
 * The lay-on-hands capture class: a remaining-RESOURCE pool (not movement)
 * whose var authors a spend floor of `min: 1` — the slider's own floor. The
 * prefix can read the pool NEGATIVE (an earlier heal over-committed it — the
 * planner projects over-commitment rather than preventing it), and a verbatim
 * capture there would open the row on a negative amount whose committed
 * `layOnHands.pool.spent` effect REFUNDS the pool at End Turn. The capture
 * must clamp at 1 instead.
 */
describe('playStore addToPlan clamps an over-committed pool capture (lay-on-hands)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('a second heal added over an over-committed first opens on 1 point and never advertises a negative spend', async () => {
    // The loh yaml scenarios' group list: everything level1 + lay-on-hands
    // evaluate against, with the pool probe standing in for the settle check.
    const { playStore } = await loadedPlayStore(
      [
        'species-human',
        'action-economy',
        'hp',
        'core-events',
        'ability-scores',
        'proficiency',
        'ac',
        'class-paladin-level1',
        'class-paladin-lay-on-hands'
      ],
      ['layOnHands.pool.total', 5]
    );
    const heal = catalogRule(playStore, 'loh-heal');

    playStore.addToPlan(heal); // captures the full pool: amount 5
    const first = playStore.state.plannedItems[0].instanceId;
    // Over-commit: 8 of 5 points. The prefix for the next row now reads
    // remaining −3.
    playStore.updateSelections(first, { amount: 8 });
    playStore.addToPlan(heal);

    // Clamped at the spend floor: 1 point, never −3 (maxValue — pool.total —
    // is a total, never negative, and needs no floor).
    const second = playStore.state.plannedItems[1];
    expect(second.rule.selections).toEqual({ amount: 1, maxValue: 5 });

    // And what the row would commit can never refund the pool.
    vi.runAllTimers();
    const effects = playStore.getPlannedEntry(second.instanceId)?.advertisedEffects ?? [];
    const spend = effects
      .map((e) => e.state?.['layOnHands.pool.spent'])
      .find((v): v is number => v !== undefined);
    expect(spend).toBeGreaterThanOrEqual(1);
  });
});
