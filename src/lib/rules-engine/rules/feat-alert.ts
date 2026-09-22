import { defineRule, type Annotation, type RuleModule } from '../builder';

const A = 'rule.dnd-5e-2024.feat-alert';

/**
 * Alert feat — sets `feat.alert.active`, computes the with-proficiency initiative
 * total (`initiative.bonus + proficiency.bonus`) the Roll Initiative offer's Alert
 * secondary roll reads, and annotates initiative panels with the swap/proficiency
 * riders. SRD 5.2 grants ONLY those two benefits (Initiative Proficiency +
 * Initiative Swap) — there is no surprise benefit in 2024, so nothing else is
 * emitted. Foundational, so no search meta.
 */
const featAlert: RuleModule = {
  id: 'feat-alert',
  derive: () => [
    { fact: 'feat.alert.active', value: () => 1 },
    {
      fact: 'feat.alert.initiativeWithProficiency',
      value: (f) => f.num('initiative.bonus') + f.num('proficiency.bonus')
    }
  ],
  annotate: (f): Annotation[] =>
    f.num('feat.alert.active') === 1
      ? [
          { key: `${A}.annotation-swap`, targets: ['dice.initiative'] },
          { key: `${A}.annotation-proficiency`, targets: ['dice.initiative'] }
        ]
      : []
};

export default defineRule(featAlert);
