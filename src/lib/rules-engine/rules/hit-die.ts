import { defineRule, HIT_DIE_SIZES, type RuleModule } from '../builder';

/**
 * Hit Die tracking — `hitDie.d{6,8,10,12}.remaining = total − spent`. The totals
 * are contributed by class levels (a paladin adds a d10 per level); the short
 * rest in core-events spends them. Foundational, so no search meta.
 */
const hitDie: RuleModule = {
  id: 'hit-die',
  derive: () =>
    HIT_DIE_SIZES.map((n) => ({
      fact: `hitDie.d${n}.remaining`,
      value: (f) => f.num(`hitDie.d${n}.total`) - f.num(`hitDie.d${n}.spent`)
    }))
};

export default defineRule(hitDie);
