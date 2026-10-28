import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Mock $lib/api/client
vi.mock('$lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn()
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
    subscribe: (callback: (t: (key: string) => string) => void) => {
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
import type { EffectInstance } from '$lib/rules-engine';

const mockApiGet = vi.mocked(apiGet);
const mockApiPost = vi.mocked(apiPost);

/**
 * Cover is CORE (user ruling 2026-10-28): every character has it by default —
 * NOT opt-in content like the Tormentor/spells/spears. Core groups reach a
 * character through exactly one in-repo always-on mechanism: the `requires`
 * self-heal in playStore.loadRuleGroups (auto-assigns a group's deps and
 * persists them). The terraform SEED#CHAR records reach NEW characters only
 * (and are untouched here), so the universal edge is `ac requires cover` — ac
 * is seeded onto every character and its derive already reads cover.bonus.
 *
 * These tests mirror the dependency-self-heal shape
 * (loadRuleGroupsDepHealing.test.ts) but source the batch metadata from the
 * REAL data/rule-groups YAML, so they pin the edge in data, not just the
 * mechanism: a character persisted WITHOUT cover still ends the load with
 * cover assigned AND evaluating (offer, AC compose, notice).
 */

interface RuleGroupYaml {
  ruleGroups?: { id: string; requires?: string[] }[];
}

/** The `requires` a group ACTUALLY declares in data (single-source, no fabrication). */
function requiresInData(ruleGroupId: string, file: string): string[] {
  const sharedFile = path.resolve(process.cwd(), 'data/rule-groups/_shared/definitions.yaml');
  const shared = fs.existsSync(sharedFile) ? fs.readFileSync(sharedFile, 'utf-8') : '';
  const content = fs.readFileSync(path.resolve(process.cwd(), 'data/rule-groups', file), 'utf-8');
  const data = yaml.load(shared ? shared + '\n' + content : content) as RuleGroupYaml;
  const group = data.ruleGroups?.find((rg) => rg.id === ruleGroupId);
  if (!group) throw new Error(`${ruleGroupId} not found in ${file}`);
  return group.requires ?? [];
}

/** One batch-API metadata record, shaped exactly like the sync pipeline writes it. */
function batchItem(ruleGroupId: string, file: string) {
  return { ruleGroupId, name: ruleGroupId, requires: requiresInData(ruleGroupId, file) };
}

describe('cover is core — every character has it by default', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('a character persisted WITHOUT cover self-heals it in and evaluates offers, AC compose and notice', async () => {
    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    // 1. GET assigned group IDs — a real existing character: ac (seeded onto
    //    every character since #158), no cover anywhere in the persisted list.
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ruleGroups: ['ac'] })
    } as Response);
    // 2. GET effects
    mockApiGet.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ effects: null })
    } as Response);

    // 3. POST batch fetch metadata for the assigned groups (real data)
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ruleGroups: [batchItem('ac', 'dnd-5e-2024/ac.yaml')] })
    } as Response);
    // 4. POST ensureCached for cover's metadata (prefetchDepTree)
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ruleGroups: [batchItem('cover', 'dnd-5e-2024/cover.yaml')]
      })
    } as Response);
    // 5. POST assign cover to the character
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    } as Response);

    await playStore.loadRuleGroups('char-1');

    // The load PERSISTED the core assignment (not just an in-memory append).
    expect(mockApiPost).toHaveBeenCalledWith('/api/characters/char-1/rule-groups', {
      ruleGroupId: 'cover'
    });
    expect(playStore.state.ruleGroupIds).toContain('ac');
    expect(playStore.state.ruleGroupIds).toContain('cover');

    // The loaded module set is a live engine input: the cover record is
    // offered (a state, not an activity — always legal).
    const modules = playStore.state.modules;
    const offer = evaluate({ modules }).availableRules.find((r) => r.rule.id === 'set-cover');
    expect(
      offer,
      'the set-cover record is offered without the group being opted into'
    ).toBeDefined();
    expect(offer?.legal).toBe(true);

    // Record half cover through the real plan fold, then compose: ac.value
    // gains the +2 and the standing notice carries the state.
    const planned = evaluate({
      modules,
      planned: [{ instanceId: 'i0', ruleId: 'set-cover', selections: { degree: 1 } }]
    });
    const effect = planned.effects.find((e) => e.id.endsWith('#effect-cover')) as EffectInstance;
    expect(effect).toBeDefined();
    const settled = evaluate({ modules, committed: [effect] });
    expect(settled.facts['cover.effective']).toBe(1);
    expect(settled.facts['ac.value']).toBe(12); // 10 + 2, read off the cover fact
    expect(
      settled.annotations.find((a) => a.key === 'rule.dnd-5e-2024.cover.notice')
    ).toBeDefined();
  });
});
