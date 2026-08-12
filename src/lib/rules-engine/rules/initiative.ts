import { defineRule, type RuleModule } from '../builder';

const I = 'rule.dnd-5e-2024.initiative';

/**
 * Initiative — `initiative.bonus = dex modifier` (combine:sum so feats like Alert
 * can add to it), plus a display-only "Roll Initiative" free action (a d20 + the
 * bonus, with an Alert secondary roll the UI enables via `feat.alert.active`). The
 * roll records nothing, so the offer has no `apply`. Foundational, so no meta.
 */
const initiative: RuleModule = {
  id: 'initiative',
  derive: () => [{ fact: 'initiative.bonus', combine: 'sum', value: (f) => f.num('dex.modifier') }],
  offer: () => [
    {
      id: 'roll-initiative',
      ui: {
        section: 'free',
        name: `${I}.roll-initiative.name`,
        description: `${I}.roll-initiative.description`,
        disadvantageFact: 'initiative.disadvantage',
        annotationLabels: ['dice.any', 'dice.initiative'],
        primaryControl: {
          type: 'dice-line',
          dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'check' }],
          advantage: { fact: 'initiative.disadvantage' }
        },
        secondaryControl: {
          type: 'dice-line',
          enabled: { condition: { fact: 'feat.alert.active', operator: 'equals', value: 1 } },
          label: 'rule.dnd-5e-2024.feat-alert.initiative-proficiency.button',
          dice: [{ sides: 20, bonus: { var: 'alertBonus' }, purpose: 'check' }]
        },
        intents: { INSPECT: 'sense' },
        actionCost: []
      },
      vars: {
        rollBonus: { capture: true, default: { fact: 'initiative.bonus' } },
        alertBonus: { capture: true, default: { fact: 'feat.alert.initiativeWithProficiency' } }
      }
    }
  ]
};

export default defineRule(initiative);
