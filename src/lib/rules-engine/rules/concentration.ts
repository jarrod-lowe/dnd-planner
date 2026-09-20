import {
  CONCENTRATION_SPELL_KEY,
  concentrationDamageMarkerClear,
  defineRule,
  type ActionResult,
  type Annotation,
  type EffectInstance,
  type RuleModule
} from '../builder';

const P = 'planner.concentration';

/**
 * Concentration: a one-slot binary resource. `remaining = max − spent`; a
 * concentration spell holds the slot via a persistent, keyed
 * `concentration.spent` effect (the shared CONCENTRATION_SPELL_KEY), so a
 * second concentration spell is LEGAL (SRD 5.2: you lose Concentration on an
 * effect the moment you start casting a spell that requires Concentration) and
 * its keyed effect REPLACES the current hold — `spent` never stacks past 1 —
 * and the hold releases when that spell's effect ends (duration or rest).
 *
 * Taking damage while concentrating (core-events' record-damage) trips
 * `concentration.damage-taken`, which surfaces the free `concentration-check`
 * offer below; the recorder reminder over the damage row is TAPPABLE and
 * plans that same check. Recording the check clears the marker via the SAME keyed effect
 * record-damage used (newest wins), so the "summed marker" never needs an
 * imperative mid-turn subtract; newest-wins is also why damage rows batched
 * ahead of any check collapse into one check at the latest DC (an accepted
 * limitation, documented at the marker's authoring site in core-events). The
 * check's ROLL decides the outcome: a failed
 * save additionally advertises an empty same-key effect (the shared
 * CONCENTRATION_SPELL_KEY) that evicts the held spell — undoably while
 * planned, permanently once committed. Foundational, so no search meta.
 */
