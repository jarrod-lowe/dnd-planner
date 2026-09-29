import { defineRule, type Offer, type RuleModule } from '../builder';

/** The 18 skills, in the established offer order. */
const SKILLS = [
  'acrobatics',
  'animal-handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight-of-hand',
  'stealth',
  'survival'
] as const;

/** A display-only "roll <skill>" free action: d20 + the skill value, no state change. */
function rollOffer(skill: string): Offer {
  return {
    id: `roll-skill-${skill}`,
    ui: {
      section: 'free',
      name: `play.stats.skills.${skill}`,
      disadvantageFact: `skill.${skill}.disadvantage`,
      // The save-recorder label scheme (save.any + save.<ability>): the broad
      // check label scopes check-wide attribution chips (Poisoned, Frightened),
      // the per-skill one scopes the untrained-armor four, and dice.any keeps
      // the any-die riders (Heroic Inspiration, Exhaustion's check rider).
      annotationLabels: ['check.any', `check.${skill}`, 'dice.any'],
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'check' }],
        advantage: { fact: `skill.${skill}.disadvantage` }
      },
      intents: { CHECK: 'skill' },
      actionCost: []
    },
    vars: { rollBonus: { capture: true, default: { fact: `skill.${skill}.value` } } }
  };
}

/**
 * Skill Checks — a display-only "roll" free action per skill (d20 + the skill
 * value, with the skill's disadvantage flag). No apply — rolling records nothing.
 * Foundational, so no search meta.
 */
const skillChecks: RuleModule = {
  id: 'skill-checks',
  offer: () => SKILLS.map(rollOffer)
};

export default defineRule(skillChecks);
