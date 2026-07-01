import { defineRule, type RuleModule } from '../builder';

/**
 * Oath of Redemption, level 4 — no new subclass features (v1 `rules: []`); a
 * no-op module so a level-4 oath build resolves. Foundational, so no meta.
 */
const oathLevel4: RuleModule = {
  id: 'class-paladin-oath-redemption-level4'
};

export default defineRule(oathLevel4);
