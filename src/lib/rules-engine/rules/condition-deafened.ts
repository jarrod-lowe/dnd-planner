import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CD = 'rule.dnd-5e-2024.condition-deafened';

/**
 * The keyed deafened effect the recorder commits: `key: 'deafened'` so a
 * future end offer could evict it with an empty same-key effect. It writes
 * ONLY `condition.deafened` — the sole SRD effect (auto-fail hearing ability
 * checks) is display-only in this engine (skill offers are display-only), so
 * the notice carries it as text and there are no shared flags to
 * `stateCombine`.
 */
const deafenedEffect = (): EffectInstance => ({
  id: 'effect-deafened',
  key: 'deafened',
  state: { 'condition.deafened': 1 },
  display: { name: `${CD}.effect-deafened.name`, detailKey: 'condition/deafened' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Deafened — wave 1 pure-bookkeeping condition (the prone chassis minus the
 * movement/attack machinery). One free-section RECORDER models BEING
 * DEAFENED (imposed by an enemy effect), so it is free and ungated — the
 * prone "Knocked Prone" precedent. A NOTICE carries the condition's standing
 * effect; auto-failing hearing checks is player judgement over the
 * display-only skill offers, so notice text only.
 *
 * Any rest clears the condition (umbrella default; `untilShortRest`, a long
 * rest includes a short) plus manual ActiveStateStrip chip dismissal — SRD
 * 5.2 gives no mechanical end, so there is no end offer.
 *
 * Foundational, so no search meta.
 */
const conditionDeafened: RuleModule = {
  id: 'condition-deafened',
  offer: () => [
    {
      id: 'record-deafened',
      ui: {
        section: 'free',
        name: `${CD}.record-deafened.name`,
        detailKey: 'condition/deafened',
        intents: { CONDITION: 'deafened' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [deafenedEffect()]
      })
    }
  ],
  // While deafened, a NOTICE carries the standing effect (auto-fail hearing
  // checks — text only, nothing live to interpolate). 'notice' ==
  // NOTICE_TARGET; rule modules may import only the builder, so the reserved
  // label is a literal here (see condition-prone / feat-sentinel).
  annotate: (f): Annotation[] =>
    f.num('condition.deafened') > 0
      ? [
          {
            key: `${CD}.notice`,
            targets: ['notice'],
            source: `${CD}.effect-deafened.name`,
            body: `${CD}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionDeafened);
