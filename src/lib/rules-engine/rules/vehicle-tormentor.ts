import {
  currentHp,
  damageThresholdGate,
  defineRule,
  type ActionResult,
  type Annotation,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type RuleModule,
  type SubjectPanelDeclaration
} from '../builder';

/**
 * Tormentor — the rule group owning the whole VEHICLE and every seat it has so
 * far. Seats (action stations) change during play, so they are not separate
 * groups; each seat is its own SUBJECT (`tormentor-damage-control` is the
 * pseudo-seat for a character riding along on generic non-station duty; Helm
 * and Harpoon Flinger come later and will join this same group).
 *
 * Boarding is a PLAYER action: the board offer sits in the player's +ADD with
 * NO station subject, ungated and free. Its apply advertises ONE permanent
 * keyed effect baking the display-only stat block into
 * `companion.tormentorDamageControl.*` facts (the steed `steedEffect`
 * pattern), and that effect is what makes the STATION's +ADD panel available —
 * the de-board offer carries the station subject, is gated on `active`, and
 * replaces the board effect by key (the steed dismiss/`retireSteedEffects`
 * pattern). Raw mount-chip removal stays as the override path. The module
 * declares its subject's top-bar and resource entries as data (`panels`), so
 * the vehicle surfaces without touching the play layer.
 *
 * Creature Capacity is the one live resource: boarding bakes max 4 and the
 * boarder counts (used defaults to 1), and the station's +ADD carries an
 * occupancy slider (the steed HP-modifier pattern) whose ONE permanent keyed
 * effect is the stored occupancy — re-applying replaces, removing the chip
 * returns used to the board default, and the board/de-board lifecycle (plus
 * the board effect's `dependents`, for raw chip removal) evicts it with the
 * board. Over-capacity occupancy stays illegal-but-possible: the derive clamps
 * the READ to 0..max and diagnostics are deferred with boarding's.
 *
 * The vehicle's Prone Deficiency is STATE TRACKING ONLY: a namespaced
 * `companion.tormentorDamageControl.prone` fact under its own keyed effect —
 * NEVER the player-global `condition.prone` (the builder's `proneEffect()`
 * would flip the PLAYER's attack flags, notice and movement legs). The
 * station's +ADD records it and flips it upright (empty same-key eviction);
 * the BOARD is each offer's one structural `when`, while the prone state
 * itself is a LEGALITY gate on both (the engine's illegal-but-visible
 * contract — plan.ts keeps illegal offers applicable with diagnostics and a
 * planned-anyway row still executes; no Speed leg, because a vehicle has no
 * movement economy). The effect is PERMANENT (a rest does not right a
 * vehicle), the board/de-board lifecycle evicts it, and a NOTICE carries the
 * deficiency while the vehicle is PRONE (PC-prone parity: the condition
 * triggers its notice — boarded but upright, there is nothing to know). Both
 * prone offers file under the CONDITION 'held' sub-bucket (#467 taxonomy), so
 * a vehicle condition groups with PC conditions in the station +ADD.
 *
 * The vehicle is DAMAGEABLE (the steed HP pool, adapted): boarding bakes
 * `hp.base` 60 and `damageThreshold` 10 as DATA, and the module derives
 * max/current/modifier (`currentHp` from the builder — a fixed stat block, so
 * no max-modifier and no manual setters; the top-bar HP chip becomes a
 * usedMax pool). The station's +ADD carries damage and repair recorders (the
 * steed recorder idiom: ONE keyed `untilLongRest` effect holding the RUNNING
 * total, chip showing the live value; repairs cap at the net missing HP).
 * The threshold is an APPLY-level gate through the builder's GENERIC
 * `damageThresholdGate` (not vehicle-local): a blow below the fact records
 * NOTHING and flags the row — the offer itself stays legal (the dash idiom;
 * the explanation lives on the damage offer's DETAIL, not on standing
 * notices, because nothing else behaves differently). Damage that empties the
 * pool ALSO writes a permanent `destroyed` wreck (the steed lethal-check
 * placement, but NO auto-unboard — the board persists so the wreck stays
 * inspectable; the destroyed NOTICE says what that means). The HP records and
 * the wreck join the board lifecycle like every other record.
 *
 * The vehicle's AC is a MODE, not a constant (the stat block's "AC 21 (19
 * while motionless)"): `ac.value` DERIVES on a `acMotionless` fact the board
 * never bakes (absent = Moving = 21, the default), and the state chip — the
 * #466 Frightened LoS toggle idiom on a panel with no dice to govern — is
 * the free, legality-free record of which holds. A tap commits ONE permanent
 * keyed `tormentor-ac-mode` seed (motionless, AC 19) or its empty same-key
 * eviction (back to 21) through the follow-up channel; the seed displays as a
 * chip under the station view, and the mode key joins the board lifecycle
 * like every other record — a re-board or de-board resets to Moving.
 *
 * Deliberately out of scope this pass (later passes on the plan): the Helm /
 * Harpoon Flinger stations and the Juke reaction, movement economy, damage
 * immunities and the mishap threshold as MECHANICS (they are detail text
 * only — the recorder never refuses fire/poison/psychic and no mishap is
 * modelled), any prone attack/movement or
 * incapacitated mechanics beyond the record, and any legality check on
 * boarding (multiple boardings are illegal-but-possible; the keyed effect
 * keeps the facts single and diagnostics are deferred).
 */

