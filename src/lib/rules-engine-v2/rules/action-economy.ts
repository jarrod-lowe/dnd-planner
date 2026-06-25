import type { RuleModule } from '../types';

/**
 * Baseline action economy. `remaining` is derived from `max` each evaluation
 * (the per-turn reset); the plan reducer then decrements it as actions are
 * spent. In v1 this is the action-max/action-reset one-group copy pattern.
 */
const actionEconomy: RuleModule = {
  id: 'action-economy',
  derive: () => [
    { fact: 'actions.max', value: () => 1 },
    { fact: 'actions.remaining', value: (f) => f.num('actions.max') },
    { fact: 'bonusActions.max', value: () => 1 },
    { fact: 'bonusActions.remaining', value: (f) => f.num('bonusActions.max') }
  ]
};

export default actionEconomy;
