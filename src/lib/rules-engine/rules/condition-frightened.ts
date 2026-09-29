import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type FactReader,
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

/**
 * Every d20 test the SRD disadvantage clause touches: the STR/DEX attack flags
 * (the weapon and unarmed dice-lines read those), the 18 skill flags (the
 * skill rollers read them), `initiative.disadvantage` (roll-initiative reads
 * it; Initiative is a Dexterity check), and `check.disadvantage` (the generic
 * record-check roller reads it).
 */
const FLAG_FACTS = [
  'attack.str.disadvantage',
  'attack.dex.disadvantage',
  'initiative.disadvantage',
  'check.disadvantage',
  ...SKILLS.map((skill) => `skill.${skill}.disadvantage`)
] as const;

/**
 * The keyed frightened effect the recorder commits: `key: 'frightened'` so a
 * future end offer could evict it with an empty same-key effect. It writes
 * ONLY `condition.frightened` — the flags live in the derives below, because
 * effect `state` cannot be conditional on live facts and the SRD scopes the
 * whole disadvantage clause to sight: "while the source of fear is within
 * line of sight". `dependents` makes chip dismissal take the source toggle
 * along (the store's removeEffect follows dependent keys), so a dismissed
 * condition cannot strand a hidden-source sub-state.
 */
const frightenedEffect = (): EffectInstance => ({
  id: 'effect-frightened',
  key: 'frightened',
  dependents: ['frightened-source'],
  state: { 'condition.frightened': 1 },
  display: { name: `${CF}.effect-frightened.name`, detailKey: 'condition/frightened' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Source of fear marked OUT of sight — the keyed sub-state the LoS chip
 * commits. `ruleGroupId` is authored because the follow-up commit channel
 * bypasses the plan fold's group stamping (the javelin Slow precedent).
 * Carries the same rest expiry as the condition, so any rest that ends
 * Frightened also resets the sight state.
 */
const sourceHiddenEffect = (): EffectInstance => ({
  id: 'effect-frightened-source-hidden',
  key: 'frightened-source',
  ruleGroupId: 'condition-frightened',
  state: { 'frightened.sourceHidden': 1 },
  display: { name: `${CF}.effect-source-hidden.name`, detailKey: 'condition/frightened' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Source back IN sight — the empty same-`key` eviction (the get-up idiom):
 * no `state`, its whole job is to replace the hidden effect so the fact
 * reverts to unset. Display-less, so the strip stays quiet while in sight;
 * the dice-line chip is the state's indicator.
 */
const sourceVisibleEffect = (): EffectInstance => ({
  id: 'effect-frightened-source-visible',
  key: 'frightened-source',
  ruleGroupId: 'condition-frightened',
  expiry: { kind: 'untilShortRest' }
});

/**
 * Frightened — the LAST of the 14 conditions, on the Poisoned chassis with
 * the line-of-sight qualifier mechanised: one free-section RECORDER models
 * BEING FRIGHTENED (imposed by an enemy effect), so it is free and ungated —
 * the prone "Knocked Prone" precedent.
 *
 * Any rest clears the condition (umbrella default; `untilShortRest`, a long
 * rest includes a short) plus manual ActiveStateStrip chip dismissal — SRD
 * 5.2 gives no mechanical end, so there is no end offer.
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
  // The 22 flags as DERIVES, not effect writes: effect `state` cannot be
  // conditional, and the whole clause is sight-qualified. Unset
  // `frightened.sourceHidden` reads 0 = in sight, so the flags default ON with
  // zero state (the "line of sight assumed" default); the hidden sub-state
  // zeroes every contribution. `combine: 'max'` agrees with every co-writer:
  // the armor penalty derives on the same facts, and Blinded/Poisoned/
  // Restrained effect-write them `stateCombine: 'max'` — the default `sum`
  // would conflict-throw for armored characters and stack to 2 for
  // overlapping conditions. Disadvantage is a flag, not a stack. The derives
  // read only `condition.frightened` + `frightened.sourceHidden`, never their
  // own outputs — no cycle.
  derive: () =>
    FLAG_FACTS.map((fact) => ({
      fact,
      combine: 'max' as const,
      value: (f: FactReader): number =>
        f.num('condition.frightened') > 0 && f.num('frightened.sourceHidden') === 0 ? 1 : 0
    })),
  // While frightened, a NOTICE carries BOTH standing effects (SRD verbatim —
  // the disadvantage sentence with its sight qualifier, and can't-approach,
  // which stays text: the board has no source-position model to enforce
  // "closer" against). The body FLIPS with the sight state (the exhaustion
  // body-dead precedent): hidden means no Frightened disadvantage, but
  // can't-approach survives sight. The second annotation is the LoS TOGGLE —
  // the dice-line chip whose tap commits the keyed sub-state effects above
  // (see AnnotationToggle); it targets the check/to-hit rollers only, never
  // saves. 'notice' == NOTICE_TARGET; rule modules may import only the
  // builder, so the reserved label is a literal here (see condition-prone /
  // condition-blinded).
  annotate: (f): Annotation[] =>
    f.num('condition.frightened') > 0
      ? [
          {
            key: `${CF}.notice`,
            targets: ['notice'],
            source: `${CF}.effect-frightened.name`,
            body:
              f.num('frightened.sourceHidden') > 0
                ? `${CF}.notice.body-hidden`
                : `${CF}.notice.body`
          },
          {
            key: `${CF}.los`,
            targets: ['attack.any', 'dice.any'],
            toggle: {
              fact: 'frightened.sourceHidden',
              onWhen: 0,
              onEffect: sourceHiddenEffect(),
              offEffect: sourceVisibleEffect(),
              labelOn: `${CF}.los.in-sight`,
              labelOff: `${CF}.los.out-of-sight`,
              appliesTo: ['to-hit', 'check']
            }
          }
        ]
      : []
};

export default defineRule(conditionFrightened);