const ID = 'tormentor';
const T = `rule.${ID}`;
/** The seat's subject id: the seg-button view, the +ADD stripe, the effect chip. */
const SUBJECT = 'tormentor-damage-control';
/** Every fact this module bakes lives under one stem. */
const F = 'companion.tormentorDamageControl';

/** The occupancy record's effect id and replacement key (ONE live record). */
const OCCUPANCY_EFFECT_ID = 'effect-tormentor-occupancy';
const OCCUPANCY_KEY = 'tormentor-occupancy';

/** The vehicle-prone record's effect id and replacement key (ONE live record). */
const PRONE_EFFECT_ID = 'effect-tormentor-prone';
const PRONE_KEY = 'tormentor-prone';

/** The HP records' effect ids and replacement keys (ONE running total each). */
const HP_DAMAGE_EFFECT_ID = 'effect-tormentor-hp-damage';
const HP_DAMAGE_KEY = 'tormentor-hp-damage';
const HP_HEAL_EFFECT_ID = 'effect-tormentor-hp-heal';
const HP_HEAL_KEY = 'tormentor-hp-heal';

/** The destroyed wreck's effect id and replacement key. */
const DESTROYED_EFFECT_ID = 'effect-tormentor-destroyed';
const DESTROYED_KEY = 'tormentor-destroyed';

/** The AC-mode seed's effect id and replacement key (ONE live mode record). */
const AC_MODE_EFFECT_ID = 'effect-tormentor-ac-mode';
const AC_MODE_KEY = 'tormentor-ac-mode';

/**
 * The annotation label every STATION offer carries so the AC-mode state chip
 * renders on the vehicle's panels. Subject-scoped the way every companion
 * panel label is (the steed's `.companion` convention, pinned registry-wide
 * by companion-annotation-labels.test.ts): the mode is THE VEHICLE's state,
 * so the chip belongs on the station's rows alone and no player-self rider
 * can reach it by spelling.
 */
const AC_MODE_LABEL = 'tormentor.ac-mode.companion';

/** The damage recorder's below-threshold diagnostic (the apply-level gate). */
const BELOW_THRESHOLD = `${T}.record-damage.below_threshold`;

/** Each prone offer's single legality leg (the get-up not_prone idiom). */
const ALREADY_PRONE = `${T}.knocked-prone.already_prone`;
const NOT_PRONE = `${T}.flip-upright.not_prone`;

/**
 * Every station record that must die with the board. The board effect declares
 * them as `dependents` (so a RAW mount-chip removal cascades), and the
 * board/de-board applies advertise empty same-key evictions beside their
 * replacement — a keyed replacement alone does not fire `dependents` (the
 * steed cast/dismiss child-eviction pattern).
 */
const CHILD_KEYS = [
  OCCUPANCY_KEY,
  PRONE_KEY,
  HP_DAMAGE_KEY,
  HP_HEAL_KEY,
  DESTROYED_KEY,
  AC_MODE_KEY
] as const;

/** The stat block boarding bakes. HP bakes its BASE (the pool derives from
 * it — the steed shape) plus the damage threshold as DATA the recorder gates
 * on; everything else is display-only EXCEPT the AC, which bakes NOTHING:
 * `ac.value` is a derive on the mode fact (21 moving / 19 motionless) and the
 * mode fact itself is absent while Moving (the default — the state chip owns
 * it, not the board). */
const BOARD_STATE: Record<string, number> = {
  [`${F}.active`]: 1,
  [`${F}.hp.base`]: 60,
  [`${F}.damageThreshold`]: 10,
  [`${F}.speed`]: 100,
  [`${F}.cargo`]: 500,
  [`${F}.str`]: 16,
  [`${F}.dex`]: 14,
  [`${F}.con`]: 14,
  [`${F}.str.modifier`]: 3,
  [`${F}.dex.modifier`]: 2,
  [`${F}.con.modifier`]: 2,
  // Creature Capacity 4 Medium creatures — the occupancy slider's ceiling.
  [`${F}.creatureCapacity.max`]: 4
};

