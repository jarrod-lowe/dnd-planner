import { defineRule, type RuleModule } from '../builder';

/**
 * Paladin's Steed — Find Steed is always prepared from level 5 (free, doesn't
 * count against the prepared limit), plus one free cast per long rest
 * (`paladinFindSteed.remaining = total - spent`, the spend being an untilLongRest
 * effect). Foundational (auto-granted with level 5), so no meta.
 */
const paladinFindSteed: RuleModule = {
  id: 'class-paladin-paladin-find-steed',
  derive: () => [
    { fact: 'spell.l2.findSteed.prepared', combine: 'max', value: () => 1 },
    { fact: 'spell.l2.findSteed.alwaysPrepared', value: () => 1 },
    { fact: 'paladinFindSteed.total', value: () => 1 },
    {
      fact: 'paladinFindSteed.remaining',
      value: (f) => f.num('paladinFindSteed.total') - f.num('paladinFindSteed.spent')
    }
  ]
};

export default defineRule(paladinFindSteed);
