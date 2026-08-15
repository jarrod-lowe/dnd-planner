import {
  defineRule,
  HIT_DIE_SIZES,
  type ActionResult,
  type Diagnostic,
  type EffectInstance,
  type Offer,
  type RuleModule
} from '../builder';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const CE = 'rule.dnd-5e-2024.core-events';

/**
 * The rest-flag effect both rest recorders advertise: sets the flag for this
 * evaluation (consumed by the rest groups), aging out at end of turn.
 */
const restFlag = (fact: string): EffectInstance => ({
  id: 'rest',
  state: { [fact]: 1 },
  expiry: { kind: 'endOfTurn' }
});

/** A record-save offer for one ability: a d20 + save bonus, with a pass/fail. */
function saveOffer(a: string): Offer {
  return {
    id: `record-save-${a}`,
    ui: {
      section: 'free',
      name: `planner.record.save.${a}`,
      // Riders targeting saves attach here: `save.any` for every save (Aura of
      // Protection), `save.{ability}` for ability-specific bonuses. The
      // `.companion` forms on the steed's rows are deliberately distinct so a
      // self-only bonus cannot leak onto the mount (matching is set intersection).
      annotationLabels: ['save.any', `save.${a}`],
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'saveBonus' }, purpose: 'save' }]
      },
      secondaryControl: {
        type: 'segmented',
        var: 'passed',
        options: [
          { value: -1, label: 'planner.record.outcome.none' },
          { value: 1, label: 'planner.record.passed' },
          { value: 0, label: 'planner.record.failed' }
        ]
      },
      intents: { SAVE: 'you' },
      actionCost: []
    },
    vars: {
      saveBonus: { capture: true, default: { fact: `${a}.save` } },
      passed: { capture: true, default: { number: -1 } }
    },
    apply: (_f, selections): ActionResult => {
      const passed = typeof selections.passed === 'number' ? selections.passed : -1;
      // Keyed so the latest save recorded this turn wins.
      return {
        advertise: [
          {
            id: 'save',
            key: 'save-last-result',
            state: { 'event.save-last-result': passed },
            expiry: { kind: 'endOfTurn' }
          }
        ]
      };
    }
  };
}

/** Set a rest flag for the current evaluation (consumed by the rest groups). */
function restOffer(id: string, fact: string): Offer {
  return {
    id,
    ui: {
      section: 'rest',
      name: `planner.record.rest.${id === 'record-long-rest' ? 'long' : 'short'}`,
      intents: { REST: 'rest' },
      actionCost: []
    },
    apply: (): ActionResult => ({ advertise: [restFlag(fact)] })
  };
}

/**
 * The hit-dice roller control on the short-rest offer: one pool per die size,
 * each resolved from the live `hitDie.*` facts at render time (an offer's `ui`
 * is authored once, so dynamic sizes ride ValueSources, not authored entries).
 * The renderer draws `total` slot rollers per pool; slots at index >=
 * `remaining` are spent and render disabled.
 *
 * Deliberately NOT typed against the renderer's `HitDiceControl` — rule
 * modules may import only `../builder` (confinement), so the payload is plain
 * data that the panel-renderer types describe on their side.
 */
function hitDiceControl(): Record<string, unknown> {
  return {
    type: 'hit-dice',
    unit: 'hp',
    bonus: { fact: 'con.modifier' },
    pools: HIT_DIE_SIZES.map((n) => ({
      sides: n,
      total: { fact: `hitDie.d${n}.total` },
      remaining: { fact: `hitDie.d${n}.remaining` }
    }))
  };
}

