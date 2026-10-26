import {
  currentHp,
  defineRule,
  hpRecorders,
  type ActionResult,
  type Annotation,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type RuleModule,
  type SubjectPanelDeclaration
} from '../builder';

/**
 * Tormentor — the rule group owning the whole VEHICLE. Bringing the vehicle in
 * is ACQUIRING it: equipping a war machine, not manning a station (the
 * Damage-Control seat fiction is retired). The vehicle is one SUBJECT
 * (`tormentor`); later vehicles join this same group as their own subjects.
 *
 * Acquiring is a PLAYER action: the acquire offer sits in the player's +ADD
 * with NO vehicle subject, structurally ungated and free (acquiring while a
 * Tormentor is already present is ILLEGAL, never hidden — one per character),
 * filed under the BUILD family's
 * EQUIP verb ('vehicle' sub-bucket). Its apply advertises ONE permanent
 * keyed effect baking the display-only stat block into
 * `companion.tormentor.*` facts (the steed `steedEffect`
 * pattern), and that effect is what makes the VEHICLE's +ADD panel available —
 * the abandon offer carries the vehicle subject, is gated on `active`, and
 * replaces the acquire effect by key (the steed dismiss/`retireSteedEffects`
 * pattern). Raw mount-chip removal stays as the override path. The module
 * declares its subject's top-bar and resource entries as data (`panels`), so
 * the vehicle surfaces without touching the play layer.
 *
 * Creature Capacity is the one live resource: acquiring bakes max 4 and the
 * acquirer counts (used defaults to 1), and the vehicle's +ADD carries an
 * occupancy slider (the steed HP-modifier pattern) whose ONE permanent keyed
 * effect is the stored occupancy — re-applying replaces, removing the chip
 * returns used to the acquire default, and the acquire/abandon lifecycle
 * (plus the acquire effect's `dependents`, for raw chip removal) evicts it
 * with the acquire. Over-capacity occupancy stays illegal-but-possible: the
 * derive clamps the READ to 0..max and diagnostics are deferred with
 * acquiring's.
 *
 * The vehicle's Prone Deficiency is STATE TRACKING ONLY: a namespaced
 * `companion.tormentor.prone` fact under its own keyed effect —
 * NEVER the player-global `condition.prone` (the builder's `proneEffect()`
 * would flip the PLAYER's attack flags, notice and movement legs). The
 * vehicle's +ADD records it and flips it upright (empty same-key eviction);
 * the ACQUIRED state is each offer's one structural `when`, while the prone
 * state itself is a LEGALITY gate on both (the engine's illegal-but-visible
 * contract — plan.ts keeps illegal offers applicable with diagnostics and a
 * planned-anyway row still executes; no Speed leg, because a vehicle has no
 * movement economy). The effect is PERMANENT (a rest does not right a
 * vehicle), the acquire/abandon lifecycle evicts it, and a NOTICE carries the
 * deficiency while the vehicle is PRONE (PC-prone parity: the condition
 * triggers its notice — acquired but upright, there is nothing to know). Both
 * prone offers file under the CONDITION 'held' sub-bucket (#467 taxonomy), so
 * a vehicle condition groups with PC conditions in the vehicle +ADD.
 *
 * The vehicle is DAMAGEABLE (the steed HP pool, adapted): acquiring bakes
 * `hp.base` 60 and `damageThreshold` 10 as DATA, and the module derives
 * max/current/modifier (`currentHp` from the builder — a fixed stat block, so
 * no max-modifier and no manual setters; the top-bar HP chip becomes a
 * usedMax pool). The vehicle's +ADD carries damage and repair recorders (the
 * steed recorder idiom: ONE keyed `untilLongRest` effect holding the RUNNING
 * total, chip showing the live value; repairs cap at the net missing HP).
 * The threshold rides the shared factory's GENERIC gate (threshold model v2,
 * user-corrected 2026-10-26 — sub-threshold damage is LEGAL to attempt: the
 * GM tells the crew an amount and they record it, and the app is what knows
 * it was under the limit): the damage offer carries a [Use Threshold | Ignore
 * Threshold] segmented control (rendered while the threshold fact is
 * positive), a Use-Threshold blow below the fact records NOTHING and returns
 * an informational 'notice' diagnostic that rides THAT planned row alone
 * (never an error, never an illegality, never a panel annotation), an
 * Ignore-Threshold blow records the RAW amount in full
 * (the GM correction), and the explanation lives on the damage offer's DETAIL
 * — not on standing notices, because nothing else behaves differently. Damage
 * that empties the pool ALSO writes a permanent `destroyed` wreck (the steed
 * lethal-check placement, but NO auto-abandon — the acquire persists so the
 * wreck stays inspectable; the destroyed NOTICE says what that means). The HP
 * records and the wreck join the acquire lifecycle like
 * every other record.
 *
 * The stat block's "AC 21 (19 while motionless)" is a MODE the player
 * records (v2 — v1's annotation state chip was abandoned; see the plan): the
 * ACQUIRE offer carries a [Moving | Motionless] segmented secondary control
 * (the steed creature-type precedent) whose selection the acquire effect
 * bakes as the 0/1 `acMotionless` fact — NO flat `ac.value` bake any more. AC
 * is DERIVED as `ac.effective` (19 motionless, else 21, gated on active), a
 * deliberately NEW name: legacy persisted acquires bake flat ac.value, and
 * nothing may derive that name or every evaluation of such a character would
 * two-writer-conflict (the pass-3 hp.max lesson) — the stale legacy bake is
 * simply inert, the legacy acquire derives 21, and there is NO load-seam
 * migration. The vehicle's +ADD carries an always-present (while acquired)
 * "AC Mode" record offer (the occupancy intent class, applied immediately)
 * with the same control pre-showing the CURRENT mode; its ONE permanent keyed
 * effect stores the mode as the DISTINCT `acMotionless.recorded` fact, which
 * the resolved-mode derive prefers when present — the engine sum-combines two
 * live effects writing one fact, so a record writing `acMotionless` itself
 * could never flip a Motionless acquire back to Moving (1 + 0 still reads 1).
 * The mode key joins the acquire lifecycle like every other record: a
 * re-acquire resets to the fresh acquire SELECTION.
 *
 * Deliberately out of scope this pass (later passes on the plan): the Helm /
 * Harpoon Flinger vehicles and the Juke reaction, movement economy, damage
 * immunities and the mishap threshold as MECHANICS (they are detail text
 * only — the recorder never refuses fire/poison/psychic and no mishap is
 * modelled), any prone attack/movement or incapacitated mechanics beyond the
 * record, and MULTIPLE vehicles per character (acquiring while a Tormentor is
 * already present is ILLEGAL — one vehicle per character, for now; a later
 * pass lifts the already-have leg when a second vehicle can exist beside the
 * first).
 */

