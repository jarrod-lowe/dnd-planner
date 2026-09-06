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

  describe('min/max clamp', () => {
    it('clamps a result below min up to min', () => {
      // Divine Smite regular: slotLevel + 1, but free use (0) must stay 2d8.
      const result = resolveValueSource(
        { var: 'slotLevel', offset: 1, min: 2 },
        {},
        { slotLevel: { default: { number: 0 } } },
        { slotLevel: 0 }
      );
      expect(result).toBe(2);
    });

    it('does not clamp a result at or above min', () => {
      expect(
        resolveValueSource(
          { var: 'slotLevel', offset: 1, min: 2 },
          {},
          { slotLevel: { default: { number: 1 } } },
          { slotLevel: 1 }
        )
      ).toBe(2);
      expect(
        resolveValueSource(
          { var: 'slotLevel', offset: 1, min: 2 },
          {},
          { slotLevel: { default: { number: 5 } } },
          { slotLevel: 5 }
        )
      ).toBe(6);
    });

    it('clamps a result above max down to max', () => {
      expect(resolveValueSource({ number: 10, max: 5 }, {}, {})).toBe(5);
    });

    it('applies clamp after scale and offset', () => {
      // 3 * 2 + 1 = 7, clamped to max 5
      expect(resolveValueSource({ number: 3, scale: 2, offset: 1, min: 0, max: 5 }, {}, {})).toBe(
        5
      );
      // 1 * 2 + -5 = -3, clamped up to min 0
      expect(resolveValueSource({ number: 1, scale: 2, offset: -5, min: 0 }, {}, {})).toBe(0);
    });

    it('leaves non-numeric results unclamped', () => {
      expect(resolveValueSource({ string: 'radiant', min: 2, max: 5 }, {}, {})).toBe('radiant');
    });

    it('does not clamp when min/max absent (backward compatible)', () => {
      expect(resolveValueSource({ number: 100 }, {}, {})).toBe(100);
    });
  });

  describe('map', () => {
    const GRIP = {
      fact: 'weapon.spear.twoHanded',
      map: {
        0: 'rule.dnd-5e-2024.loadout.grip.one-handed',
        1: 'rule.dnd-5e-2024.loadout.grip.two-handed'
      }
    };

    it('maps a fact value onto the matching string', () => {
      expect(resolveValueSource(GRIP, { 'weapon.spear.twoHanded': 1 }, {})).toBe(
        'rule.dnd-5e-2024.loadout.grip.two-handed'
      );
      expect(resolveValueSource(GRIP, { 'weapon.spear.twoHanded': 0 }, {})).toBe(
        'rule.dnd-5e-2024.loadout.grip.one-handed'
      );
    });

    it('maps an UNSET fact as 0 — the engine reads an absent numeric fact as zero', () => {
      // `weapon.<id>.twoHanded` is only written by a two-handed loadout, so the
      // one-handed grip is the absence of the fact, not a fact set to 0.
      expect(resolveValueSource(GRIP, {}, {})).toBe('rule.dnd-5e-2024.loadout.grip.one-handed');
    });

    it('maps a var selection too, not just a fact', () => {
      const source = { var: 'grip', map: { 0: 'one', 1: 'two' } };
      expect(
        resolveValueSource(source, {}, { grip: { default: { number: 0 } } }, { grip: 1 })
      ).toBe('two');
    });

    it('returns undefined when nothing in the map matches', () => {
      expect(
        resolveValueSource({ fact: 'weapon.spear.twoHanded', map: { 1: 'two' } }, {}, {})
      ).toBeUndefined();
    });

    it('leaves sources without a map untouched', () => {
      expect(resolveValueSource({ fact: 'weapon.spear.twoHanded' }, {}, {})).toBeUndefined();
      expect(resolveValueSource({ number: 1 }, {}, {})).toBe(1);
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
