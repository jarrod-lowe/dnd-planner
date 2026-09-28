import {
  defineRule,
  type Annotation,
  type ActionResult,
  type Contribution,
  type EffectInstance,
  type FactReader,
  type RuleModule
} from '../builder';

const CF = 'rule.dnd-5e-2024.condition-frightened';

/**
 * The 18 skills, in the established offer order. Module-local per the
 * confinement rule (modules import only the builder): skill-checks.ts,
 * ability-scores.ts and condition-poisoned.ts each keep their own copy.
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
 * The 22 d20-test flags the SRD disadvantage touches — the same list Poisoned
 * effect-writes (copy, don't share; a shared const would couple condition
 * modules to each other). Here they are DERIVED, not written: the
 * disadvantage is scoped to "while the source of fear is within line of
 * sight", and effect `state` cannot be conditional on live facts.
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
 * ONLY the condition fact — the flags live in the derives below. Its
 * `dependents` names the toggle's key: dismissing the Frightened chip on the
 * active-effects strip takes a COMMITTED toggle with it (the store's
 * removeEffect follows dependent keys; the yaml runner's does not, so the
 * orphan guard is pinned store-level).
 */
const frightenedEffect = (): EffectInstance => ({
  id: 'effect-frightened',
  key: 'frightened',
  state: { 'condition.frightened': 1 },
  dependents: ['frightened-source'],
  display: { name: `${CF}.effect-frightened.name`, detailKey: 'condition/frightened' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * The keyed LoS toggle-on effect: `key: 'frightened-source'`, DISTINCT from
 * the condition's 'frightened' (a same-key eviction would end the condition
 * itself). Its state write is the whole model — `frightened.sourceHidden: 1`
 * while the player has marked the source out of sight — and its chip is the
 * strip's live LoS display. Any rest clears it together with the condition
 * (umbrella default). `ruleGroupId` is AUTHORED (the javelin Slow follow-up
 * idiom): the chip's tap commits through the store's follow-up channel, which
 * bypasses the plan fold that would otherwise stamp the owning group —
 * without it, unassigning condition-frightened strands a persisted
 * sourceHidden and the next Frightened starts hidden.
 */
const sourceHiddenEffect = (): EffectInstance => ({
  id: 'frightened-source-hidden',
  key: 'frightened-source',
  ruleGroupId: 'condition-frightened',
  state: { 'frightened.sourceHidden': 1 },
  display: { name: `${CF}.effect-source-hidden.name`, detailKey: 'condition/frightened' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * The reveal: an EMPTY same-`key` effect (the get-up / regain-consciousness
 * idiom) — the dice-line chip's out-of-sight tap commits it directly (the
 * store's follow-up channel, keyed replace-by-eviction), and any rest clears
 * it together with the condition. Its display name is the DISTINCT ended
 * label; its expiry is untilShortRest, NOT permanent: a permanent ended-chip
 * would outlive Frightened itself, so the rest must take the eviction WITH
 * the condition (the strip shows the ended chip until then — pinned in
 * condition-frightened-source-back-in-sight). Same AUTHORED `ruleGroupId` as
 * the hide, for the same follow-up-channel reason.
 */
const sourceVisibleEffect = (): EffectInstance => ({
  id: 'frightened-source-visible',
  key: 'frightened-source',
  ruleGroupId: 'condition-frightened',
  display: { name: `${CF}.source-back-in-sight.effect-cleared.name` },
  expiry: { kind: 'untilShortRest' }
});

/**
 * The 22 flags as gated derives (the builder's armorTrainingPenalties shape):
 * 1 only while frightened AND the source is within sight. Each carries
 * `combine: 'max'` — mode agreement with Poisoned's `stateCombine: 'max'`
 * effect writes and the armor modules' own `max` derives, so co-standing
 * writers compete-take-max instead of conflict-throwing (Blinded's regression
 * family; disadvantage is a flag, not a stack). The derives read ONLY the two
 * condition facts, never their own outputs — no cycle (splint reads
 * `armor.splint.equipped`, an effect-written fact, the same way).
 */
const flagsWhileSourceVisible = (f: FactReader): number =>
  f.num('condition.frightened') > 0 && f.num('frightened.sourceHidden') === 0 ? 1 : 0;

const flagDerives = (): Contribution[] =>
  FLAG_FACTS.map((fact) => ({
    fact,
    combine: 'max' as const,
    value: flagsWhileSourceVisible
  }));

/**
 * Frightened — wave 2's deferred straggler and the LAST of the 14 conditions;
 * held back over the line-of-sight qualifier, landed as a player-toggled
 * sub-state. SRD 5.2 scopes the ENTIRE disadvantage clause to "while the
 * source of fear is within line of sight", and source-hidden is the common
 * mid-fight state, so the flags DERIVE from a player-asserted
 * `frightened.sourceHidden` toggle instead of standing. One free-section
 * RECORDER models BEING FRIGHTENED (imposed by an enemy effect — the
 * knocked-prone precedent, free and ungated).
 *
 * The toggle itself, v2 (user-directed 2026-09-29 — the walkthrough decision
 * "Reading 2: persistent global toggle, chip-styled, immediate"): a PERSISTENT
 * chip on the dice-lines whose disadvantage it scopes (weapon/skill/initiative/
 * save/check rollers — the lines reading the gated flags), one tap, BOTH
 * directions, committing IMMEDIATELY through the store's follow-up channel —
 * but only while the CONDITION effect is COMMITTED (the toggle's
 * `committedKey`; a merely planned record row advertises the same facts, and
 * a cancellable projection must not commit persistent LoS state).
 * The engine cannot see the table, so the toggle is player judgement expressed
 * as a committed keyed effect — no planned choices, no picker offers (the v1
 * illegal-but-visible toggle offers are deleted per the no-unused-code rule).
 * The committed toggle effect carries its own strip chip (the live LoS
 * display; dismissing it restores in-sight), and the NOTICE is standing text
 * only. Can't-willingly-approach stays notice text (no source position to
 * verify against); any rest clears condition + toggle together.
 *
 * Foundational, so no search meta.
 */
const conditionFrightened: RuleModule = {
  id: 'condition-frightened',
  derive: flagDerives,
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
  // ONE annotation while frightened carries BOTH surfaces: the standing
  // notice (text only — the strip's half) and the `toggle` the governed
  // dice-lines render as the persistent LoS chip. 'dice.any' reaches every
  // d20 roller (the annotation-targets guard pins that every dice panel
  // carries it); the chip then narrows to the lines whose disadvantage source
  // is one of the governed flags, so damage/healing lines and the steed's
  // companion-labelled panels never show it. 'notice' == NOTICE_TARGET; rule
  // modules may import only the builder, so the reserved label is a literal
  // here (see condition-prone / -poisoned).
  annotate: (f): Annotation[] => {
    if (f.num('condition.frightened') <= 0) return [];
    const hidden = f.num('frightened.sourceHidden') > 0;
    return [
      {
        key: `${CF}.notice`,
        targets: ['notice', 'dice.any'],
        source: `${CF}.effect-frightened.name`,
        body: hidden ? `${CF}.notice.body-hidden` : `${CF}.notice.body`,
        toggle: {
          offFact: 'frightened.sourceHidden',
          onLabelKey: `${CF}.fear-source-in-sight`,
          offLabelKey: `${CF}.fear-source-out-of-sight`,
          onEffect: sourceHiddenEffect(),
          offEffect: sourceVisibleEffect(),
          governs: [...FLAG_FACTS],
          // The chip exists only while the CONDITION is committed: a tap
          // commits persistent LoS state, and a merely planned record row (the
          // fold advertises the same facts this annotate reads) must not offer
          // it — the player can still cancel the row and orphan the toggle.
          // The view resolves the gate against the store's committed keys.
          committedKey: 'frightened'
        }
      }
    ];
  }
};

export default defineRule(conditionFrightened);
