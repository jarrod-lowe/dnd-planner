import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin level 3 contributions, stacking on levels 1–2 (all `combine: sum`):
 * +6 max HP (average d10), a third level-1 spell slot, +1 prepared-spell capacity
 * (→ 4), +5 Lay on Hands (→ 15), and the Channel Divinity pool (2 points). Level 3
 * is also where a paladin takes a subclass + Channel Divinity uses, which live in
 * their own `class-paladin-divinity` / oath groups (assigned alongside).
 *
 * Same conventions as level 2: the CON-at-level capture collapses to "count CON
 * once at level 1" (flat +6 here); only pool `total`s are contributed (the
 * lay-on-hands / spellcasting / divinity groups derive `remaining = total −
 * spent`); and the hit-die bump is deferred with the hit-die group.
 */
const paladinLevel3: RuleModule = {
  id: 'class-paladin-level3',
  derive: () => [
    { fact: 'hp.base.max', combine: 'sum', value: () => 6 },
    { fact: 'spellcasting.slots.level1.total', combine: 'sum', value: () => 1 },
    { fact: 'spellcasting.prepared.max', combine: 'sum', value: () => 1 },
    { fact: 'layOnHands.pool.total', combine: 'sum', value: () => 5 },
    { fact: 'divinity.total', combine: 'sum', value: () => 2 }
  ]
};

export default defineRule(paladinLevel3);
