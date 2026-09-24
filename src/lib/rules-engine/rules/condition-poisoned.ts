import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CP = 'rule.dnd-5e-2024.condition-poisoned';

/**
 * The 18 skills, in the established offer order. Module-local per the
 * confinement rule (modules import only the builder): skill-checks.ts and
 * ability-scores.ts each keep their own copy already.
 */
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

/** One pass over SKILLS builds both skill maps: write 1, combine max. */
const skillState: Record<string, number> = {};
const skillCombine: Record<string, 'max'> = {};
for (const skill of SKILLS) {
  const fact = `skill.${skill}.disadvantage`;
  skillState[fact] = 1;
  skillCombine[fact] = 'max';
}

/**
 * The keyed poisoned effect the recorder commits: `key: 'poisoned'` so a future
 * end offer could evict it with an empty same-key effect. It writes
 * `condition.poisoned` plus every d20 test the SRD disadvantage touches: the
 * STR/DEX attack flags (the weapon and unarmed dice-lines read those), the 18
 * skill flags (the skill rollers read them), `initiative.disadvantage`
 * (roll-initiative reads it; Initiative is a Dexterity check), and
 * `check.disadvantage` (the generic record-check roller reads it).
 *
 * Every FLAG carries `stateCombine: 'max'` (the prone idiom): the armor modules
 * derive 7 of these facts with `combine: 'max'` on the derive side, and other
 * conditions (Blinded already) effect-write the same attack flags — the default
 * `sum` on an effect write would conflict-throw for any armored character and
 * stack to 2 for overlapping conditions (see condition-poisoned-skill-flags and
 * condition-poisoned-with-blinded). Disadvantage is a flag, not a stack.
 */
const poisonedEffect = (): EffectInstance => ({
  id: 'effect-poisoned',
  key: 'poisoned',
  state: {
    'condition.poisoned': 1,
    'attack.str.disadvantage': 1,
    'attack.dex.disadvantage': 1,
    'initiative.disadvantage': 1,
    'check.disadvantage': 1,
    ...skillState
  },
  stateCombine: {
    'attack.str.disadvantage': 'max',
    'attack.dex.disadvantage': 'max',
    'initiative.disadvantage': 'max',
    'check.disadvantage': 'max',
    ...skillCombine
  },
  display: { name: `${CP}.effect-poisoned.name`, detailKey: 'condition/poisoned' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Poisoned — wave 2 condition on the prone chassis, the first to reach past
 * the attack flags into the ability checks: "You have Disadvantage on attack
 * rolls and ability checks." One free-section RECORDER models BEING POISONED
 * (imposed by an enemy effect), so it is free and ungated — the prone
 * "Knocked Prone" precedent.
 *
 * Any rest clears the condition (umbrella default; `untilShortRest`, a long
 * rest includes a short) plus manual ActiveStateStrip chip dismissal — SRD
 * 5.2 gives no mechanical end, so there is no end offer. Skill-less raw
 * ability checks have no offers (the notice text is their reminder).
 *
 * Foundational, so no search meta.
 */
const conditionPoisoned: RuleModule = {
  id: 'condition-poisoned',
  offer: () => [
    {
      id: 'record-poisoned',
      ui: {
        section: 'free',
        name: `${CP}.record-poisoned.name`,
        detailKey: 'condition/poisoned',
        intents: { CONDITION: 'poisoned' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [poisonedEffect()]
      })
    }
  ],
  // While poisoned, a NOTICE carries the standing effect (SRD verbatim — text
  // only, nothing live to interpolate, unlike prone's cost). 'notice' ==
  // NOTICE_TARGET; rule modules may import only the builder, so the reserved
  // label is a literal here (see condition-prone / condition-blinded).
  annotate: (f): Annotation[] =>
    f.num('condition.poisoned') > 0
      ? [
          {
            key: `${CP}.notice`,
            targets: ['notice'],
            source: `${CP}.effect-poisoned.name`,
            body: `${CP}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionPoisoned);
