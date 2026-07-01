import {
  attackActionSpend,
  defineRule,
  type ActionResult,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const G = 'rule.dnd-5e-2024.grapple';
const NO_ACTION = `${G}.action-grapple-offer.no_action`;
const NO_HAND = `${G}.action-grapple-offer.no_hand`;

/**
 * Grapple — an Unarmed Strike option (Attack action) needing a free hand: the
 * target makes a STR/DEX save vs `grapple.dc` (8 + proficiency + STR modifier) or
 * gains Grappled. It participates in the Extra Attack budget (`attackActionSpend`)
 * and gates on a free hand. The target-outcome marker drives the hand cost:
 *  - failed save (`passed = 0`): the target is Grappled — a PERMANENT
 *    `effect-grappling` keeps a hand consumed until released (removeEffect);
 *  - unresolved (`passed = -1`): the attempt ties up a hand for the turn only;
 *  - successful save (`passed = 1`): the target slips free — no hand, no effect.
 * Foundational, so no search meta.
 */
const grapple: RuleModule = {
  id: 'grapple',
  derive: () => [
    { fact: 'grapple.dc', value: (f) => 8 + f.num('proficiency.bonus') + f.num('str.modifier') }
  ],
  offer: () => [
    {
      id: 'grapple-action',
      ui: {
        section: 'action-attack',
        packBehind: 'unarmed-strike-use-action',
        name: `${G}.grapple-action.name`,
        description: `${G}.grapple-action.description`,
        detailKey: 'attack/grapple',
        annotationLabels: ['attack.action'],
        information: [
          {
            type: 'text',
            label: 'play.information.saveDc',
            labelValues: { saveType: { string: 'STR/DEX' }, dc: { fact: 'grapple.dc' } }
          }
        ],
        secondaryControl: {
          type: 'segmented',
          var: 'passed',
          prefix: 'play.choices.grapple.target',
          options: [
            { value: -1, label: 'planner.record.outcome.none' },
            { value: 1, label: 'planner.record.passed' },
            { value: 0, label: 'planner.record.failed' }
          ]
        },
        intents: { ATTACK: 'brawl' },
        actionCost: ['action']
      },
      vars: { passed: { capture: true, default: { number: -1 } } },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0 || f.num('attackAction.extraRemaining') > 0,
          diagnostics: [{ code: NO_ACTION, severity: 'error' }]
        },
        {
          condition: (f) => f.num('hands.remaining') >= 1,
          diagnostics: [{ code: NO_HAND, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const passed = typeof selections.passed === 'number' ? selections.passed : -1;
        const { effect, overCommitted } = attackActionSpend(f);
        const advertise: EffectInstance[] = [effect];
        if (passed === 0) {
          // Grappled: a hand stays tied up until the grapple is released.
          advertise.push({
            id: 'effect-grappling',
            key: 'grappling',
            state: { 'hands.spent': 1 },
            expiry: { kind: 'permanent' }
          });
        } else if (passed !== 1) {
          // Unresolved attempt: a hand is committed for the turn only.
          advertise.push({ id: 'grapple-attempt', state: { 'hands.spent': 1 }, expiry: { kind: 'endOfTurn' } });
        }
        const diagnostics: Diagnostic[] = [];
        if (overCommitted) diagnostics.push({ code: NO_ACTION, severity: 'error' });
        if (f.num('hands.remaining') < 1) diagnostics.push({ code: NO_HAND, severity: 'error' });
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(grapple);
