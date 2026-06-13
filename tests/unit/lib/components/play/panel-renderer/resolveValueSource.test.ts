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

  describe('scale', () => {
    it('multiplies a literal number by scale', () => {
      const result = resolveValueSource({ number: 3, scale: 5 }, {}, {});
      expect(result).toBe(15);
    });

    it('multiplies a fact value by scale', () => {
      const result = resolveValueSource({ fact: 'slotLevel', scale: 5 }, { slotLevel: 4 }, {});
      expect(result).toBe(20);
    });

    it('multiplies a var selection by scale', () => {
      const result = resolveValueSource(
        { var: 'slotLevel', scale: 5 },
        {},
        { slotLevel: { default: { number: 2 } } },
        { slotLevel: 3 }
      );
      expect(result).toBe(15);
    });
  });

  describe('offset', () => {
    it('adds offset to a literal number', () => {
      const result = resolveValueSource({ number: 10, offset: -5 }, {}, {});
      expect(result).toBe(5);
    });

    it('adds offset without scale', () => {
      const result = resolveValueSource({ number: 7, offset: 3 }, {}, {});
      expect(result).toBe(10);
    });
  });

  describe('scale and offset together', () => {
    it('computes Aid HP bonus: slotLevel * 5 - 5', () => {
      // Level 2 → 5, Level 3 → 10, Level 4 → 15, Level 5 → 20
      const results = [2, 3, 4, 5].map((level) =>
        resolveValueSource(
          { var: 'slotLevel', scale: 5, offset: -5 },
          {},
          { slotLevel: { default: { number: 2 } } },
          { slotLevel: level }
        )
      );
      expect(results).toEqual([5, 10, 15, 20]);
    });
  });

  it('ignores scale and offset on non-numeric values', () => {
    const result = resolveValueSource({ string: 'hello', scale: 5, offset: -3 }, {}, {});
    expect(result).toBe('hello');
  });

  it('returns undefined when base value is undefined with scale', () => {
    const result = resolveValueSource({ fact: 'missing', scale: 5 }, {}, {});
    expect(result).toBeUndefined();
  });
});
