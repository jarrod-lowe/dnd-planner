import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock $lib/api/client
vi.mock('$lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn()
}));

// Mock the (legacy v1) rules engine evaluate function. The store no longer calls
// it — v2 is wired through `./evaluateV2` + `loadModules` (mocked below) — but some
// tests still import the symbol, so keep it a harmless stub.
vi.mock('$lib/rules-engine', () => ({
  evaluate: vi.fn()
}));

// Mock the v2 lazy module loader (no chunks in unit tests) but keep the rest of the
// v2 barrel real (migratePersistedEffects, endTurn aging — pure).
vi.mock('$lib/rules-engine-v2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/rules-engine-v2')>();
  return {
    ...actual,
    loadModules: vi.fn(async () => ({ modules: [], missing: [], incompatible: [] }))
  };
});

// Mock the store's v2 evaluation seam so tests can inject facts/offers/effects.
vi.mock('$lib/play/evaluateV2', () => ({
  evaluateCharacterV2: vi.fn(),
  hypotheticalOffers: vi.fn(() => new Map())
}));

// Mock $lib/i18n with a proper mock store
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

import { apiGet, apiPost, apiDelete } from '$lib/api/client';
import { evaluate } from '$lib/rules-engine';
import { loadModules } from '$lib/rules-engine-v2';
import { evaluateCharacterV2, hypotheticalOffers } from '$lib/play/evaluateV2';
import { locale } from '$lib/i18n';
import { toast } from 'svelte-sonner';
import type { Rule, EngineOutput } from '$lib/rules-engine';
import type { EngineOutput as V2EngineOutput } from '$lib/rules-engine-v2';
import type { V2PlayOutput } from '$lib/play/evaluateV2';

/** A minimal, valid raw v2 engine output for the adapter to consume. */
function rawV2(overrides: Partial<V2EngineOutput> = {}): V2EngineOutput {
  return {
    status: { ok: true, legal: true, applicable: true },
    facts: {},
    availableRules: [],
    planDiagnostics: {},
    annotations: [],
    effects: [],
    diagnostics: { errors: [], warnings: [], notices: [] },
    next: { modules: [] },
    ...overrides
  };
}

/** A V2PlayOutput (the store's eval seam result) with sensible empty defaults. */
function v2Out(overrides: Partial<V2PlayOutput> = {}): V2PlayOutput {
  const raw = overrides.raw ?? rawV2({ facts: overrides.facts });
  return {
    facts: raw.facts,
    availableRules: raw.availableRules,
    plannedEntries: [],
    topBarEntries: [],
    resourceEntries: [],
    advertised: [],
    raw,
    ...overrides
  };
}

