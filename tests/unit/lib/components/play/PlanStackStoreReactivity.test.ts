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
  hypotheticalOffers: vi.fn(() => new Map()),
  // The harness adds capture-var-less rules only; the prefix seam returns no
  // facts rather than throwing for the store's captureSelections.
  factsBeforeRow: vi.fn(() => ({}))
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
import { evaluate } from '$lib/rules-engine';
import type { EngineOutput, PlannedRef } from '$lib/rules-engine';
import type { Rule } from '$lib/rules-view';
import type { CharacterEvaluation } from '$lib/play/evaluateCharacter';

/**
 * A greataxe-shaped view rule: a d20 to-hit dice-line reading the governed
 * `attack.str.disadvantage` fact, carrying the `dice.any` annotation label the
 * Frightened toggle annotation targets — the row the LoS chip renders on.
 */
const axeRule: Rule = {
  id: 'test-axe',
  activities: [],
  ui: {
    section: 'action-attack',
    name: 'test-axe',
    intents: { ATTACK: 'default' },
    annotationLabels: ['attack.any', 'dice.any'],
    primaryControl: {
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { number: 5 }, purpose: 'to-hit' }],
      advantage: { fact: 'attack.str.disadvantage' }
    }
  }
};

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
      diagnostics: [{ code: 'no_action', severity: 'error' as const }],
      advertisedEffects: []
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

describe("PlanStack ↔ playStore — the Frightened LoS chip's committed gate", () => {
  let container: HTMLElement;
  let app: Record<string, unknown>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(hypotheticalOffers).mockReturnValue(new Map());
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

  it("stays off while the condition is merely PLANNED; appears on the next turn's rows once endTurn commits it", async () => {
    // The bug pin (codex 4127417615): a planned record-frightened row's
    // advertised effect feeds the fold, so the axe row's dice already read the
    // disadvantage — but the chip's tap COMMITS persistent LoS state, and a
    // projection the player can still cancel (removeFromPlan) must not offer
    // it. The chip appears only once the condition effect is in the store's
    // committed set — i.e. on rows planned AFTER End Turn.
    const mod = (await import('$lib/rules-engine/rules/condition-frightened')).default;
    vi.mocked(evaluateCharacter).mockImplementation((_modules, committed, refs) => {
      // The REAL module over the store's committed set and plan refs, with a
      // view entry per ref: the recorder row itself, and the axe row the chip
      // renders on. The axe offer id is unknown to the module, so the fold
      // skips it — its entry comes straight from this mapping.
      const out = evaluate({ modules: [mod], committed, planned: refs });
      return {
        facts: out.facts,
        availableRules: out.availableRules,
        plannedEntries: refs.map((ref) => ({
          instanceId: ref.instanceId,
          rule:
            ref.ruleId === 'record-frightened'
              ? ({
                  id: 'record-frightened',
                  activities: [],
                  ui: { section: 'free', name: 'record-frightened' }
                } as Rule)
              : axeRule,
          legal: true,
          applicable: true,
          diagnostics: [],
          advertisedEffects: []
        })),
        topBarEntries: [],
        resourceEntries: [],
        advertised: out.effects,
        raw: out
      };
    });

    playStore.reset();
    app = mount(PlanStackStoreHarness, { target: container });
    flushSync();

    // Merely planned: the recorder + an axe row. The axe dice read the folded
    // disadvantage (the projection is honest), the toggle annotation is
    // emitted — but NO chip may exist, button or span.
    playStore.addToPlan({ id: 'record-frightened', activities: [] });
    playStore.addToPlan(axeRule);
    vi.advanceTimersByTime(300);
    flushSync();
    expect(container.querySelectorAll('.plan-row')).toHaveLength(2);
    expect(container.querySelector('.panel-renderer__disadv-indicator')).not.toBeNull();
    expect(container.querySelector('.panel-renderer__toggle')).toBeNull();

    // End Turn commits the condition; the plan clears. The next turn's axe row
    // — planned against the COMMITTED condition — gets the chip.
    playStore.endTurn();
    flushSync();
    playStore.addToPlan(axeRule);
    vi.advanceTimersByTime(300);
    flushSync();
    const chip = container.querySelector<HTMLButtonElement>('button.panel-renderer__toggle');
    expect(chip, 'the chip renders once the condition is committed').not.toBeNull();
    expect(chip!.getAttribute('aria-pressed')).toBe('true');
  });
});
