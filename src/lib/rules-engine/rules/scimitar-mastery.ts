import { defineRule, type RuleModule } from '../builder';

/** Scimitar Mastery (Nick) — sets attack.scimitar.mastery. A separate group. */
const scimitarMastery: RuleModule = {
  id: 'scimitar-mastery',
  derive: () => [{ fact: 'attack.scimitar.mastery', value: () => 1 }]
};

export default defineRule(scimitarMastery);
