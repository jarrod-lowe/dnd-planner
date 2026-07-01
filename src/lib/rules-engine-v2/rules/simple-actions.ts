import { defineRule, type Offer, type RuleModule } from '../builder';

const A = 'rule.dnd-5e-2024.simple-actions';

/** One "spend your action" offer (disengage, dodge, …): legal while an action remains. */
function actionOffer(id: string, intents: Record<string, string>): Offer {
  const noAction = `${A}.action-${id}-offer.no_action`;
  return {
    id: `${id}-action`,
    ui: {
      section: 'action-other',
      name: `${A}.${id}-action.name`,
      description: `${A}.${id}-action.description`,
      intents,
      actionCost: ['action']
    },
    legalWhen: [
      { condition: (f) => f.num('actions.remaining') > 0, diagnostics: [{ code: noAction, severity: 'error' }] }
    ],
    apply: (f) => ({
      advertise: [{ id: 'cost', state: { 'actions.spent': 1 }, expiry: { kind: 'endOfTurn' } }],
      diagnostics: f.num('actions.remaining') > 0 ? [] : [{ code: noAction, severity: 'error' }]
    })
  };
}

/**
 * Simple Actions — the eight generic Action-cost options (Disengage, Dodge,
 * Improvise, Influence, Interact, Search, Study, Utilize). Each just spends the
 * action (an endOfTurn `actions.spent`), so they share one generator differing
 * only in id + intent. Foundational, so no search meta.
 */
const simpleActions: RuleModule = {
  id: 'simple-actions',
  offer: () => [
    actionOffer('disengage', { DEFEND: 'evade' }),
    actionOffer('dodge', { DEFEND: 'evade' }),
    actionOffer('improvise', { HANDLE: 'gear' }),
    actionOffer('influence', { AID: 'ally' }),
    actionOffer('interact', { HANDLE: 'gear' }),
    actionOffer('search', { INSPECT: 'sense' }),
    actionOffer('study', { INSPECT: 'check' }),
    actionOffer('utilize', { HANDLE: 'gear' })
  ]
};

export default defineRule(simpleActions);
