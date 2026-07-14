import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { readable } from 'svelte/store';

vi.mock('$lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn()
}));

vi.mock('$lib/rules-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/rules-engine')>();
  return {
    ...actual,
    loadModules: vi.fn(async () => ({ modules: [], missing: [], incompatible: [] }))
  };
});

// The store's evaluation seam: the test injects per-instance planned entries.
vi.mock('$lib/play/evaluateCharacter', () => ({
  evaluateCharacter: vi.fn(),
  hypotheticalOffers: vi.fn(() => new Map())
}));

vi.mock('$lib/i18n', () => ({
  t: readable((key: string) => key),
  locale: readable('en'),
  locales: ['en']
}));

vi.mock('svelte-sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() }
}));

import { evaluateCharacter, hypotheticalOffers } from '$lib/play/evaluateCharacter';
import { playStore } from '$lib/play/playStore.svelte';
import PlanStackStoreHarness from './PlanStackStoreHarness.svelte';
import type { EngineOutput, PlannedRef } from '$lib/rules-engine';
import type { Rule } from '$lib/rules-view';
import type { CharacterEvaluation } from '$lib/play/evaluateCharacter';

function rawOutput(): EngineOutput {
  return {
    status: { ok: true, legal: true, applicable: true },
    facts: {},
    availableRules: [],
    planDiagnostics: {},
    plannedOffers: {},
    annotations: [],
    effects: [],
    diagnostics: { errors: [], warnings: [], notices: [] },
    next: { modules: [] }
  };
}

const attackRule: Rule = {
  id: 'attack-sword',
  phase: 'normal',
  activities: [],
  ui: { section: 'action-attack', name: 'attack-sword', intents: { ATTACK: 'default' } }
};

/**
 * The engine's verdict for every planned instance: ran, but ILLEGAL. Distinct
 * from PlanStack's pre-evaluation fallback (legal + inapplicable), so the row's
 * indicator shows which source it rendered from.
 */
function illegalVerdicts(refs: readonly PlannedRef[]): CharacterEvaluation {
  return {
    facts: {},
    availableRules: [],
    plannedEntries: refs.map((ref) => ({
      instanceId: ref.instanceId,
      rule: { ...attackRule, id: ref.ruleId },
      legal: false,
      applicable: true,
      diagnostics: [{ code: 'no_action', severity: 'error' as const }]
    })),
    topBarEntries: [],
    resourceEntries: [],
    advertised: [],
    raw: rawOutput()
  };
}

describe('PlanStack ↔ playStore reactivity (per-instance planned entries)', () => {
  let container: HTMLElement;
  let app: Record<string, unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(hypotheticalOffers).mockReturnValue(new Map());
    vi.mocked(evaluateCharacter).mockImplementation((_modules, _committed, refs) =>
      illegalVerdicts(refs)
    );
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (app) unmount(app);
    container.remove();
    vi.runAllTimers();
    vi.useRealTimers();
    playStore.reset();
    vi.clearAllMocks();
  });

  it('a newly added row upgrades from the fallback to the engine verdict when the debounced evaluation lands', () => {
    playStore.reset();
    app = mount(PlanStackStoreHarness, { target: container });
    flushSync();

    playStore.addToPlan(attackRule);
    flushSync();

    // Before the debounced evaluation: no per-instance entry yet, so the row
    // renders the inapplicable fallback.
    let rows = container.querySelectorAll('.plan-row');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.warning-indicator--inapplicable')).toBeTruthy();
    expect(rows[0].querySelector('.warning-indicator--illegal')).toBeNull();

    // The debounce fires performEvaluation(): it replaces the planned-entries
    // map and the store state. The row must now show THIS instance's engine
    // verdict (illegal), not the stale fallback.
    vi.advanceTimersByTime(300);
    flushSync();

    rows = container.querySelectorAll('.plan-row');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.warning-indicator--illegal')).toBeTruthy();
    expect(rows[0].querySelector('.warning-indicator--inapplicable')).toBeNull();
  });

  it('a later evaluation flipping the verdict updates an existing row in place', () => {
    playStore.reset();
    app = mount(PlanStackStoreHarness, { target: container });

    playStore.addToPlan(attackRule);
    vi.advanceTimersByTime(300);
    flushSync();
    expect(container.querySelector('.warning-indicator--illegal')).toBeTruthy();

    // The next evaluation says the same instance is now legal (e.g. an earlier
    // row freed the action). Trigger it via a plan change elsewhere.
    vi.mocked(evaluateCharacter).mockImplementation((_modules, _committed, refs) => {
      const verdict = illegalVerdicts(refs);
      return {
        ...verdict,
        plannedEntries: verdict.plannedEntries.map((pe) => ({
          ...pe,
          legal: true,
          diagnostics: []
        }))
      };
    });
    playStore.addToPlan(attackRule);
    vi.advanceTimersByTime(300);
    flushSync();

    const rows = container.querySelectorAll('.plan-row');
    expect(rows.length).toBe(2);
    expect(container.querySelector('.warning-indicator--illegal')).toBeNull();
  });
});
