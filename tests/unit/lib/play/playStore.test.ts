import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock $lib/api/client
vi.mock('$lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn()
}));

// Mock the rules engine evaluate function
vi.mock('$lib/rules-engine', () => ({
  evaluate: vi.fn()
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
import { locale } from '$lib/i18n';
import { toast } from 'svelte-sonner';
import type { Rule, EngineOutput } from '$lib/rules-engine';

describe('playStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
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

    it('populates effects from persisted API response', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockEvaluate = vi.mocked(evaluate);

      const persistedEffects: Rule[] = [
        { id: 'effect-slot-expended-l1', phase: 'normal', activities: [] }
      ];

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: JSON.stringify(persistedEffects) })
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

      expect(playStore.state.effects).toEqual(persistedEffects);
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
      const mockEvaluate = vi.mocked(evaluate);

      // Mock rule group IDs response
      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

      // Mock evaluate to return facts
      mockEvaluate.mockReturnValue({
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
      } as EngineOutput);

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
      const mockEvaluate = vi.mocked(evaluate);

      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: [] })
      } as Response);

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
      const mockEvaluate = vi.mocked(evaluate);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: { 'con.modifier': 3 },
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
      const mockEvaluate = vi.mocked(evaluate);

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: { 'str.value': 14, 'dex.value': 10 },
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
      const mockEvaluate = vi.mocked(evaluate);
      const committedEffect: Rule = { id: 'effect-slot-1', activities: [] };

      // First call: spell cast returns an effect
      mockEvaluate.mockReturnValueOnce({
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

      // Second call: after endTurn, should receive committed effects
      mockEvaluate.mockReturnValueOnce({
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
      } as EngineOutput).mockReturnValueOnce({
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
        effects: [],
        next: {
          schemaVersion: 1,
          rules: { standing: [], planned: [], effects: [] },
          state: { facts: {} }
        }
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Cast a spell that advertises an effect
      const spellRule: Rule = { id: 'cast-spell', activities: [] };
      playStore.addToPlan(spellRule);
      vi.advanceTimersByTime(300);

      // End turn to commit effects
      playStore.endTurn();

      // Now add another action - the committed effects should be passed to engine
      mockEvaluate.mockClear();
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

      const rule: Rule = { id: 'test-rule', activities: [] };
      playStore.addToPlan(rule);
      vi.advanceTimersByTime(300);

      // Verify evaluate was called with the committed effects
      expect(mockEvaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          rules: expect.objectContaining({
            effects: [committedEffect]
          })
        })
      );
    });

    it('commits output effects to state on endTurn', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      const committedEffect: Rule = {
        id: 'effect-slot-1',
        phase: 'normal',
        activities: []
      };

      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: { 'slots.remaining': 3 },
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
          state: { facts: { 'slots.remaining': 3 } }
        }
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // Add something to plan to make it non-trivial
      playStore.addToPlan({ id: 'test-rule', activities: [] });
      vi.advanceTimersByTime(300);

      // End turn
      playStore.endTurn();

      // Verify effects from output were committed to state
      expect(playStore.state.effects).toEqual([committedEffect]);
      // Verify plan was cleared
      expect(playStore.state.plannedItems).toEqual([]);
    });

    it('clears effects on reset', async () => {
      const committedEffect: Rule = { id: 'effect-1', activities: [] };
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
        effects: [committedEffect],
        next: {
          schemaVersion: 1,
          rules: { standing: [], planned: [], effects: [committedEffect] },
          state: { facts: {} }
        }
      } as EngineOutput);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      // End turn to commit effects
      playStore.addToPlan({ id: 'test-rule', activities: [] });
      vi.advanceTimersByTime(300);
      playStore.endTurn();

      // Verify effects were committed
      expect(playStore.state.effects).toEqual([committedEffect]);

      // Reset should clear effects
      playStore.reset();

      expect(playStore.state.effects).toEqual([]);
    });

    it('POSTs committed effects on endTurn', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);
      vi.mocked(toast.error).mockClear();

      const committedEffect: Rule = { id: 'effect-slot-1', activities: [] };

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

      mockApiPost.mockResolvedValue({ ok: true, status: 204 } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-42');

      // Clear to isolate the endTurn POST
      mockApiPost.mockClear();

      playStore.endTurn();

      expect(mockApiPost).toHaveBeenCalledWith('/api/characters/char-42/effects', {
        effects: JSON.stringify([committedEffect])
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
      const mockEvaluate = vi.mocked(evaluate);

      const effect1: Rule = { id: 'effect-1', activities: [] };
      const effect2: Rule = { id: 'effect-2', activities: [] };

      // Setup: load character with committed effects
      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: JSON.stringify([effect1, effect2]) })
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
      const mockEvaluate = vi.mocked(evaluate);

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

      mockApiPost.mockResolvedValue({ ok: true, status: 204 } as Response);

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      await playStore.loadRuleGroups('char-1');

      mockEvaluate.mockClear();

      playStore.removeEffect('effect-1');

      // Should have called evaluate (performEvaluation, not debounced)
      expect(mockEvaluate).toHaveBeenCalled();
    });

    it('POSTs updated effects to API for persistence', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      const effect1: Rule = { id: 'effect-1', activities: [] };
      const effect2: Rule = { id: 'effect-2', activities: [] };

      mockApiGet
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ruleGroups: [] })
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ effects: JSON.stringify([effect1, effect2]) })
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

  describe('stats extraction', () => {
    it('state.stats is empty after reset', async () => {
      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();
      expect(playStore.state.stats).toEqual([]);
    });

    it('state.stats contains stats from loaded rule groups', async () => {
      const mockApiGet = vi.mocked(apiGet);
      const mockApiPost = vi.mocked(apiPost);
      const mockEvaluate = vi.mocked(evaluate);

      mockApiGet.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ruleGroups: ['group-1'] })
      } as Response);

      const mockRules: Rule[] = [
        {
          id: 'rule-with-stats',
          activities: [],
          ui: {
            stats: [
              {
                name: 'play.stats.initiative',
                type: 'value',
                fact: 'initiative.value',
                section: 'stats'
              }
            ]
          }
        }
      ];
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
      await playStore.loadRuleGroups('char-stats-1');

      expect(playStore.state.stats).toHaveLength(1);
      expect(playStore.state.stats[0].name).toBe('play.stats.initiative');
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
                phase: 'early',
                activities: [
                  {
                    type: 'numberSet',
                    target: { fact: 'skill.${value}.proficiency' },
                    source: { number: 1 }
                  }
                ]
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
      expect(playStore.state.effects).toHaveLength(1);
      expect(playStore.state.effects[0].id).toBe(
        'class-paladin-level1::paladin-skill-proficiency-athletics'
      );
    });
  });

  describe('getAlternativeEntries', () => {
    function makeEngineOutput(
      availableRules: import('$lib/rules-engine').AvailableRuleEntry[] = []
    ): EngineOutput {
      return {
        status: { ok: true, legal: true, applicable: true },
        facts: {},
        collections: {},
        availableRules,
        annotations: [],
        diagnostics: { errors: [], warnings: [], notices: [] },
        trace: {
          appliedRuleIds: [],
          appliedActivityIds: [],
          providedCapabilities: [],
          emittedEvents: []
        },
        effects: [],
        next: {
          schemaVersion: 1,
          rules: { standing: [], planned: [], effects: [] },
          state: { facts: {} }
        }
      } as EngineOutput;
    }

    it('returns hypothetical availableRules for a planned item', async () => {
      const mockEvaluate = vi.mocked(evaluate);

      const mainOutput = makeEngineOutput([
        { rule: { id: 'attack-1', activities: [] }, legal: false, applicable: true, diagnostics: [] },
        { rule: { id: 'disengage-1', activities: [] }, legal: false, applicable: true, diagnostics: [] }
      ]);

      const hypotheticalOutput = makeEngineOutput([
        { rule: { id: 'attack-1', activities: [] }, legal: true, applicable: true, diagnostics: [] },
        { rule: { id: 'disengage-1', activities: [] }, legal: true, applicable: true, diagnostics: [] }
      ]);

      mockEvaluate.mockReturnValueOnce(mainOutput).mockReturnValueOnce(hypotheticalOutput);

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
    });

    it('returns empty array when instanceId is not in the map', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue(makeEngineOutput());

      const { playStore } = await import('$lib/play/playStore.svelte');
      playStore.reset();

      playStore.addToPlan({ id: 'attack-1', activities: [] });
      vi.advanceTimersByTime(300);

      const result = playStore.getAlternativeEntries('nonexistent-id');
      expect(result).toEqual([]);
    });

    it('replaces map between evaluations so removed items have no stale entries', async () => {
      const mockEvaluate = vi.mocked(evaluate);

      const altRules = [
        { rule: { id: 'dodge-1', activities: [] }, legal: true, applicable: true, diagnostics: [] }
      ];
      // 1 main eval + 2 hypothetical evals (one per planned item)
      mockEvaluate
        .mockReturnValueOnce(makeEngineOutput())
        .mockReturnValueOnce(makeEngineOutput(altRules))
        .mockReturnValueOnce(makeEngineOutput(altRules));

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

      // Remove item B and re-evaluate
      mockEvaluate.mockReturnValue(makeEngineOutput());
      playStore.removeFromPlan(idB);
      vi.advanceTimersByTime(300);

      // B's entries should be gone from the map
      expect(playStore.getAlternativeEntries(idB)).toEqual([]);
    });

    it('clears map on reset so no stale entries persist', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue(makeEngineOutput());

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
  });
});
