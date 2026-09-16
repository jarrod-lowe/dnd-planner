import { defineRule, type Annotation, type RuleModule } from '../builder';

const A = 'rule.dnd-5e-2024.feat-alert';

/**
 * Alert feat — sets `feat.alert.active`, computes the with-proficiency initiative
 * total (`initiative.bonus + proficiency.bonus`) the Roll Initiative offer's Alert
 * secondary roll reads, and annotates initiative panels with the swap/proficiency
 * riders. The feat's unmodelled half — can't be surprised — is a NOTICE: no
 * surprise mechanic exists in the engine to hook, so the benefit rides along as
 * a passive reminder. Foundational, so no search meta.
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
          { key: `${A}.annotation-proficiency`, targets: ['dice.initiative'] },
          {
            // 'notice' == NOTICE_TARGET; rule modules may import only the
            // builder, so the reserved label is a literal here (see
            // feat-sentinel) and the unit test pins it to the exported constant.
            key: `${A}.notice-surprise`,
            targets: ['notice'],
            body: `${A}.notice-surprise.body`
          }
        ]
      : []
};

export default defineRule(featAlert);
