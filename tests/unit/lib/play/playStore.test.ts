import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock $lib/api/client
vi.mock('$lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn()
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

  return {
    locale: mockLocale,
    locales: ['en', 'en-x-tlh']
  };
});

import { apiGet, apiPost } from '$lib/api/client';
import { evaluate } from '$lib/rules-engine';
import { locale } from '$lib/i18n';
import type { Rule, EngineOutput } from '$lib/rules-engine';

describe('playStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          'character.movement.current': 25,
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
      expect(playStore.state.facts['character.movement.current']).toBe(25);

      // Rule with a capture var
      const rule: Rule = {
        id: 'move-walk',
        description: 'Walk',
        activities: [],
        vars: {
          distance: {
            default: { fact: 'character.movement.current' },
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

    it('does not resolve vars without capture property', async () => {
      const mockEvaluate = vi.mocked(evaluate);
      mockEvaluate.mockReturnValue({
        status: { ok: true, legal: true, applicable: true },
        facts: {
          'character.movement.current': 25
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
            default: { fact: 'character.movement.current' }
            // capture not set
          }
        }
      };

      playStore.addToPlan(rule);

      expect(playStore.state.plannedItems).toHaveLength(1);
      // selections should be empty or undefined since capture is not set
      expect(playStore.state.plannedItems[0].rule.selections).toBeUndefined();
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

      // Original item should not have selections
      expect(playStore.state.plannedItems[0].rule.selections).toBeUndefined();
    });
  });
});
