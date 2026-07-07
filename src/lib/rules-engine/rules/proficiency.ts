import { defineRule, type RuleModule } from '../builder';

/**
 * Proficiency: the home of the proficiency-bonus stat. The bonus itself is
 * contributed by class levels (e.g. class-paladin-level1 → +2); this group adds
 * no facts — the legacy `proficiency-reset` rule had empty activities and only a UI stat
 * descriptor. Foundational (auto-assigned, not user-searched), so no `meta`. It
 * exists so a character's `proficiency` rule-group id resolves to a module.
 */
const proficiency: RuleModule = {
  id: 'proficiency'
};

export default defineRule(proficiency);
