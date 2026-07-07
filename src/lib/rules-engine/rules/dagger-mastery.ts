import { defineRule, type RuleModule } from '../builder';

const P = 'rule.dnd-5e-2024.attacks.dagger-mastery';

/**
 * Dagger Mastery (Nick) — sets `attack.dagger.mastery`, the flag the dagger's
 * attack panel reads to offer the Nick follow-up. A separate group (it `requires`
 * the dagger) so mastery can be granted independently of owning the weapon.
 */
const daggerMastery: RuleModule = {
  id: 'dagger-mastery',
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['dagger']
  },
  derive: () => [{ fact: 'attack.dagger.mastery', value: () => 1 }]
};

export default defineRule(daggerMastery);
