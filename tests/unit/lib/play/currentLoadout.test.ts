import { describe, it, expect } from 'vitest';
import { currentLoadout } from '$lib/play/currentLoadout';
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

describe('currentLoadout', () => {
  it('reads empty hands off facts that hold nothing', () => {
    expect(currentLoadout(modules, {}).id).toBe('empty');
  });

  it('recognises a single held item', () => {
    const facts: Facts = { 'weapon.dagger.equipped': 1, 'hands.spent': 1 };
    expect(currentLoadout(modules, facts).id).toBe('dagger');
  });

  it('tells the two grips of a versatile weapon apart', () => {
    const oneHanded: Facts = { 'weapon.spear.equipped': 1, 'hands.spent': 1 };
    const twoHanded: Facts = {
      'weapon.spear.equipped': 1,
      'weapon.spear.twoHanded': 1,
      'hands.spent': 2
    };
    expect(currentLoadout(modules, oneHanded).id).toBe('spear');
    expect(currentLoadout(modules, twoHanded).id).toBe('spear:2h');
  });

  it('recognises a two-item configuration', () => {
    const facts: Facts = {
      'weapon.dagger.equipped': 1,
      'armor.shield.equipped': 1,
      'ac.shieldBonus': 2,
      'hands.spent': 2
    };
    expect(currentLoadout(modules, facts).id).toBe('dagger+shield');
  });

  it('tells a doubled item from a single one by the hands it spends', () => {
    const facts: Facts = { 'weapon.dagger.equipped': 1, 'hands.spent': 2 };
    expect(currentLoadout(modules, facts).id).toBe('dagger+dagger');
  });

  it('falls back to empty hands when the facts match no legal configuration', () => {
    // e.g. a legacy per-item equip chip that set an equipped flag but no hands.
    const facts: Facts = { 'weapon.greataxe.equipped': 1, 'hands.spent': 2 };
    expect(currentLoadout(modules, facts).id).toBe('empty');
  });

  it('returns a configuration the picker can render, not a bare id', () => {
    const facts: Facts = { 'weapon.spear.equipped': 1, 'hands.spent': 1 };
    const config = currentLoadout(modules, facts);
    expect(config.items.map((i) => i.nameKey)).toEqual(['rule.test.spear.name']);
    expect(config.handsFree).toBe(1);
    expect(config.freeHandKey).toBe('rule.dnd-5e-2024.loadout.hands-free.name');
  });
});
