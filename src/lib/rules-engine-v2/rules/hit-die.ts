import { defineRule, type RuleModule } from '../builder';

const SIZES = [6, 8, 10, 12] as const;

/**
 * Hit Die tracking — `hitDie.d{6,8,10,12}.remaining = total − spent`. The totals
 * are contributed by class levels (a paladin adds a d10 per level); nothing spends
 * them yet, so remaining tracks total. Foundational, so no search meta.
 */
const hitDie: RuleModule = {
  id: 'hit-die',
  derive: () =>
    SIZES.map((n) => ({
      fact: `hitDie.d${n}.remaining`,
      value: (f) => f.num(`hitDie.d${n}.total`) - f.num(`hitDie.d${n}.spent`)
    }))
};

export default defineRule(hitDie);
