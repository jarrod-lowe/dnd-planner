import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin level 7 contributions, stacking on levels 1–6 (all `combine: sum`):
 * a seventh hit die, +6 (average d10) + the live CON modifier to max HP (as at
 * every level — 2024: retroactive recalc on a CON change), +5 Lay on Hands
 * (→ 35), +1 prepared-spell capacity (→ 7) and a third level-2 spell slot — the
 * one line of the class table that moves at this level (→ 4×level-1 / 3×level-2).
 *
 * Everything else on the row is flat, so nothing is contributed for it (the
 * level-7 scenarios assert those hold): proficiency stays +3, Channel Divinity
 * stays at 2 uses, the level-1 slot column stays at 4, and level-3 slots do not
 * arrive until level 9.
 *
 * The subclass feature gained at this level (Aura of the Guardian for the Oath
 * of Redemption) lives in its own oath group, not here — this module is the
 * class table only.
 */
const paladinLevel7: RuleModule = {
  id: 'class-paladin-level7',
  derive: () => [
    { fact: 'hitDie.d10.total', combine: 'sum', value: () => 1 },
    { fact: 'hp.base.max', combine: 'sum', value: (f) => 6 + f.num('con.modifier') },
    { fact: 'layOnHands.pool.total', combine: 'sum', value: () => 5 },
    { fact: 'spellcasting.slots.level2.total', combine: 'sum', value: () => 1 },
    { fact: 'spellcasting.prepared.max', combine: 'sum', value: () => 1 }
  ]
};

export default defineRule(paladinLevel7);
