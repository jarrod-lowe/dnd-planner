import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CB = 'rule.dnd-5e-2024.condition-blinded';

/**
 * The keyed blinded effect the recorder commits: `key: 'blinded'` so a future
 * end offer could evict it with an empty same-key effect. It writes
 * `condition.blinded` plus the STR/DEX attack-disadvantage flags the weapon and
 * unarmed dice-lines already read (so the rollers default to 2d20-take-low with
 * zero roller changes). The flags carry `stateCombine: 'max'` (the prone
 * idiom): the armor modules derive the same facts with `combine: 'max'`, and
 * the default `sum` on an effect write would conflict-throw for any armored
 * character (see condition-blinded-attack-flags).
 */
const blindedEffect = (): EffectInstance => ({
  id: 'effect-blinded',
  key: 'blinded',
  state: {
    'condition.blinded': 1,
    'attack.str.disadvantage': 1,
    'attack.dex.disadvantage': 1
  },
  stateCombine: {
    'attack.str.disadvantage': 'max',
    'attack.dex.disadvantage': 'max'
  },
  display: { name: `${CB}.effect-blinded.name`, detailKey: 'condition/blinded' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Blinded — wave 1 condition on the prone chassis minus the movement
 * machinery. One free-section RECORDER models BEING BLINDED (imposed by an
 * enemy effect), so it is free and ungated — the prone "Knocked Prone"
 * precedent. Mechanically it is prone's attack flags and nothing else: your
 * attack rolls have Disadvantage (the shared STR/DEX flags), while can't-see
 * (auto-fail sight checks) and attacks-against-you Advantage are notice text —
 * skill offers are display-only (the Deafened precedent) and the NPC side is
 * never modelled (the prone precedent).
 *
 * Any rest clears the condition (umbrella default; `untilShortRest`, a long
 * rest includes a short) plus manual ActiveStateStrip chip dismissal — SRD
 * 5.2 gives no mechanical end, so there is no end offer.
 *
 * Foundational, so no search meta.
 */
const conditionBlinded: RuleModule = {
  id: 'condition-blinded',
  offer: () => [
    {
      id: 'record-blinded',
      ui: {
        section: 'free',
        name: `${CB}.record-blinded.name`,
        detailKey: 'condition/blinded',
        intents: { CONDITION: 'blinded' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [blindedEffect()]
      })
    }
  ],
  // While blinded, a NOTICE carries the standing effects (sight auto-fail and
  // the NPC-side attacks-against-you Advantage — text only, nothing live to
  // interpolate, unlike prone's cost). 'notice' == NOTICE_TARGET; rule modules
  // may import only the builder, so the reserved label is a literal here (see
  // condition-prone / condition-charmed).
  annotate: (f): Annotation[] =>
    f.num('condition.blinded') > 0
      ? [
          {
            key: `${CB}.notice`,
            targets: ['notice'],
            source: `${CB}.effect-blinded.name`,
            body: `${CB}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionBlinded);