/**
 * The board effect (permanent, keyed so a re-board or de-board REPLACES rather
 * than stacks). Exported so tests and later passes can seed an already-boarded
 * vehicle without driving the offer. `display` opts it onto the strip as a
 * MOUNT chip under its subject, and the `detailKey` is what the strip's flip
 * path reads — the first mount chip that flips to a stat-block detail (the
 * steed's never carried one). Every station record (occupancy, prone, the HP
 * totals, the destroyed wreck) is a DEPENDENT, so raw mount-chip removal
 * (playStore's `removeEffect`) evicts them with the board instead of
 * stranding a record under a de-boarded vehicle (the steed
 * mount/STEED_CHILD_EFFECTS pattern).
 */
export function tormentorBoardEffect(): EffectInstance {
  return {
    id: 'effect-tormentor-damage-control',
    key: 'tormentor-damage-control',
    state: { ...BOARD_STATE },
    dependents: [...CHILD_KEYS],
    display: {
      name: `${T}.effect.name`,
      section: 'mount',
      subject: SUBJECT,
      detailKey: 'vehicle/tormentor-damage-control'
    },
    expiry: { kind: 'permanent' }
  };
}

/**
 * The de-board marker: same key as the board effect, no state, no display —
 * purely a replacement that evicts the board effect (and every fact it baked)
 * the moment it is newest. Hidden and permanent so nothing revives the stat
 * block until a fresh board replaces the marker in turn. The id deliberately
 * does not extend the board effect's id: effect-id matching treats
 * `effect-x-…` as the base `effect-x`, which would blur the two.
 */
function tormentorDeboardEffect(): EffectInstance {
  return {
    id: 'effect-deboard-tormentor-damage-control',
    key: 'tormentor-damage-control',
    expiry: { kind: 'permanent' }
  };
}

/**
 * Eviction of EVERY station record (an empty same-key effect each — newest
 * wins, so the stored occupancy vanishes and `used` falls back to the board
 * default, the prone record clears, the HP running totals and the destroyed
 * wreck go). Advertised beside BOTH the board effect (a re-board starts
 * FRESH: the boarder counts, upright, whole — a new vehicle, not a persisted
 * one) and the de-board marker (no record outlives the board that justifies
 * it) — the steed cast/dismiss child-eviction pattern: a keyed replacement
 * alone does not fire `dependents`.
 */
function evictChildEffects(): EffectInstance[] {
  return CHILD_KEYS.map(
    (k): EffectInstance => ({ id: `evict-${k}`, key: k, expiry: { kind: 'permanent' } })
  );
}

/**
 * The vehicle's Prone Deficiency, as STATE TRACKING ONLY. The Tormentor is not
 * immune to Prone (its condition-immunity list omits it), and — unlike a
 * creature — it cannot right itself: flipped on its side it stays there and
 * can do nothing until something flips it upright. The fact is NAMESPACED
 * (`companion.tormentorDamageControl.prone`) under its own key, NEVER the
 * player-global `condition.prone`: conditions are player-global today, and
 * the builder's `proneEffect()` would flip the PLAYER's attack disadvantage
 * flags, notice and movement legs — a prone vehicle is not a prone rider.
 * PERMANENT, unlike the player's `untilShortRest` prone: no rest clears it,
 * because a rest does not right a vehicle — only Flip Upright (or the board
 * lifecycle) does. `display` files the chip under the station view like the
 * occupancy record's.
 */
function tormentorProneEffect(): EffectInstance {
  return {
    id: PRONE_EFFECT_ID,
    key: PRONE_KEY,
    state: { [`${F}.prone`]: 1 },
    display: {
      name: `${T}.prone-effect.name`,
      section: 'mount',
      subject: SUBJECT,
      // The chip flips to the vehicle's own prone detail — the same path the
      // board chip uses (the player's condition/prone text would promise a
      // creature's crawling and self-righting).
      detailKey: 'vehicle/tormentor-prone'
    },
    expiry: { kind: 'permanent' }
  };
}

/**
 * Eviction of the prone record — the same empty same-key idiom the player's
 * Get Up uses, advertised three ways: beside the flip-upright offer (the
 * clear), the board effect (a re-board starts upright) and the de-board
 * marker (the record never outlives the board).
 */
function evictProneEffect(): EffectInstance {
  return { id: `evict-${PRONE_KEY}`, key: PRONE_KEY, expiry: { kind: 'permanent' } };
}

/**
 * The MOTIONLESS half of the AC mode — the keyed SEED the state chip's tap
 * commits (stat block: AC 21, 19 while motionless). The board effect bakes no
 * mode fact, so an ABSENT fact is Moving (21, the default) and this effect is
 * the only writer of the deviation. Permanent: the mode persists until
 * switched or unboarded — no rest ages it out, and the board lifecycle
 * (dependents + the board/de-board evictions) is what resets it. `display`
 * files it as a chip under the station view (inspectable — and dismissable,
 * the manual override back to Moving — even with an empty plan). Exported so
 * tests and later passes can seed a motionless vehicle; `ruleGroupId` is
 * authored because the follow-up commit channel bypasses the plan fold's
 * group stamping (the Frightened sight-seed precedent).
 */
