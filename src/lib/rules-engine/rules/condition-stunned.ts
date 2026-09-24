import {
  concentrationBreakEffects,
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CS = 'rule.dnd-5e-2024.condition-stunned';

/**
 * The keyed stunned effect the recorder commits: `key: 'stunned'` so repeat
 * records evict rather than stack. It writes BOTH facts in its OWN state —
 * `condition.stunned` (nothing else reads it yet) AND
 * `condition.incapacitated` DIRECTLY (the wave-3 composition parent's
 * contract: both facts die with this effect; the child imports nothing from
 * the parent, the shared fact name IS the coupling).
 * `condition.incapacitated` carries `stateCombine: 'max'` — mandatory, not
 * stylistic: `effect-incapacitated` writes it `max` and sheet.ts THROWS on
 * conflicting combine modes when standalone Incapacitated co-stands (a
 * default-sum child effect = engine error; pinned by the
 * condition-stunned-with-incapacitated scenario).
 */
const stunnedEffect = (): EffectInstance => ({
  id: 'effect-stunned',
  key: 'stunned',
  state: { 'condition.stunned': 1, 'condition.incapacitated': 1 },
  stateCombine: { 'condition.incapacitated': 'max' },
  display: { name: `${CS}.effect-stunned.name`, detailKey: 'condition/stunned' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Stunned — wave 5, the SMALLEST composition child (with Paralyzed and
 * Petrified). SRD 5.2: Incapacitated (composed — the parent's economy clamps
 * and Surprised initiative derive read the shared fact, inherited for free),
 * Saving Throws Affected (auto-fail STR/DEX), Attacks Affected (vs-you
 * Advantage). One free-section RECORDER models BEING STUNNED (imposed by an
 * enemy effect — a stunning strike, a psionic blast), so it is free and
 * ungated — the prone "Knocked Prone" precedent.
 *
 * THE TRIO DIVERGENCE: SRD Stunned imposes NO Speed 0 and sits OUTSIDE
 * movement.ts's halted derive list (the five Speed-0 conditions) — walk stays
 * legal, movement is untouched, and there is no move-illegal scenario or
 * movement dep (pinned by the condition-stunned-record scenario).
 *
 * No Concentration is the record apply's conditional break: writing the
 * composed fact does NOT evict a held spell (the fact alone is offer-inert),
 * so the recorder invokes the shared builder helper the parent's does —
 * eviction + marker clear, only while a hold is live (the helper returns []
 * with nothing held, so no phantom chip records).
 *
 * Auto-fail STR/DEX saves (auto-fail ≠ disadvantage — its own future
 * semantic) and vs-you Advantage are NPC-side — notice text (prone
 * precedent). Any rest clears the condition (umbrella default;
 * `untilShortRest`, a long rest includes a short) plus manual
 * ActiveStateStrip chip dismissal; SRD gives no mechanical end (the source
 * effect ends it), so there is no end offer.
 *
 * Foundational, so no search meta.
 */
const conditionStunned: RuleModule = {
  id: 'condition-stunned',
  offer: () => [
    {
      id: 'record-stunned',
      ui: {
        section: 'free',
        name: `${CS}.record-stunned.name`,
        detailKey: 'condition/stunned',
        intents: { CONDITION: 'stunned' },
        actionCost: []
      },
      apply: (f): ActionResult => ({
        advertise: [stunnedEffect(), ...concentrationBreakEffects(f)]
      })
    }
  ],
  // While stunned, a NOTICE carries the standing effects (SRD verbatim minus
  // the engine-enforced Incapacitated fact — auto-fail saves and vs-you
  // Advantage are text only, nothing live to interpolate). 'notice' ==
  // NOTICE_TARGET; rule modules may import only the builder, so the reserved
  // label is a literal here (see condition-prone / -poisoned / -grappled).
  annotate: (f): Annotation[] =>
    f.num('condition.stunned') > 0
      ? [
          {
            key: `${CS}.notice`,
            targets: ['notice'],
            source: `${CS}.effect-stunned.name`,
            body: `${CS}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionStunned);
