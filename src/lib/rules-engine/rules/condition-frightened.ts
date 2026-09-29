import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CF = 'rule.dnd-5e-2024.condition-frightened';

/**
 * The keyed frightened effect the recorder commits: `key: 'frightened'` so a
 * future end offer could evict it with an empty same-key effect. It writes
 * ONLY `condition.frightened` — the disadvantage is carried PER ROW by the LoS
 * chip (see the toggle annotation below), never by the shared flags: a
 * max-combined flag cannot be subtracted per row, so a row's own sight value
 * could never be reconciled with Poisoned/Blinded/armor contributions already
 * folded in. `dependents` makes chip dismissal take the sight seed along (the
 * store's removeEffect follows dependent keys), so a dismissed condition
 * cannot strand a hidden-source seed.
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
 * Source of fear marked OUT of sight — the keyed SEED the dice-line chip's
 * tap commits: the value newly planned rows CAPTURE as their per-row sight
 * state (capture-at-add), and the value the notice body reports. Previous
 * rows keep their own captured value — the seed only feeds forward.
 * `ruleGroupId` is authored because the follow-up commit channel bypasses the
 * plan fold's group stamping (the javelin Slow precedent). Carries the same
 * rest expiry as the condition, so any rest that ends Frightened also resets
 * the sight seed.
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
 * no `state`, its whole job is to replace the hidden seed so the fact reverts
 * to unset. Display-less, so the strip stays quiet while in sight; the
 * dice-line chips are the state's indicators.
 */
const sourceVisibleEffect = (): EffectInstance => ({
  id: 'effect-frightened-source-visible',
  key: 'frightened-source',
  ruleGroupId: 'condition-frightened',
  expiry: { kind: 'untilShortRest' }
});

/**
 * Frightened — the LAST of the 14 conditions, on the Poisoned chassis with
 * the line-of-sight qualifier mechanised PER ROW (user-directed 2026-09-29):
 * one free-section RECORDER models BEING FRIGHTENED (imposed by an enemy
 * effect), so it is free and ungated — the prone "Knocked Prone" precedent.
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
  // NO flag derives, deliberately (see frightenedEffect): the SRD's
  // "while the source of fear is within line of sight" is player-asserted
  // PER ROLL, so each planned row carries its own sight value (captured at
  // add time from the seed) and the dice-line chip forces the disadvantage
  // roll-mode from it. Other disadvantage sources keep the shared flags —
  // source-pure, so the per-row legs combine without subtraction.
  // While frightened, a NOTICE carries BOTH standing effects (SRD verbatim —
  // the disadvantage sentence with its sight qualifier, and can't-approach,
  // which stays text: the board has no source-position model to enforce
  // "closer" against). The body FLIPS with the sight SEED (the exhaustion
  // body-dead precedent): hidden means new rows open with no Frightened
  // disadvantage, but can't-approach survives sight. The LoS TOGGLE — the
  // dice-line chip; see AnnotationToggle — carries `parentKey: 'frightened'`:
  // a tap persists a seed effect immediately (the follow-up channel), and a
  // merely-PLANNED recorder row removed before End Turn would strand it (the
  // `dependents` cleanup runs on committed-parent dismissal only), so the
  // VIEW strips the chip until the parent is committed — the engine's
  // annotate pass folds planned and committed by design and cannot tell them
  // apart. 'notice' == NOTICE_TARGET; rule modules may import only the
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
              parentKey: 'frightened',
              // Direction contract: onEffect takes the fact TO onWhen (the
              // REVEAL — an in-sight chip is the pressed state), offEffect
              // takes it away (the HIDE). Pinned in
              // condition-frightened-los.test.ts.
              onEffect: sourceVisibleEffect(),
              offEffect: sourceHiddenEffect(),
              labelOn: `${CF}.los.in-sight`,
              labelOff: `${CF}.los.out-of-sight`,
              appliesTo: ['to-hit', 'check']
            }
          }
        ]
      : []
};

export default defineRule(conditionFrightened);
