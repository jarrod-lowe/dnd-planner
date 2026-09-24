import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CI = 'rule.dnd-5e-2024.condition-incapacitated';

/**
 * The keyed incapacitated effect the recorder commits: `key: 'incapacitated'`
 * so repeat records evict rather than stack. It writes ONLY
 * `condition.incapacitated` — the wave-3 composition parent's contract:
 * Paralyzed/Petrified/Stunned (wave 5) and Unconscious write the same fact
 * DIRECTLY in their own effect state (all writers carry `stateCombine: 'max'`
 * so they co-write safely; sheet.ts throws on conflicting combine modes), and
 * every reader gates `> 0`, never `=== 1`. The wave-5 children thus inherit
 * the initiative derive and the economy clamps below for free, with no
 * cross-module import — the shared fact name IS the coupling.
 */
const incapacitatedEffect = (): EffectInstance => ({
  id: 'effect-incapacitated',
  key: 'incapacitated',
  state: { 'condition.incapacitated': 1 },
  stateCombine: { 'condition.incapacitated': 'max' },
  display: { name: `${CI}.effect-incapacitated.name`, detailKey: 'condition/incapacitated' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Incapacitated — wave 3 "the enabler", the composition parent the wave-5
 * conditions build on. SRD 5.2: Inactive (no action, Bonus Action, or
 * Reaction), No Concentration (broken), Speechless, Surprised (Disadvantage on
 * Initiative). One free-section RECORDER models BEING INCAPACITATED (imposed
 * by an enemy effect), so it is free and ungated — the prone "Knocked Prone"
 * precedent.
 *
 * Inactive is enforced where the pools live, not here: the action-economy
 * `*.remaining` derives and the attacks `attackAction.extraRemaining` derive
 * read `condition.incapacitated` and clamp to 0 while it is set, so every
 * `actions.remaining > 0` gate (dash, bless, weapon/spell costApply…) goes
 * illegal for free. Surprised is a DERIVE (below), not an effect write, so it
 * reacts to the composed fact and the wave-5 children inherit it. No
 * Concentration (the eviction on record while a hold is live) and Speechless
 * (notice text only) ride later work / the notice.
 *
 * Any rest clears the condition (umbrella default; `untilShortRest`, a long
 * rest includes a short) plus manual ActiveStateStrip chip dismissal — SRD 5.2
 * gives no mechanical end, so there is no end offer.
 *
 * Foundational, so no search meta.
 */
const conditionIncapacitated: RuleModule = {
  id: 'condition-incapacitated',
  offer: () => [
    {
      id: 'record-incapacitated',
      ui: {
        section: 'free',
        name: `${CI}.record-incapacitated.name`,
        detailKey: 'condition/incapacitated',
        intents: { CONDITION: 'incapacitated' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [incapacitatedEffect()]
      })
    }
  ],
  // Surprised: derive the flag from the fact rather than effect-writing it, so
  // the composition children (whose effects write `condition.incapacitated`
  // directly) inherit the Disadvantage for free. `combine: 'max'` agrees with
  // the armor penalty derives and the poisoned effect write on the same fact.
  derive: () => [
    {
      fact: 'initiative.disadvantage',
      combine: 'max',
      value: (f) => (f.num('condition.incapacitated') > 0 ? 1 : 0)
    }
  ],
  // While incapacitated, a NOTICE carries the standing effects: Inactive and
  // No Concentration are enforced engine-side, Speechless and Surprised are
  // player-side reminders (SRD verbatim — text only). 'notice' == NOTICE_TARGET;
  // rule modules may import only the builder, so the reserved label is a
  // literal here (see condition-prone / condition-poisoned).
  annotate: (f): Annotation[] =>
    f.num('condition.incapacitated') > 0
      ? [
          {
            key: `${CI}.notice`,
            targets: ['notice'],
            source: `${CI}.effect-incapacitated.name`,
            body: `${CI}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionIncapacitated);
