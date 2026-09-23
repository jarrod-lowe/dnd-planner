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

/** A loaded, settled store: modules loaded, initial evaluation run (empty plan). */
async function loadedPlayStore(): Promise<{
  playStore: (typeof import('$lib/play/playStore.svelte'))['playStore'];
  walk: Rule;
}> {
  // Character load: assigned groups [species-human, movement], no persisted
  // effects, no group metadata (the batch response's metadata is cache-only).
  vi.mocked(apiGet)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ruleGroups: ['species-human', 'movement'] })
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

  // The initial (synchronous, empty-plan) evaluation has settled: speed 30.
  expect(playStore.state.facts['character.movement.remaining']).toBe(30);

  const walk =
    playStore.state.engineOutput?.availableRules.find((e) => e.rule.id === 'move-walk')?.rule ??
    undefined;
  if (!walk) throw new Error('move-walk missing from the offer catalog');
  return { playStore, walk };
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
    const { playStore, walk } = await loadedPlayStore();

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
    const { playStore, walk } = await loadedPlayStore();

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
