import { defineRule, type RuleModule } from '../builder';

const PASSIVES = ['perception', 'insight', 'investigation'] as const;

/**
 * Passive Skills — each passive score is `10 + the skill's value` (which
 * ability-scores derives as ability modifier + proficiency). Pure derives.
 * Foundational, so no search meta.
 */
const passiveSkills: RuleModule = {
  id: 'passive-skills',
  derive: () =>
    PASSIVES.map((s) => ({ fact: `passive.${s}.value`, value: (f) => 10 + f.num(`skill.${s}.value`) }))
};

export default defineRule(passiveSkills);
