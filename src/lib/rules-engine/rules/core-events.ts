import {
  defineRule,
  HIT_DIE_SIZES,
  hpRecorders,
  type ActionResult,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type Offer,
  type RuleModule
} from '../builder';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const CE = 'rule.dnd-5e-2024.core-events';

/**
 * Taking damage while concentrating (the slot is held → remaining ≤ 0) trips
 * the concentration group's check trigger, carrying the amount so the reminder
 * can SAY the save DC (SRD 5.2: the DC equals 10 or half the damage taken,
 * round down, whichever is higher, max 30 — computed by the concentration
 * group's annotation, not here). Keyed + endOfTurn so it lasts only this turn
 * and a planned concentration-check can clear it (same key, newest wins).
 * Newest-wins is an accepted limitation: damage rows batched before any check
 * is resolved collapse into ONE check at the latest row's DC (the first save is
 * skipped) — the supported flow is interleaved (record damage, resolve the
 * check, record the next), and a faithful fix needs a pending-damage queue the
 * engine deliberately lacks. Its sibling — a resolved check's captured DC not
 * following later edits of its damage row — is owned by the `dc` capture in the
 * concentration group. Gated on the group being loaded so it never sets a
 * phantom fact when concentration isn't in play, and on the amount: a row left
 * at the slider's default 0 is no damage taken, so it must not put a
 * concentration check in front of the player.
 *
 * The PLAYER-ONLY extra the shared HP recorder carries via `onDamageRecorded`
 * (a steed never concentrates, a vehicle has nobody concentrating): it fires
 * only when a damage record LANDS — a Use-Threshold blow bounced by a (seeded)
 * damage threshold took no damage, so it owes no check, while an
 * Ignore-Threshold correction is damage taken and owes one like any blow.
 */
const concentrationDamageMarker = (f: FactReader, amount: number): EffectInstance[] =>
  amount > 0 && f.has('concentration.remaining') && f.num('concentration.remaining') <= 0
    ? [
        {
          id: 'concentration-damage-taken',
          key: 'concentration-damage-taken',
          state: {
            'concentration.damage-taken': 1,
            'concentration.last-damage': amount
          },
          expiry: { kind: 'endOfTurn' }
        }
      ]
    : [];

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
      // `dice.any` because this panel rolls a d20: Heroic Inspiration rerolls
      // "any die", saving throws emphatically included.
      annotationLabels: ['save.any', `save.${a}`, 'dice.any'],
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'saveBonus' }, purpose: 'save' }],
        // A save suffers disadvantage like any other roll (the record-check
        // shape): the Restrained condition writes the DEX fact — the other
        // five abilities have no writers yet (dead wiring until future
        // derivers land). PanelDiceLine resolves a truthy source → default
        // roll mode 'disadvantage'; a per-die manual override still wins.
        advantage: { fact: `save.${a}.disadvantage` }
      },
      secondaryControl: {
        type: 'segmented',
        var: 'passed',
        prefix: 'play.choices.save.outcome',
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

/**
 * Set a rest flag for the current evaluation (consumed by the rest groups).
 *
 * The panel carries the rest signal it sets as its annotation label, so
 * rest-scoped advice can find it: prepared-spells' "you can swap a spell"
 * reminder targets `rest.long` (the long rest is the only caller today; the
 * short rest has its own offer above).
 */
function restOffer(id: string, fact: string): Offer {
  return {
    id,
    ui: {
      section: 'rest',
      name: `planner.record.rest.${id === 'record-long-rest' ? 'long' : 'short'}`,
      annotationLabels: [fact],
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
      // Hit dice are dice, and Heroic Inspiration rerolls "any die".
      annotationLabels: ['dice.any'],
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
        // Guarded like record-damage's concentration check: a plan may carry
        // rolls under a rule set lacking the hit-die group (groups changed after
        // the plan was built). Absent facts no-op the rolls silently instead of
        // erroring invalid_slot against pools that do not exist.
        if (!f.has(`hitDie.d${n}.total`)) continue;
        const total = f.num(`hitDie.d${n}.total`);
        // COMMITTED-only availability. The plan fold derives an action's facts
        // from `committed + advertised-so-far`, and a rest row's own advertised
        // spends are pushed only AFTER its apply runs — so `remaining` here
        // already excludes this row's own pending rolls. It shrinks only when an
        // EARLIER rest's spend was aged into `committed` at end of turn, which is
        // exactly the spend a `die_already_spent` should reject. (The UI panel,
        // by contrast, resolves its facts POST-plan, so its own rolls DO shrink
        // its `remaining` — that offset lives in PanelHitDice, not here.)
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
/**
 * The player's own damage/heal recorders, on the shared factory (the steed and
 * the Tormentor ride the same code path). Keyless stacking records — each hit
 * its own removable chip holding its own amount — with the player-ONLY
 * concentration trigger riding `onDamageRecorded`. The threshold fact is the
 * player's natural `hp.damageThreshold`: nothing derives it, so it reads 0,
 * the recorder never gates and the threshold-mode control never renders today;
 * a future subject that bakes one adapts the recorder for free (bounce
 * annotation in this namespace).
 */
const HP_RECORDERS = hpRecorders({
  idStem: 'record',
  facts: {
    max: 'hp.max',
    modifierCurrent: 'hp.modifier.current',
    damageThreshold: 'hp.damageThreshold'
  },
  damage: {
    name: 'planner.record.damage',
    // The recorder idiom (record-heal carries 'healing.any'): the panel the
    // post-hoc damage reminders ride — concentration's
    // save-to-keep-the-spell annotation (with the computed DC) while the slot
    // is held, and the below-threshold bounce annotation while its marker
    // stands.
    annotationLabels: ['damage.any'],
    // The ids are what the scenarios assert (effect-hp-damage / -heal).
    effectId: 'effect-hp-damage',
    effectName: `${CE}.effect-hp-damage.name`
  },
  heal: {
    name: 'planner.record.heal',
    annotationLabels: ['healing.any'],
    effectId: 'effect-hp-heal',
    effectName: `${CE}.effect-hp-heal.name`
  },
  accumulation: 'keyless-stack',
  chipSection: 'health',
  bounce: {
    effectId: 'effect-hp-bounce',
    annotationKey: `${CE}.record-damage.below_threshold`
  },
  onDamageRecorded: concentrationDamageMarker
});

const coreEvents: RuleModule = {
  id: 'core-events',
  offer: () => [
    ...HP_RECORDERS.offers,
    ...ABILITIES.map(saveOffer),
    {
      id: 'record-check',
      ui: {
        section: 'free',
        name: 'planner.record.check',
        // The skill rollers' label scheme: check.any scopes check-wide
        // attribution chips (Poisoned) without leaking them onto saves.
        annotationLabels: ['check.any', 'dice.any'],
        primaryControl: {
          type: 'dice-line',
          dice: [{ sides: 20, purpose: 'check' }],
          // A generic ability check suffers disadvantage like any other (the
          // Poisoned condition writes this fact; the Restrained save-wiring
          // shape).
          advantage: { fact: 'check.disadvantage' }
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
  ],
  // The recorders' annotate share — the below-threshold bounce annotation on
  // the damage panel (threshold model v2: the feedback is informational, and
  // it stands only while the bounce marker does). The player has no other
  // annotate output today.
  annotate: HP_RECORDERS.annotate
};

export default defineRule(coreEvents);
