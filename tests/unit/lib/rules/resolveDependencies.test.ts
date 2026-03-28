import { describe, it, expect } from 'vitest';
import { resolveDependencies } from '$lib/rules/resolveDependencies';
import type { RuleGroupMeta } from '$lib/rules/ruleGroupCache.svelte';

function makeCache(
  entries: Record<string, { name?: string; requires?: string[] }>
): Map<string, RuleGroupMeta> {
  const map = new Map<string, RuleGroupMeta>();
  for (const [id, entry] of Object.entries(entries)) {
    map.set(id, {
      name: entry.name ?? id,
      description: '',
      requires: entry.requires ?? []
    });
  }
  return map;
}

describe('resolveDependencies', () => {
  it('returns empty array when rule group has no requires', () => {
    const cache = makeCache({
      'paladin-1': { name: 'Paladin L1' }
    });
    const result = resolveDependencies('paladin-1', cache, []);
    expect(result).toEqual([]);
  });

  it('returns missing dependencies in depth-first order', () => {
    const cache = makeCache({
      'paladin-1': { requires: ['spellcasting'] },
      spellcasting: { name: 'Spellcasting' }
    });
    const result = resolveDependencies('paladin-1', cache, []);
    expect(result).toEqual(['spellcasting']);
  });

  it('skips already-assigned dependencies', () => {
    const cache = makeCache({
      'paladin-1': { requires: ['spellcasting'] },
      spellcasting: { name: 'Spellcasting' }
    });
    const result = resolveDependencies('paladin-1', cache, ['spellcasting']);
    expect(result).toEqual([]);
  });

  it('handles recursive dependencies (A requires B requires C)', () => {
    const cache = makeCache({
      'paladin-1': { requires: ['spellcasting'] },
      spellcasting: { requires: ['core-actions'] },
      'core-actions': { name: 'Core Actions' }
    });
    const result = resolveDependencies('paladin-1', cache, []);
    // Deepest first: core-actions, then spellcasting
    expect(result).toEqual(['core-actions', 'spellcasting']);
  });

  it('handles diamond dependencies (A requires B and C, both require D)', () => {
    const cache = makeCache({
      'paladin-1': { requires: ['spellcasting', 'martial'] },
      spellcasting: { requires: ['core-actions'] },
      martial: { requires: ['core-actions'] },
      'core-actions': { name: 'Core Actions' }
    });
    const result = resolveDependencies('paladin-1', cache, []);
    // D should only appear once
    const coreCount = result.filter((id) => id === 'core-actions').length;
    expect(coreCount).toBe(1);
    // core-actions must come before both spellcasting and martial
    const coreIdx = result.indexOf('core-actions');
    const spellIdx = result.indexOf('spellcasting');
    const martialIdx = result.indexOf('martial');
    expect(coreIdx).toBeLessThan(spellIdx);
    expect(coreIdx).toBeLessThan(martialIdx);
  });

  it('handles cycles gracefully without infinite loop', () => {
    const cache = makeCache({
      a: { requires: ['b'] },
      b: { requires: ['a'] }
    });
    // Should not throw or infinite loop
    const result = resolveDependencies('a', cache, []);
    // b is a dep of a, a is already being resolved so skip it
    expect(result).toEqual(['b']);
  });

  it('returns deps deepest-first (C, B for A requires B requires C)', () => {
    const cache = makeCache({
      a: { requires: ['b'] },
      b: { requires: ['c'] },
      c: { name: 'C' }
    });
    const result = resolveDependencies('a', cache, []);
    expect(result).toEqual(['c', 'b']);
  });

  it('handles unknown rule group ID gracefully', () => {
    const cache = makeCache({});
    const result = resolveDependencies('unknown-id', cache, []);
    expect(result).toEqual([]);
  });
});
