import { defineRule, type RuleModule } from '../builder';

/**
 * Oath of Redemption, level 6 — no new subclass features (the oath's next
 * feature is Aura of the Guardian at level 7, and its next oath spells at level
 * 9); a no-op module so a level-6 oath build resolves, like level 4.
 * Foundational, so no meta.
 */
const oathLevel6: RuleModule = {
  id: 'class-paladin-oath-redemption-level6'
};

export default defineRule(oathLevel6);
