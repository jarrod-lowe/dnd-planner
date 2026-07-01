import { defineRule, type RuleModule } from '../builder';

/** Javelin Mastery (Slow) — sets attack.javelin.mastery. A separate group. */
const javelinMastery: RuleModule = {
  id: 'javelin-mastery',
  derive: () => [{ fact: 'attack.javelin.mastery', value: () => 1 }]
};

export default defineRule(javelinMastery);
