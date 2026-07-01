import { defineRule, type ActionResult, type RuleModule } from '../builder';

const D = 'rule.dnd-5e-2024.dash';
const NO_ACTION = `${D}.action-dash-offer.no_action`;

/**
 * Dash — spend your action to add your speed to this turn's movement. The apply
 * reads the current `character.movement.total` (the base speed) and advertises an
 * endOfTurn effect adding that much to it, so `remaining = total − spent` picks up
 * the boost and it resets next turn. `character.movement.total` is a combine:sum
 * fact (species base + this), so the add composes with no second-writer conflict.
 * Foundational, so no meta.
 */
const dash: RuleModule = {
  id: 'dash',
  offer: () => [
    {
      id: 'dash-action',
      ui: {
        section: 'action-other',
        name: `${D}.dash-action.name`,
        description: `${D}.dash-action.description`,
        intents: { MOVE: 'dash' },
        actionCost: ['action']
      },
      legalWhen: [
        { condition: (f) => f.num('actions.remaining') > 0, diagnostics: [{ code: NO_ACTION, severity: 'error' }] }
      ],
      apply: (f): ActionResult => {
        const speed = f.num('character.movement.total');
        return {
          advertise: [
            {
              id: 'dash',
              state: { 'actions.spent': 1, 'character.movement.total': speed },
              expiry: { kind: 'endOfTurn' }
            }
          ],
          diagnostics: f.num('actions.remaining') > 0 ? [] : [{ code: NO_ACTION, severity: 'error' }]
        };
      }
    }
  ]
};

export default defineRule(dash);
