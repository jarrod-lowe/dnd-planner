import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin level 2 contributions, stacking on level 1 (all `combine: sum`, so the
 * class levels add with no ordering): +6 max HP (average d10), +1 prepared-spell
 * capacity (→ 3), and +5 to the Lay on Hands pool (→ 10). The L2 Divine Smite
 * features (always-prepared + the free once-per-long-rest use) live in their own
 * `class-paladin-paladin-smite` group, which the L2 scenarios assign alongside.
 *
 * HP / CON note: v1 captured the CON modifier at level-up time, so a CON raised
 * later did not retroactively grow this level's HP — and in every scenario CON is
 * set after the class levels, so that captured value is 0. v2 derives are pure
 * over live facts (no level-up capture), so the CON modifier is counted once (by
 * level 1's `10 + con.modifier`) and level 2 adds a flat +6. This reproduces v1's
 * totals (16 with no CON, 18 with +2) without stateful capture.
 *
 * Like level 1, `pool.remaining` is derived by the lay-on-hands group (total −
 * spent) so only `total` is contributed here, and the hit-die contribution is
 * deferred to the hit-die group wave.
 */
const paladinLevel2: RuleModule = {
  id: 'class-paladin-level2',
  derive: () => [
    { fact: 'hp.base.max', combine: 'sum', value: () => 6 },
    { fact: 'spellcasting.prepared.max', combine: 'sum', value: () => 1 },
    { fact: 'layOnHands.pool.total', combine: 'sum', value: () => 5 }
  ]
};

export default defineRule(paladinLevel2);
