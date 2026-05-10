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
    subscribe: (callback: (key: string) => string) => {
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
import { evaluate } from '$lib/rules-engine';
import type { Rule, EngineOutput } from '$lib/rules-engine';

const mockApiGet = vi.mocked(apiGet);
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

describe('loadRuleGroups dependency self-healing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    mockEvaluate.mockReturnValue(mockEngineOutput());
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('auto-assigns missing feat-alert when loading species-human', async () => {
    const humanRules: Rule[] = [{ id: 'human-rule-1', activities: [] }];
    const alertRules: Rule[] = [{ id: 'alert-rule-1', activities: [] }];

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    // 1. GET assigned group IDs
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ruleGroups: ['species-human'] })
    } as Response);
    // 2. GET effects
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ effects: null })
    } as Response);

    // 3. POST batch fetch rules for initial groups (includes requires metadata)
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          {
            ruleGroupId: 'species-human',
            rules: JSON.stringify(humanRules),
            name: 'Human',
            requires: ['feat-alert']
          }
        ]
      })
    } as Response);
    // 4. POST ensureCached for feat-alert metadata (from prefetchDepTree)
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          {
            ruleGroupId: 'feat-alert',
            rules: JSON.stringify([]),
            name: 'Alert',
            requires: []
          }
        ]
      })
    } as Response);
    // 5. POST assign feat-alert
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    } as Response);
    // 6. POST batch fetch rules for feat-alert
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          {
            ruleGroupId: 'feat-alert',
            rules: JSON.stringify(alertRules),
            requires: []
          }
        ]
      })
    } as Response);

    await playStore.loadRuleGroups('char-1');

    // feat-alert should have been assigned via API
    expect(mockApiPost).toHaveBeenCalledWith('/api/characters/char-1/rule-groups', {
      ruleGroupId: 'feat-alert'
    });

    // Both groups should be in state
    expect(playStore.state.ruleGroupIds).toContain('species-human');
    expect(playStore.state.ruleGroupIds).toContain('feat-alert');

    // Both rules should be loaded
    expect(playStore.state.ruleGroups).toEqual(
      expect.arrayContaining([...humanRules, ...alertRules])
    );
  });

  it('does not assign anything when all deps are already present', async () => {
    const humanRules: Rule[] = [{ id: 'human-rule-1', activities: [] }];
    const alertRules: Rule[] = [{ id: 'alert-rule-1', activities: [] }];

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    // GET assigned group IDs - both already present
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ruleGroups: ['species-human', 'feat-alert'] })
    } as Response);
    // GET effects
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ effects: null })
    } as Response);

    // POST batch fetch - only one call needed (all groups in one batch)
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          {
            ruleGroupId: 'species-human',
            rules: JSON.stringify(humanRules),
            requires: ['feat-alert']
          },
          {
            ruleGroupId: 'feat-alert',
            rules: JSON.stringify(alertRules),
            requires: []
          }
        ]
      })
    } as Response);

    await playStore.loadRuleGroups('char-1');

    // Should only have 1 apiPost call (the batch fetch) - no assignment calls
    const assignmentCalls = mockApiPost.mock.calls.filter(
      (call) =>
        typeof call[0] === 'string' && call[0].includes('/rule-groups') && call[1]?.ruleGroupId
    );
    expect(assignmentCalls).toHaveLength(0);

    // Both groups should be in state
    expect(playStore.state.ruleGroupIds).toContain('species-human');
    expect(playStore.state.ruleGroupIds).toContain('feat-alert');
  });

  it('resolves transitive dependencies (A requires B, B requires C)', async () => {
    const rulesA: Rule[] = [{ id: 'rule-a', activities: [] }];
    const rulesB: Rule[] = [{ id: 'rule-b', activities: [] }];
    const rulesC: Rule[] = [{ id: 'rule-c', activities: [] }];

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    // GET group IDs
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ruleGroups: ['group-a'] })
    } as Response);
    // GET effects
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ effects: null })
    } as Response);

    // POST batch fetch initial
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          {
            ruleGroupId: 'group-a',
            rules: JSON.stringify(rulesA),
            requires: ['group-b']
          }
        ]
      })
    } as Response);

    // POST ensureCached for group-b metadata (discovers group-c)
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          {
            ruleGroupId: 'group-b',
            rules: JSON.stringify([]),
            requires: ['group-c']
          }
        ]
      })
    } as Response);

    // POST ensureCached for group-c metadata
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          {
            ruleGroupId: 'group-c',
            rules: JSON.stringify([]),
            requires: []
          }
        ]
      })
    } as Response);

    // POST assign group-c (deepest first)
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    } as Response);
    // POST batch fetch group-c rules
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [{ ruleGroupId: 'group-c', rules: JSON.stringify(rulesC), requires: [] }]
      })
    } as Response);

    // POST assign group-b
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    } as Response);
    // POST batch fetch group-b rules
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          { ruleGroupId: 'group-b', rules: JSON.stringify(rulesB), requires: ['group-c'] }
        ]
      })
    } as Response);

    await playStore.loadRuleGroups('char-1');

    // Both transitive deps should be assigned
    expect(mockApiPost).toHaveBeenCalledWith('/api/characters/char-1/rule-groups', {
      ruleGroupId: 'group-c'
    });
    expect(mockApiPost).toHaveBeenCalledWith('/api/characters/char-1/rule-groups', {
      ruleGroupId: 'group-b'
    });

    expect(playStore.state.ruleGroupIds).toContain('group-a');
    expect(playStore.state.ruleGroupIds).toContain('group-b');
    expect(playStore.state.ruleGroupIds).toContain('group-c');
  });

  it('deduplicates diamond dependencies across root groups', async () => {
    const rulesA: Rule[] = [{ id: 'rule-a', activities: [] }];
    const rulesB: Rule[] = [{ id: 'rule-b', activities: [] }];
    const rulesC: Rule[] = [{ id: 'rule-c', activities: [] }];

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    // GET group IDs - both A and B assigned, C missing
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ruleGroups: ['group-a', 'group-b'] })
    } as Response);
    // GET effects
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ effects: null })
    } as Response);

    // POST batch fetch initial
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          { ruleGroupId: 'group-a', rules: JSON.stringify(rulesA), requires: ['group-c'] },
          { ruleGroupId: 'group-b', rules: JSON.stringify(rulesB), requires: ['group-c'] }
        ]
      })
    } as Response);

    // POST ensureCached for group-c metadata
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [{ ruleGroupId: 'group-c', rules: JSON.stringify([]), requires: [] }]
      })
    } as Response);

    // POST assign group-c (only once, even though both A and B require it)
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    } as Response);
    // POST batch fetch group-c rules
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [{ ruleGroupId: 'group-c', rules: JSON.stringify(rulesC), requires: [] }]
      })
    } as Response);

    await playStore.loadRuleGroups('char-1');

    // group-c should be assigned exactly once
    const assignCalls = mockApiPost.mock.calls.filter((call) => call[1]?.ruleGroupId === 'group-c');
    expect(assignCalls).toHaveLength(1);

    expect(playStore.state.ruleGroupIds).toContain('group-c');
  });

  it('continues loading when dep assignment fails', async () => {
    const humanRules: Rule[] = [{ id: 'human-rule-1', activities: [] }];

    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    // GET group IDs
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ruleGroups: ['species-human'] })
    } as Response);
    // GET effects
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ effects: null })
    } as Response);

    // POST batch fetch initial
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [
          {
            ruleGroupId: 'species-human',
            rules: JSON.stringify(humanRules),
            requires: ['feat-alert']
          }
        ]
      })
    } as Response);

    // POST ensureCached for feat-alert metadata
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [{ ruleGroupId: 'feat-alert', rules: JSON.stringify([]), requires: [] }]
      })
    } as Response);

    // POST assign feat-alert fails
    mockApiPost.mockResolvedValueOnce({
      ok: false,
      status: 500
    } as Response);

    await playStore.loadRuleGroups('char-1');

    // Should still have loaded species-human rules
    expect(playStore.state.ruleGroupIds).toContain('species-human');
    expect(playStore.state.ruleGroups).toEqual(expect.arrayContaining(humanRules));
    // feat-alert should NOT be in state (assignment failed)
    expect(playStore.state.ruleGroupIds).not.toContain('feat-alert');
    // Should not have errored
    expect(playStore.state.ruleGroupError).toBeNull();
  });
});
