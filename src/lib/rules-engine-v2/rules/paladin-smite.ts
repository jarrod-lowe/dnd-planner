import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin's Smite (granted at level 2): Divine Smite is always prepared (free,
 * not counting against the prepared limit), and castable once per long rest
 * without a slot. The free use is a `remaining = total - spent` resource spent by
 * an `untilLongRest` effect.
 */
const paladinSmite: RuleModule = {
  id: 'class-paladin-paladin-smite',
  derive: () => [
    { fact: 'spell.l1.divineSmite.prepared', value: () => 1 },
    { fact: 'spell.l1.divineSmite.alwaysPrepared', value: () => 1 },
    { fact: 'paladinSmite.total', value: () => 1 },
    {
      fact: 'paladinSmite.remaining',
      value: (f) => f.num('paladinSmite.total') - f.num('paladinSmite.spent')
    }
  ]
};

export default defineRule(paladinSmite);
