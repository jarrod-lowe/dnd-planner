import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CR = 'rule.dnd-5e-2024.condition-restrained';

/**
 * The keyed restrained effect the recorder commits: `key: 'restrained'` so
 * repeat records evict rather than stack. It writes `condition.restrained` —
 * movement.ts's halted derive already lists it (grappled's Speed-0 family, the
 * foundation this wave reuses), so halted, the remaining/effective_total mask,
 * and every halted gate (all travel offers, dash "can't increase", the prone
 * get-up/drop Speed-0 gates) come free with zero movement.ts changes — plus
 * the Attacks Affected STR/DEX attack-disadvantage flags the weapon and
 * unarmed dice-lines already read, and `save.dex.disadvantage`, the Saving
 * Throws Affected flag the core-events save recorders' advantage source
 * resolves (a NEW fact; no other writer today). All three flags carry
 * `stateCombine: 'max'` (the prone/blinded/grappled idiom): the armor modules
 * derive the same facts with `combine: 'max'`, and the default `sum` on an
 * effect write would conflict-throw for any armored character. The vs-you
 * Advantage half of Attacks Affected is NPC-side — notice text (prone
 * precedent), no fact.
 */
const restrainedEffect = (): EffectInstance => ({
  id: 'effect-restrained',
  key: 'restrained',
  state: {
    'condition.restrained': 1,
    'attack.str.disadvantage': 1,
    'attack.dex.disadvantage': 1,
    'save.dex.disadvantage': 1
  },
  stateCombine: {
    'attack.str.disadvantage': 'max',
    'attack.dex.disadvantage': 'max',
    'save.dex.disadvantage': 'max'
  },
  display: { name: `${CR}.effect-restrained.name`, detailKey: 'condition/restrained' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Restrained — wave 4, the last Speed-0 family member on grappled's halted
 * foundation. SRD 5.2: Speed 0 ("Your Speed is 0 and can't increase"), Attacks
 * Affected ("Attack rolls against you have Advantage, and your attack rolls
 * have Disadvantage"), Saving Throws Affected ("You have Disadvantage on
 * Dexterity saving throws"). One free-section RECORDER models BEING RESTRAINED
 * (imposed by an enemy effect — web, entangle, a net, manacles; escape-DC
 * offers are out of scope), so it is free and ungated — the prone "Knocked
 * Prone" precedent.
 *
 * Speed 0 is enforced where the movement facts live, not here (the grappled
 * module's comment carries the full story): halted masks remaining and
 * effective_total while speed/total stay live for derived math. Any rest
 * clears the condition (umbrella default; `untilShortRest`, a long rest
 * includes a short) plus manual ActiveStateStrip chip dismissal.
 *
 * Foundational, so no search meta.
 */
const conditionRestrained: RuleModule = {
  id: 'condition-restrained',
  offer: () => [
    {
      id: 'record-restrained',
      ui: {
        section: 'free',
        name: `${CR}.record-restrained.name`,
        detailKey: 'condition/restrained',
        intents: { CONDITION: 'restrained' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [restrainedEffect()]
      })
    }
  ],
  // While restrained, a NOTICE carries the standing effects (SRD verbatim minus
  // the engine-enforced facts — the vs-you Advantage half is text only, nothing
  // live to interpolate). 'notice' == NOTICE_TARGET; rule modules may import
  // only the builder, so the reserved label is a literal here (see
  // condition-prone / -poisoned / -grappled).
  annotate: (f): Annotation[] =>
    f.num('condition.restrained') > 0
      ? [
          {
            key: `${CR}.notice`,
            targets: ['notice'],
            source: `${CR}.effect-restrained.name`,
            body: `${CR}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionRestrained);
