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

  return {
    locale: mockLocale,
    locales: ['en', 'en-x-tlh']
  };
});

import { apiPost } from '$lib/api/client';
import { evaluate } from '$lib/rules-engine';
import type { Rule, EngineOutput } from '$lib/rules-engine';

const mockApiPost = vi.mocked(apiPost);
const mockEvaluate = vi.mocked(evaluate);

function mockEngineOutput(): EngineOutput {
  return {
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
  };
}

describe('assignRuleGroup with dependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockEvaluate.mockReturnValue(mockEngineOutput());
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('assigns a single dependency before the target group', async () => {
    const depRules: Rule[] = [{ id: 'dep-rule-1', activities: [] }];
    const targetRules: Rule[] = [{ id: 'target-rule-1', activities: [] }];

    // Assign dep (POST /characters/{id}/rule-groups)
    mockApiPost
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      // Fetch dep rules (POST /rule-groups/batch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [
            { ruleGroupId: 'spellcasting', rules: JSON.stringify(depRules), requires: [] }
          ]
        })
      } as Response)
      // Assign target (POST /characters/{id}/rule-groups)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      // Fetch target rules (POST /rule-groups/batch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [
            { ruleGroupId: 'paladin-1', rules: JSON.stringify(targetRules), requires: ['spellcasting'] }
          ]
        })
      } as Response);

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    // Seed cache with requires info
    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      'paladin-1': { name: 'Paladin L1', description: '', requires: ['spellcasting'] },
      'spellcasting': { name: 'Spellcasting', description: '', requires: [] }
    });

    await playStore.assignRuleGroup('char-1', 'paladin-1');

    // Should have 4 POST calls: assign dep, fetch dep rules, assign target, fetch target rules
    expect(mockApiPost).toHaveBeenCalledTimes(4);

    // First call should assign the dep
    expect(mockApiPost).toHaveBeenNthCalledWith(1, '/api/characters/char-1/rule-groups', {
      ruleGroupId: 'spellcasting'
    });
    // Third call should assign the target
    expect(mockApiPost).toHaveBeenNthCalledWith(3, '/api/characters/char-1/rule-groups', {
      ruleGroupId: 'paladin-1'
    });

    // Both should be in state
    expect(playStore.state.ruleGroupIds).toContain('spellcasting');
    expect(playStore.state.ruleGroupIds).toContain('paladin-1');
  });

  it('assigns transitive dependencies in correct order (C, B, A)', async () => {
    // A requires B, B requires C
    const rulesC: Rule[] = [{ id: 'rule-c', activities: [] }];
    const rulesB: Rule[] = [{ id: 'rule-b', activities: [] }];
    const rulesA: Rule[] = [{ id: 'rule-a', activities: [] }];

    // Assign C, fetch C rules, assign B, fetch B rules, assign A, fetch A rules
    mockApiPost
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'c', rules: JSON.stringify(rulesC), requires: [] }]
        })
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'b', rules: JSON.stringify(rulesB), requires: ['c'] }]
        })
      } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'a', rules: JSON.stringify(rulesA), requires: ['b'] }]
        })
      } as Response);

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      'a': { name: 'A', description: '', requires: ['b'] },
      'b': { name: 'B', description: '', requires: ['c'] },
      'c': { name: 'C', description: '', requires: [] }
    });

    await playStore.assignRuleGroup('char-1', 'a');

    // Assign order: C first, then B, then A
    expect(mockApiPost).toHaveBeenNthCalledWith(1, '/api/characters/char-1/rule-groups', {
      ruleGroupId: 'c'
    });
    expect(mockApiPost).toHaveBeenNthCalledWith(3, '/api/characters/char-1/rule-groups', {
      ruleGroupId: 'b'
    });
    expect(mockApiPost).toHaveBeenNthCalledWith(5, '/api/characters/char-1/rule-groups', {
      ruleGroupId: 'a'
    });
  });

  it('skips already-assigned dependencies', async () => {
    const targetRules: Rule[] = [{ id: 'target-rule', activities: [] }];

    // Only assign target (dep already assigned)
    mockApiPost
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'paladin-1', rules: JSON.stringify(targetRules), requires: ['spellcasting'] }]
        })
      } as Response);

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      'paladin-1': { name: 'Paladin L1', description: '', requires: ['spellcasting'] },
      'spellcasting': { name: 'Spellcasting', description: '', requires: [] }
    });

    // Pre-assign spellcasting
    playStore.state.ruleGroupIds = ['spellcasting'];

    await playStore.assignRuleGroup('char-1', 'paladin-1');

    // Only 2 calls: assign target + fetch target rules (dep skipped)
    expect(mockApiPost).toHaveBeenCalledTimes(2);
    expect(playStore.state.ruleGroupIds).toContain('paladin-1');
  });

  it('assigns target even when all deps already assigned', async () => {
    const targetRules: Rule[] = [{ id: 'target-rule', activities: [] }];

    mockApiPost
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'paladin-1', rules: JSON.stringify(targetRules), requires: ['spellcasting'] }]
        })
      } as Response);

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      'paladin-1': { name: 'Paladin L1', description: '', requires: ['spellcasting'] },
      'spellcasting': { name: 'Spellcasting', description: '', requires: [] }
    });

    playStore.state.ruleGroupIds = ['spellcasting'];

    await playStore.assignRuleGroup('char-1', 'paladin-1');

    expect(playStore.state.ruleGroupIds).toContain('paladin-1');
    expect(mockApiPost).toHaveBeenCalledTimes(2); // assign + fetch only
  });

  it('rolls back all deps if target assignment fails', async () => {
    const depRules: Rule[] = [{ id: 'dep-rule', activities: [] }];

    // Assign dep succeeds, fetch dep rules succeeds, assign target fails
    mockApiPost
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ruleGroups: [{ ruleGroupId: 'spellcasting', rules: JSON.stringify(depRules), requires: [] }]
        })
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response); // target assign fails

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      'paladin-1': { name: 'Paladin L1', description: '', requires: ['spellcasting'] },
      'spellcasting': { name: 'Spellcasting', description: '', requires: [] }
    });

    await expect(playStore.assignRuleGroup('char-1', 'paladin-1')).rejects.toThrow();

    // Dep should also be rolled back
    expect(playStore.state.ruleGroupIds).not.toContain('spellcasting');
    expect(playStore.state.ruleGroupIds).not.toContain('paladin-1');
  });
});
