import {
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CG = 'rule.dnd-5e-2024.condition-grappled';

/**
 * The keyed grappled effect the recorder commits: `key: 'grappled'` so repeat
 * records evict rather than stack. It writes `condition.grappled` —
 * movement.ts's halted derive reads it (with Restrained/Paralyzed/Petrified/
 * Unconscious, the whole Speed-0 family) and masks remaining/effective_total
 * to 0 while gating every travel offer — plus the Attacks Affected STR/DEX
 * attack-disadvantage flags the weapon and unarmed dice-lines already read
 * (so the rollers default to 2d20-take-low with zero roller changes). The
 * flags carry `stateCombine: 'max'` (the prone/blinded idiom): the armor
 * modules derive the same facts with `combine: 'max'`, and the default `sum`
 * on an effect write would conflict-throw for any armored character. The
 * flags stay UNscoped — "against any target other than the grappler" is NPC
 * identity, notice text (see the module notice).
 */
const grappledEffect = (): EffectInstance => ({
  id: 'effect-grappled',
  key: 'grappled',
  state: {
    'condition.grappled': 1,
    'attack.str.disadvantage': 1,
    'attack.dex.disadvantage': 1
  },
  stateCombine: {
    'attack.str.disadvantage': 'max',
    'attack.dex.disadvantage': 'max'
  },
  display: { name: `${CG}.effect-grappled.name`, detailKey: 'condition/grappled' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Grappled — wave 4, the Speed-0 ("halted") FOUNDATION the Restrained and
 * wave-5 conditions reuse. SRD 5.2: Speed 0 ("Your Speed is 0 and can't
 * increase"), Attacks Affected (Disadvantage vs any target other than the
 * grappler), Movable (the grappler drags/carries you at 1 extra foot per foot
 * unless you are Tiny or two sizes smaller). One free-section RECORDER models
 * BEING GRAPPLED (imposed by an enemy effect — `grapple.ts` is the other side,
 * US grappling others via hands; distinct facts, no overlap), so it is free
 * and ungated — the prone "Knocked Prone" precedent.
 *
 * Speed 0 is enforced where the movement facts live, not here: the movement
 * module derives `halted` from the five Speed-0 condition facts and masks
 * `remaining`/`effective_total` (the display reads the mask; `speed`/`total`
 * stay live for math — a condition module cannot zero them without a
 * self-reading derive, the cycle trap), and every travel offer plus dash
 * ("can't increase") and the prone get-up/drop gates gate on it. The grappler
 * exception (Disadvantage applies to every target but the grappler) and
 * Movable/drag are notice text (NPC identity is out of engine scope).
 *
 * Any rest clears the condition (umbrella default; `untilShortRest`, a long
 * rest includes a short) plus manual ActiveStateStrip chip dismissal — the
 * SRD's mechanical end is an escape check, out of scope initially.
 *
 * Foundational, so no search meta.
 */
const conditionGrappled: RuleModule = {
  id: 'condition-grappled',
  offer: () => [
    {
      id: 'record-grappled',
      ui: {
        section: 'free',
        name: `${CG}.record-grappled.name`,
        detailKey: 'condition/grappled',
        intents: { CONDITION: 'grappled' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [grappledEffect()]
      })
    }
  ],
  // While grappled, a NOTICE carries the standing effects (SRD verbatim minus
  // the engine-enforced Speed 0 — text only, nothing live to interpolate).
  // 'notice' == NOTICE_TARGET; rule modules may import only the builder, so
  // the reserved label is a literal here (see condition-prone / -poisoned).
  annotate: (f): Annotation[] =>
    f.num('condition.grappled') > 0
      ? [
          {
            key: `${CG}.notice`,
            targets: ['notice'],
            source: `${CG}.effect-grappled.name`,
            body: `${CG}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionGrappled);