/**
 * The short rest, with hit-dice spending. Rolled slots arrive via
 * `selections.rolls` as `{ d10: { '0': 6 } }` — slot index → NATURAL roll
 * (1..sides); the CON bonus and the 1-HP floor are applied here, engine-side.
 *
 * Each rolled slot advertises ONE keyless `untilLongRest` effect carrying both
 * the heal (`max(1, roll + con.modifier)`, capped at the missing HP — the
 * record-heal pattern, so surplus isn't banked) and the die spend, so the
 * health chip is removable and removing it refunds the die with the HP. A die
 * rolled with nothing left to heal still spends (5e). The long-rest reset is
 * free: the spends age out with a long rest like Lay on Hands.
 *
 * Cross-size attribution of the missing-HP budget is deterministic: sizes are
 * consumed in ascending order (d6 before d12), slots ascending within a size,
 * so the capped-to-zero heals always land on the LAST chips in that order and
 * the UI can predict which chip carries the capped amount.
 */
function shortRestOffer(): Offer {
  return {
    id: 'record-short-rest',
    ui: {
      section: 'rest',
      name: 'planner.record.rest.short',
      intents: { REST: 'rest' },
      actionCost: [],
      primaryControl: hitDiceControl()
    },
    apply: (f, selections): ActionResult => {
      const advertise: EffectInstance[] = [restFlag('rest.short')];
      const diagnostics: Diagnostic[] = [];
      const rolls = (selections.rolls ?? {}) as Record<string, Record<string, unknown>>;
      let missing = Math.max(0, -f.num('hp.modifier.current'));
      const con = f.num('con.modifier');
      for (const n of HIT_DIE_SIZES) {
        const sizeRolls = rolls[`d${n}`];
        if (!sizeRolls) continue;
        const total = f.num(`hitDie.d${n}.total`);
        const remaining = f.num(`hitDie.d${n}.remaining`);
        for (const slot of Object.keys(sizeRolls).sort((a, b) => Number(a) - Number(b))) {
          const index = Number(slot);
          const roll = Number(sizeRolls[slot]);
          if (!Number.isInteger(index) || index < 0 || index >= total) {
            diagnostics.push({
              code: `${CE}.record-short-rest-offer.invalid_slot`,
              severity: 'error'
            });
            continue;
          }
          if (index >= remaining) {
            diagnostics.push({
              code: `${CE}.record-short-rest-offer.die_already_spent`,
              severity: 'error'
            });
            continue;
          }
          if (!Number.isInteger(roll) || roll < 1 || roll > n) {
            diagnostics.push({
              code: `${CE}.record-short-rest-offer.invalid_roll`,
              severity: 'error'
            });
            continue;
          }
          const effective = Math.min(Math.max(1, roll + con), missing);
          missing -= effective;
          advertise.push({
            id: 'effect-hit-die-heal',
            state: { 'hp.modifier.current': effective, [`hitDie.d${n}.spent`]: 1 },
            display: {
              name: `${CE}.effect-hit-die-heal.name`,
              section: 'health',
              value: effective
            },
            expiry: { kind: 'untilLongRest' }
          });
        }
      }
      return { advertise, diagnostics };
    }
  };
}

/**
 * Core events: the always-available recorders — damage, healing, saving throws,
 * ability checks, short/long rest, and a freeform note.
 *
 * Damage and healing flow through `hp.modifier.current` as `untilLongRest`
 * effects (negative for damage, positive for healing); the `hp.current` derive
 * clamps the total at the max, so over-heal is bounded without an imperative
 * clamp. Rest recorders set `rest.short` / `rest.long` for the evaluation; the engine
 * ages rest-scoped resources at endTurn, so the resource RESET on rest is the
 * concern of the resource groups, not here. The short rest also spends hit dice
 * (see `shortRestOffer`). Recording damage while concentrating also trips
 * `concentration.damage-taken` (the concentration group's check
 * trigger). Foundational, so no search meta.
 */
