import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CC = 'rule.dnd-5e-2024.condition-charmed';

/**
 * The keyed charmed effect the recorder commits: `key: 'charmed'` so a future
 * end offer could evict it with an empty same-key effect. It writes ONLY
 * `condition.charmed` — both SRD effects are NPC-side (you can't attack the
 * charmer; the charmer has Advantage on social checks against you), so the
 * notice carries them as text and there are no shared flags to `stateCombine`
 * (prone's max-combine existed for its shared attack-disadvantage facts).
 */
const charmedEffect = (): EffectInstance => ({
  id: 'effect-charmed',
  key: 'charmed',
  state: { 'condition.charmed': 1 },
  display: { name: `${CC}.effect-charmed.name`, detailKey: 'condition/charmed' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Charmed — wave 1 pure-bookkeeping condition (the prone chassis minus the
 * movement/attack machinery). One free-section RECORDER models BEING CHARMED
 * (imposed by an enemy effect), so it is free and ungated — the prone
 * "Knocked Prone" precedent. A NOTICE carries the condition's standing
 * effects; both are NPC-side, notice text only (no charmer identity is
 * modelled, so can't-harm-the-charmer stays player judgement).
 *
 * Any rest clears the condition (umbrella default; `untilShortRest`, a long
 * rest includes a short) plus manual ActiveStateStrip chip dismissal — SRD
 * 5.2 gives no mechanical end (charm-end triggers are per-spell), so there
 * is no end offer.
 *
 * Foundational, so no search meta.
 */
const conditionCharmed: RuleModule = {
  id: 'condition-charmed',
  offer: () => [
    {
      id: 'record-charmed',
      ui: {
        section: 'free',
        name: `${CC}.record-charmed.name`,
        detailKey: 'condition/charmed',
        intents: { CONDITION: 'charmed' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [charmedEffect()]
      })
    }
  ],
  // While charmed, a NOTICE carries the standing effects (both NPC-side —
  // text only, nothing live to interpolate). 'notice' == NOTICE_TARGET; rule
  // modules may import only the builder, so the reserved label is a literal
  // here (see condition-prone / feat-sentinel).
  annotate: (f): Annotation[] =>
    f.num('condition.charmed') > 0
      ? [
          {
            key: `${CC}.notice`,
            targets: ['notice'],
            source: `${CC}.effect-charmed.name`,
            body: `${CC}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionCharmed);
