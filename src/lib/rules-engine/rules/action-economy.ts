import { defineRule, type RuleModule } from '../builder';

/**
 * Baseline action economy. `remaining = max - spent`, where `spent` is summed
 * from this turn's `endOfTurn` spend effects (advertised by actions). Effects
 * expire at end of turn, so the budget resets next turn with no explicit reset
 * rule. The legacy engine used an action-max/action-reset copy plus per-action decrement.
 *
 * Incapacitated (SRD 5.2 "Inactive": no action, Bonus Action, or Reaction)
 * clamps all three pools to 0 here — reading the condition fact where the
 * pools live, so every `*.remaining > 0` gate goes illegal for free and the
 * denial stays standing across turns (the fact's expiry outlives the per-turn
 * spends). Movement is untouched: Incapacitated is not Speed 0.
 */
const actionEconomy: RuleModule = {
  id: 'action-economy',
  derive: () => [
    { fact: 'actions.max', value: () => 1 },
    {
      fact: 'actions.remaining',
      value: (f) =>
        f.num('condition.incapacitated') > 0 ? 0 : f.num('actions.max') - f.num('actions.spent')
    },
    { fact: 'bonusActions.max', value: () => 1 },
    {
      fact: 'bonusActions.remaining',
      value: (f) =>
        f.num('condition.incapacitated') > 0
          ? 0
          : f.num('bonusActions.max') - f.num('bonusActions.spent')
    },
    { fact: 'reactions.max', value: () => 1 },
    {
      fact: 'reactions.remaining',
      value: (f) =>
        f.num('condition.incapacitated') > 0 ? 0 : f.num('reactions.max') - f.num('reactions.spent')
    }
  ]
};

export default defineRule(actionEconomy);