const coreEvents: RuleModule = {
  id: 'core-events',
  offer: () => [
    {
      id: 'record-damage',
      ui: {
        section: 'free',
        name: 'planner.record.damage',
        primaryControl: {
          type: 'slider',
          var: 'amount',
          min: { number: 0 },
          max: { fact: 'hp.max' },
          unit: 'hp'
        },
        intents: { HEALTH: 'hp' },
        actionCost: []
      },
      vars: { amount: { capture: true, default: { number: 0 } } },
      apply: (f, selections): ActionResult => {
        const amount = typeof selections.amount === 'number' ? selections.amount : 0;
        const advertise: EffectInstance[] = [
          // id is what the scenarios assert (effect-hp-damage).
          {
            id: 'effect-hp-damage',
            state: { 'hp.modifier.current': -amount },
            // The chip name is `Damage {{score}}`; records are keyless and stack,
            // so each carries its own amount as a display literal.
            display: {
              name: 'rule.dnd-5e-2024.core-events.effect-hp-damage.name',
              section: 'health',
              value: amount
            },
            expiry: { kind: 'untilLongRest' }
          }
        ];
        // Taking damage while concentrating (the slot is held → remaining ≤ 0)
        // trips the concentration group's check trigger. Keyed + endOfTurn so it
        // lasts only this turn and a planned concentration-check can clear it
        // (same key, newest wins). Gated on the group being loaded so it never
        // sets a phantom fact when concentration isn't in play.
        if (f.has('concentration.remaining') && f.num('concentration.remaining') <= 0) {
          advertise.push({
            id: 'concentration-damage-taken',
            key: 'concentration-damage-taken',
            state: { 'concentration.damage-taken': 1 },
            expiry: { kind: 'endOfTurn' }
          });
        }
        return { advertise };
      }
    },
    {
      id: 'record-heal',
      ui: {
        section: 'free',
        name: 'planner.record.heal',
        annotationLabels: ['healing.any'],
        primaryControl: {
          type: 'slider',
          var: 'amount',
          min: { number: 0 },
          max: { fact: 'hp.max' },
          unit: 'hp'
        },
        intents: { HEALTH: 'hp' },
        actionCost: []
      },
      vars: { amount: { capture: true, default: { number: 0 } } },
      apply: (f, selections): ActionResult => {
        const amount = typeof selections.amount === 'number' ? selections.amount : 0;
        // Effective healing caps at the HP missing when it is recorded (5e:
        // regained HP cannot exceed the max — the surplus is simply lost). The
        // hp.current clamp only HIDES a positive modifier; persisting the raw
        // amount would bank the surplus and pre-cancel damage taken later
        // (heal 15 on 10 damage, then take 7 → −2 instead of −7).
        const missing = Math.max(0, -f.num('hp.modifier.current'));
        const effective = Math.min(amount, missing);
        return {
          advertise: [
            // id is what the scenarios assert (effect-hp-heal).
            {
              id: 'effect-hp-heal',
              state: { 'hp.modifier.current': effective },
              // The chip name is `Healing {{score}}`; show the EFFECTIVE amount —
              // the same value the effect records (surplus healing is lost).
              display: {
                name: 'rule.dnd-5e-2024.core-events.effect-hp-heal.name',
                section: 'health',
                value: effective
              },
              expiry: { kind: 'untilLongRest' }
            }
          ]
        };
      }
    },
    ...ABILITIES.map(saveOffer),
    {
      id: 'record-check',
      ui: {
        section: 'free',
        name: 'planner.record.check',
        annotationLabels: ['dice.any'],
        primaryControl: {
          type: 'dice-line',
          dice: [{ sides: 20, purpose: 'check' }]
        },
        intents: { CHECK: 'skill' },
        actionCost: []
      }
    },
    shortRestOffer(),
    restOffer('record-long-rest', 'rest.long'),
    {
      id: 'record-note',
      ui: {
        section: 'free',
        name: 'planner.record.note',
        primaryControl: { type: 'text', var: 'text', multiline: true },
        intents: { NOTE: 'freeform' },
        actionCost: []
      },
      vars: { text: { capture: true, default: { string: '' } } }
    }
  ]
};

export default defineRule(coreEvents);
