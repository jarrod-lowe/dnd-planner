import { defineRule, type ActionResult, type EffectInstance, type Offer, type RuleModule } from '../builder';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/** A record-save offer for one ability: a d20 + save bonus, with a pass/fail. */
function saveOffer(a: string): Offer {
  return {
    id: `record-save-${a}`,
    ui: {
      section: 'free',
      name: `planner.record.save.${a}`,
      primaryControl: { type: 'dice-line', dice: [{ sides: 20, bonus: { var: 'saveBonus' }, purpose: 'save' }] },
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
      // Keyed so the latest save recorded this turn wins (v1 used numberSet).
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
    ui: { section: 'rest', name: `planner.record.rest.${id === 'record-long-rest' ? 'long' : 'short'}`, intents: { REST: 'rest' }, actionCost: [] },
    apply: (): ActionResult => ({
      advertise: [{ id: 'rest', state: { [fact]: 1 }, expiry: { kind: 'endOfTurn' } }]
    })
  };
}

/**
 * Core events: the always-available recorders — damage, healing, saving throws,
 * ability checks, short/long rest, and a freeform note.
 *
 * Damage and healing flow through `hp.modifier.current` as `untilLongRest`
 * effects (negative for damage, positive for healing); the `hp.current` derive
 * clamps the total at the max, so over-heal is bounded without an imperative
 * clamp. Rest recorders set `rest.short` / `rest.long` for the evaluation; v2
 * ages rest-scoped resources at endTurn, so the resource RESET on rest is the
 * concern of the resource groups, not here. Concentration's damage trigger is
 * deferred until the concentration group ports (it has nothing to validate it
 * here). Foundational, so no search meta.
 */
const coreEvents: RuleModule = {
  id: 'core-events',
  offer: () => [
    {
      id: 'record-damage',
      ui: {
        section: 'free',
        name: 'planner.record.damage',
        primaryControl: { type: 'slider', var: 'amount', min: { number: 0 }, max: { fact: 'hp.max' }, unit: 'hp' },
        intents: { HEALTH: 'hp' },
        actionCost: []
      },
      vars: { amount: { capture: true, default: { number: 0 } } },
      apply: (_f, selections): ActionResult => {
        const amount = typeof selections.amount === 'number' ? selections.amount : 0;
        const advertise: EffectInstance[] = [
          // id matches the v1 effect (scenarios assert effect-hp-damage).
          { id: 'effect-hp-damage', state: { 'hp.modifier.current': -amount }, expiry: { kind: 'untilLongRest' } }
        ];
        return { advertise };
      }
    },
    {
      id: 'record-heal',
      ui: {
        section: 'free',
        name: 'planner.record.heal',
        annotationLabels: ['healing.any'],
        primaryControl: { type: 'slider', var: 'amount', min: { number: 0 }, max: { fact: 'hp.max' }, unit: 'hp' },
        intents: { HEALTH: 'hp' },
        actionCost: []
      },
      vars: { amount: { capture: true, default: { number: 0 } } },
      apply: (_f, selections): ActionResult => {
        const amount = typeof selections.amount === 'number' ? selections.amount : 0;
        // Reduces accumulated damage; the hp.current clamp caps at hp.max.
        return {
          advertise: [
            // id matches the v1 effect (scenarios assert effect-hp-heal).
            { id: 'effect-hp-heal', state: { 'hp.modifier.current': amount }, expiry: { kind: 'untilLongRest' } }
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
        primaryControl: { type: 'dice-line', dice: [{ sides: 20, purpose: 'check' }], annotationLabels: ['dice.any'] },
        intents: { CHECK: 'skill' },
        actionCost: []
      }
    },
    restOffer('record-short-rest', 'rest.short'),
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
