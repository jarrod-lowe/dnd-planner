import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin level 6 contributions, stacking on levels 1–5 (all `combine: sum`):
 * a sixth hit die, +6 (average d10) + the live CON modifier to max HP (as at
 * every level — 2024: retroactive recalc on a CON change), and +5 Lay on Hands
 * (→ 30).
 *
 * Level 6 is otherwise a flat step on the class table: proficiency stays +3,
 * prepared-spell capacity stays 6, the slot line stays 4×level-1 / 2×level-2 and
 * Channel Divinity stays at 2 uses, so nothing is contributed for those (the
 * level-6 scenarios assert they hold).
 *
 * Aura of Protection, the level-6 class feature, is NOT modelled here — it needs
 * a flat save bonus the `{a}.save` derive has no second writer for, so it lands
 * separately.
 */
const paladinLevel6: RuleModule = {
  id: 'class-paladin-level6',
  derive: () => [
    { fact: 'hitDie.d10.total', combine: 'sum', value: () => 1 },
    { fact: 'hp.base.max', combine: 'sum', value: (f) => 6 + f.num('con.modifier') },
    { fact: 'layOnHands.pool.total', combine: 'sum', value: () => 5 }
  ]
};

export default defineRule(paladinLevel6);