const concentration: RuleModule = {
  id: 'concentration',
  derive: () => [
    { fact: 'concentration.max', value: () => 1 },
    {
      fact: 'concentration.remaining',
      value: (f) => f.num('concentration.max') - f.num('concentration.spent')
    },
    // The save DC the damage demands, derived once so every consumer (the
    // recorder annotation's interpolated DC, the check offer's captured `dc`
    // var) reads the SAME number. SRD 5.2 — "The DC equals 10 or half the
    // damage taken (round down), whichever number is higher, up to a maximum
    // DC of 30." `last-damage` is 0/unset only when the marker arrived without
    // an amount (never from record-damage, which gates on amount > 0); the
    // clamp then serves the DC 10 floor — a sane DC, not an undefined number.
    {
      fact: 'concentration.dc',
      value: (f) => Math.min(30, Math.max(10, Math.floor(f.num('concentration.last-damage') / 2)))
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
    // The DC is the DERIVED fact (single source): the label interpolates what
    // the check itself will demand, not a second computation of it.
    return [
      {
        key: `${P}.annotation`,
        targets: ['damage.any'],
        values: { dc: f.num('concentration.dc') },
        // One tap plans the check the save demands (the divine-smite / Heroic
        // Inspiration idiom). NO seed, deliberately: the seed vocabulary can
        // only copy what the SOURCE row holds — record-damage's `amount`, the
        // raw damage, not the clamped half — so seeding the check's `dc` var
        // would corrupt the DC. The check's own `dc` capture var is the right
        // channel: this gate IS the offer's `when`, and both read the same
        // post-plan facts the store captures from at add time, so a tappable
        // reminder implies a live marker implies the captured
        // `concentration.dc` is still the DC the label interpolated (a rolled
        // check's marker clear removes the annotation with it, so the collapse
        // to the DC 10 floor can never hide under a visible button).
        addsToPlan: { offer: 'concentration-check' }
      }
    ];
  },
  offer: () => [
    {
      // Surfaces only while concentrating (slot held → remaining ≤ 0) and damage
      // was taken this turn. Recording the outcome clears the trigger.
      //
      // The ROLL decides (SRD 5.2: a CON save against the damage's DC — a pure
      // comparison, no nat-20/nat-1 auto rule; the boundary total === DC
      // passes). The panel persists the kept d20 natural into the `roll`
      // selection (0 = unrolled, 1–20 = the natural) and, because the dice
      // line FOLDS active save riders (Aura of Protection) into the total it
      // displays, the rider it captured at roll time into `riderBonus` — so
      // this apply's verdict matches the total the player watched. The DC and
      // the CON save bonus are captured at add time; an unrolled row records
      // no outcome and keeps the save owed, and a failed roll evicts the
      // concentration spell.
      id: 'concentration-check',
      when: (f) =>
        f.num('concentration.damage-taken') === 1 && f.num('concentration.remaining') <= 0,
      ui: {
        section: 'free',
        name: 'planner.concentration.check',
        // The record-save label set on a check the PLAYER rolls: save-scoped
        // riders (Aura of Protection's save.any, a CON-specific save.con)
        // reach the roller, and dice.any lets the reroll-any-die reminder
        // find it (the annotation-targets gate pins the dice label).
        annotationLabels: ['save.any', 'save.con', 'dice.any'],
        // The check is ROLLABLE: a d20 + the captured CON save bonus, the
        // record-save shape. `writeBack` persists the kept natural into the
        // `roll` selection (the var the apply above decides on) AND — via
        // `riderVar` — the active modifier total the dice line folded into
        // its displayed total (Aura of Protection, +CHA to saves) into
        // `riderBonus`, so the engine decides on the total the player saw.
        // `outcomeVs` hands the panel's pass/fail chip the same captured `dc`
        // the apply compares against — chip and engine verdict can't diverge.
        primaryControl: {
          type: 'dice-line',
          dice: [
            {
              sides: 20,
              bonus: { var: 'saveBonus' },
              purpose: 'save',
              writeBack: { var: 'roll', riderVar: 'riderBonus' }
            }
          ],
          outcomeVs: { var: 'dc' }
        },
        // The DC the save demands, from the same captured var the apply reads
        // (the label the damage reminder already interpolates) — so the row
        // keeps showing the DC it was added against, not the post-clear floor.
        information: [
          { type: 'text', label: 'play.information.saveDcCon', labelValues: { dc: { var: 'dc' } } }
        ],
        intents: { SAVE: 'you' },
        actionCost: []
      },
      vars: {
        // CAPTURED: the check's own marker-clear zeroes `concentration.last-damage`
        // (hence the dc derive) mid-fold, so a live read would collapse to the
        // DC 10 floor on a row added behind an earlier check row. The capture
        // preserves the DC the save is owed against; a NEW row re-captures.
        // Accepted limitation (AUTHORITATIVE note; the batched-damage sibling
        // lives in core-events): the capture is one-time, so EDITING the damage
        // row after the check was added leaves the check at the captured DC —
        // the check row's label can diverge from the damage row's. Correcting
        // means removing the check row and re-tapping the reminder, which
        // re-captures against the edited facts.
        dc: { capture: true, default: { fact: 'concentration.dc' } },
        // The kept d20 natural, written back by the panel's dice line once the
        // player rolls (advantage/disadvantage keeps the kept natural). 0 —
        // the default — means no roll yet.
        roll: { capture: true, default: { number: 0 } },
        // The rider the ROLL captured: the active save modifiers (Aura of
        // Protection) the dice line folded into its displayed total, persisted
        // alongside the natural by the writeBack `riderVar`. The engine cannot
        // see panel toggle state, so the panel hands over the number at roll
        // time — the same capture discipline as `roll`, one moment later. 0 —
        // the default — covers an unrolled row and a roll made with every
        // rider switched off.
        riderBonus: { capture: true, default: { number: 0 } },
        // The CON save bonus at add time. The AUTHORED bonus only: the panel's
        // toggle chips are riders, not save-bonus edits, and each persists
        // through its own channel above; the engine's apply must decide on the
        // same bonus the row captured, not on a toggle the fold cannot see.
        saveBonus: { capture: true, default: { fact: 'con.save' } }
      },
      apply: (f, selections): ActionResult => {
        const dc = typeof selections.dc === 'number' ? selections.dc : f.num('concentration.dc');
        const saveBonus =
          typeof selections.saveBonus === 'number' ? selections.saveBonus : f.num('con.save');
        // The rider the roll captured (0 when nothing rode the roll): the
        // third leg of the verdict, so the total the dice line DISPLAYED is
        // the total this apply judges.
        const riderBonus = typeof selections.riderBonus === 'number' ? selections.riderBonus : 0;
        const raw = selections.roll;
        const roll = typeof raw === 'number' ? raw : 0;

        // The outcome marker, keyed so the latest check this turn wins.
        const result = (passed: number): EffectInstance => ({
          id: 'concentration-check-result',
          key: 'concentration-check-result',
          state: { 'concentration.check-passed': passed },
          expiry: { kind: 'endOfTurn' }
        });

        // Unrolled: no outcome, and the marker survives — the save is still
        // owed, so the offer stays up and no reminder disappears early.
        if (roll === 0) return { advertise: [result(-1)] };

        // A "roll" outside 1..20 is input the engine must not act on: mirror
        // the short-rest roller's guard — diagnose, treat as unrolled (no
        // eviction, no clear), never end a spell on garbage input.
        if (!Number.isInteger(roll) || roll < 1 || roll > 20) {
          return {
            advertise: [result(-1)],
            diagnostics: [{ code: `${P}.check.invalid_roll`, severity: 'error' }]
          };
        }

        const passed = roll + saveBonus + riderBonus >= dc;
        // A ROLLED outcome resolves the save, so the trigger clears — pass or
        // fail. The clear is the shared builder helper (same key as
        // record-damage's marker → planning the check, later in the fold,
        // clears damage-taken AND its carried amount back to 0, newest wins),
        // so a later reminder's DC cannot quote stale damage — and the
        // concentration spells' casts advertise the identical effect to moot a
        // save pending against a replaced hold.
        const advertise: EffectInstance[] = [
          result(passed ? 1 : 0),
          concentrationDamageMarkerClear()
        ];
        if (passed) return { advertise };

        // Failed: additionally evict the spell. The eviction is an EMPTY
        // same-key effect (the find-steed Dismiss pattern): it replaces the
        // holding effect's contributions while merely planned — remove the row
        // (or re-roll) and the spell folds back — and endTurn merges it
        // permanently. Post-commit permanence is correct per 5e.
        advertise.push({
          id: 'concentration-broken',
          key: CONCENTRATION_SPELL_KEY,
          display: { name: `${P}.broken`, section: 'other' },
          expiry: { kind: 'permanent' }
        });
        return { advertise };
      }
    }
  ]
};

export default defineRule(concentration);
