import {
  defineRule,
  type ActionResult,
  type Annotation,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type RestKind,
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
 * The level-0 END of the condition (the get-up prone-ended idiom): an EMPTY
 * same-`key` effect that newest-wins-evicts the level effect while merely
 * planned and merges permanently at endTurn, so `condition.exhaustion`
 * reverts to 0 and the notice and riders vanish with it. Its display name is
 * the DISTINCT ended label — reusing `.effect-exhaustion.name` would read
 * "Exhaustion" on the strip after everything the condition meant is gone
 * (the off-by-one trap: 2 → 1 never exercises this branch, so only the
 * 1 → 0 leg can strand a wrong label). No `state`: the eviction's whole job
 * is to carry the key and the label, never a fact.
 */
const exhaustionEnded = (): EffectInstance => ({
  id: 'exhaustion-ended',
  key: 'exhaustion',
  display: { name: `${CE}.long-rest-clear.name` },
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
 * by 2 × level (the three flat riders below), Speed reduced by 5 × level (the
 * derive above), a Long Rest removes exactly one level (the onRest hook
 * below). One free-section RECORDER models RECEIVING the condition (imposed —
 * forced march, starvation, frenzy; sources are out of scope), the
 * record-prone shape with a number: its apply reads the FOLDED prior level
 * and advertises the keyed effect at prior + 1, so two records the same turn
 * land on level 2 (the fold re-derives per row and the sheet folds after
 * keyed dedupe — row 2 sees row 1's effect).
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
  // SRD 5.2 Removing Exhaustion Levels: "Finishing a Long Rest removes 1 of
  // your Exhaustion levels. When your Exhaustion level reaches 0, the
  // condition ends." Rest expiry cannot express a decrement (it clears whole
  // effects), so this is the onRest hook (the Channel Divinity precedent):
  // the hook reads the PRE-rest boundary state and advertises the SAME keyed
  // effect one level lower, newest-wins replacing the committed one within
  // the very evaluation the rest is recorded; at level 1 the decrement IS
  // the end — the empty-key eviction with its distinct ended label. A short
  // rest removes NOTHING (SRD gives the removal to the Long Rest alone).
  //
  // ACCEPTED EDGE (plan.ts's documented post-rest-row blindness): hook
  // effects SPLICE at the rest boundary, so a record planned AFTER the rest
  // stays chronologically newer and keyed newest-wins keeps it — the GAIN
  // survives, the DECREMENT is swallowed (2 → rest → record → 3, not 1).
  // Gain-then-rest is correct (the hook reads the post-gain boundary state
  // and its effect splices after the recorder row, winning). Pinned in
  // condition-exhaustion-rest-then-gain-edge; post-rest plans are the rare
  // corner plan.ts documents.
  onRest: (kind: RestKind, f: FactReader): EffectInstance[] => {
    if (kind !== 'long') return [];
    const level = f.num('condition.exhaustion');
    if (level <= 0) return [];
    return [level > 1 ? exhaustionEffect(level - 1) : exhaustionEnded()];
  },
  // While at least one level is live, a NOTICE carries the standing effects,
  // and THREE flat riders carry the D20 Test reduction onto the dice
  // themselves. 'notice' == NOTICE_TARGET; rule modules may import only the
  // builder, so the reserved label is a literal here (see condition-prone /
  // -unconscious).
  annotate: (f): Annotation[] => {
    const level = f.num('condition.exhaustion');
    if (level <= 0) return [];
    // SRD 5.2 D20 Tests Affected: "When you make a D20 Test, the roll is
    // reduced by 2 times your Exhaustion level" — a RIDER, not a derive (the
    // Aura of Protection precedent: the ROLL is reduced, so the attack and
    // save modifiers and the top bar stay untouched). `appliesTo` is
    // single-purpose, so one annotation per D20 Test kind, each aimed at the
    // label map its dice declare: attack.any (every weapon + unarmed;
    // companion `.companion` labels are deliberately unreachable — the steed
    // has no Exhaustion), dice.any (the 18 skills, record-check, Roll
    // Initiative and Alert's secondary — Initiative IS a D20 Test, a Dex
    // check), save.any (the 6 save recorders + concentration). PanelDiceLine
    // shows a chip only where a die's purpose equals `appliesTo`, so the
    // check rider never leaks onto a weapon's damage die even though weapon
    // panels also carry dice.any. The chip is TOGGLEABLE (no locked rider
    // variant exists) — a mandatory penalty the player can switch off;
    // accepted channel limitation. These are the first to-hit/check flat
    // riders; the negative-value chip render is pinned in
    // PanelDiceLine-summary.test.ts.
    const d20Rider = (
      key: string,
      target: string,
      appliesTo: 'to-hit' | 'check' | 'save'
    ): Annotation => ({
      key,
      targets: [target],
      rider: {
        label: `${CE}.rider`,
        type: 'modifier',
        value: { kind: 'flat', bonus: -2 * level },
        appliesTo,
        defaultOn: true
      }
    });
    return [
      {
        key: `${CE}.notice`,
        targets: ['notice'],
        source: `${CE}.effect-exhaustion.name`,
        // SRD 5.2: "You die if your Exhaustion level is 6" — the body
        // flips to the dead variant at the maximum.
        body: level >= MAX_LEVEL ? `${CE}.notice.body-dead` : `${CE}.notice.body`,
        values: { level, roll: -2 * level, speed: -5 * level }
      },
      d20Rider(`${CE}.rider-to-hit`, 'attack.any', 'to-hit'),
      d20Rider(`${CE}.rider-check`, 'dice.any', 'check'),
      d20Rider(`${CE}.rider-save`, 'save.any', 'save')
    ];
  }
};

export default defineRule(conditionExhaustion);