export function tormentorAcModeEffect(): EffectInstance {
  return {
    id: AC_MODE_EFFECT_ID,
    key: AC_MODE_KEY,
    ruleGroupId: ID,
    state: { [`${F}.acMotionless`]: 1 },
    display: {
      name: `${T}.ac-mode-effect.name`,
      section: 'mount',
      subject: SUBJECT
    },
    expiry: { kind: 'permanent' }
  };
}

/**
 * The MOVING half — the empty same-`key` EVICTION (the get-up idiom): no
 * state, its whole job is to replace the motionless seed so the fact reverts
 * to unset. Display-less, so the strip stays quiet while moving; the state
 * chip (and the top-bar AC reading 21) is the state's indicator. Carries the
 * authored group stamp for the same follow-up-channel reason as the seed.
 */
function evictAcModeEffect(): EffectInstance {
  return {
    id: `evict-${AC_MODE_KEY}`,
    key: AC_MODE_KEY,
    ruleGroupId: ID,
    expiry: { kind: 'permanent' }
  };
}

/**
 * The destroyed wreck, written by the damage recorder the moment recorded
 * damage brings the pool to 0 (the steed's lethal-check placement — but a
 * steed RETIRES at 0 HP while a vehicle becomes a burning wreck it can still
 * inspect: no auto-unboard, the board effect stays live beside this). Its own
 * permanent key, so the untilLongRest HP records age out on a rest without
 * touching it — a rest restores the pool, it never un-burns a war machine —
 * and the board lifecycle (dependents + the explicit evictions) is the only
 * thing that clears it: re-boarding is a fresh vehicle. `display` files the
 * chip under the station view like every other record.
 */
function tormentorDestroyedEffect(): EffectInstance {
  return {
    id: DESTROYED_EFFECT_ID,
    key: DESTROYED_KEY,
    state: { [`${F}.destroyed`]: 1 },
    display: {
      name: `${T}.destroyed-effect.name`,
      section: 'mount',
      subject: SUBJECT
    },
    expiry: { kind: 'permanent' }
  };
}

/** The structural gate every STATION action shares: the board effect is live. */
const boarded = (f: FactReader): boolean => f.num(`${F}.active`) > 0;

/**
 * The subject's top-bar and resource entries, gated on `active` (present only
 * while the board effect lives — removing the mount chip takes every fact with
 * it).
 */
const TORMENTOR_PANELS: SubjectPanelDeclaration[] = [
  {
    // HP is a POOL now (the damageable pass): the steed's chip shape —
    // usedMax renders "remaining/total", so it reads "45/60" and drops with
    // recorded damage. The gate stays `active` (a baked fact, absent when the
    // board goes), not the derived hp.max (which settles to 0, never absent).
    subject: SUBJECT,
    panel: 'topBar',
    gate: `${F}.active`,
    entry: {
      type: 'usedMax',
      label: 'play.stats.tormentor-damage-control.hp',
      total: `${F}.hp.max`,
      remaining: `${F}.hp.current`
    }
  },
  {
    subject: SUBJECT,
    panel: 'topBar',
    gate: `${F}.active`,
    entry: { type: 'value', label: 'play.stats.tormentor-damage-control.ac', fact: `${F}.ac.value` }
  },
  {
    subject: SUBJECT,
    panel: 'topBar',
    gate: `${F}.active`,
    entry: {
      type: 'value',
      label: 'play.stats.tormentor-damage-control.speed',
      fact: `${F}.speed`
    }
  },
  {
    // Cargo capacity: display-only alongside the other stat-block values.
    subject: SUBJECT,
    panel: 'topBar',
    gate: `${F}.active`,
    entry: {
      type: 'value',
      label: 'play.stats.tormentor-damage-control.cargo',
      fact: `${F}.cargo`
    }
  },
  {
    // Like the steed's chip, but three abilities, no saveFact (a vehicle makes
    // no saves of its own here) and no Int/Wis/Cha — the stat block has none.
    subject: SUBJECT,
    panel: 'topBar',
    gate: `${F}.active`,
    entry: {
      type: 'ability',
      label: 'play.topBar.abilities',
      abilities: (['str', 'dex', 'con'] as const).map((a) => ({
        name: `play.stats.${a}`,
        fact: `${F}.${a}.modifier`
      }))
    }
  },
  // ── Resources (the ledger's station view) ──
  {
    // The one live resource: Creature Capacity. `usedMax` renders
    // "remaining/total"; for capacity the meaningful number is OCCUPANTS, so
    // the `remaining` slot carries `used` — the row reads "1/4", "3/4" (used
    // of max, not open seats).
    subject: SUBJECT,
    panel: 'resources',
    gate: `${F}.active`,
    entry: {
      type: 'usedMax',
      label: 'play.stats.tormentor-damage-control.creatureCapacity',
      total: `${F}.creatureCapacity.max`,
      remaining: `${F}.creatureCapacity.used`
    }
  }
];

