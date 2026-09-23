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
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

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

/**
 * The entry a row's OR INSTEAD picker would hand the swap, mirroring
 * PlanStack's `preChoiceAlternatives`: the row's pre-choice (hypothetical)
 * catalog when an evaluation covers the instance, else the post-plan catalog —
 * the documented fallback inside the debounce window. Illegal entries are
 * shown and tappable in the picker (tagged, not filtered), so an illegal-for-
 * a-human Fly is a faithful target.
 */
function alternativeEntry(
  playStore: (typeof import('$lib/play/playStore.svelte'))['playStore'],
  instanceId: string,
  ruleId: string
): AvailableRuleEntry {
  const catalog =
    playStore.getAlternativeEntries(instanceId) ??
    playStore.state.engineOutput?.availableRules ??
    [];
  const entry = catalog.find((e) => e.rule.id === ruleId);
  if (!entry) throw new Error(`${ruleId} missing from the row's OR INSTEAD catalog`);
  return entry;
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

describe('playStore swapPlanItemRule captures from the plan prefix', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('swapping a Dash row to Walk opens on the species speed, not the doubled dashed total', async () => {
    // The originally reported repro: the MOVE chip defaults to Dash, the player
    // swaps to Walk. Dash's apply advertises the CURRENT total (combine:sum),
    // so the post-plan facts read 60 — but the row's choice was made over the
    // pre-Dash state, where 30 feet were legal.
    const { playStore } = await loadedPlayStore(['species-human', 'movement', 'dash']);
    const dash =
      playStore.state.engineOutput?.availableRules.find((e) => e.rule.id === 'dash-action')?.rule ??
      undefined;
    if (!dash) throw new Error('dash-action missing from the offer catalog');

    playStore.addToPlan(dash);
    const row = playStore.state.plannedItems[0].instanceId;
    vi.advanceTimersByTime(300);
    // The final fold includes Dash's +30: both total and remaining read 60.
    expect(playStore.state.facts['character.movement.total']).toBe(60);
    expect(playStore.state.facts['character.movement.remaining']).toBe(60);

    playStore.swapPlanItemRule(row, alternativeEntry(playStore, row, 'move-walk'));

    // The row's prefix is the EMPTY plan (its own Dash excluded): speed 30.
    expect(playStore.state.plannedItems[0].rule.selections).toEqual({ distance: 30 });
  });

  it('swapping an evaluated Walk@15 row opens on the full remaining, not the old value', async () => {
    const { playStore } = await loadedPlayStore();
    const walk = catalogRule(playStore, 'move-walk');

    playStore.addToPlan(walk);
    const first = playStore.state.plannedItems[0].instanceId;
    playStore.updateSelections(first, { distance: 15 });
    vi.advanceTimersByTime(300);
    expect(playStore.state.facts['character.movement.remaining']).toBe(15); // final facts

    playStore.swapPlanItemRule(first, alternativeEntry(playStore, first, 'move-fly'));

    // The row's prefix excludes its own spend: all 30 feet are legal again.
    expect(playStore.state.plannedItems[0].rule.selections).toEqual({ distance: 30 });
  });

  it('swapping a fully-spent Walk row opens on the full remaining, not 0', async () => {
    const { playStore } = await loadedPlayStore();
    const walk = catalogRule(playStore, 'move-walk');

    playStore.addToPlan(walk); // captures 30 — a full spend
    const first = playStore.state.plannedItems[0].instanceId;
    vi.advanceTimersByTime(300);
    expect(playStore.state.facts['character.movement.remaining']).toBe(0); // final facts

    playStore.swapPlanItemRule(first, alternativeEntry(playStore, first, 'move-fly'));

    expect(playStore.state.plannedItems[0].rule.selections).toEqual({ distance: 30 });
  });

  it('swapping an over-committed Walk row opens on the full remaining, not the clamped leftover', async () => {
    const { playStore } = await loadedPlayStore();
    const walk = catalogRule(playStore, 'move-walk');

    playStore.addToPlan(walk);
    const first = playStore.state.plannedItems[0].instanceId;
    playStore.updateSelections(first, { distance: 35 }); // over-commit drag stays draggable
    vi.advanceTimersByTime(300);
    // The planner projects over-commitment: final facts read negative.
    expect(playStore.state.facts['character.movement.remaining']).toBe(-5);

    playStore.swapPlanItemRule(first, alternativeEntry(playStore, first, 'move-fly'));

    expect(playStore.state.plannedItems[0].rule.selections).toEqual({ distance: 30 });
  });

  it('a multi-row swap counts earlier rows and excludes the swapped row itself', async () => {
    const { playStore } = await loadedPlayStore();
    const walk = catalogRule(playStore, 'move-walk');

    playStore.addToPlan(walk);
    const first = playStore.state.plannedItems[0].instanceId;
    playStore.updateSelections(first, { distance: 15 });
    vi.advanceTimersByTime(300); // [Walk 15] settled
    playStore.addToPlan(walk); // second Walk opens on 15 (the prefix)
    const second = playStore.state.plannedItems[1].instanceId;
    vi.advanceTimersByTime(300); // [Walk 15, Walk 15] settled
    expect(playStore.state.facts['character.movement.remaining']).toBe(0); // final facts

    playStore.swapPlanItemRule(second, alternativeEntry(playStore, second, 'move-fly'));

    // The second row's prefix is [Walk 15]: 15 feet legal, its own 15 excluded.
    expect(playStore.state.plannedItems[1].rule.selections).toEqual({ distance: 15 });
  });

  it('the same swap with NO timer advance after the drag captures identically', async () => {
    const { playStore } = await loadedPlayStore();
    const walk = catalogRule(playStore, 'move-walk');

    playStore.addToPlan(walk); // captures 30
    const first = playStore.state.plannedItems[0].instanceId;
    vi.advanceTimersByTime(300); // the fold sees Walk@30
    playStore.updateSelections(first, { distance: 15 });
    // NO advance: the drag is in plannedItems (source of truth) but the
    // debounced facts still read the Walk@30 evaluation.
    expect(playStore.state.facts['character.movement.remaining']).toBe(0);

    playStore.swapPlanItemRule(first, alternativeEntry(playStore, first, 'move-fly'));

    // Identical to the settled variant: the prefix (empty) is untouched by
    // either the debounce or the row's own spend.
    expect(playStore.state.plannedItems[0].rule.selections).toEqual({ distance: 30 });
  });

  it('a multi-row swap inside the debounce window (row just added) captures identically', async () => {
    const { playStore } = await loadedPlayStore();
    const walk = catalogRule(playStore, 'move-walk');

    playStore.addToPlan(walk);
    const first = playStore.state.plannedItems[0].instanceId;
    playStore.updateSelections(first, { distance: 15 });
    vi.advanceTimersByTime(300); // [Walk 15] settled
    playStore.addToPlan(walk); // second Walk opens on 15
    const second = playStore.state.plannedItems[1].instanceId;
    // NO advance: no hypothetical catalog covers the new instance yet — the
    // picker falls back to the post-plan catalog (also pre-settlement here).
    expect(playStore.state.facts['character.movement.remaining']).toBe(15);

    playStore.swapPlanItemRule(second, alternativeEntry(playStore, second, 'move-fly'));

    // Identical to the settled variant: the prefix [Walk 15] reads 15 legal.
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
