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

  /**
   * WHICH panels qualify depends on the grip, and that is a rule, not a UI
   * concern. A two-handed weapon always qualifies; a VERSATILE one qualifies only
   * while the loadout actually has it in two hands (`grip.twoHanded`).
   *
   * This gate used to live in PanelRenderer as `selectionExtraHands > 0`, reading
   * a per-attack selection. When the loadout took ownership of the grip nothing
   * wrote that selection any more, so the gate silently pinned itself false and
   * Great Weapon Fighting died for every versatile weapon — with no test to say so.
   */
  it('annotates only two-handed panels when nothing is gripped two-handed', () => {
    const found = anns({ 'attack.last.weapon': 1 }).find((a) => a.key === KEY);
    expect(found?.targets).toEqual(['property.twoHanded']);
  });

  it('adds the versatile panels once the loadout grips two-handed', () => {
    const found = anns({ 'attack.last.weapon': 1, 'grip.twoHanded': 1 }).find((a) => a.key === KEY);
    expect(found?.targets).toEqual(['property.twoHanded', 'property.versatile']);
  });

  it('still annotates after a second Extra-Attack swing (marker sums to 2)', () => {
    expect(anns({ 'attack.last.weapon': 2 }).some((a) => a.key === KEY)).toBe(true);
  });
});
