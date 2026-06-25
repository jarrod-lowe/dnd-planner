import type { RuleModule } from '../types';

/**
 * Baseline action economy. `remaining = max - spent`, where `spent` is summed
 * from this turn's `endOfTurn` spend effects (advertised by actions). Effects
 * expire at end of turn, so the budget resets next turn with no explicit reset
 * rule. In v1 this is the action-max/action-reset copy plus per-action decrement.
 */
const actionEconomy: RuleModule = {
  id: 'action-economy',
  derive: () => [
    { fact: 'actions.max', value: () => 1 },
    { fact: 'actions.remaining', value: (f) => f.num('actions.max') - f.num('actions.spent') },
    { fact: 'bonusActions.max', value: () => 1 },
    {
      fact: 'bonusActions.remaining',
      value: (f) => f.num('bonusActions.max') - f.num('bonusActions.spent')
    }
  ]
};

export default actionEconomy;
