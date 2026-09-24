import {
  concentrationBreakEffects,
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CPL = 'rule.dnd-5e-2024.condition-paralyzed';

/**
 * The keyed paralyzed effect the recorder commits: `key: 'paralyzed'` so
 * repeat records evict rather than stack. It writes BOTH facts in its OWN
 * state — `condition.paralyzed` (movement.ts's halted derive already reads
 * it, the grappled Speed-0 family, so halted + the remaining/effective_total
 * mask + every halted gate come free) AND `condition.incapacitated` DIRECTLY
 * (the wave-3 composition parent's contract: both facts die with this
 * effect; the child imports nothing from the parent, the shared fact name IS
 * the coupling). `condition.incapacitated` carries `stateCombine: 'max'` —
 * mandatory, not stylistic: `effect-incapacitated` writes it `max` and
 * sheet.ts THROWS on conflicting combine modes when standalone Incapacitated
 * co-stands (a default-sum child effect = engine error; pinned by the
 * condition-paralyzed-with-incapacitated scenario).
 */
const paralyzedEffect = (): EffectInstance => ({
  id: 'effect-paralyzed',
  key: 'paralyzed',
  state: { 'condition.paralyzed': 1, 'condition.incapacitated': 1 },
  stateCombine: { 'condition.incapacitated': 'max' },
  display: { name: `${CPL}.effect-paralyzed.name`, detailKey: 'condition/paralyzed' },
  expiry: { kind: 'untilShortRest' }
});

/**
 * Paralyzed — wave 5, first of the composition trio (with Petrified and
 * Stunned). SRD 5.2: Incapacitated (composed — the parent's economy clamps
 * and Surprised initiative derive read the shared fact, inherited for free),
 * Speed 0 (halted — movement.ts owns it), Saving Throws Affected
 * (auto-fail STR/DEX), Attacks Affected (vs-you Advantage), Automatic
 * Critical Hits (within 5 ft). One free-section RECORDER models BEING
 * PARALYZED (imposed by an enemy effect — hold monster, a paralyzing toxin;
 * `hold_person.ts` is the other side, our spell on others — distinct facts,
 * no overlap), so it is free and ungated — the prone "Knocked Prone"
 * precedent.
 *
 * No Concentration is the record apply's conditional break: writing the
 * composed fact does NOT evict a held spell (the fact alone is offer-inert),
 * so the recorder invokes the shared builder helper the parent's does —
 * eviction + marker clear, only while a hold is live (the helper returns []
 * with nothing held, so no phantom chip records).
 *
 * Auto-fail STR/DEX saves (auto-fail ≠ disadvantage — its own future
 * semantic, not Restrained's save-disadvantage wiring), vs-you Advantage and
 * the within-5-ft auto-crit are NPC-side — notice text (prone precedent). Any
 * rest clears the condition (umbrella default; `untilShortRest`, a long rest
 * includes a short) plus manual ActiveStateStrip chip dismissal; SRD gives no
 * mechanical end (the source effect ends it), so there is no end offer.
 *
 * Foundational, so no search meta.
 */
const conditionParalyzed: RuleModule = {
  id: 'condition-paralyzed',
  offer: () => [
    {
      id: 'record-paralyzed',
      ui: {
        section: 'free',
        name: `${CPL}.record-paralyzed.name`,
        detailKey: 'condition/paralyzed',
        intents: { CONDITION: 'paralyzed' },
        actionCost: []
      },
      apply: (f): ActionResult => ({
        advertise: [paralyzedEffect(), ...concentrationBreakEffects(f)]
      })
    }
  ],
  // While paralyzed, a NOTICE carries the standing effects (SRD verbatim
  // minus the engine-enforced facts — Speed 0 via halted, Incapacitated via
  // the composed fact; auto-fail saves, vs-you Advantage and the auto-crit
  // are text only, nothing live to interpolate). 'notice' == NOTICE_TARGET;
  // rule modules may import only the builder, so the reserved label is a
  // literal here (see condition-prone / -poisoned / -grappled).
  annotate: (f): Annotation[] =>
    f.num('condition.paralyzed') > 0
      ? [
          {
            key: `${CPL}.notice`,
            targets: ['notice'],
            source: `${CPL}.effect-paralyzed.name`,
            body: `${CPL}.notice.body`
          }
        ]
      : []
};

export default defineRule(conditionParalyzed);