describe('playStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    // v2 seam defaults: empty modules + an empty evaluation. Tests override as needed.
    vi.mocked(loadModules).mockResolvedValue({ modules: [], missing: [], incompatible: [] });
    vi.mocked(evaluateCharacterV2).mockReturnValue(v2Out());
    vi.mocked(hypotheticalOffers).mockReturnValue(new Map());
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  describe('loadRuleGroups', () => {
    it('fetches rule group IDs then batches to fetch rules', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      // Mock rule group IDs response - API returns { ruleGroups: string[] }
      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: ['group-1', 'group-2'] })
      } as Response);

      // Mock batch rules response - API returns { ruleGroups: [{ rules: "JSON string" }] }
      const mockRules: Rule[] = [
        { id: 'rule-1', activities: [] },
        { id: 'rule-2', activities: [] }
      ];
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'group-1', rules: JSON.stringify(mockRules) }]
        })
      } as Response);

      // Mock evaluate
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');

      await playStore.loadRuleGroups('char-123');

      expect(mockApiGet).toHaveBeenCalledWith('/api/characters/char-123/rule-groups');
      expect(mockApiPost).toHaveBeenCalledWith('/api/rule-groups/batch?lang=en', {
        ids: ['group-1', 'group-2']
      });
      expect(playStore.state.ruleGroups).toEqual(mockRules);
      expect(playStore.state.ruleGroupIds).toEqual(['group-1', 'group-2']);
    });

    it('splits large rule group lists into batches of 100', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      // Create 150 rule group IDs
      const groupIds = Array.from({ length: 150 }, (_, i) => `group-${i}`);
      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: groupIds })
      } as Response);

      // Mock two batch responses
      const batch1Rules: Rule[] = Array.from({ length: 100 }, (_, i) => ({
        id: `rule-${i}`,
        activities: []
      }));
      const batch2Rules: Rule[] = Array.from({ length: 50 }, (_, i) => ({
        id: `rule-${i + 100}`,
        activities: []
      }));

      mockApiPost
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ruleGroups: [{ ruleGroupId: 'batch-1', rules: JSON.stringify(batch1Rules) }]
          })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ruleGroups: [{ ruleGroupId: 'batch-2', rules: JSON.stringify(batch2Rules) }]
          })
        } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-123');

      expect(mockApiPost).toHaveBeenCalledTimes(2);
      expect(mockApiPost).toHaveBeenNthCalledWith(1, '/api/rule-groups/batch?lang=en', {
        ids: groupIds.slice(0, 100)
      });
      expect(mockApiPost).toHaveBeenNthCalledWith(2, '/api/rule-groups/batch?lang=en', {
        ids: groupIds.slice(100)
      });
      expect(playStore.state.ruleGroups).toHaveLength(150);
      expect(playStore.state.ruleGroupIds).toEqual(groupIds);
    });

    it('sets error state on API failure', async () => {
      const mockApiGet = vi.mocked(apiGet);
      mockApiGet.mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-123');

      expect(playStore.state.ruleGroupError).toBeTruthy();
      expect(playStore.state.isLoadingRuleGroups).toBe(false);
      expect(playStore.state.ruleGroupIds).toEqual([]);
    });

    it('passes current locale to API', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      // Mock rule group IDs response
      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: ['group-1'] })
      } as Response);

      // Mock batch rules response
      const mockRules: Rule[] = [{ id: 'rule-1', activities: [] }];
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'group-1', rules: JSON.stringify(mockRules) }]
        })
      } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Set locale to Klingon
      locale.set('en-x-tlh');

      await playStore.loadRuleGroups('char-123');

      // Should pass lang parameter to API
      expect(mockApiPost).toHaveBeenCalledWith('/api/rule-groups/batch?lang=en-x-tlh', {
        ids: ['group-1']
      });

      // Reset locale
      locale.set('en');
    });

    it('populates ruleGroupRulesMap from batch response', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      const group1Rules: Rule[] = [{ id: 'rule-1', activities: [] }];
      const group2Rules: Rule[] = [{ id: 'rule-2', activities: [] }];

      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: ['group-1', 'group-2'] })
      } as Response);

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [
            { ruleGroupId: 'group-1', rules: JSON.stringify(group1Rules) },
            { ruleGroupId: 'group-2', rules: JSON.stringify(group2Rules) }
          ]
        })
      } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-123');

      expect(playStore.state.ruleGroupRulesMap).toEqual({
        'group-1': group1Rules,
        'group-2': group2Rules
      });
    });

    it('stores the characterId in state', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: ['group-1'] })
      } as Response);

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [
            { ruleGroupId: 'group-1', rules: JSON.stringify([{ id: 'r1', activities: [] }]) }
          ]
        })
      } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-999');

      expect(playStore.state.currentCharacterId).toBe('char-999');
    });

    it('loads effects from API and keeps empty array when null', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockEvaluate = vi.mocked(evaluate);

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: null })
        } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-1');

      expect(mockApiGet).toHaveBeenCalledWith('/api/characters/char-1/effects');
      expect(playStore.state.effects).toEqual([]);
    });

    it('populates committed effects from persisted API response', async () => {
      const mockApiGet = vi.mocked(apiGet);

      // A persisted v2 EffectInstance blob (the post-cutover format).
      const persisted = [
        {
          id: 'effect-bless',
          key: 'bless',
          state: { 'concentration.spent': 1 },
          expiry: [{ kind: 'turns', remaining: 10 }]
        }
      ];

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: JSON.stringify(persisted) })
        } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-1');

      // The blob loads directly as committed; state.effects is the display bridge.
      expect(playStore.state.committed).toEqual(persisted);
      expect(playStore.state.effects.map((e) => e.id)).toEqual(['effect-bless']);
    });

    it('shows toast on effects load failure and falls back to empty', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockEvaluate = vi.mocked(evaluate);
      vi.mocked(toast.error).mockClear();

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500
        } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-1');

      expect(toast.error).toHaveBeenCalledWith('play.error.loadEffects');
      expect(playStore.state.effects).toEqual([]);
    });
  });

  describe('addToPlan', () => {
    it('adds a rule to the plan with a unique instance ID', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule: Rule = { id: 'attack-1', description: 'Attack', activities: [] };
      playStore.addToPlan(rule);

      expect(playStore.state.plannedItems).toHaveLength(1);
      // rule.id is now set to instanceId for unique engine processing
      const item = playStore.state.plannedItems[0];
      expect(item.rule.description).toBe('Attack');
      expect(item.rule.activities).toEqual([]);
      expect(item.instanceId).toBeDefined();
      expect(item.rule.id).toBe(item.instanceId); // id is now the instanceId
      expect(item.order).toBe(0);
    });

    it('resolves capture vars from facts when adding to plan', async () => {
      const mockApiGet = vi.mocked(apiGet);

      // Mock rule group IDs response
      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

      // The v2 evaluation returns the facts capture vars resolve against.
      vi.mocked(evaluateCharacterV2).mockReturnValue(
        v2Out({ facts: { 'character.movement.remaining': 25, 'character.movement.total': 30 } })
      );

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Load rule groups triggers evaluation which populates facts
      await playStore.loadRuleGroups('char-123');

      // Verify facts are populated
      expect(playStore.state.facts['character.movement.remaining']).toBe(25);

      // Rule with a capture var
      const rule: Rule = {
        id: 'move-walk',
        description: 'Walk',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' },
            capture: true
          }
        }
      };

      playStore.addToPlan(rule);

      expect(playStore.state.plannedItems).toHaveLength(1);
      expect(playStore.state.plannedItems[0].rule.selections).toEqual({
        distance: 25
      });
    });

    it('preserves rule default selections alongside capture vars', async () => {
      const mockApiGet = vi.mocked(apiGet);

      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

      vi.mocked(evaluateCharacterV2).mockReturnValue(
        v2Out({ facts: { 'character.movement.remaining': 25 } })
      );

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      await playStore.loadRuleGroups('char-123');

      // Rule with both default selections and a capture var
      const rule: Rule = {
        id: 'move-walk',
        description: 'Walk',
        activities: [],
        selections: { slotLevel: 1 },
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' },
            capture: true
          }
        }
      };

      playStore.addToPlan(rule);

      expect(playStore.state.plannedItems[0].rule.selections).toEqual({
        slotLevel: 1,
        distance: 25
      });
    });

    it('does not resolve vars without capture property', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {
          'character.movement.remaining': 25
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Rule without capture var (capture not set or false)
      const rule: Rule = {
        id: 'move-walk',
        description: 'Walk',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.remaining' }
            // capture not set
          }
        }
      };

      playStore.addToPlan(rule);

      expect(playStore.state.plannedItems).toHaveLength(1);
      // selections should be empty since capture is not set
      expect(playStore.state.plannedItems[0].rule.selections).toEqual({});
    });

    it('allows adding the same rule multiple times (duplicates)', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule: Rule = { id: 'attack-1', description: 'Attack', activities: [] };
      playStore.addToPlan(rule);
      playStore.addToPlan(rule);

      expect(playStore.state.plannedItems).toHaveLength(2);
      expect(playStore.state.plannedItems[0].instanceId).not.toBe(
        playStore.state.plannedItems[1].instanceId
      );
    });

    it('stores originalRuleId preserving the rule id before rewriting', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule: Rule = { id: 'greataxe-attack', description: 'Greataxe', activities: [] };
      playStore.addToPlan(rule);

      const item = playStore.state.plannedItems[0];
      expect(item.rule.id).toBe(item.instanceId);
      expect(item.originalRuleId).toBe('greataxe-attack');
    });

    it('stores verb derived from the rule', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule: Rule = {
        id: 'greataxe-attack',
        activities: [],
        ui: { section: 'action-attack', intents: { ATTACK: 'weapons' }, actionCost: ['action'] }
      };
      playStore.addToPlan(rule);

      expect(playStore.state.plannedItems[0].verb).toBe('ATTACK');
    });
  });

  describe('swapPlanItemRule', () => {
    it('swaps a planned item rule and updates verb and originalRuleId', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Add initial item
      const attackRule: Rule = {
        id: 'greataxe-attack',
        activities: [],
        ui: { section: 'action-attack', intents: { ATTACK: 'weapons' }, actionCost: ['action'] }
      };
      playStore.addToPlan(attackRule);

      const instanceId = playStore.state.plannedItems[0].instanceId;

      // Swap to a different rule
      const spellRule: Rule = {
        id: 'cast-bless',
        activities: [],
        ui: { section: 'action-spell', intents: { AID: 'ally' }, actionCost: ['action'] }
      };
      playStore.swapPlanItemRule(instanceId, { rule: spellRule, illegalReasons: [] });

      expect(playStore.state.plannedItems).toHaveLength(1);
      const item = playStore.state.plannedItems[0];
      expect(item.instanceId).toBe(instanceId); // same instance
      expect(item.originalRuleId).toBe('cast-bless');
      expect(item.verb).toBe('AID');
      expect(item.rule.id).toBe(instanceId); // id still rewritten
    });
  });

  describe('removeFromPlan', () => {
    it('removes an item by instance ID and reindexes order', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule1: Rule = { id: 'attack-1', activities: [] };
      const rule2: Rule = { id: 'move-1', activities: [] };
      const rule3: Rule = { id: 'cast-1', activities: [] };

      playStore.addToPlan(rule1);
      playStore.addToPlan(rule2);
      playStore.addToPlan(rule3);

      const middleInstanceId = playStore.state.plannedItems[1].instanceId;
      playStore.removeFromPlan(middleInstanceId);

      expect(playStore.state.plannedItems).toHaveLength(2);
      expect(playStore.state.plannedItems[0].order).toBe(0);
      expect(playStore.state.plannedItems[1].order).toBe(1);
      expect(
        playStore.state.plannedItems.find((i) => i.instanceId === middleInstanceId)
      ).toBeUndefined();
    });
  });

  describe('movePlanItem', () => {
    it('moves an item up in the plan order', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule1: Rule = { id: 'attack-1', activities: [] };
      const rule2: Rule = { id: 'move-1', activities: [] };

      playStore.addToPlan(rule1);
      playStore.addToPlan(rule2);

      // Move second item up
      const moveItemInstanceId = playStore.state.plannedItems[1].instanceId;
      const attackItemInstanceId = playStore.state.plannedItems[0].instanceId;
      playStore.movePlanItem(moveItemInstanceId, 'up');

      expect(playStore.state.plannedItems[0].instanceId).toBe(moveItemInstanceId);
      expect(playStore.state.plannedItems[1].instanceId).toBe(attackItemInstanceId);
    });

    it('moves an item down in the plan order', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule1: Rule = { id: 'attack-1', activities: [] };
      const rule2: Rule = { id: 'move-1', activities: [] };

      playStore.addToPlan(rule1);
      playStore.addToPlan(rule2);

      // Move first item down
      const attackItemInstanceId = playStore.state.plannedItems[0].instanceId;
      const moveItemInstanceId = playStore.state.plannedItems[1].instanceId;
      playStore.movePlanItem(attackItemInstanceId, 'down');

      expect(playStore.state.plannedItems[0].instanceId).toBe(moveItemInstanceId);
      expect(playStore.state.plannedItems[1].instanceId).toBe(attackItemInstanceId);
    });

    it('does nothing when trying to move first item up', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule1: Rule = { id: 'attack-1', activities: [] };
      const rule2: Rule = { id: 'move-1', activities: [] };

      playStore.addToPlan(rule1);
      playStore.addToPlan(rule2);

      const attackItemInstanceId = playStore.state.plannedItems[0].instanceId;
      const moveItemInstanceId = playStore.state.plannedItems[1].instanceId;
      playStore.movePlanItem(attackItemInstanceId, 'up');

      // Order should remain unchanged
      expect(playStore.state.plannedItems[0].instanceId).toBe(attackItemInstanceId);
      expect(playStore.state.plannedItems[1].instanceId).toBe(moveItemInstanceId);
    });

    it('does nothing when trying to move last item down', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule1: Rule = { id: 'attack-1', activities: [] };
      const rule2: Rule = { id: 'move-1', activities: [] };

      playStore.addToPlan(rule1);
      playStore.addToPlan(rule2);

      const attackItemInstanceId = playStore.state.plannedItems[0].instanceId;
      const moveItemInstanceId = playStore.state.plannedItems[1].instanceId;
      playStore.movePlanItem(moveItemInstanceId, 'down');

      // Order should remain unchanged
      expect(playStore.state.plannedItems[0].instanceId).toBe(attackItemInstanceId);
      expect(playStore.state.plannedItems[1].instanceId).toBe(moveItemInstanceId);
    });
  });

  describe('reset', () => {
    it('clears all state to initial values', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');

      // Add some state
      playStore.addToPlan({ id: 'test', activities: [] });

      // Reset
      playStore.reset();

      expect(playStore.state.plannedItems).toEqual([]);
      expect(playStore.state.ruleGroups).toEqual([]);
      expect(playStore.state.ruleGroupIds).toEqual([]);
      expect(playStore.state.engineOutput).toBeNull();
    });

    it('clears currentCharacterId', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockEvaluate = vi.mocked(evaluate);

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: null })
        } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-1');

      expect(playStore.state.currentCharacterId).toBe('char-1');

      playStore.reset();

      expect(playStore.state.currentCharacterId).toBeNull();
    });
  });

  describe('updateSelections', () => {
    it('updates selections for a planned item and triggers debounced evaluate', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule: Rule = { id: 'move-1', activities: [] };
      playStore.addToPlan(rule);

      const instanceId = playStore.state.plannedItems[0].instanceId;
      playStore.updateSelections(instanceId, { distance: 15 });

      expect(playStore.state.plannedItems[0].rule.selections).toEqual({ distance: 15 });
    });

    it('does nothing if instance ID not found', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule: Rule = { id: 'move-1', activities: [] };
      playStore.addToPlan(rule);

      // Try to update non-existent instance
      playStore.updateSelections('non-existent-id', { distance: 15 });

      // Original item should have empty selections
      expect(playStore.state.plannedItems[0].rule.selections).toEqual({});
    });

    it('merges new selections with existing instead of replacing', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Rule with multiple capture vars (like LoH heal with amount + maxValue)
      const rule: Rule = {
        id: 'loh-heal',
        activities: [],
        vars: {
          amount: { capture: true, default: { number: 5 } },
          maxValue: { capture: true, default: { number: 5 } }
        }
      };
      playStore.addToPlan(rule);

      const instanceId = playStore.state.plannedItems[0].instanceId;

      // Initial selections should capture both vars
      expect(playStore.state.plannedItems[0].rule.selections).toEqual({
        amount: 5,
        maxValue: 5
      });

      // User changes amount via slider - maxValue should be preserved
      playStore.updateSelections(instanceId, { amount: 3 });

      expect(playStore.state.plannedItems[0].rule.selections).toEqual({
        amount: 3,
        maxValue: 5
      });
    });
  });

  describe('assignRuleGroup', () => {
    it('adds ruleGroupId to state on successful assignment', async () => {
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      // prefetchDepTree: batch fetch metadata
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

      // Mock POST assign call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({})
      } as Response);

      // Mock batch fetch call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      await playStore.assignRuleGroup?.('char-1', 'group-new');

      expect(playStore.state.ruleGroupIds).toContain('group-new');
    });

    it('fetches rules and updates standing on success', async () => {
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      const newRules: Rule[] = [{ id: 'new-rule-1', activities: [] }];

      // prefetchDepTree: batch fetch metadata
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

      // Mock POST assign call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({})
      } as Response);

      // Mock batch fetch call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'group-new', rules: JSON.stringify(newRules) }]
        })
      } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      await playStore.assignRuleGroup?.('char-1', 'group-new');

      expect(playStore.state.ruleGroupIds).toContain('group-new');
      expect(playStore.state.ruleGroups).toEqual(expect.arrayContaining(newRules));
    });

    it('reverts ruleGroupIds on API failure', async () => {
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      mockApiPost.mockResolvedValueOnce({
        ok: false,
        status: 500
      } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      expect(typeof playStore.assignRuleGroup).toBe('function');

      await expect(playStore.assignRuleGroup('char-1', 'group-new')).rejects.toThrow();

      // Should be reverted after failure
      expect(playStore.state.ruleGroupIds).not.toContain('group-new');
    });

    it('captures vars for standing rules when assigning a new rule group', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);

      vi.mocked(evaluateCharacterV2).mockReturnValue(v2Out({ facts: { 'con.modifier': 3 } }));

      // loadRuleGroups: get assigned IDs, then effects
      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: ['base-group'] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: null })
        } as Response);

      // loadRuleGroups: fetch base rules
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'base-group', rules: JSON.stringify([]) }]
        })
      } as Response);

      // prefetchDepTree: batch fetch metadata for group-new
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

      // assignRuleGroup: assign API call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({})
      } as Response);

      // assignRuleGroup: fetch assigned group rules
      const assignedRule: Rule = {
        id: 'paladin-level2-hp',
        vars: {
          conAtLevel: { capture: true, default: { fact: 'con.modifier' } }
        },
        activities: []
      };
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'group-new', rules: JSON.stringify([assignedRule]) }]
        })
      } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-1');
      await playStore.assignRuleGroup?.('char-1', 'group-new');

      const addedRule = playStore.state.ruleGroups.find((r) => r.id === 'paladin-level2-hp');
      expect(addedRule?.selections).toEqual({ conAtLevel: 3 });
    });
  });

  describe('condition gating', () => {
    it('blocks assignRuleGroup when conditions are not met', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockEvaluate = vi.mocked(evaluate);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: { 'str.value': 10, 'dex.value': 10 },
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
      } as EngineOutput);

      // loadRuleGroups: get assigned IDs, then effects
      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: null })
        } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
      playStore.reset();

      seedCache({
        'feat-sentinel': {
          name: 'Sentinel',
          description: 'Test',
          requires: [],
          settings: [],
          condition: [
            {
              type: 'or',
              clauses: [
                { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 },
                { fact: 'dex.value', operator: 'greaterThanOrEqual', value: 13 }
              ]
            }
          ]
        }
      });

      // Load rule groups to populate state.facts via evaluation
      await playStore.loadRuleGroups('char-1');

      await expect(playStore.assignRuleGroup?.('char-1', 'feat-sentinel')).rejects.toThrow();

      expect(playStore.state.ruleGroupIds).not.toContain('feat-sentinel');
    });

    it('allows assignRuleGroup when conditions are met', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);

      vi.mocked(evaluateCharacterV2).mockReturnValue(
        v2Out({ facts: { 'str.value': 14, 'dex.value': 10 } })
      );

      // loadRuleGroups: get assigned IDs, then effects
      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: null })
        } as Response);

      // prefetchDepTree: batch fetch metadata
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

      // Mock POST assign call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({})
      } as Response);

      // Mock batch fetch call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
      playStore.reset();

      seedCache({
        'feat-sentinel': {
          name: 'Sentinel',
          description: 'Test',
          requires: [],
          settings: [],
          condition: [
            {
              type: 'or',
              clauses: [
                { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 },
                { fact: 'dex.value', operator: 'greaterThanOrEqual', value: 13 }
              ]
            }
          ]
        }
      });

      // Load rule groups to populate state.facts via evaluation
      await playStore.loadRuleGroups('char-1');
      expect(playStore.state.facts['str.value']).toBe(14);

      await playStore.assignRuleGroup?.('char-1', 'feat-sentinel');

      expect(playStore.state.ruleGroupIds).toContain('feat-sentinel');
    });

    it('checkCondition returns false when conditions not met', async () => {
      const mockApiGet = vi.mocked(apiGet);

      vi.mocked(evaluateCharacterV2).mockReturnValue(
        v2Out({ facts: { 'str.value': 10, 'dex.value': 10 } })
      );

      // loadRuleGroups: get assigned IDs, then effects
      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: null })
        } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
      playStore.reset();

      seedCache({
        'feat-sentinel': {
          name: 'Sentinel',
          description: 'Test',
          requires: [],
          settings: [],
          condition: [
            {
              type: 'or',
              clauses: [
                { fact: 'str.value', operator: 'greaterThanOrEqual', value: 13 },
                { fact: 'dex.value', operator: 'greaterThanOrEqual', value: 13 }
              ]
            }
          ]
        }
      });

      await playStore.loadRuleGroups('char-1');

      expect(playStore.checkCondition?.('feat-sentinel')).toBe(false);
    });

    it('checkCondition returns true when no conditions defined', async () => {
      const mockEvaluate = vi.mocked(evaluate);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
      playStore.reset();

      seedCache({
        'no-conditions-feat': {
          name: 'No Conditions',
          description: 'Test',
          requires: [],
          settings: []
        }
      });

      expect(playStore.checkCondition?.('no-conditions-feat')).toBe(true);
    });

    it('checkCondition returns false after loadRuleGroups caches a condition-bearing group', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);

      vi.mocked(evaluateCharacterV2).mockReturnValue(
        v2Out({ facts: { 'str.value': 10, 'dex.value': 10 } })
      );

      // loadRuleGroups: get assigned IDs (sentinel is assigned)
      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: ['feat-sentinel'] })
        } as Response)
        // effects
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: null })
        } as Response);

      // loadRuleGroups batch fetch: returns sentinel with condition as JSON string
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [
            {
              ruleGroupId: 'feat-sentinel',
              name: 'Sentinel',
              description: 'Test',
              rules: '[]',
              requires: [],
              settings: '[]',
              condition:
                '[{"type":"or","clauses":[{"fact":"str.value","operator":"greaterThanOrEqual","value":13},{"fact":"dex.value","operator":"greaterThanOrEqual","value":13}]}]'
            }
          ]
        })
      } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      await playStore.loadRuleGroups('char-1');

      // After loadRuleGroups, checkCondition should still evaluate the condition
      expect(playStore.state.facts['str.value']).toBe(10);
      expect(playStore.checkCondition?.('feat-sentinel')).toBe(false);
    });
  });

  describe('unassignRuleGroup', () => {
    it('optimistically removes ruleGroupId and rules from state', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockApiDeleteFn = vi.mocked(apiDelete);
      const mockEvaluate = vi.mocked(evaluate);

      const group1Rules: Rule[] = [{ id: 'rule-1', activities: [] }];

      // Set up loadRuleGroups
      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: ['group-1'] })
      } as Response);

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'group-1', rules: JSON.stringify(group1Rules) }]
        })
      } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-123');

      expect(playStore.state.ruleGroupIds).toContain('group-1');

      // Pending DELETE to check optimistic state
      let resolveDelete: (value: unknown) => void;
      mockApiDeleteFn.mockReturnValue(
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
      );

      const promise = playStore.unassignRuleGroup?.('char-123', 'group-1');

      // Optimistic: ID should be removed before API resolves
      expect(playStore.state.ruleGroupIds).not.toContain('group-1');

      // Clean up
      resolveDelete!({ ok: true, status: 204 });
      mockApiPost.mockResolvedValueOnce({ ok: true } as Response);
      await promise;
    });

    it('removes optimistically then reverts on API failure', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockApiDeleteFn = vi.mocked(apiDelete);
      const mockEvaluate = vi.mocked(evaluate);

      const group1Rules: Rule[] = [{ id: 'rule-1', activities: [] }];

      // Set up loadRuleGroups
      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: ['group-1'] })
      } as Response);

      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'group-1', rules: JSON.stringify(group1Rules) }]
        })
      } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-123');

      // Pending DELETE so we can check optimistic then revert
      let resolveDelete: (value: unknown) => void;
      mockApiDeleteFn.mockReturnValue(
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
      );

      const promise = playStore.unassignRuleGroup?.('char-123', 'group-1');

      // Step 1: Optimistic removal
      expect(playStore.state.ruleGroupIds).not.toContain('group-1');

      // Step 2: Fail the DELETE
      resolveDelete!({ ok: false, status: 500 });
      await expect(promise).rejects.toThrow();

      // Step 3: Reverted
      expect(playStore.state.ruleGroupIds).toContain('group-1');
    });
  });

  describe('effects persistence', () => {
    it('passes committed effects to engine during evaluation', async () => {
      // The cast advertises a persistent slot-spend effect this turn.
      const advertised = {
        id: 'effect-slot-1',
        state: { 'spellcasting.slots.level1.spent': 1 },
        expiry: { kind: 'untilLongRest' as const }
      };
      vi.mocked(evaluateCharacterV2).mockReturnValue(v2Out({ advertised: [advertised] }));

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Cast a spell that advertises an effect, then commit it at End Turn.
      playStore.addToPlan({ id: 'cast-spell', activities: [] });
      vi.advanceTimersByTime(300);
      playStore.endTurn();
      expect(playStore.state.committed).toEqual([advertised]);

      // A subsequent evaluation passes the committed set to the engine (2nd arg).
      vi.mocked(evaluateCharacterV2).mockClear();
      vi.mocked(evaluateCharacterV2).mockReturnValue(v2Out());
      playStore.addToPlan({ id: 'test-rule', activities: [] });
      vi.advanceTimersByTime(300);

      expect(evaluateCharacterV2).toHaveBeenCalledWith(
        expect.anything(),
        [advertised],
        expect.anything()
      );
    });

    it('commits advertised effects to state on endTurn', async () => {
      const advertised = {
        id: 'effect-slot-1',
        state: { 'spellcasting.slots.level1.spent': 1 },
        expiry: { kind: 'untilLongRest' as const }
      };
      vi.mocked(evaluateCharacterV2).mockReturnValue(v2Out({ advertised: [advertised] }));

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Add something to plan to make it non-trivial
      playStore.addToPlan({ id: 'test-rule', activities: [] });
      vi.advanceTimersByTime(300);

      // End turn ages the advertised effect into committed.
      playStore.endTurn();

      expect(playStore.state.committed).toEqual([advertised]);
      expect(playStore.state.effects.map((e) => e.id)).toEqual(['effect-slot-1']);
      // Verify plan was cleared
      expect(playStore.state.plannedItems).toEqual([]);
    });

    it('clears effects on reset', async () => {
      const advertised = {
        id: 'effect-1',
        state: { 'spellcasting.slots.level1.spent': 1 },
        expiry: { kind: 'untilLongRest' as const }
      };
      vi.mocked(evaluateCharacterV2).mockReturnValue(v2Out({ advertised: [advertised] }));

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // End turn to commit effects
      playStore.addToPlan({ id: 'test-rule', activities: [] });
      vi.advanceTimersByTime(300);
      playStore.endTurn();

      // Verify effects were committed
      expect(playStore.state.committed).toEqual([advertised]);

      // Reset should clear committed + display effects
      playStore.reset();

      expect(playStore.state.committed).toEqual([]);
      expect(playStore.state.effects).toEqual([]);
    });

    it('POSTs committed effects on endTurn', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      vi.mocked(toast.error).mockClear();

      const advertised = {
        id: 'effect-slot-1',
        state: { 'spellcasting.slots.level1.spent': 1 },
        expiry: { kind: 'untilLongRest' as const }
      };
      vi.mocked(evaluateCharacterV2).mockReturnValue(v2Out({ advertised: [advertised] }));

      // Setup: load character to set currentCharacterId
      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: null })
        } as Response);

      mockApiPost.mockResolvedValue({ ok: true, status: 204 } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-42');

      // Clear to isolate the endTurn POST
      mockApiPost.mockClear();

      playStore.endTurn();

      expect(mockApiPost).toHaveBeenCalledWith('/api/characters/char-42/effects', {
        effects: JSON.stringify([advertised])
      });
    });

    it('shows toast when effects save fails', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);
      vi.mocked(toast.error).mockClear();

      const committedEffect: Rule = { id: 'effect-1', activities: [] };

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: null })
        } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
        collections: {},
        availableRules: [],
        diagnostics: { errors: [], warnings: [], notices: [] },
        trace: {
          appliedRuleIds: [],
          appliedActivityIds: [],
          providedCapabilities: [],
          emittedEvents: []
        },
        effects: [committedEffect],
        next: {
          schemaVersion: 1,
          rules: { standing: [], planned: [], effects: [committedEffect] },
          state: { facts: {} }
        }
      } as EngineOutput);

      // POST returns failure
      mockApiPost.mockResolvedValue({ ok: false, status: 500 } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-42');

      playStore.endTurn();

      // Flush microtasks so the .then() callback runs
      await vi.advanceTimersByTimeAsync(0);

      expect(toast.error).toHaveBeenCalledWith('play.error.saveEffects');
    });

    it('does not POST when no character is loaded', async () => {
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);
      mockApiPost.mockClear();

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Do NOT call loadRuleGroups — currentCharacterId stays null
      playStore.endTurn();

      expect(mockApiPost).not.toHaveBeenCalledWith(
        expect.stringContaining('/effects'),
        expect.anything()
      );
    });
  });

  describe('removeEffect', () => {
    it('removes an effect by rule ID from state.effects', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);

      const effect1 = { id: 'effect-1', state: { 'a.active': 1 }, expiry: { kind: 'untilLongRest' as const } };
      const effect2 = { id: 'effect-2', state: { 'b.active': 1 }, expiry: { kind: 'untilLongRest' as const } };

      // Setup: load character with committed effects (v2 EffectInstance blob)
      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: JSON.stringify([effect1, effect2]) })
        } as Response);

      mockApiPost.mockResolvedValue({ ok: true, status: 204 } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-1');

      expect(playStore.state.effects).toHaveLength(2);

      // Remove effect-1
      playStore.removeEffect('effect-1');

      // Should only have effect-2 remaining
      expect(playStore.state.effects).toHaveLength(1);
      expect(playStore.state.effects[0].id).toBe('effect-2');
    });

    it('triggers re-evaluation after removing an effect', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);

      const persisted = [
        { id: 'effect-1', state: { 'x.active': 1 }, expiry: { kind: 'untilLongRest' } }
      ];

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: JSON.stringify(persisted) })
        } as Response);

      mockApiPost.mockResolvedValue({ ok: true, status: 204 } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-1');

      vi.mocked(evaluateCharacterV2).mockClear();

      playStore.removeEffect('effect-1');

      // Should have re-evaluated (performEvaluation, not debounced)
      expect(evaluateCharacterV2).toHaveBeenCalled();
    });

    it('POSTs updated effects to API for persistence', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);

      const effect1 = { id: 'effect-1', state: { 'a.active': 1 }, expiry: { kind: 'untilLongRest' as const } };
      const effect2 = { id: 'effect-2', state: { 'b.active': 1 }, expiry: { kind: 'untilLongRest' as const } };

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: JSON.stringify([effect1, effect2]) })
        } as Response);

      mockApiPost.mockResolvedValue({ ok: true, status: 204 } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-42');

      // Clear to isolate the removeEffect POST
      mockApiPost.mockClear();

      playStore.removeEffect('effect-1');

      expect(mockApiPost).toHaveBeenCalledWith('/api/characters/char-42/effects', {
        effects: JSON.stringify([effect2])
      });
    });

    it('does not POST when no character is loaded', async () => {
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      mockApiPost.mockClear();

      // No character loaded - should not POST
      playStore.removeEffect('effect-1');

      expect(mockApiPost).not.toHaveBeenCalledWith(
        expect.stringContaining('/effects'),
        expect.anything()
      );
    });

    it('shows toast when effects save fails', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);
      vi.mocked(toast.error).mockClear();

      const effect: Rule = { id: 'effect-1', activities: [] };

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: JSON.stringify([effect]) })
        } as Response);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      // POST returns failure
      mockApiPost.mockResolvedValue({ ok: false, status: 500 } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-42');

      playStore.removeEffect('effect-1');

      // Flush microtasks so the .then() callback runs
      await vi.advanceTimersByTimeAsync(0);

      expect(toast.error).toHaveBeenCalledWith('play.error.saveEffects');
    });
  });

  describe('assignRuleGroupWithSettings', () => {
    // assignSingleGroup makes 2 API calls: assign POST + batch fetch POST
    function mockAssignAndFetch(mockApiPost: ReturnType<typeof vi.mocked<typeof apiPost>>): void {
      // Assign call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({})
      } as Response);
      // Batch fetch call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);
    }

    it('calls assignRuleGroup for select-rule-group settings', async () => {
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      // Parent group + 2 mastery groups (no deps on masteries in test)
      mockAssignAndFetch(mockApiPost); // class-paladin-level1
      mockAssignAndFetch(mockApiPost); // greataxe-mastery
      mockAssignAndFetch(mockApiPost); // javelin-mastery

      const { playStore } = await import('$lib/play/playStore.svelte');
      const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
      playStore.reset();

      seedCache({
        'class-paladin-level1': {
          name: 'Paladin Level 1',
          description: 'Test',
          requires: [],
          settings: [
            {
              id: 'paladin-mastery-1',
              type: 'select-rule-group',
              translations: {
                en: { name: 'Weapon Mastery' },
                'en-x-tlh': { name: 'Weapon Mastery' }
              },
              options: [
                { value: 'greataxe-mastery', translations: { en: { name: 'Greataxe (Cleave)' } } }
              ]
            },
            {
              id: 'paladin-mastery-2',
              type: 'select-rule-group',
              translations: {
                en: { name: 'Weapon Mastery' },
                'en-x-tlh': { name: 'Weapon Mastery' }
              },
              options: [
                { value: 'javelin-mastery', translations: { en: { name: 'Javelin (Slow)' } } }
              ]
            }
          ]
        },
        'greataxe-mastery': {
          name: 'Greataxe Mastery',
          description: 'Test',
          requires: [],
          settings: []
        },
        'javelin-mastery': {
          name: 'Javelin Mastery',
          description: 'Test',
          requires: [],
          settings: []
        }
      });

      const settingsValues = new Map<string, Record<string, string>>();
      settingsValues.set('class-paladin-level1', {
        'paladin-mastery-1': 'greataxe-mastery',
        'paladin-mastery-2': 'javelin-mastery'
      });

      await playStore.assignRuleGroupWithSettings?.(
        'char-1',
        'class-paladin-level1',
        settingsValues
      );

      expect(playStore.state.ruleGroupIds).toContain('class-paladin-level1');
      expect(playStore.state.ruleGroupIds).toContain('greataxe-mastery');
      expect(playStore.state.ruleGroupIds).toContain('javelin-mastery');
    });

    it('does not generate effects for select-rule-group settings', async () => {
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      mockAssignAndFetch(mockApiPost); // class-paladin-level1
      mockAssignAndFetch(mockApiPost); // greataxe-mastery

      const { playStore } = await import('$lib/play/playStore.svelte');
      const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
      playStore.reset();

      seedCache({
        'class-paladin-level1': {
          name: 'Paladin Level 1',
          description: 'Test',
          requires: [],
          settings: [
            {
              id: 'paladin-mastery-1',
              type: 'select-rule-group',
              translations: {
                en: { name: 'Weapon Mastery' },
                'en-x-tlh': { name: 'Weapon Mastery' }
              },
              options: [
                { value: 'greataxe-mastery', translations: { en: { name: 'Greataxe (Cleave)' } } }
              ]
            }
          ]
        },
        'greataxe-mastery': {
          name: 'Greataxe Mastery',
          description: 'Test',
          requires: [],
          settings: []
        }
      });

      const settingsValues = new Map<string, Record<string, string>>();
      settingsValues.set('class-paladin-level1', {
        'paladin-mastery-1': 'greataxe-mastery'
      });

      await playStore.assignRuleGroupWithSettings?.(
        'char-1',
        'class-paladin-level1',
        settingsValues
      );

      expect(playStore.state.effects).toHaveLength(0);
    });

    it('handles mixed select and select-rule-group settings', async () => {
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {},
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
      } as EngineOutput);

      // Parent assign + mastery assign + effects save
      mockAssignAndFetch(mockApiPost); // class-paladin-level1
      mockAssignAndFetch(mockApiPost); // greataxe-mastery
      // Effects persist call
      mockApiPost.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
      playStore.reset();

      seedCache({
        'class-paladin-level1': {
          name: 'Paladin Level 1',
          description: 'Test',
          requires: [],
          settings: [
            {
              id: 'paladin-skill-1',
              type: 'select',
              translations: {
                en: { name: 'Skill Proficiency' },
                'en-x-tlh': { name: 'Skill Proficiency' }
              },
              options: [{ value: 'athletics', translations: { en: { name: 'Athletics' } } }],
              effect: {
                id: 'paladin-skill-proficiency-${value}',
                key: 'skill-${value}-prof',
                state: { 'skill.${value}.proficiency': 1 },
                expiry: { kind: 'permanent' }
              }
            },
            {
              id: 'paladin-mastery-1',
              type: 'select-rule-group',
              translations: {
                en: { name: 'Weapon Mastery' },
                'en-x-tlh': { name: 'Weapon Mastery' }
              },
              options: [
                { value: 'greataxe-mastery', translations: { en: { name: 'Greataxe (Cleave)' } } }
              ]
            }
          ]
        },
        'greataxe-mastery': {
          name: 'Greataxe Mastery',
          description: 'Test',
          requires: [],
          settings: []
        }
      });

      const settingsValues = new Map<string, Record<string, string>>();
      settingsValues.set('class-paladin-level1', {
        'paladin-skill-1': 'athletics',
        'paladin-mastery-1': 'greataxe-mastery'
      });

      await playStore.assignRuleGroupWithSettings?.(
        'char-1',
        'class-paladin-level1',
        settingsValues
      );

      expect(playStore.state.ruleGroupIds).toContain('greataxe-mastery');
      // The select setting committed a v2 EffectInstance (base fact only; the module
      // derives the rest); the display bridge surfaces it in state.effects.
      expect(playStore.state.committed).toEqual([
        {
          id: 'class-paladin-level1::paladin-skill-proficiency-athletics',
          key: 'skill-athletics-prof',
          state: { 'skill.athletics.proficiency': 1 },
          expiry: { kind: 'permanent' }
        }
      ]);
      expect(playStore.state.effects).toHaveLength(1);
      expect(playStore.state.effects[0].id).toBe(
        'class-paladin-level1::paladin-skill-proficiency-athletics'
      );
    });
  });

  describe('getAlternativeEntries', () => {
    it('returns hypothetical availableRules for a planned item', async () => {
      // v2 hypotheticals come from `hypotheticalOffers`, keyed by the removed
      // instance's id. Build the map from the refs the store passes.
      vi.mocked(hypotheticalOffers).mockImplementation((_m, _c, planned) => {
        const map = new Map();
        for (const ref of planned) {
          map.set(ref.instanceId, [
            { rule: { id: 'attack-1' }, legal: true, applicable: true, diagnostics: [] },
            { rule: { id: 'disengage-1' }, legal: true, applicable: true, diagnostics: [] }
          ]);
        }
        return map;
      });

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      const rule: Rule = { id: 'attack-1', activities: [] };
      playStore.addToPlan(rule);

      // Advance timers to trigger debounced evaluation
      vi.advanceTimersByTime(300);

      const instanceId = playStore.state.plannedItems[0].instanceId;
      const result = playStore.getAlternativeEntries(instanceId);

      expect(result).toHaveLength(2);
      expect(result[0].legal).toBe(true);
      expect(result[1].legal).toBe(true);
      // Adapted to the v1 entry shape the UI reads (descriptor gains activities).
      expect(result[0].rule.activities).toEqual([]);
    });

    it('returns empty array when instanceId is not in the map', async () => {
      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      playStore.addToPlan({ id: 'attack-1', activities: [] });
      vi.advanceTimersByTime(300);

      const result = playStore.getAlternativeEntries('nonexistent-id');
      expect(result).toEqual([]);
    });

    it('replaces map between evaluations so removed items have no stale entries', async () => {
      vi.mocked(hypotheticalOffers).mockImplementation((_m, _c, planned) => {
        const map = new Map();
        for (const ref of planned) {
          map.set(ref.instanceId, [
            { rule: { id: 'dodge-1' }, legal: true, applicable: true, diagnostics: [] }
          ]);
        }
        return map;
      });

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      playStore.addToPlan({ id: 'attack-1', activities: [] });
      playStore.addToPlan({ id: 'disengage-1', activities: [] });
      vi.advanceTimersByTime(300);

      const idA = playStore.state.plannedItems[0].instanceId;
      const idB = playStore.state.plannedItems[1].instanceId;

      // Both should be in the map after evaluation
      expect(playStore.getAlternativeEntries(idA)).toBeDefined();
      expect(playStore.getAlternativeEntries(idA)).not.toEqual([]);

      // Remove item B and re-evaluate — B is no longer a ref, so no stale entry.
      playStore.removeFromPlan(idB);
      vi.advanceTimersByTime(300);

      expect(playStore.getAlternativeEntries(idB)).toEqual([]);
    });

    it('clears map on reset so no stale entries persist', async () => {
      vi.mocked(hypotheticalOffers).mockImplementation((_m, _c, planned) => {
        const map = new Map();
        for (const ref of planned) {
          map.set(ref.instanceId, [
            { rule: { id: 'dodge-1' }, legal: true, applicable: true, diagnostics: [] }
          ]);
        }
        return map;
      });

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      playStore.addToPlan({ id: 'attack-1', activities: [] });
      vi.advanceTimersByTime(300);

      const instanceId = playStore.state.plannedItems[0].instanceId;

      // Should have entries after evaluation
      expect(playStore.getAlternativeEntries(instanceId)).toBeDefined();

      // Reset clears everything
      playStore.reset();

      expect(playStore.getAlternativeEntries(instanceId)).toEqual([]);
    });

    it('passes plain planned refs (instanceId + ruleId) to hypothetical evaluations', async () => {
      // v2 passes PlannedRef DATA (not mutable rule objects), so the v1 varsRuntime
      // cross-contamination between the main and hypothetical evals cannot occur.
      const seen: Array<Array<{ instanceId: string; ruleId: string }>> = [];
      vi.mocked(hypotheticalOffers).mockImplementation((_m, _c, planned) => {
        seen.push(planned as Array<{ instanceId: string; ruleId: string }>);
        return new Map();
      });

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      playStore.addToPlan({ id: 'attack-1', activities: [] });
      vi.advanceTimersByTime(300);

      expect(seen.length).toBeGreaterThan(0);
      const lastRefs = seen[seen.length - 1];
      expect(lastRefs[0].ruleId).toBe('attack-1');
      expect(lastRefs[0].instanceId).toBeDefined();
    });

    it('carries a planned item captured selections onto its ref', async () => {
      let capturedRefs: Array<{ ruleId: string; selections?: Record<string, unknown> }> = [];
      vi.mocked(evaluateCharacterV2).mockImplementation((_m, _c, planned) => {
        capturedRefs = planned as typeof capturedRefs;
        return v2Out();
      });

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      playStore.addToPlan({ id: 'cast-spell', activities: [], selections: { slotLevel: 2 } });
      vi.advanceTimersByTime(300);

      expect(capturedRefs[0].ruleId).toBe('cast-spell');
      expect(capturedRefs[0].selections).toMatchObject({ slotLevel: 2 });
    });
  });

  describe('effect mutations recalculate derived UI', () => {
    // v2 top-bar entries come from `derivePanels(facts)` in the eval result, not
    // effect `ui.topBar` blocks. A stateful mock surfaces an entry whenever the
    // character carries a committed effect, so a mutation that changes `committed`
    // changes the derived panel — the behaviour these tests guard.
    const speedEntry = {
      type: 'value' as const,
      label: 'play.topBar.speed',
      fact: 'character.movement.remaining'
    };
    const byCommitted = (_m: unknown, committed: unknown[]) =>
      v2Out({ topBarEntries: committed.length > 0 ? [speedEntry] : [] });

    it('updates topBarEntries after addFollowupEffect', async () => {
      vi.mocked(evaluateCharacterV2).mockImplementation(byCommitted as never);
      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      playStore.addFollowupEffect({
        id: 'effect-steed',
        state: { 'steed.active': 1 },
        expiry: { kind: 'permanent' }
      });

      expect(playStore.state.topBarEntries).toHaveLength(1);
      expect(playStore.state.topBarEntries[0]).toMatchObject({ label: 'play.topBar.speed' });
    });

    it('updates topBarEntries after removeEffect', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      vi.mocked(evaluateCharacterV2).mockImplementation(byCommitted as never);

      mockApiGet
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ruleGroups: [] }) } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            effects: JSON.stringify([
              { id: 'effect-steed', state: { 'steed.active': 1 }, expiry: { kind: 'untilLongRest' } }
            ])
          })
        } as Response);
      mockApiPost.mockResolvedValue({ ok: true, status: 204 } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-1');

      expect(playStore.state.topBarEntries).toHaveLength(1);

      playStore.removeEffect('effect-steed');

      expect(playStore.state.topBarEntries).toHaveLength(0);
    });

    it('updates topBarEntries after endTurn commits effects from engine output', async () => {
      const advertised = {
        id: 'effect-steed',
        state: { 'steed.active': 1 },
        expiry: { kind: 'untilLongRest' as const }
      };
      // Advertise the effect this turn; the entry only surfaces once it's committed.
      vi.mocked(evaluateCharacterV2).mockImplementation(
        ((_m: unknown, committed: unknown[]) =>
          v2Out({
            topBarEntries: committed.length > 0 ? [speedEntry] : [],
            advertised: [advertised]
          })) as never
      );

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      playStore.addToPlan({ id: 'some-action', activities: [] });
      vi.advanceTimersByTime(300);

      expect(playStore.state.topBarEntries).toHaveLength(0);

      playStore.endTurn();

      expect(playStore.state.topBarEntries).toHaveLength(1);
      expect(playStore.state.topBarEntries[0]).toMatchObject({ label: 'play.topBar.speed' });
    });
  });
});
