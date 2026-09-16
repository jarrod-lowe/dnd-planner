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
  // While the slot is held, an annotation carries the damage-save rule (DC 10,
  // or half the damage taken, whichever is higher — 2024). The reminder is
  // post-hoc — it matters when the player records damage — so it rides the
  // record-damage panel via its 'damage.any' annotationLabel (the recorder
  // idiom: record-heal carries 'healing.any'), not the notices strip. Panels
  // render the label only ($t(annotation.key), no values), so the DC 10 rule
  // text is baked into the label copy. Rule modules may import only the
  // builder, so the label is a literal here and the unit test pins it to the
  // recorder's declared annotationLabels. Keys sit in the module's existing
  // planner.concentration.* namespace (the check offer's name key).
  annotate: (f): Annotation[] =>
    f.num('concentration.remaining') <= 0
      ? [{ key: `${P}.annotation`, targets: ['damage.any'] }]
      : [],
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
            // fold) clears damage-taken back to 0 (newest wins).
            {
              id: 'concentration-damage-taken',
              key: 'concentration-damage-taken',
              state: { 'concentration.damage-taken': 0 },
              expiry: { kind: 'endOfTurn' }
            }
          ]
        };
      }
    }
  ]
};

export default defineRule(concentration);
