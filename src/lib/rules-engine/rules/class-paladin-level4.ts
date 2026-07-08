import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin level 4 contributions, stacking on levels 1–3 (all `combine: sum`):
 * +6 max HP (average d10), +1 prepared-spell capacity (→ 5), and +5 Lay on Hands
 * (→ 20). Level 4 grants no new spell slots (a quirk the scenarios assert).
 *
 * Same conventions as the earlier levels: +6 (average d10) + the live CON
 * modifier to max HP (2024: retroactive recalc on a CON change); only the LoH
 * `total` is contributed (lay-on-hands derives `remaining`); hit die is
 * deferred with its group. (Level 4's Ability Score Improvement is a separate
 * build choice, not modelled here.)
 */
const paladinLevel4: RuleModule = {
  id: 'class-paladin-level4',
  derive: () => [
    { fact: 'hitDie.d10.total', combine: 'sum', value: () => 1 },
    { fact: 'hp.base.max', combine: 'sum', value: (f) => 6 + f.num('con.modifier') },
    { fact: 'spellcasting.prepared.max', combine: 'sum', value: () => 1 },
    { fact: 'layOnHands.pool.total', combine: 'sum', value: () => 5 }
  ]
};

export default defineRule(paladinLevel4);