const ID = 'tormentor';
const T = `rule.${ID}`;
/** The vehicle's subject id: the seg-button view, the +ADD stripe, the effect chip. */
const SUBJECT = 'tormentor';
/** Every fact this module bakes lives under one stem. */
const F = 'companion.tormentor';

/** The occupancy record's effect id and replacement key (ONE live record). */
const OCCUPANCY_EFFECT_ID = 'effect-tormentor-occupancy';
const OCCUPANCY_KEY = 'tormentor-occupancy';

/** The AC-mode record's effect id and replacement key (ONE live record). */
const AC_MODE_EFFECT_ID = 'effect-tormentor-ac-mode';
const AC_MODE_KEY = 'tormentor-ac-mode';

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

/**
 * The damage recorder's below-threshold key — the INFORMATIONAL note a
 * Use-Threshold sub-threshold blow carries on its own planned row (threshold
 * model v2: the blow was legal to attempt; the app tells the player it
 * bounced). Same i18n slot the old error diagnostic lived in, new meaning.
 */
const BELOW_THRESHOLD = `${T}.record-damage.below_threshold`;

/** Each prone offer's single legality leg (the get-up not_prone idiom). */
const ALREADY_PRONE = `${T}.knocked-prone.already_prone`;
const NOT_PRONE = `${T}.flip-upright.not_prone`;

