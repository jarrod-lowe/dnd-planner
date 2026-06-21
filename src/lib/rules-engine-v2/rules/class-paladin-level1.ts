import type { RuleModule } from '../types';

/**
 * Paladin level 1 contributions to the sheet: +2 proficiency and a d10 hit die
 * worth of max HP (10 + CON modifier). Both use `combine: sum` so multiple class
 * levels / classes stack with no ordering — addition is commutative and the
 * engine settles all contributors before dependents read the total.
 */
const paladinLevel1: RuleModule = {
  id: 'class-paladin-level1',
  derive: () => [
    { fact: 'proficiency.bonus', combine: 'sum', value: () => 2 },
    { fact: 'hp.base.max', combine: 'sum', value: (f) => 10 + f.num('con.modifier') }
  ]
};

export default paladinLevel1;
