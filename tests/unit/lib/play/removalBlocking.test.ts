import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock $lib/api/client
vi.mock('$lib/api/client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn()
}));

// Mock $lib/i18n
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

describe('unassignRuleGroup blocking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('allows removal when no other group requires it', async () => {
    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      spellcasting: { name: 'Spellcasting', description: '', requires: [] },
      'paladin-1': { name: 'Paladin L1', description: '', requires: ['spellcasting'] }
    });

    playStore.state.ruleGroupIds = ['spellcasting', 'paladin-1'];

    expect(playStore.isLocked('paladin-1')).toBe(false);
  });

  it('blocks removal when another assigned group requires it', async () => {
    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      spellcasting: { name: 'Spellcasting', description: '', requires: [] },
      'paladin-1': { name: 'Paladin L1', description: '', requires: ['spellcasting'] }
    });

    playStore.state.ruleGroupIds = ['spellcasting', 'paladin-1'];

    // spellcasting is required by paladin-1, so it's locked
    expect(playStore.isLocked('spellcasting')).toBe(true);
  });

  it('allows removal after dependent is removed first', async () => {
    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      spellcasting: { name: 'Spellcasting', description: '', requires: [] },
      'paladin-1': { name: 'Paladin L1', description: '', requires: ['spellcasting'] }
    });

    // Only spellcasting assigned (paladin removed)
    playStore.state.ruleGroupIds = ['spellcasting'];

    expect(playStore.isLocked('spellcasting')).toBe(false);
  });

  it('identifies which groups are blocking', async () => {
    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      spellcasting: { name: 'Spellcasting', description: '', requires: [] },
      'paladin-1': { name: 'Paladin L1', description: '', requires: ['spellcasting'] },
      'sorcerer-1': { name: 'Sorcerer L1', description: '', requires: ['spellcasting'] }
    });

    playStore.state.ruleGroupIds = ['spellcasting', 'paladin-1', 'sorcerer-1'];

    const dependents = playStore.getDependents('spellcasting');
    expect(dependents).toContain('paladin-1');
    expect(dependents).toContain('sorcerer-1');
    expect(dependents).toHaveLength(2);
  });

  it('does not block based on unassigned groups', async () => {
    const { playStore } = await import('$lib/play/playStore.svelte');
    playStore.reset();

    const { seedCache } = await import('$lib/rules/ruleGroupCache.svelte');
    seedCache({
      spellcasting: { name: 'Spellcasting', description: '', requires: [] },
      'paladin-1': { name: 'Paladin L1', description: '', requires: ['spellcasting'] }
    });

    // Only spellcasting assigned, paladin-1 is NOT assigned
    playStore.state.ruleGroupIds = ['spellcasting'];

    expect(playStore.isLocked('spellcasting')).toBe(false);
  });
});
