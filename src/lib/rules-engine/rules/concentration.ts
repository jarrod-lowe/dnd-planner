import { defineRule, type ActionResult, type Annotation, type RuleModule } from '../builder';

const P = 'planner.concentration';

/**
 * Concentration: a one-slot binary resource. `remaining = max − spent`; a
 * concentration spell holds the slot via a persistent `concentration.spent`
 * effect, so a second concentration spell sees `remaining = 0` and is illegal,
 * and the hold releases when that spell's effect ends (duration or rest).
 *
 * Taking damage while concentrating (core-events' record-damage) trips
 * `concentration.damage-taken`, which surfaces the free `concentration-check`
 * offer below. Recording the check clears the marker via the SAME keyed effect
 * record-damage used (newest wins), so the "summed marker" never needs an
 * imperative mid-turn subtract. Foundational, so no search meta.
 */
const concentration: RuleModule = {
  id: 'concentration',
  derive: () => [
    { fact: 'concentration.max', value: () => 1 },
    {
      fact: 'concentration.remaining',
      value: (f) => f.num('concentration.max') - f.num('concentration.spent')
    }
  ],
  // While the slot is held AND damage was recorded while holding it, an
  // annotation carries the damage-save rule with the COMPUTED DC. The reminder
  // is post-hoc — it matters when the player records damage — so it rides the
  // record-damage panel via its 'damage.any' annotationLabel (the recorder
  // idiom: record-heal carries 'healing.any'), not the notices strip.
  // Annotations derive from the FINAL post-plan facts and render on every
  // matching row, so the gate is the step-time marker
  // `concentration.damage-taken` (record-damage sets it only when the slot
  // was held at record time): ungated, damage planned before the cast would
  // show the save instruction for a save that is not owed (SRD 5.2: only
  // damage taken while concentrating demands the check). Gated, the
  // annotation coincides with the concentration-check offer — the standing
  // undamaged heads-up on the recorder is gone by design. The damage amount
  // rides the same keyed marker (`concentration.last-damage`, newest wins),
  // so the label interpolates the DC rather than reciting the min/max prose:
  // SRD 5.2 — "The DC equals 10 or half the damage taken (round down),
  // whichever number is higher, up to a maximum DC of 30." Panels render
  // $t(annotation.key, annotation.values), the same double-brace
  // interpolation the notices strip uses for bodies. Rule modules may import
  // only the builder, so the label key is a literal here and the unit test
  // pins it to the recorder's declared annotationLabels. Keys sit in the
  // module's existing planner.concentration.* namespace (the check offer's
  // name key).
  annotate: (f): Annotation[] => {
    if (f.num('concentration.damage-taken') !== 1 || f.num('concentration.remaining') > 0)
      return [];
    // Half the damage, round down, clamped 10..30. `last-damage` is 0/unset
    // only when the marker arrived without an amount (never from
    // record-damage, which gates on amount > 0); the clamp then serves the
    // DC 10 floor — a sane label, not an undefined number.
    const dc = Math.min(30, Math.max(10, Math.floor(f.num('concentration.last-damage') / 2)));
    return [{ key: `${P}.annotation`, targets: ['damage.any'], values: { dc } }];
  },
  offer: () => [
    {
      // Surfaces only while concentrating (slot held → remaining ≤ 0) and damage
      // was taken this turn. Recording the outcome clears the trigger.
      id: 'concentration-check',
      when: (f) =>
        f.num('concentration.damage-taken') === 1 && f.num('concentration.remaining') <= 0,
      ui: {
        section: 'free',
        name: 'planner.concentration.check',
        intents: { SAVE: 'you' },
        actionCost: []
      },
      vars: { passed: { capture: true, default: { number: 1 } } },
      apply: (_f, selections): ActionResult => {
        const passed = typeof selections.passed === 'number' ? selections.passed : 1;
        return {
          advertise: [
            {
              id: 'concentration-check-result',
              key: 'concentration-check-result',
              state: { 'concentration.check-passed': passed },
              expiry: { kind: 'endOfTurn' }
            },
            // Same key as record-damage's marker → planning the check (later in the
            // fold) clears damage-taken AND its carried amount back to 0 (newest
            // wins), so a later reminder's DC cannot quote stale damage.
            {
              id: 'concentration-damage-taken',
              key: 'concentration-damage-taken',
              state: { 'concentration.damage-taken': 0, 'concentration.last-damage': 0 },
              expiry: { kind: 'endOfTurn' }
            }
          ]
        };
      }
    }
  ]
};

export default defineRule(concentration);
