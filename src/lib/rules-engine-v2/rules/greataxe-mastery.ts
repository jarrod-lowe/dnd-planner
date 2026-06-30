import { defineRule, type RuleModule } from '../builder';

const P = 'rule.dnd-5e-2024.attacks.greataxe-mastery';

/**
 * Greataxe Mastery (Cleave) — sets `attack.greataxe.mastery`, the flag the
 * greataxe's action panel reads to enable the Cleave follow-up/secondary control.
 * A separate group (it `requires` the greataxe).
 */
const greataxeMastery: RuleModule = {
  id: 'greataxe-mastery',
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['greataxe']
  },
  derive: () => [{ fact: 'attack.greataxe.mastery', value: () => 1 }]
};

export default defineRule(greataxeMastery);
