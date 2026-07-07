import { attackActionSpend, defineRule, type ActionResult, type RuleModule } from '../builder';

const S = 'rule.dnd-5e-2024.shove';
const NO_ACTION = `${S}.action-shove-offer.no_action`;

/**
 * Shove — an Unarmed Strike option (Attack action): the target makes a STR/DEX
 * save vs `shove.dc` (8 + proficiency + STR modifier) or is pushed / knocked
 * Prone. It participates in the Extra Attack budget (shared `attackActionSpend`)
 * and, being a save not a roll, shows the DC + a target-outcome marker rather than
 * a dice line — the outcome records nothing, so there is no lingering effect.
 * Foundational, so no search meta.
 */
const shove: RuleModule = {
  id: 'shove',
  derive: () => [
    { fact: 'shove.dc', value: (f) => 8 + f.num('proficiency.bonus') + f.num('str.modifier') }
  ],
  offer: () => [
    {
      id: 'shove-action',
      ui: {
        section: 'action-attack',
        packBehind: 'unarmed-strike-use-action',
        name: `${S}.shove-action.name`,
        description: `${S}.shove-action.description`,
        detailKey: 'attack/shove',
        annotationLabels: ['attack.action'],
        information: [
          {
            type: 'text',
            label: 'play.information.saveDc',
            labelValues: { saveType: { string: 'STR/DEX' }, dc: { fact: 'shove.dc' } }
          }
        ],
        secondaryControl: {
          type: 'segmented',
          var: 'passed',
          prefix: 'play.choices.shove.target',
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
          condition: (f) =>
            f.num('actions.remaining') > 0 || f.num('attackAction.extraRemaining') > 0,
          diagnostics: [{ code: NO_ACTION, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const { effect, overCommitted } = attackActionSpend(f);
        return {
          advertise: [effect],
          diagnostics: overCommitted ? [{ code: NO_ACTION, severity: 'error' }] : []
        };
      }
    }
  ]
};

export default defineRule(shove);
