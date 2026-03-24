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

import { apiGet, apiPost } from '$lib/api/client';
import { evaluate } from '$lib/rules-engine';
import type { Rule, EngineOutput } from '$lib/rules-engine';

describe('playStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
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
      expect(mockApiPost).toHaveBeenCalledWith('/api/rule-groups/batch', {
        ids: ['group-1', 'group-2']
      });
      expect(playStore.state.ruleGroups).toEqual(mockRules);
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
      expect(mockApiPost).toHaveBeenNthCalledWith(1, '/api/rule-groups/batch', {
        ids: groupIds.slice(0, 100)
      });
      expect(mockApiPost).toHaveBeenNthCalledWith(2, '/api/rule-groups/batch', {
        ids: groupIds.slice(100)
      });
      expect(playStore.state.ruleGroups).toHaveLength(150);
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
      expect(playStore.state.plannedItems[0].rule).toEqual(rule);
      expect(playStore.state.plannedItems[0].instanceId).toBeDefined();
      expect(playStore.state.plannedItems[0].order).toBe(0);
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
      const instanceId = playStore.state.plannedItems[1].instanceId;
      playStore.movePlanItem(instanceId, 'up');

      expect(playStore.state.plannedItems[0].rule.id).toBe('move-1');
      expect(playStore.state.plannedItems[1].rule.id).toBe('attack-1');
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
      const instanceId = playStore.state.plannedItems[0].instanceId;
      playStore.movePlanItem(instanceId, 'down');

      expect(playStore.state.plannedItems[0].rule.id).toBe('move-1');
      expect(playStore.state.plannedItems[1].rule.id).toBe('attack-1');
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

      const instanceId = playStore.state.plannedItems[0].instanceId;
      playStore.movePlanItem(instanceId, 'up');

      // Order should remain unchanged
      expect(playStore.state.plannedItems[0].rule.id).toBe('attack-1');
      expect(playStore.state.plannedItems[1].rule.id).toBe('move-1');
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

      const instanceId = playStore.state.plannedItems[1].instanceId;
      playStore.movePlanItem(instanceId, 'down');

      // Order should remain unchanged
      expect(playStore.state.plannedItems[0].rule.id).toBe('attack-1');
      expect(playStore.state.plannedItems[1].rule.id).toBe('move-1');
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
      expect(playStore.state.engineOutput).toBeNull();
    });
  });
});