/**
 * The acquire offer's single legality leg (the knocked-prone already-prone
 * idiom): ONE vehicle per character, for now — acquiring while a Tormentor is
 * already present is ILLEGAL, never hidden.
 */
const ALREADY_HAVE = `${T}.acquire.already_have`;

/**
 * Every vehicle record that must die with the acquire. The acquire effect declares
 * them as `dependents` (so a RAW mount-chip removal cascades), and the
 * acquire/abandon applies advertise empty same-key evictions beside their
 * replacement — a keyed replacement alone does not fire `dependents` (the
 * steed cast/dismiss child-eviction pattern).
 */
const CHILD_KEYS = [
  OCCUPANCY_KEY,
  AC_MODE_KEY,
  PRONE_KEY,
  HP_DAMAGE_KEY,
  HP_HEAL_KEY,
  DESTROYED_KEY
] as const;

/** The stat block acquiring bakes. HP bakes its BASE (the pool derives from
 * it — the steed shape) plus the damage threshold as DATA the recorder gates
 * on; everything else is display-only. AC bakes NO value at all — the acquire
 * selection's MODE fact is the bake, and `ac.effective` derives the number
 * (see the derive below for why the flat `ac.value` name is retired). */
const ACQUIRE_STATE: Record<string, number> = {
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
 * The [Moving | Motionless] picker both AC-mode controls render — the steed
 * creature-type segmented precedent (a segmented control can only ever be a
 * `secondaryControl` in PanelRenderer). The values ARE the 0/1 motionless
 * flag: 0 Moving (the default), 1 Motionless.
 */
const AC_MODE_CONTROL = {
  type: 'segmented',
  var: 'mode',
  prefix: 'play.choices.tormentor.mode',
  options: [
    { value: 0, label: `${T}.mode.moving` },
    { value: 1, label: `${T}.mode.motionless` }
  ]
} as const;

/** The selected AC mode from a segmented capture (Moving when unset). */
const modeFrom = (selections: Record<string, unknown>): number =>
  typeof selections.mode === 'number' ? selections.mode : 0;

/**
 * The acquire effect (permanent, keyed so a re-acquire or abandon REPLACES rather
 * than stacks). Exported so tests and later passes can seed an already-acquired
 * vehicle without driving the offer. `display` opts it onto the strip as a
 * MOUNT chip under its subject, and the `detailKey` is what the strip's flip
 * path reads — the first mount chip that flips to a stat-block detail (the
 * steed's never carried one). Every vehicle record (occupancy, the AC mode,
 * prone, the HP totals, the destroyed wreck) is a DEPENDENT, so raw mount-chip
 * removal (playStore's `removeEffect`) evicts them with the acquire instead of
 * stranding a record under an abandoned vehicle (the steed
 * mount/STEED_CHILD_EFFECTS pattern).
 *
 * `acMotionless` is the MODE the acquire-offer segmented control selected (0
 * Moving — the default — 1 Motionless): the selection flows into the effect
 * state exactly the way the creature-type choice flows into the steed effect.
 * A LEGACY persisted acquire (pre-AC-mode) baked flat `ac.value` and no mode
 * fact; that shape still evaluates (the mode reads as Moving) and its stale
 * `ac.value` is inert — nothing derives that name any more.
 */
export function tormentorAcquireEffect(acMotionless = 0): EffectInstance {
  return {
    id: 'effect-tormentor-acquire',
    key: 'tormentor-acquire',
    state: { ...ACQUIRE_STATE, [`${F}.acMotionless`]: acMotionless },
    dependents: [...CHILD_KEYS],
    display: {
      name: `${T}.effect.name`,
      section: 'mount',
      subject: SUBJECT,
      detailKey: 'vehicle/tormentor'
    },
    expiry: { kind: 'permanent' }
  };
}

/**
 * The abandon marker: same key as the acquire effect, no state, no display —
 * purely a replacement that evicts the acquire effect (and every fact it baked)
 * the moment it is newest. Hidden and permanent so nothing revives the stat
 * block until a fresh acquire replaces the marker in turn. The id deliberately
 * does not extend the acquire effect's id: effect-id matching treats
 * `effect-x-…` as the base `effect-x`, which would blur the two.
 */
function tormentorAbandonEffect(): EffectInstance {
  return {
    id: 'effect-abandon-tormentor',
    key: 'tormentor-acquire',
    expiry: { kind: 'permanent' }
  };
}

/**
 * Eviction of EVERY vehicle record (an empty same-key effect each — newest
 * wins, so the stored occupancy vanishes and `used` falls back to the acquire
 * default, the AC-mode record clears and the mode falls back to the acquire
 * bake, the prone record clears, the HP running totals and the destroyed
 * wreck go). Advertised beside BOTH the acquire effect (a re-acquire starts
 * FRESH: the acquirer counts, upright, whole, in the mode THIS row selected —
 * a new vehicle, not a persisted one) and the abandon marker (no record
 * outlives the acquire that justifies it) — the steed cast/dismiss
 * child-eviction pattern: a keyed replacement alone does not fire
 * `dependents`.
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
 * (`companion.tormentor.prone`) under its own key, NEVER the
 * player-global `condition.prone`: conditions are player-global today, and
 * the builder's `proneEffect()` would flip the PLAYER's attack disadvantage
 * flags, notice and movement legs — a prone vehicle is not a prone rider.
 * PERMANENT, unlike the player's `untilShortRest` prone: no rest clears it,
 * because a rest does not right a vehicle — only Flip Upright (or the acquire
 * lifecycle) does. `display` files the chip under the vehicle view like the
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
      // acquire chip uses (the player's condition/prone text would promise a
      // creature's crawling and self-righting).
      detailKey: 'vehicle/tormentor-prone'
    },
    expiry: { kind: 'permanent' }
  };
}

/**
 * Eviction of the prone record — the same empty same-key idiom the player's
 * Get Up uses, advertised three ways: beside the flip-upright offer (the
 * clear), the acquire effect (a re-acquire starts upright) and the abandon
 * marker (the record never outlives the acquire).
 */
function evictProneEffect(): EffectInstance {
  return { id: `evict-${PRONE_KEY}`, key: PRONE_KEY, expiry: { kind: 'permanent' } };
}

/**
 * The destroyed wreck, written by the damage recorder the moment recorded
 * damage brings the pool to 0 (the steed's lethal-check placement — but a
 * steed RETIRES at 0 HP while a vehicle becomes a burning wreck it can still
 * inspect: no auto-abandon, the acquire effect stays live beside this). Its own
 * permanent key, so the untilLongRest HP records age out on a rest without
 * touching it — a rest restores the pool, it never un-burns a war machine —
 * and the acquire lifecycle (dependents + the explicit evictions) is the only
 * thing that clears it: re-acquiring is a fresh vehicle. `display` files the
 * chip under the vehicle view like every other record.
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

/** The structural gate every VEHICLE action shares: the acquire effect is live. */
const acquired = (f: FactReader): boolean => f.num(`${F}.active`) > 0;

/**
 * The subject's top-bar and resource entries, gated on `active` (present only
 * while the acquire effect lives — removing the mount chip takes every fact with
 * it).
 */
const TORMENTOR_PANELS: SubjectPanelDeclaration[] = [
  {
    // HP is a POOL now (the damageable pass): the steed's chip shape —
    // usedMax renders "remaining/total", so it reads "45/60" and drops with
    // recorded damage. The gate stays `active` (a baked fact, absent when the
    // acquire goes), not the derived hp.max (which settles to 0, never absent).
    subject: SUBJECT,
    panel: 'topBar',
    gate: `${F}.active`,
    entry: {
      type: 'usedMax',
      label: 'play.stats.tormentor.hp',
      total: `${F}.hp.max`,
      remaining: `${F}.hp.current`
    }
  },
  {
    // The DERIVED AC (the mode resolve above): 21 moving, 19 motionless — the
    // flat ac.value read is retired with the bake (a legacy acquire's stale
    // ac.value must never reach the chip).
    subject: SUBJECT,
    panel: 'topBar',
    gate: `${F}.active`,
    entry: {
      type: 'value',
      label: 'play.stats.tormentor.ac',
      fact: `${F}.ac.effective`
    }
  },
  {
    subject: SUBJECT,
    panel: 'topBar',
    gate: `${F}.active`,
    entry: {
      type: 'value',
      label: 'play.stats.tormentor.speed',
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
      label: 'play.stats.tormentor.cargo',
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
  // ── Resources (the ledger's vehicle view) ──
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
      label: 'play.stats.tormentor.creatureCapacity',
      total: `${F}.creatureCapacity.max`,
      remaining: `${F}.creatureCapacity.used`
    }
  }
];

/**
 * The VEHICLE's damage/repair recorders, on the shared factory (the player's
 * and the steed's ride the same code path): free, acquired, an HP record (the
 * HEALTH bucket, like the steed's and the player's — not a condition), keyed
 * running totals the acquire/abandon lifecycle evicts by key. The stat block's
 * damage threshold is a BAKED FACT the factory consults (threshold model v2 —
 * sub-threshold damage is LEGAL to attempt: the GM tells the crew an amount
 * and they record it): the damage offer carries the factory's [Use Threshold |
 * Ignore Threshold] segmented control (rendered while the fact is positive),
 * a Use-Threshold blow below the fact records NOTHING and returns the
 * informational below-threshold note as a 'notice' diagnostic on that row
 * alone, and an Ignore-Threshold blow records the RAW amount in full (the GM
 * correction); at or above the threshold the FULL amount lands (a floor, not
 * a cap). Damage that brings the pool to 0 ALSO writes the permanent
 * destroyed wreck BESIDE the record (the record lands — the blow happened;
 * the wreck is permanent, because a long rest must not un-burn a war
 * machine). The damage offer carries the damage DETAIL — threshold,
 * immunities and the mishap trigger live there, not on standing notices
 * (nothing else behaves differently, so there is nothing to warn about before
 * acting); the repair offer keeps the minimal surface (no detailKey, no
 * threshold control — repairs never bounce).
 */
const HP_RECORDERS = hpRecorders({
  idStem: 'record-tormentor',
  when: acquired,
  subject: SUBJECT,
  facts: {
    max: `${F}.hp.max`,
    modifierCurrent: `${F}.hp.modifier.current`,
    damageRecorded: `${F}.hp.damageRecorded`,
    healRecorded: `${F}.hp.healRecorded`,
    damageThreshold: `${F}.damageThreshold`
  },
  damage: {
    name: `${T}.record-damage.name`,
    description: `${T}.record-damage.description`,
    detailKey: 'vehicle/tormentor-damage',
    effectId: HP_DAMAGE_EFFECT_ID,
    effectKey: HP_DAMAGE_KEY,
    effectName: `${T}.hp-damage-effect.name`
  },
  heal: {
    name: `${T}.record-heal.name`,
    description: `${T}.record-heal.description`,
    effectId: HP_HEAL_EFFECT_ID,
    effectKey: HP_HEAL_KEY,
    effectName: `${T}.hp-heal-effect.name`
  },
  accumulation: 'keyed-total',
  chipSection: 'mount',
  bounce: {
    noteKey: BELOW_THRESHOLD
  },
  lethal: { effects: () => [tormentorDestroyedEffect()], keepRecord: true }
});

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
      // Occupancy used: the acquire default is 1 (the acquirer counts), the
      // occupancy record overrides it, and the READ clamps to 0..max — the
      // slider's own bound is UI-only, so a stale or foreign stored value can
      // never read past the stat block. `has` (not num) is what lets a RECORDED
      // 0 (the vehicle emptied) differ from no record at all. Unacquired, the
      // contribution reads 0 (the acquire default is not a free occupant).
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
    // unacquired the pool settles to 0 rather than vanishing (the contributions
    // stay registered), which is why the panel gates key on `active`.
    {
      fact: `${F}.hp.max`,
      value: (f) => (acquired(f) ? f.num(`${F}.hp.base`) : 0)
    },
    {
      fact: `${F}.hp.current`,
      value: (f) =>
        acquired(f) ? currentHp(f.num(`${F}.hp.max`), f.num(`${F}.hp.modifier.current`)) : 0
    },
    {
      // `sum` like the steed's, so later writers (a repair-kit-style grant, a
      // future pass) can join the modifier without a conflict throw.
      fact: `${F}.hp.modifier.current`,
      combine: 'sum',
      value: (f) => f.num(`${F}.hp.healRecorded`) - f.num(`${F}.hp.damageRecorded`)
    },
    // The RESOLVED AC mode: the vehicle record when one stands, else the acquire
    // bake — the occupancy has-preference idiom, and deliberately a DISTINCT
    // recorded fact: the engine sum-combines two live effects writing one
    // fact, so a mode record writing `acMotionless` itself could never flip a
    // Motionless acquire back to Moving (1 + 0 still reads 1). A LEGACY acquire
    // (no acMotionless baked) resolves to Moving here.
    {
      fact: `${F}.acMotionless.current`,
      value: (f) =>
        (f.has(`${F}.acMotionless.recorded`)
          ? f.num(`${F}.acMotionless.recorded`)
          : f.num(`${F}.acMotionless`)) > 0
          ? 1
          : 0
    },
    // The stat block's "AC 21 (19 while motionless)" as a DERIVED fact under a
    // deliberately NEW name: legacy persisted acquires bake flat `ac.value`, and
    // a derive on the same name would two-writer-conflict on every evaluation
    // of such a character (the pass-3 hp.max lesson). The stale legacy bake is
    // inert — nothing derives or reads `ac.value` any more. Gated on `active`
    // like the pool, so an unacquired vehicle reads 0 and the panel gate holds
    // the chip back.
    {
      fact: `${F}.ac.effective`,
      value: (f) => (acquired(f) ? (f.num(`${F}.acMotionless.current`) > 0 ? 19 : 21) : 0)
    }
  ],
  offer: () => [
    {
      // The PLAYER-side acquire action: ungated (the offer exists whenever the
      // group is loaded, for every character) and carrying NO vehicle subject,
      // so it files under the player's +ADD rather than a vehicle panel that
      // cannot exist before the acquire effect does. Acquiring is EQUIPPING a
      // vehicle: the BUILD family's EQUIP verb in the new 'vehicle' sub-bucket
      // (labels in both locales), not the HANDLE gear bucket the records use.
      // No `when` — but ONE legality leg: acquiring while a Tormentor is
      // already present is ILLEGAL (one vehicle per character, for now), never
      // hidden (the knocked-prone already-prone idiom — the engine's
      // illegal-but-visible contract: the offer stays visible and applicable
      // with its diagnostic, and a planned-anyway row still executes as the one
      // keyed replacement). The segmented secondary control picks the AC MODE
      // the fresh acquire starts in (the steed creature-type precedent: the
      // selection flows into the acquire effect's state).
      id: 'acquire-tormentor',
      legalWhen: [
        {
          // Illegal while the vehicle is already present (the presence fact
          // the acquire effect bakes) — one per character, for now.
          condition: (f: FactReader): boolean => f.num(`${F}.active`) === 0,
          diagnostics: [{ code: ALREADY_HAVE, severity: 'error' }]
        }
      ],
      ui: {
        section: 'free',
        name: `${T}.acquire.name`,
        description: `${T}.acquire.description`,
        detailKey: 'vehicle/tormentor',
        secondaryControl: AC_MODE_CONTROL,
        intents: { EQUIP: 'vehicle' },
        actionCost: []
      },
      vars: { mode: { capture: true, default: { number: 0 } } },
      // The evicts beside the replacement: a keyed replacement alone does not
      // fire dependents, so a re-acquire resets occupancy to the acquire default
      // (the acquirer counts), starts the vehicle upright AND whole — no damage
      // banked, no wreck — and resets the AC MODE to this row's selection,
      // explicitly (the steed recast/child-eviction pattern).
      apply: (f: FactReader, selections): ActionResult => {
        // Re-checked legality (the dash idiom) so a planned-anyway row carries
        // its own diagnostics from the fold — the re-acquire still executes as
        // the one keyed replacement (the facts stay single; nothing stacks).
        const diagnostics: Diagnostic[] = [];
        if (f.num(`${F}.active`) > 0) diagnostics.push({ code: ALREADY_HAVE, severity: 'error' });
        return {
          advertise: [tormentorAcquireEffect(modeFrom(selections)), ...evictChildEffects()],
          diagnostics
        };
      }
    },
    {
      // The VEHICLE's occupancy record: a vehicle action in the vehicle's +ADD
      // (free, gated on the acquire) whose slider (0..the baked capacity, opening
      // at the current used) writes ONE permanent KEYED effect — the steed
      // HP-modifier semantics: the keyed effect IS the stored value, re-apply
      // replaces, removing the chip clears the modification. No legality gates:
      // occupancy past the capacity is illegal-but-possible (the derive clamps
      // the read; diagnostics are deferred with acquiring's).
      id: 'set-tormentor-occupancy',
      when: acquired,
      ui: {
        section: 'free',
        subject: SUBJECT,
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
      // The VEHICLE's AC-mode record: always present while acquired (a mode is
      // a fact, not a resource — no legality gates), free, in the occupancy
      // intent class, with the same [Moving | Motionless] segmented control the
      // acquire offer carries — pre-showing the CURRENT mode, so the row opens on
      // the mode in force. Apply is IMMEDIATE (record-class): ONE permanent
      // KEYED effect storing the mode as the DISTINCT `acMotionless.recorded`
      // fact the resolved-mode derive prefers — re-applying replaces by key
      // (never stacks), and the acquire lifecycle evicts it (a fresh acquire resets
      // to the acquire selection).
      id: 'set-tormentor-ac-mode',
      when: acquired,
      ui: {
        section: 'free',
        subject: SUBJECT,
        name: `${T}.ac-mode.name`,
        description: `${T}.ac-mode.description`,
        secondaryControl: AC_MODE_CONTROL,
        intents: { HANDLE: 'gear' },
        actionCost: []
      },
      vars: { mode: { capture: true, default: { fact: `${F}.acMotionless.current` } } },
      apply: (_f, selections): ActionResult => ({
        advertise: [
          {
            id: AC_MODE_EFFECT_ID,
            key: AC_MODE_KEY,
            state: { [`${F}.acMotionless.recorded`]: modeFrom(selections) },
            display: {
              name: `${T}.ac-mode-effect.name`,
              section: 'mount',
              subject: SUBJECT
            },
            expiry: { kind: 'permanent' }
          }
        ]
      })
    },
    // The VEHICLE's damage/repair recorders (see HP_RECORDERS above).
    ...HP_RECORDERS,
    {
      // The VEHICLE's prone RECORDER: models the vehicle BEING knocked prone
      // (imposed by the outside world), free. The BOARD is the one structural
      // gate (unacquired there is no vehicle to knock); the already-prone state
      // is a LEGALITY gate, never a `when` (the engine's illegal-but-visible
      // contract — plan.ts keeps illegal offers applicable with diagnostics
      // and a planned-anyway row still executes): while prone the offer stays
      // visible and applicable, flagged illegal with its already-prone
      // diagnostic, and committing it anyway re-advertises the one keyed
      // record (newest-wins — still a single prone fact). No Speed leg: a
      // vehicle has no movement economy. State tracking only: no attack flags,
      // no movement legs, no incapacitated modelling this pass.
      id: 'knock-tormentor-prone',
      when: acquired,
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
        name: `${T}.knocked-prone.name`,
        description: `${T}.knocked-prone.description`,
        // Both prone offers flip to the vehicle's own condition text — what
        // fallen-prone means for a war machine, not for a rider.
        detailKey: 'vehicle/tormentor-prone',
        // A vehicle CONDITION files like the PC's: record-prone's CONDITION
        // 'held' sub-bucket (#467 taxonomy — "Prone (both offers)"), not the
        // HANDLE gear bucket the acquiring offers use.
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
      // has to flip it upright. The acquire is again the one structural gate;
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
      when: acquired,
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
        name: `${T}.flip-upright.name`,
        description: `${T}.flip-upright.description`,
        detailKey: 'vehicle/tormentor-prone',
        // The condition-END offer files with its condition ('held', like the
        // recorder) so both prone offers sit under the Conditions grouping in
        // the vehicle +ADD. The PLAYER's Get Up is a MOVE 'rise' offer because
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
      // The VEHICLE-side way out: gated on the acquire (structurally —
      // unacquired, the action does not exist at all), sitting under the
      // vehicle's +ADD panel so it appears exactly once acquiring has made that
      // panel available. Replaces the acquire effect by key (evicting every
      // vehicle record with it); no cost, no legality gates. Files beside the
      // acquire offer: EQUIP 'vehicle', the BUILD family.
      id: 'abandon-tormentor',
      when: acquired,
      ui: {
        section: 'free',
        subject: SUBJECT,
        name: `${T}.abandon.name`,
        description: `${T}.abandon.description`,
        intents: { EQUIP: 'vehicle' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [tormentorAbandonEffect(), ...evictChildEffects()]
      })
    }
  ],
  // The Prone Deficiency trait, surfaced as a NOTICE while the vehicle is
  // PRONE (the Life-Bond annotate pattern gated on the condition — PC-prone
  // parity: the condition triggers its notice, so acquired-but-upright carries
  // nothing). It is a condition the player must know BEFORE acting on the
  // vehicle's behalf: the Tormentor cannot right itself, so it stays prone
  // and can do nothing until something flips it upright. The gate is the
  // prone fact alone — the record never outlives the acquire (the effect's
  // dependents plus the explicit acquire/abandon evictions), so no separate
  // acquired check is needed. Own wording (the Tormentor is not SRD);
  // 'notice' == NOTICE_TARGET, a reserved label rule modules spell as a
  // literal (see condition-prone / find-steed).
  //
  // The DESTROYED wreck carries its own notice the same way: a state the crew
  // must know before acting on the vehicle's behalf (it can no longer act;
  // the way out is people, not repairs), gated on the destroyed fact alone —
  // the wreck never outlives the acquire either. Distinct key from the prone
  // notice, so a prone wreck (somehow) carries both.
  annotate: (f: FactReader): Annotation[] => {
    // No recorders' share: the below-threshold bounce is a per-row notice
    // diagnostic (threshold model v2 — informational feedback, never a panel
    // annotation). What remains are the standing notices.
    const out: Annotation[] = [];
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
