import { defineRule, type ActionResult, type Diagnostic, type RuleModule } from '../builder';

const FA = 'rule.dnd-5e-2024.free-actions';

/**
 * Free actions: a no-cost "free action" (flavour; no apply — planning it changes
 * nothing) and the Help action, which costs the action. Help spends it via an
 * `endOfTurn` effect (resets next turn) and is illegal-but-visible once no action
 * remains. Foundational, so no search meta.
 */
const freeActions: RuleModule = {
  id: 'free-actions',
  offer: () => [
    {
      id: 'free-action',
      ui: {
        section: 'free',
        name: `${FA}.free-action.name`,
        description: `${FA}.free-action.description`,
        intents: { HANDLE: 'gear' },
        actionCost: []
      }
    },
    {
      id: 'help-action',
      ui: {
        section: 'action-other',
        name: `${FA}.help-action.name`,
        description: `${FA}.help-action.description`,
        intents: { AID: 'ally' },
        actionCost: ['action']
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: `${FA}.action-help-offer.no_action`, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${FA}.action-help-offer.no_action`, severity: 'error' });
        return {
          advertise: [{ id: 'spend', state: { 'actions.spent': 1 }, expiry: { kind: 'endOfTurn' } }],
          diagnostics
        };
      }
    }
  ]
};

export default defineRule(freeActions);