const vehicleTormentor: RuleModule = {
  id: ID,
  meta: {
    name: `${T}.name`,
    description: `${T}.description`,
    keywords: `${T}.keywords`
  },
  panels: TORMENTOR_PANELS,
  derive: () => [
    {
      // Occupancy used: the board default is 1 (the boarder counts), the
      // occupancy record overrides it, and the READ clamps to 0..max — the
      // slider's own bound is UI-only, so a stale or foreign stored value can
      // never read past the stat block. `has` (not num) is what lets a RECORDED
      // 0 (the vehicle emptied) differ from no record at all. Unboarded, the
      // contribution reads 0 (the board default is not a free occupant).
      fact: `${F}.creatureCapacity.used`,
      value: (f) => {
        if (f.num(`${F}.active`) === 0) return 0;
        const max = f.num(`${F}.creatureCapacity.max`);
        const recorded = f.has(`${F}.creatureCapacity.occupancy`)
          ? f.num(`${F}.creatureCapacity.occupancy`)
          : 1;
        return Math.min(Math.max(recorded, 0), max);
      }
    },
    // The HP POOL, in the steed's shape (a fixed stat block: max = base, no
    // max-modifier, no manual setters — damage and repairs are RECORDS): max
    // derives from the baked base, current starts at the max and follows the
    // net modifier down (floored at 0, never over the max — `currentHp` is the
    // player's own formula, shared so the two can never disagree), and the
    // modifier reads heals recorded − damage recorded. All gated on `active`:
    // unboarded the pool settles to 0 rather than vanishing (the contributions
    // stay registered), which is why the panel gates key on `active`.
    {
      fact: `${F}.hp.max`,
      value: (f) => (boarded(f) ? f.num(`${F}.hp.base`) : 0)
    },
    {
      fact: `${F}.hp.current`,
      value: (f) =>
        boarded(f) ? currentHp(f.num(`${F}.hp.max`), f.num(`${F}.hp.modifier.current`)) : 0
    },
    {
      // `sum` like the steed's, so later writers (a repair-kit-style grant, a
      // future pass) can join the modifier without a conflict throw.
      fact: `${F}.hp.modifier.current`,
      combine: 'sum',
      value: (f) => f.num(`${F}.hp.healRecorded`) - f.num(`${F}.hp.damageRecorded`)
    },
    {
      // The AC MODE (the stat block's "AC 21 (19 while motionless)"): a
      // derive on the mode fact, in the hp pool's boarded-gated shape. The
      // board bakes neither the value nor the mode — Moving (fact absent,
      // AC 21) is the default and the state chip's seed is the only writer
      // of the 19. Unboarded the contribution settles to 0 like the pool
      // (the top-bar gate keys on `active`, which is gone).
      fact: `${F}.ac.value`,
      value: (f) => (boarded(f) ? (f.num(`${F}.acMotionless`) > 0 ? 19 : 21) : 0)
    }
  ],
  offer: () => [
    {
      // The PLAYER-side board action: ungated (the offer exists whenever the
      // group is loaded, for every character) and carrying NO station subject,
      // so it files under the player's +ADD rather than a station panel that
      // cannot exist before the board effect does. No `when`, no `legalWhen`
      // (see the scope note above).
      id: 'board-tormentor',
      ui: {
        section: 'free',
        name: `${T}.board.name`,
        description: `${T}.board.description`,
        detailKey: 'vehicle/tormentor-damage-control',
        intents: { HANDLE: 'gear' },
        actionCost: []
      },
      // The evicts beside the replacement: a keyed replacement alone does not
      // fire dependents, so a re-board resets occupancy to the board default
      // (the boarder counts), starts the vehicle upright AND whole — no damage
      // banked, no wreck — explicitly (the steed recast/child-eviction pattern).
      apply: (): ActionResult => ({
        advertise: [tormentorBoardEffect(), ...evictChildEffects()]
      })
    },
    {
      // The STATION's occupancy record: a station action in the station's +ADD
      // (free, gated on the board) whose slider (0..the baked capacity, opening
      // at the current used) writes ONE permanent KEYED effect — the steed
      // HP-modifier semantics: the keyed effect IS the stored value, re-apply
      // replaces, removing the chip clears the modification. No legality gates:
      // occupancy past the capacity is illegal-but-possible (the derive clamps
      // the read; diagnostics are deferred with boarding's).
      id: 'set-tormentor-occupancy',
      when: boarded,
      ui: {
        section: 'free',
        subject: SUBJECT,
        // The AC-mode state chip rides every station row (the label the
        // module's toggle annotation targets — see the annotate pass).
        annotationLabels: [AC_MODE_LABEL],
        name: `${T}.occupancy.name`,
        description: `${T}.occupancy.description`,
        primaryControl: {
          type: 'slider',
          var: 'occupancy',
          min: { number: 0 },
          max: { fact: `${F}.creatureCapacity.max` }
        },
        intents: { HANDLE: 'gear' },
        actionCost: []
      },
      vars: { occupancy: { capture: true, default: { fact: `${F}.creatureCapacity.used` } } },
      apply: (_f, selections): ActionResult => ({
        advertise: [
          {
            id: OCCUPANCY_EFFECT_ID,
            key: OCCUPANCY_KEY,
            state: {
              [`${F}.creatureCapacity.occupancy`]:
                typeof selections.occupancy === 'number' ? selections.occupancy : 1
            },
            display: {
              name: `${T}.occupancy-effect.name`,
              section: 'mount',
              subject: SUBJECT,
              displayFact: `${F}.creatureCapacity.used`
            },
            expiry: { kind: 'permanent' }
          }
        ]
      })
    },
    {
      // The STATION's damage RECORDER (the steed steed-record-damage shape):
      // free, boarded, an HP record (the HEALTH bucket, like the steed's and
      // the player's — not a condition). The ONE keyed untilLongRest effect
      // carries the RUNNING total (prior + this amount), so records accumulate
      // while the board/de-board lifecycle still evicts by key and removing
      // the single chip clears the whole record. The stat block's damage
      // threshold is an APPLY-level gate via the builder's generic helper (the
      // dash idiom — the offer stays legal whatever the slider reads): a blow
      // below the baked fact records NOTHING and flags the row with the
      // below-threshold diagnostic; at or above it the FULL amount lands (the
      // threshold is a floor, not a cap). Damage that brings the pool to 0
      // ALSO writes the permanent destroyed wreck (see below). The offer
      // carries the damage DETAIL — threshold, immunities and the mishap
      // trigger live there, not on standing notices (nothing else behaves
      // differently, so there is nothing to warn about before acting).
      id: 'record-tormentor-damage',
      when: boarded,
      ui: {
        section: 'free',
        subject: SUBJECT,
        annotationLabels: [AC_MODE_LABEL],
        name: `${T}.record-damage.name`,
        description: `${T}.record-damage.description`,
        detailKey: 'vehicle/tormentor-damage',
        primaryControl: {
          type: 'slider',
          var: 'amount',
          min: { number: 0 },
          max: { fact: `${F}.hp.max` },
          unit: 'hp'
        },
        intents: { HEALTH: 'hp' },
        actionCost: []
      },
      vars: { amount: { capture: true, default: { number: 0 } } },
      apply: (f, selections): ActionResult => {
        const amount = typeof selections.amount === 'number' ? selections.amount : 0;
        // Below the threshold the blow bounces off: NO record, and the row (not
        // the offer — that stays legal) carries the diagnostic.
        const bounced = damageThresholdGate(f, amount, `${F}.damageThreshold`, BELOW_THRESHOLD);
        if (bounced) return { advertise: [], diagnostics: [bounced] };
        const advertise: EffectInstance[] = [
          {
            id: HP_DAMAGE_EFFECT_ID,
            key: HP_DAMAGE_KEY,
            state: { [`${F}.hp.damageRecorded`]: f.num(`${F}.hp.damageRecorded`) + amount },
            display: {
              name: `${T}.hp-damage-effect.name`,
              section: 'mount',
              subject: SUBJECT,
              displayFact: `${F}.hp.damageRecorded`
            },
            expiry: { kind: 'untilLongRest' }
          }
        ];
        // The lethal check (the steed record-damage placement), but NO
        // auto-unboard: the steed retires itself at 0 HP, a vehicle becomes a
        // WRECK — `destroyed` under its own permanent key, the board effect
        // left live so the wreck stays inspectable and the crew can de-board.
        // The damage record lands regardless (the blow happened); permanent,
        // because a long rest must not un-burn a war machine (it ages the HP
        // records out and the pool reads full again — the wreck stays).
        const hpAfter = currentHp(f.num(`${F}.hp.max`), f.num(`${F}.hp.modifier.current`) - amount);
        if (hpAfter <= 0) advertise.push(tormentorDestroyedEffect());
        return { advertise };
      }
    },
    {
      // The STATION's repair recorder — the steed steed-record-heal mirror:
      // same slider, same HEALTH bucket, same keyed running total, and the
      // added heal CAPS at the current net missing HP (`max(0,
      // -hp.modifier.current)`, which folds in all recorded damage), so
      // repairs offset HP loss and never bank surplus past full to pre-cancel
      // a later blow. Minimal surface: no detailKey (the damage semantics
      // detail rides the damage offer alone).
      id: 'record-tormentor-heal',
      when: boarded,
      ui: {
        section: 'free',
        subject: SUBJECT,
        annotationLabels: [AC_MODE_LABEL],
        name: `${T}.record-heal.name`,
        description: `${T}.record-heal.description`,
        primaryControl: {
          type: 'slider',
          var: 'amount',
          min: { number: 0 },
          max: { fact: `${F}.hp.max` },
          unit: 'hp'
        },
        intents: { HEALTH: 'hp' },
        actionCost: []
      },
      vars: { amount: { capture: true, default: { number: 0 } } },
      apply: (f, selections): ActionResult => {
        const amount = typeof selections.amount === 'number' ? selections.amount : 0;
        const missing = Math.max(0, -f.num(`${F}.hp.modifier.current`));
        return {
          advertise: [
            {
              id: HP_HEAL_EFFECT_ID,
              key: HP_HEAL_KEY,
              state: {
                [`${F}.hp.healRecorded`]: f.num(`${F}.hp.healRecorded`) + Math.min(amount, missing)
              },
              display: {
                name: `${T}.hp-heal-effect.name`,
                section: 'mount',
                subject: SUBJECT,
                displayFact: `${F}.hp.healRecorded`
              },
              expiry: { kind: 'untilLongRest' }
            }
          ]
        };
      }
    },
    {
      // The STATION's prone RECORDER: models the vehicle BEING knocked prone
      // (imposed by the outside world), free. The BOARD is the one structural
      // gate (unboarded there is no vehicle to knock); the already-prone state
      // is a LEGALITY gate, never a `when` (the engine's illegal-but-visible
      // contract — plan.ts keeps illegal offers applicable with diagnostics
      // and a planned-anyway row still executes; the PC drop-prone structural
      // gate was the deviation, corrected): while prone the offer stays
      // visible and applicable, flagged illegal with its already-prone
      // diagnostic, and committing it anyway re-advertises the one keyed
      // record (newest-wins — still a single prone fact). No Speed leg: a
      // vehicle has no movement economy. State tracking only: no attack flags,
      // no movement legs, no incapacitated modelling this pass.
      id: 'knock-tormentor-prone',
      when: boarded,
      legalWhen: [
        {
          // Illegal while already prone (the state the record would write).
          condition: (f: FactReader): boolean => f.num(`${F}.prone`) === 0,
          diagnostics: [{ code: ALREADY_PRONE, severity: 'error' }]
        }
      ],
      ui: {
        section: 'free',
        subject: SUBJECT,
        annotationLabels: [AC_MODE_LABEL],
        name: `${T}.knocked-prone.name`,
        description: `${T}.knocked-prone.description`,
        // Both prone offers flip to the vehicle's own condition text — what
        // fallen-prone means for a war machine, not for a rider.
        detailKey: 'vehicle/tormentor-prone',
        // A vehicle CONDITION files like the PC's: record-prone's CONDITION
        // 'held' sub-bucket (#467 taxonomy — "Prone (both offers)"), not the
        // HANDLE gear bucket the boarding offers use.
        intents: { CONDITION: 'held' },
        actionCost: []
      },
      apply: (f: FactReader): ActionResult => {
        // Re-checked legality (the dash idiom) so a planned-anyway row carries
        // its own diagnostics from the fold.
        const diagnostics: Diagnostic[] = [];
        if (f.num(`${F}.prone`) > 0) diagnostics.push({ code: ALREADY_PRONE, severity: 'error' });
        return { advertise: [tormentorProneEffect()], diagnostics };
      }
    },
    {
      // The way a prone vehicle rights itself: it cannot — something else
      // has to flip it upright. The board is again the one structural gate;
      // NOT-prone is a legality gate (the get-up shape, the engine's
      // illegal-but-visible contract): while upright the offer stays visible
      // and applicable, flagged illegal with its not-prone diagnostic, and a
      // planned-anyway row still executes — its EMPTY same-key eviction (the
      // player's Get Up idiom) committing as a no-op beside nothing to evict,
      // exactly like Get Up while standing. Newest-wins clears the record
      // while merely planned. PC get-up parity check: of Get Up's three
      // legality legs, prone-only is this gate; Speed-0 and half-Speed
      // affordability do not translate — a vehicle has no movement economy.
      id: 'flip-tormentor-upright',
      when: boarded,
      legalWhen: [
        {
          // Illegal while upright (nothing to flip).
          condition: (f: FactReader): boolean => f.num(`${F}.prone`) > 0,
          diagnostics: [{ code: NOT_PRONE, severity: 'error' }]
        }
      ],
      ui: {
        section: 'free',
        subject: SUBJECT,
        annotationLabels: [AC_MODE_LABEL],
        name: `${T}.flip-upright.name`,
        description: `${T}.flip-upright.description`,
        detailKey: 'vehicle/tormentor-prone',
        // The condition-END offer files with its condition ('held', like the
        // recorder) so both prone offers sit under the Conditions grouping in
        // the station +ADD. The PLAYER's Get Up is a MOVE 'rise' offer because
        // it spends movement; this free flip is not a movement action.
        intents: { CONDITION: 'held' },
        actionCost: []
      },
      apply: (f: FactReader): ActionResult => {
        // Re-checked legality (the dash idiom) so a planned-anyway row carries
        // its own diagnostics from the fold.
        const diagnostics: Diagnostic[] = [];
        if (f.num(`${F}.prone`) === 0) diagnostics.push({ code: NOT_PRONE, severity: 'error' });
        return { advertise: [evictProneEffect()], diagnostics };
      }
    },
    {
      // The STATION-side way out: gated on the board (structurally — unboarded,
      // the action does not exist at all), sitting under the station's +ADD
      // panel so it appears exactly once boarding has made that panel
      // available. Replaces the board effect by key (evicting every station
      // record with it); no cost, no legality gates.
      id: 'deboard-tormentor',
      when: boarded,
      ui: {
        section: 'free',
        subject: SUBJECT,
        annotationLabels: [AC_MODE_LABEL],
        name: `${T}.deboard.name`,
        description: `${T}.deboard.description`,
        intents: { HANDLE: 'gear' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [tormentorDeboardEffect(), ...evictChildEffects()]
      })
    }
  ],
  // The AC MODE is a free state record of whether the vehicle is moving —
  // like occupancy, no legality gates (nothing is illegal about either state;
  // the vehicle simply is or is not moving). The surface is the #466
  // Frightened dice-line state-chip mechanism (an AnnotationToggle committing
  // a keyed SEED through the follow-up channel — `addFollowupEffect`), with
  // one transplant: a vehicle's panels roll NO dice, so the toggle authors an
  // EMPTY `appliesTo` — the chip renders on the matched PANEL itself, and
  // every station offer carries the label so whichever row is planned shows
  // it. The pressed state reads the LIVE fact (unlike Frightened's per-row
  // captures, the mode is one vehicle-wide state — every chip agrees with the
  // seed); a tap commits one of the two authored effects: the seed writing
  // `acMotionless` 1 (AC 19) or its empty same-key eviction (back to 21).
  // `onWhen: 0` makes MOVING the pressed default (the unset fact is Moving,
  // so the seed only ever records the deviation), and the annotation gates on
  // the board alone — unboarded there is no vehicle to be moving, and the
  // rows that carry the label are structurally gone anyway.
  //
  // The Prone Deficiency trait, surfaced as a NOTICE while the vehicle is
  // PRONE (the Life-Bond annotate pattern gated on the condition — PC-prone
  // parity: the condition triggers its notice, so boarded-but-upright carries
  // nothing). It is a condition the player must know BEFORE acting on the
  // vehicle's behalf: the Tormentor cannot right itself, so it stays prone
  // and can do nothing until something flips it upright. The gate is the
  // prone fact alone — the record never outlives the board (the effect's
  // dependents plus the explicit board/de-board evictions), so no separate
  // boarded check is needed. Own wording (the Tormentor is not SRD);
  // 'notice' == NOTICE_TARGET, a reserved label rule modules spell as a
  // literal (see condition-prone / find-steed).
  //
  // The DESTROYED wreck carries its own notice the same way: a state the crew
  // must know before acting on the vehicle's behalf (it can no longer act;
  // the way out is people, not repairs), gated on the destroyed fact alone —
  // the wreck never outlives the board either. Distinct key from the prone
  // notice, so a prone wreck (somehow) carries both.
  annotate: (f: FactReader): Annotation[] => {
    const out: Annotation[] = [];
    if (boarded(f))
      out.push({
        key: `${T}.ac-mode`,
        targets: [AC_MODE_LABEL],
        toggle: {
          fact: `${F}.acMotionless`,
          onWhen: 0,
          // Direction contract (pinned in the unit tests): onEffect takes the
          // fact TO onWhen (back to MOVING — the empty eviction), offEffect
          // takes it away (MOTIONLESS — the seed).
          onEffect: evictAcModeEffect(),
          offEffect: tormentorAcModeEffect(),
          labelOn: `${T}.ac-mode.moving`,
          labelOff: `${T}.ac-mode.motionless`,
          appliesTo: []
        }
      });
    if (f.num(`${F}.prone`) > 0)
      out.push({
        key: `${T}.notice`,
        targets: ['notice'],
        source: `${T}.effect.name`,
        body: `${T}.notice.body`
      });
    if (f.num(`${F}.destroyed`) > 0)
      out.push({
        key: `${T}.destroyed-notice`,
        targets: ['notice'],
        source: `${T}.effect.name`,
        body: `${T}.destroyed-notice.body`
      });
    return out;
  }
};

export default defineRule(vehicleTormentor);
