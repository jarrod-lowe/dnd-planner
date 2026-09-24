import {
  concentrationBreakEffects,
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CPE = 'rule.dnd-5e-2024.condition-petrified';

/**
 * The keyed petrified effect the recorder commits: `key: 'petrified'` so
 * repeat records evict rather than stack. It writes BOTH facts in its OWN
 * state — `condition.petrified` (movement.ts's halted derive already reads
 * it, the grappled Speed-0 family, so halted + the remaining/effective_total
 * mask + every halted gate come free) AND `condition.incapacitated` DIRECTLY
 * (the wave-3 composition parent's contract: both facts die with this
 * effect; the child imports nothing from the parent, the shared fact name IS
 * the coupling). `condition.incapacitated` carries `stateCombine: 'max'` —
 * mandatory, not stylistic: `effect-incapacitated` writes it `max` and
 * sheet.ts THROWS on conflicting combine modes when standalone Incapacitated
 * co-stands (a default-sum child effect = engine error; pinned by the
 * condition-petrified-with-incapacitated scenario).
 */
const petrifiedEffect = (): EffectInstance => ({
  id: 'effect-petrified',
  key: 'petrified',
  state: { 'condition.petrified': 1, 'condition.incapacitated': 1 },
  stateCombine: { 'condition.incapacitated': 'max' },
  display: { name: `${CPE}.effect-petrified.name`, detailKey: 'condition/petrified' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Petrified — wave 5, second of the composition trio (with Paralyzed and
 * Stunned). SRD 5.2: Turned to Inanimate Substance (stone, weight ×10, cease
 * aging), Incapacitated (composed — the parent's economy clamps and Surprised
 * initiative derive read the shared fact, inherited for free), Speed 0
 * (halted — movement.ts owns it), Attacks Affected (vs-you Advantage), Saving
 * Throws Affected (auto-fail STR/DEX), Resist Damage (all damage), Poison
 * Immunity (the Poisoned condition). One free-section RECORDER models BEING
 * PETRIFIED (imposed by an enemy effect — a gorgon's breath, flesh to stone),
 * so it is free and ungated — the prone "Knocked Prone" precedent.
 *
 * No Concentration is the record apply's conditional break: writing the
 * composed fact does NOT evict a held spell (the fact alone is offer-inert),
 * so the recorder invokes the shared builder helper the parent's does —
 * eviction + marker clear, only while a hold is live (the helper returns []
 * with nothing held, so no phantom chip records).
 *
 * Turned-to-stone flavour, auto-fail STR/DEX saves (auto-fail ≠
 * disadvantage — its own future semantic), vs-you Advantage, resist-all
 * damage (no resistance modelling exists — the damage recorder is
 * free-entry, the player halves themselves) and the Poisoned immunity are
 * notice text. Recording an immunity ≠ enforcing it: a standing Poisoned
 * effect is NOT auto-evicted (condition immunities are the umbrella's global
 * out-of-scope; mechanisation recorded there as a future idea). Any rest
 * clears the condition (umbrella default; `untilShortRest`, a long rest
 * includes a short) plus manual ActiveStateStrip chip dismissal; SRD gives
 * no mechanical end (the source effect ends it), so there is no end offer.
 *
 * Foundational, so no search meta.
 */
const conditionPetrified: RuleModule = {
  id: 'condition-petrified',
  offer: () => [
    {
      id: 'record-petrified',
      ui: {
        section: 'free',
        name: `${CPE}.record-petrified.name`,
        detailKey: 'condition/petrified',
        intents: { CONDITION: 'petrified' },
        actionCost: []
      },
      apply: (f): ActionResult => ({
        advertise: [petrifiedEffect(), ...concentrationBreakEffects(f)]
      })
    }
  ],
  // While petrified, a NOTICE carries the standing effects (SRD verbatim
  // minus the engine-enforced facts — Speed 0 via halted, Incapacitated via
  // the composed fact; stone flavour, auto-fail saves, vs-you Advantage,
  // resist-all and the Poisoned immunity are text only, nothing live to
  // interpolate). 'notice' == NOTICE_TARGET; rule modules may import only
  // the builder, so the reserved label is a literal here (see condition-prone
  // / -poisoned / -grappled).
  annotate: (f): Annotation[] =>
    f.num('condition.petrified') > 0
      ? [
          {
            key: `${CPE}.notice`,
            targets: ['notice'],
            source: `${CPE}.effect-petrified.name`,
            body: `${CPE}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionPetrified);
