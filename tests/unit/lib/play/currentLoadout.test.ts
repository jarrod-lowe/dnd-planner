import { describe, it, expect } from 'vitest';
import { currentLoadout } from '$lib/play/currentLoadout';
import { enumerateLoadouts, loadoutEffectState } from '$lib/rules-engine/loadout';
import type { Facts } from '$lib/rules-view';
import type { RuleModule } from '$lib/rules-engine/types';

const dagger: RuleModule = {
  id: 'dagger',
  equip: {
    hands: 1,
    stackable: true,
    nameKey: 'rule.test.dagger.name',
    state: { 'weapon.dagger.equipped': 1 }
  }
};

const spear: RuleModule = {
  id: 'spear',
  equip: {
    hands: 1,
    versatile: true,
    stackable: true,
    nameKey: 'rule.test.spear.name',
    state: { 'weapon.spear.equipped': 1 },
    twoHandedState: { 'weapon.spear.twoHanded': 1 }
  }
};

const shield: RuleModule = {
  id: 'shield',
  equip: {
    hands: 1,
    nameKey: 'rule.test.shield.name',
    state: { 'armor.shield.equipped': 1, 'ac.shieldBonus': 2 }
  }
};

const modules: RuleModule[] = [dagger, spear, shield];

/**
 * The facts the sheet would actually carry while holding `id`, plus anything
 * spent by something that is NOT the loadout.
 *
 * Derived from `loadoutEffectState` rather than hand-written on purpose. The
 * matcher compares against the union of every fact any configuration can write,
 * so a hand-written fixture silently stops matching — and falls back to `empty`,
 * which reads as a plausible answer — the moment a fact is added to that state.
 * That trap has already cost two rounds (`grip.twoHanded`, then
 * `loadout.hands.spent`). The literal fact names stay pinned exhaustively by the
 * `loadoutEffectState` block in tests/unit/rules-engine/loadout.test.ts, which is
 * where a change to them SHOULD fail; these tests are about the matching, so they
 * take the state as given and stay honest for free.
 */
const heldFacts = (id: string, spentElsewhere = 0): Facts => {
  const config = enumerateLoadouts(modules).find((c) => c.id === id);
  if (!config) throw new Error(`no such configuration: ${id}`);
  const state = loadoutEffectState(config);
  return { ...state, 'hands.spent': state['hands.spent'] + spentElsewhere };
};

describe('currentLoadout', () => {
  it('reads empty hands off facts that hold nothing', () => {
    expect(currentLoadout(modules, {}).id).toBe('empty');
  });

  it('recognises a single held item', () => {
    expect(currentLoadout(modules, heldFacts('dagger')).id).toBe('dagger');
  });

  it('tells the two grips of a versatile weapon apart', () => {
    expect(currentLoadout(modules, heldFacts('spear')).id).toBe('spear');
    expect(currentLoadout(modules, heldFacts('spear:2h')).id).toBe('spear:2h');
  });

  it('recognises a two-item configuration', () => {
    expect(currentLoadout(modules, heldFacts('dagger+shield')).id).toBe('dagger+shield');
  });

  it('tells a doubled item from a single one by the hands it spends', () => {
    expect(currentLoadout(modules, heldFacts('dagger+dagger')).id).toBe('dagger+dagger');
  });

  /**
   * `hands.spent` is an AGGREGATE — Grapple writes it too — so it cannot be the
   * fact that tells one dagger from two. Two daggers do not write
   * `weapon.dagger.equipped: 2` (each item fixes the value at 1 and the states
   * merge by assignment), so hand count was the ONLY discriminator, and a single
   * dagger plus a committed grapple presents exactly the two-dagger state.
   *
   * Matching the wrong row is not a cosmetic slip: `resolveInitialSelections`
   * pins the row to it, so merely ADDING the row would arm the character with a
   * dagger they do not have and commit a third spent hand. An untouched row must
   * never change what the character is holding.
   */
  it('is not fooled into doubling an item by a hand spent elsewhere', () => {
    // One dagger held, one hand holding a grappled target.
    expect(currentLoadout(modules, heldFacts('dagger', 1)).id).toBe('dagger');
  });

  it('still reads empty hands when every spent hand belongs to something else', () => {
    expect(currentLoadout(modules, heldFacts('empty', 1)).id).toBe('empty');
  });

  it('falls back to empty hands when the facts match no legal configuration', () => {
    // e.g. a legacy per-item equip chip that set an equipped flag but no hands.
    const facts: Facts = { 'weapon.greataxe.equipped': 1, 'hands.spent': 2 };
    expect(currentLoadout(modules, facts).id).toBe('empty');
  });

  it('returns a configuration the picker can render, not a bare id', () => {
    const config = currentLoadout(modules, heldFacts('spear'));
    expect(config.items.map((i) => i.nameKey)).toEqual(['rule.test.spear.name']);
    expect(config.handsFree).toBe(1);
    expect(config.freeHandKey).toBe('rule.dnd-5e-2024.loadout.hands-free.name');
  });
});
