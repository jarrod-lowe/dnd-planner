import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin level 2 contributions, stacking on level 1 (all `combine: sum`, so the
 * class levels add with no ordering): +6 max HP (average d10), +1 prepared-spell
 * capacity (→ 3), and +5 to the Lay on Hands pool (→ 10). The L2 Divine Smite
 * features (always-prepared + the free once-per-long-rest use) live in their own
 * `class-paladin-paladin-smite` group, which the L2 scenarios assign alongside.
 *
 * HP / CON note: each level past the 1st adds 6 (average d10) + the LIVE CON
 * modifier, like level 1's `10 + con.modifier`. Derives are pure over live
 * facts, which is exactly the 2024 rule: a CON increase retroactively raises
 * max HP for every level. (The legacy engine instead captured CON at level-up
 * time, so a level assigned before CON was set contributed a frozen 0 — an
 * order dependence the dataflow model deliberately drops.)
 *
 * Like level 1, `pool.remaining` is derived by the lay-on-hands group (total −
 * spent) so only `total` is contributed here, and the hit-die contribution is
 * deferred to the hit-die group wave.
 */
const paladinLevel2: RuleModule = {
  id: 'class-paladin-level2',
  derive: () => [
    { fact: 'hitDie.d10.total', combine: 'sum', value: () => 1 },
    { fact: 'hp.base.max', combine: 'sum', value: (f) => 6 + f.num('con.modifier') },
    { fact: 'spellcasting.prepared.max', combine: 'sum', value: () => 1 },
    { fact: 'layOnHands.pool.total', combine: 'sum', value: () => 5 }
  ]
};

export default defineRule(paladinLevel2);
