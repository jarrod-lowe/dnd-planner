import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin level 5 contributions, stacking on levels 1–4 (all `combine: sum`):
 * +6 + the live CON modifier to max HP (as at every level — 2024: retroactive
 * recalc on a CON change), **Extra Attack** (`extraAttacks.max += 1` — the follow-up budget the
 * attacks/weapon offers read when an Attack action grants free swings), +1
 * proficiency bonus (→ 3), +1 prepared-spell capacity (→ 6), a fourth level-1 and
 * two level-2 spell slots, and +5 Lay on Hands (→ 25).
 *
 * `extraAttacks.max` and `proficiency.bonus` use `sum` so they stack with their
 * other sources (level 1's +2 proficiency; any future extra-attack grant) with no
 * ordering. Pool `remaining`s are derived by their owning groups; hit die is
 * deferred. (Level 5 also makes Find Steed always-prepared and adds level-2
 * paladin spells — those live in the `paladin-find-steed` / `paladin-spells-l2`
 * groups it `requires`.)
 */
const paladinLevel5: RuleModule = {
  id: 'class-paladin-level5',
  derive: () => [
    { fact: 'hitDie.d10.total', combine: 'sum', value: () => 1 },
    { fact: 'hp.base.max', combine: 'sum', value: (f) => 6 + f.num('con.modifier') },
    { fact: 'extraAttacks.max', combine: 'sum', value: () => 1 },
    { fact: 'proficiency.bonus', combine: 'sum', value: () => 1 },
    { fact: 'spellcasting.prepared.max', combine: 'sum', value: () => 1 },
    { fact: 'spellcasting.slots.level1.total', combine: 'sum', value: () => 1 },
    { fact: 'spellcasting.slots.level2.total', combine: 'sum', value: () => 2 },
    { fact: 'layOnHands.pool.total', combine: 'sum', value: () => 5 }
  ]
};

export default defineRule(paladinLevel5);
