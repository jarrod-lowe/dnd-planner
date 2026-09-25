import {
  defineRule,
  type ActionResult,
  type Annotation,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const CE = 'rule.dnd-5e-2024.condition-exhaustion';
const DEAD_AT_MAX = `${CE}.record-exhaustion-offer.dead_at_max`;

/** SRD 5.2 Exhaustion Levels: "You die if your Exhaustion level is 6." */
const MAX_LEVEL = 6;

/**
 * The keyed level effect the recorder commits: `key: 'exhaustion'` so repeats
 * REPLACE rather than stack (dedupeByKey keeps the newest), which is what makes
 * the single summed `condition.exhaustion` fact THE live level — the only
 * COUNTER condition (SRD 5.2 glossary: "The Exhaustion condition is an
 * exception" to no-self-stacking). The apply always passes the level it
 * observed folded, so a newer effect never leaks an older level. The chip's
 * `display.value` is a literal baked at advertise time (the hp-modifier idiom —
 * a `displayFact` would read the same fact, but the literal stays correct even
 * if a future writer joins the fact); newest-wins rewrites the whole effect on
 * every record, so it always shows the live level.
 */
const exhaustionEffect = (level: number): EffectInstance => ({
  id: 'effect-exhaustion',
  key: 'exhaustion',
  state: { 'condition.exhaustion': level },
  display: {
    name: `${CE}.effect-exhaustion.name`,
    detailKey: 'condition/exhaustion',
    value: level
  },
  // PERMANENT, a deliberate deviation from the umbrella's untilShortRest
  // condition default: a short rest must not clear levels (SRD: only a Long
  // Rest removes one, and by exactly 1 — the onRest decrement). Manual strip
  // dismissal drops all levels at once — accepted manual override.
  expiry: { kind: 'permanent' }
});

/**
 * SRD 5.2 Speed Reduced: "Your Speed is reduced by a number of feet equal to
 * 5 times your Exhaustion level" — `combine: sum` contributions to BOTH
 * `character.movement.speed` and `character.movement.total` (the splint −10
 * shape), so remaining, the move sliders, Dash's boost, and the half-Speed
 * Get Up cost all see the reduced Speed with no movement.ts change. Reads
 * `condition.exhaustion` while writing the movement facts — a different fact,
 * so no derive cycle (splint reads `armor.splint.equipped` the same way).
 * Raw by design (the splint precedent): the contributions stack honestly even
 * below 0, and every READ that feeds a control, pool, or cost floors at 0 in
 * movement.ts (user-directed 2026-09-25, superseding this module's original
 * unclamped-everywhere line — remaining/effective_total/half_*, the slider
 * maxes, Dash's boost); at level 6 Speed reaches 0 and every existing gate
 * behaves; levels past 6 cannot occur (the clamp below).
 */
const speedPenalty = (fact: string): Contribution => ({
  fact,
  combine: 'sum',
  value: (f) => -5 * f.num('condition.exhaustion')
});

/**
 * Exhaustion — wave 8, the LAST condition and the only one that is a counter
 * rather than a flag. SRD 5.2: cumulative levels (die at 6), D20 Tests reduced
 * by 2 × level (a rider — deferred to the rider PR), Speed reduced by
 * 5 × level (the derive above), a Long Rest removes exactly one level (an
 * onRest hook — deferred to the rest PR). One free-section RECORDER models
 * RECEIVING the condition (imposed — forced march, starvation, frenzy;
 * sources are out of scope), the record-prone shape with a number: its apply
 * reads the FOLDED prior level and advertises the keyed effect at prior + 1,
 * so two records the same turn land on level 2 (the fold re-derives per row
 * and the sheet folds after keyed dedupe — row 2 sees row 1's effect).
 *
 * Death at 6 is a LEGALITY gate, not a structural one (user-directed
 * 2026-09-25, superseding the doc's UNGATED decision): the offer stays
 * visible while dead with its dead_at_max diagnostic (the illegal-but-visible
 * engine contract — diagnostics + player override, never hiding), and a
 * planned-anyway 7th row still EXECUTES but its apply clamps to
 * min(prior + 1, 6), so no plan can manufacture a level 7 — the fact, the
 * Speed penalty, and the notice all stop at 6, where the dead body flip
 * (.notice.body-dead) says what happened.
 *
 * While any level is live, a NOTICE carries the standing effects, its body
 * interpolating the live numbers (level, −2 × level on D20 Tests, −5 × level
 * Speed) via double-brace values (the prone cost idiom; the yaml grammar
 * asserts existence/targets only, so the values are unit-pinned in
 * condition-exhaustion-notice.test.ts).
 *
 * Foundational, so no search meta.
 */
const conditionExhaustion: RuleModule = {
  id: 'condition-exhaustion',
  derive: () => [
    speedPenalty('character.movement.speed'),
    speedPenalty('character.movement.total')
  ],
  offer: () => [
    {
      id: 'record-exhaustion',
      ui: {
        section: 'free',
        name: `${CE}.record-exhaustion.name`,
        detailKey: 'condition/exhaustion',
        intents: { CONDITION: 'exhaustion' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('condition.exhaustion') < MAX_LEVEL,
          diagnostics: [{ code: DEAD_AT_MAX, severity: 'error' }]
        }
      ],
      apply: (f): ActionResult => {
        const prior = f.num('condition.exhaustion');
        const diagnostics: Diagnostic[] = [];
        if (prior >= MAX_LEVEL) diagnostics.push({ code: DEAD_AT_MAX, severity: 'error' });
        return {
          // The clamp is the no-level-7 backstop: a planned-anyway row at the
          // maximum re-advertises 6, so the keyed effect (and the fact) cannot
          // move past death.
          advertise: [exhaustionEffect(Math.min(prior + 1, MAX_LEVEL))],
          diagnostics
        };
      }
    }
  ],
  // While at least one level is live, a NOTICE carries the standing effects.
  // 'notice' == NOTICE_TARGET; rule modules may import only the builder, so
  // the reserved label is a literal here (see condition-prone / -unconscious).
  annotate: (f): Annotation[] => {
    const level = f.num('condition.exhaustion');
    return level > 0
      ? [
          {
            key: `${CE}.notice`,
            targets: ['notice'],
            source: `${CE}.effect-exhaustion.name`,
            // SRD 5.2: "You die if your Exhaustion level is 6" — the body
            // flips to the dead variant at the maximum.
            body: level >= MAX_LEVEL ? `${CE}.notice.body-dead` : `${CE}.notice.body`,
            values: { level, roll: -2 * level, speed: -5 * level }
          }
        ]
      : [];
  }
};

export default defineRule(conditionExhaustion);
