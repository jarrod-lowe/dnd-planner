import { describe, it, expect } from 'vitest';
import { resolveValueSource } from '$lib/components/play/panel-renderer/resolveValueSource';

describe('resolveValueSource', () => {
  it('resolves a fact reference', () => {
    const result = resolveValueSource({ fact: 'character.speed' }, { 'character.speed': 30 }, {});
    expect(result).toBe(30);
  });

  it('resolves a var reference', () => {
    const result = resolveValueSource(
      { var: 'distance' },
      {},
      { distance: { default: { number: 15 } } }
    );
    expect(result).toBe(15);
  });

  it('resolves a literal number', () => {
    const result = resolveValueSource({ number: 5 }, {}, {});
    expect(result).toBe(5);
  });

  it('resolves a literal string', () => {
    const result = resolveValueSource({ string: 'melee' }, {}, {});
    expect(result).toBe('melee');
  });

  it('resolves var default from fact', () => {
    const result = resolveValueSource(
      { var: 'hitBonus' },
      { 'character.hitBonus': 5 },
      { hitBonus: { default: { fact: 'character.hitBonus' } } }
    );
    expect(result).toBe(5);
  });

  it('resolves var with selection override', () => {
    const result = resolveValueSource(
      { var: 'distance' },
      {},
      { distance: { default: { number: 10 } } },
      { distance: 25 }
    );
    expect(result).toBe(25);
  });

  it('returns undefined for missing value', () => {
    const result = resolveValueSource({ fact: 'nonexistent' }, {}, {});
    expect(result).toBeUndefined();
  });

  it('resolves var default from string', () => {
    const result = resolveValueSource(
      { var: 'label' },
      {},
      { label: { default: { string: 'Proficient' } } }
    );
    expect(result).toBe('Proficient');
  });
});
