import { describe, it, expect } from 'vitest';
import { evaluateSheet, collectAnnotations } from '$lib/rules-engine';
import fightingStyleGreatWeapon from '$lib/rules-engine/rules/fighting-style-great-weapon';

/**
 * Great Weapon Fighting annotates two-handed/versatile weapon panels with the
 * reroll reminder, but only once a weapon attack has been made this turn. The
 * gate reads `attack.last.weapon`, a marker that SUMS per weapon swing (each
 * Attack-action spend contributes 1), so it must test `>= 1` like Savage
 * Attacker — a strict `=== 1` wrongly drops the rider on the second Extra
 * Attack swing.
 */
const KEY = 'rule.dnd-5e-2024.fighting-style-great-weapon.annotation';

describe('fighting-style-great-weapon — reroll rider', () => {
  const anns = (facts: Record<string, number>) =>
    collectAnnotations(
      [fightingStyleGreatWeapon],
      evaluateSheet([fightingStyleGreatWeapon], facts)
    );

  it('does not annotate before any weapon attack this turn', () => {
    expect(anns({}).some((a) => a.key === KEY)).toBe(false);
  });

  it('annotates two-handed/versatile panels after the first weapon attack', () => {
    const found = anns({ 'attack.last.weapon': 1 }).find((a) => a.key === KEY);
    expect(found?.targets).toEqual(['property.twoHanded', 'property.versatile']);
  });

  it('still annotates after a second Extra-Attack swing (marker sums to 2)', () => {
    expect(anns({ 'attack.last.weapon': 2 }).some((a) => a.key === KEY)).toBe(true);
  });
});
