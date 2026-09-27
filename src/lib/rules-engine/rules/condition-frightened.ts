import {
  defineRule,
  type ActionResult,
  type Annotation,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type RuleModule
} from '../builder';

const CF = 'rule.dnd-5e-2024.condition-frightened';
const NOT_FRIGHTENED = `${CF}.source-out-of-sight-offer.not_frightened`;
const ALREADY_HIDDEN = `${CF}.source-out-of-sight-offer.already_hidden`;
const NOT_HIDDEN = `${CF}.source-back-in-sight-offer.not_hidden`;

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
 * (umbrella default).
 */
const sourceHiddenEffect = (): EffectInstance => ({
  id: 'frightened-source-hidden',
  key: 'frightened-source',
  state: { 'frightened.sourceHidden': 1 },
  display: { name: `${CF}.effect-source-hidden.name`, detailKey: 'condition/frightened' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * The reveal: an EMPTY same-`key` effect (the get-up / regain-consciousness
 * idiom) — newest-wins evicts the hidden toggle while the row is still merely
 * planned, and endTurn merges the eviction permanently. Its display name is
 * the DISTINCT ended label; its expiry is untilShortRest, NOT permanent: a
 * permanent ended-chip would outlive Frightened itself, so the rest must take
 * the eviction WITH the condition (the strip shows the ended chip until then
 * — pinned in condition-frightened-rest-clears).
 */
const sourceVisibleEffect = (): EffectInstance => ({
  id: 'frightened-source-visible',
  key: 'frightened-source',
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
 * sub-state (user-directed 2026-09-25): SRD 5.2 scopes the ENTIRE disadvantage
 * clause to "while the source of fear is within line of sight", and
 * source-hidden is the common mid-fight state, so the flags DERIVE from a
 * player-asserted `frightened.sourceHidden` toggle instead of standing. One
 * free-section RECORDER models BEING FRIGHTENED (imposed by an enemy effect —
 * the knocked-prone precedent, free and ungated); TWO free toggle offers flip
 * the sub-state in both directions, legality-gated (the #453
 * illegal-but-visible contract — no `when`, `legalWhen` + apply re-check),
 * since the engine cannot see the table: the toggle is player judgement, one
 * tap, both directions. The NOTICE is the toggle's home — its button is the
 * shortcut (the offers also live in the add-row picker as ordinary free
 * actions). Can't-willingly-approach stays notice text (no source position to
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
    },
    {
      // Mark the source out of sight. NO `when` gate (the #453
      // illegal-but-visible contract): the offer is always visible, ILLEGAL
      // while un-frightened or already hidden with its diagnostics, and a
      // planned-anyway row still executes (the plan.ts contract) — while
      // un-frightened it commits an inert toggle (the derives gate on the
      // condition fact), while already hidden the keyed write replaces its
      // own predecessor harmlessly.
      id: 'source-out-of-sight',
      ui: {
        section: 'free',
        name: `${CF}.source-out-of-sight.name`,
        description: `${CF}.source-out-of-sight.description`,
        detailKey: 'condition/frightened',
        intents: { CONDITION: 'frightened' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('condition.frightened') > 0,
          diagnostics: [{ code: NOT_FRIGHTENED, severity: 'error' }]
        },
        {
          condition: (f) => f.num('frightened.sourceHidden') === 0,
          diagnostics: [{ code: ALREADY_HIDDEN, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        // Re-checked legality (the dash idiom) so a planned-anyway row
        // carries its own diagnostics from the fold.
        const diagnostics: Diagnostic[] = [];
        if (f.num('condition.frightened') === 0)
          diagnostics.push({ code: NOT_FRIGHTENED, severity: 'error' });
        if (f.num('frightened.sourceHidden') > 0)
          diagnostics.push({ code: ALREADY_HIDDEN, severity: 'error' });
        return { advertise: [sourceHiddenEffect()], diagnostics };
      }
    },
    {
      // Mark the source back in sight — the reveal eviction. NO `when` gate
      // either: ILLEGAL while the source is not marked hidden (not_hidden),
      // and a planned-anyway row still executes as a no-op eviction (no
      // toggle effect is held).
      id: 'source-back-in-sight',
      ui: {
        section: 'free',
        name: `${CF}.source-back-in-sight.name`,
        description: `${CF}.source-back-in-sight.description`,
        detailKey: 'condition/frightened',
        intents: { CONDITION: 'frightened' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('frightened.sourceHidden') > 0,
          diagnostics: [{ code: NOT_HIDDEN, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        // Re-checked legality (the dash idiom) so a planned-anyway row
        // carries its own diagnostics from the fold.
        const diagnostics: Diagnostic[] = [];
        if (f.num('frightened.sourceHidden') === 0)
          diagnostics.push({ code: NOT_HIDDEN, severity: 'error' });
        return { advertise: [sourceVisibleEffect()], diagnostics };
      }
    }
  ],
  // The notice IS the toggle's home: ONE standing notice while frightened,
  // whose body AND addsToPlan action flip with the LoS state (exhaustion's
  // body-dead flip precedent) — the strip button (PR1 chassis) is the
  // one-tap shortcut, with a state-specific labelKey so a screen reader
  // announces which way the tap goes. The offers also live in the add-row
  // picker; the button degrades to plain text when its offer is not addable.
  // 'notice' == NOTICE_TARGET; rule modules may import only the builder, so
  // the reserved label is a literal here (see condition-prone / -poisoned).
  annotate: (f): Annotation[] => {
    if (f.num('condition.frightened') <= 0) return [];
    const hidden = f.num('frightened.sourceHidden') > 0;
    return [
      {
        key: `${CF}.notice`,
        targets: ['notice'],
        source: `${CF}.effect-frightened.name`,
        body: hidden ? `${CF}.notice.body-hidden` : `${CF}.notice.body`,
        addsToPlan: hidden
          ? { offer: 'source-back-in-sight', labelKey: `${CF}.notice.action-reveal` }
          : { offer: 'source-out-of-sight', labelKey: `${CF}.notice.action-hide` }
      }
    ];
  }
};

export default defineRule(conditionFrightened);
