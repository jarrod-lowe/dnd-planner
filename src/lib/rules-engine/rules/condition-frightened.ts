import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CF = 'rule.dnd-5e-2024.condition-frightened';

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
 * The keyed frightened effect the recorder commits: `key: 'frightened'` so a
 * future end offer could evict it with an empty same-key effect. It writes
 * `condition.frightened` plus Poisoned's full flag set — every d20 test the
 * SRD disadvantage clause touches: the STR/DEX attack flags (the weapon and
 * unarmed dice-lines read those), the 18 skill flags (the skill rollers read
 * them), `initiative.disadvantage` (roll-initiative reads it; Initiative is a
 * Dexterity check), and `check.disadvantage` (the generic record-check roller
 * reads it).
 *
 * The SRD scopes the clause — "while the source of fear is within line of
 * sight" — and the assume-always-line-of-sight simplification (user-directed
 * 2026-09-29) satisfies that qualifier by assumption, so the flags are
 * STANDING while the condition lives; mechanising the qualifier is a deferred
 * follow-up.
 *
 * Every FLAG carries `stateCombine: 'max'` (the prone idiom): the armor modules
 * derive 7 of these facts with `combine: 'max'` on the derive side, and other
 * conditions (Blinded, Poisoned) effect-write the same flags — the default
 * `sum` on an effect write would conflict-throw for any armored character and
 * stack to 2 for overlapping conditions (see condition-frightened-skill-flags
 * and condition-frightened-with-poisoned). Disadvantage is a flag, not a stack.
 */
const frightenedEffect = (): EffectInstance => ({
  id: 'effect-frightened',
  key: 'frightened',
  state: {
    'condition.frightened': 1,
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
  display: { name: `${CF}.effect-frightened.name`, detailKey: 'condition/frightened' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Frightened — the wave-2 straggler and the LAST of the 14 conditions, on the
 * Poisoned chassis: one free-section RECORDER models BEING FRIGHTENED (imposed
 * by an enemy effect), so it is free and ungated — the prone "Knocked Prone"
 * precedent.
 *
 * Any rest clears the condition (umbrella default; `untilShortRest`, a long
 * rest includes a short) plus manual ActiveStateStrip chip dismissal — SRD
 * 5.2 gives no mechanical end, so there is no end offer. Skill-less raw
 * ability checks have no offers (the notice text is their reminder).
 *
 * Foundational, so no search meta.
 */
const conditionFrightened: RuleModule = {
  id: 'condition-frightened',
  offer: () => [
    {
      id: 'record-frightened',
      ui: {
        section: 'free',
        name: `${CF}.record-frightened.name`,
        detailKey: 'condition/frightened',
        intents: { CONDITION: 'frightened' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [frightenedEffect()]
      })
    }
  ],
  // While frightened, a NOTICE carries BOTH standing effects (SRD verbatim —
  // the disadvantage sentence with its sight qualifier, and can't-approach,
  // which stays text: the board has no source-position model to enforce
  // "closer" against). 'notice' == NOTICE_TARGET; rule modules may import only
  // the builder, so the reserved label is a literal here (see condition-prone /
  // condition-blinded).
  annotate: (f): Annotation[] =>
    f.num('condition.frightened') > 0
      ? [
          {
            key: `${CF}.notice`,
            targets: ['notice'],
            source: `${CF}.effect-frightened.name`,
            body: `${CF}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionFrightened);
