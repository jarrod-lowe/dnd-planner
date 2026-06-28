import { defineRule, type RuleModule } from '../builder';

/**
 * Concentration: a one-slot binary resource. `remaining = max − spent`; a
 * concentration spell holds the slot via a persistent `concentration.spent`
 * effect, so a second concentration spell sees `remaining = 0` and is illegal,
 * and the hold releases when that spell's effect ends (duration or rest).
 *
 * The damage-triggered `concentration-check` offer is deferred until the
 * core-events damage → `concentration.damage-taken` coupling lands (clearing a
 * summed marker mid-turn needs more than the current effect model, and no ported
 * scenario needs it yet). Foundational, so no search meta.
 */
const concentration: RuleModule = {
  id: 'concentration',
  derive: () => [
    { fact: 'concentration.max', value: () => 1 },
    {
      fact: 'concentration.remaining',
      value: (f) => f.num('concentration.max') - f.num('concentration.spent')
    }
  ]
};

export default defineRule(concentration);
