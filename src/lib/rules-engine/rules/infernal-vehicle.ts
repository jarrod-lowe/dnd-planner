import {
  currentHp,
  defineRule,
  hpRecorders,
  type ActionResult,
  type Annotation,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type LegalWhen,
  type Offer,
  type RuleModule,
  type SubjectPanelDeclaration
} from '../builder';

/**
 * The infernal-vehicle FACTORY — the whole war-machine rule group, built from
 * one spec (`buildInfernalVehicle(spec)`). Every infernal vehicle (the
 * Tormentor today; one rule group per vehicle, each its own module built here)
 * is the SAME machine: acquiring the vehicle as a PLAYER action that bakes the
 * stat block, the seat infrastructure with its take/leave pairs and one-seat
 * exclusivity, the HP pool with its damage/repair recorders and thresholds,
 * the prone pair, the wrecked boundary, the fuel/boost records, the movement
 * economy at the Helm, and the checks/saves record rollers. What differs
 * between vehicles is DATA — ids, subject, fact stem, stat-block numbers,
 * stations, detail keys — and it all arrives in the spec; nothing about a
 * specific vehicle is named in this file.
 *
 * The spec's `id` is the template root: the module id (registry/lazy), the
 * `rule.<id>.*` i18n stem (offer names, diagnostics, chip names), the offer
 * ids (`acquire-<id>`, `set-<id>-fuel`, `take-<id>-<station>-seat`, …) and the
 * effect ids/keys (`effect-<id>-acquire`/`<id>-acquire`, `<id>-seat-<station>`,
 * …). `subject` stamps every vehicle-side ui and panel declaration; `factStem`
 * is where every baked fact lives (`companion.<vehicle>.*`). Because the keys
 * are built from spec DATA, the static module-i18n-coverage scan cannot expand
 * them — tests/unit/rules-engine/infernal-vehicle.test.ts walks the EMITTED
 * module and pins that every key resolves in both locales.
 *
 * This file is machinery only; a vehicle's spec (with its own authored
 * comments) lives in its own module — see rules/vehicle-tormentor.ts.
 */

/** One weapon station's attack, as authored data (the fire offer + its numbers). */
export interface SeatWeaponSpec {
  /** i18n keys for the fire offer's row. */
  fire: { name: string; description: string };
  /** The fire offer's own no-action diagnostic key. */
  noAction: string;
  /**
   * The weapon's one RIDER rule, when its stat block carries one — the i18n
   * key of an UNCONDITIONAL per-row note on EVERY fire row (the dash-risk
   * idiom: ONE 'notice' diagnostic beside the spend, informational only,
   * never the error path — the row stays legal). The note states the whole
   * rule in the locale's own words and the engine wires NOTHING behind it:
   * what the rule's terms mean at the table is the GM's call. OMIT for a
   * weapon with no rider — its rows carry no note (the flinger's riders
   * stay detail copy).
   */
  rider?: string;
  /** Rules-mode detail the fire offer links. */
  detailKey: string;
  /** The station's attack numbers — the derives the dice-line vars read. */
  hitBonus: number;
  damageBonus: number;
  damageDie: number;
  damageCount: number;
  damageType: string;
}

/**
 * One MOVE TRAIT the stat block carries — a rule that fires on the vehicle's
 * OWN movement (the Crushing Wheels both infernal vehicles roll on; later the
 * Tormentor's Raking Scythes), as authored data. The factory turns each entry
 * into ONE unconditional 'notice' diagnostic on EVERY planned Drive row (the
 * dash-risk idiom exactly — see DASH_RISK): the note states the WHOLE rule in
 * the locale's own words, nothing is gated, recorded or counted behind it, and
 * the plan fold attaches it to that row alone. The save DC and the damage
 * travel as diagnostic `params` ({{dc}}/{{damage}} slots) COMPUTED from the
 * entry's data — the damage the dice AVERAGE plus the bonus, so a re-authored
 * stat block moves the number with no other edit. The trait's non-numeric
 * shape (which creatures it reaches, what befalls an already-prone creature)
 * lives in the note COPY, not in data — it is translated text either way.
 */
export interface MoveTraitSpec {
  /**
   * The trait's slug: the ROLL offer's id (`<slug>-<id>`, e.g.
   * wheels-tormentor) and the `rule.<id>.<slug>` i18n stem (name,
   * description, not_driven diagnostic).
   */
  slug: string;
  /**
   * i18n key of the trait's SHORT pointer NOTE — the LINKED chip annotation's
   * label on the Drive panel — an authored LITERAL per vehicle, per trait
   * (the SeatWeaponSpec.rider precedent), so the static module-i18n-coverage
   * scan sees it in the spec's source. The chip points at the roll row
   * (addsToPlan); the full rule lives in the roll offer's description.
   */
  note: string;
  /** The Dexterity save DC the trait's rule calls for (the {{dc}} param). */
  saveDc: number;
  /**
   * The trait's damage dice and type — the ROLL offer's damage-only dice
   * line, built from these values. The damageType rides as the IDENTIFIER
   * the render site localizes through the damage-type.* keys (every dice
   * line's convention) — never as a diagnostic param (the render sites
   * interpolate params raw, so a word there would leak English into every
   * translated sentence).
   */
  damageCount: number;
  damageDie: number;
  damageBonus: number;
  damageType: string;
}

/**
 * One station's seat, as authored data. The per-station i18n keys arrive as
 * LITERALS per station (module-i18n-coverage scans the source for
 * `${PREFIX}.suffix` templates — a key the helper built from the station string
 * would be invisible to it); the diagnostics are station-generic, templated
 * from the vehicle id by the factory. `consumesSeat` is the capacity question:
 * a rider INSIDE consumes one of the stat block's seats (a rider on the
 * OUTSIDE consumes none — the flag drives both the capacity derive's seat term
 * and whether the take offer carries the free-seat legality leg at all).
 * `detailKey` optionally links the TAKE offer to a station detail (the one
 * station whose rule is worth reading before taking it). `notice` optionally
 * states the station's one standing rule while the seat is held. `weapon`
 * optionally gives the station its attack (the fire offer + its derives).
 * `cover` optionally grants the rider a cover DEGREE while seated, on the
 * cover module's ordinal scale (0 none, 1 half, 2 three-quarters, 3 total) —
 * spec data feeding the factory's seat-cover contribution (see COVER_SEAT).
 */
export interface SeatSpec {
  station: string;
  take: { name: string; description: string };
  leave: { name: string; description: string };
  effectName: string;
  consumesSeat: boolean;
  detailKey?: string;
  notice?: { key: string; body: string };
  weapon?: SeatWeaponSpec;
  /** The cover degree a rider at this station benefits from (0-3 ordinal). */
  cover?: number;
}

/** One infernal vehicle's whole rule group, as authored data. */
export interface InfernalVehicleSpec {
  /** Canonical rule-group id: registry/lazy key and the `rule.<id>` i18n stem. */
  id: string;
  /** The vehicle's subject id: the seg-button view, the +ADD stripe, the chip. */
  subject: string;
  /** Every fact this module bakes lives under one stem (e.g. companion.tormentor). */
  factStem: string;
  /** The stat block acquiring bakes (HP bakes its BASE; the pool derives). */
  statBlock: {
    hpBase: number;
    damageThreshold: number;
    mishapThreshold: number;
    cargo: number;
    creatureCapacity: number;
    /** In stat-block order: drives the acquire bake, the panel chip, the rollers. */
    abilities: readonly {
      ability: 'str' | 'dex' | 'con';
      score: number;
      modifier: number;
      /** The CHECK recorder's name key (no shared per-ability check label exists). */
      checkName: string;
    }[];
  };
  /**
   * The [Moving | Motionless] AC mode, when the stat block carries one: the
   * acquire/record segmented control and the derived `ac.effective` (moving
   * while upright, motionless while parked). OMIT for a vehicle with a flat AC
   * — no mode control, no mode facts — and set `flatAc` instead.
   */
  acMode?: { moving: number; motionless: number };
  /**
   * The stat block's FLAT AC ("AC 19", no rider), when it carries no mode: the
   * same `ac.effective` derive and top-bar chip the mode resolves to, at one
   * fixed number — the flat-AC branch the mode machinery's absence leaves. A
   * spec must set at most one of `acMode`/`flatAc` (the build throws on both:
   * two writers to one derive); a vehicle with no AC line at all sets neither.
   */
  flatAc?: number;
  /** Speed by fuel ordinal (none / soul coin / demon ichor). */
  fuelSpeeds: readonly number[];
  /** What a standing boost adds to the effective speed. */
  boostBonus: number;
  /** The per-encounter Dash allowance base (the allowance is base + CON mod). */
  dashAllowanceBase: number;
  /**
   * The stat block's REACTION entry (the driver's Juke swerve), when it
   * carries one: the factory emits the Juke offer ONLY for a spec that sets
   * this — a vehicle whose stat block has no Reaction (the Demon Grinder)
   * never gets one, not even dormant behind the Helm gate. Optional machinery
   * for the same reason the AC shapes are: what a stat block does not carry
   * does not exist.
   */
  juke?: boolean;
  /**
   * The stat block's MOVE TRAITS — rules that fire on the vehicle's own
   * movement (Crushing Wheels, Raking Scythes), each an entry in
   * MoveTraitSpec. When set, each entry drives TWO surfaces: a SHORT LINKED
   * chip annotation on the Drive panel (the existing annotation-click
   * mechanism — tap it and the trait's roll row joins the plan; the DC its
   * only interpolation value) and a VEHICLE-level roll row (`<slug>-<id>`,
   * free, no seat, no spend) whose dice line carries the trait's damage and
   * whose description carries the whole rule. OMIT it for a vehicle whose
   * stat block carries none — no chips, no roll rows (what a stat block does
   * not carry does not exist, the juke/acMode optionality precedent), and a
   * later trait joins as data.
   */
  moveTraits?: readonly MoveTraitSpec[];
  /** Rules-mode detail keys (the flip targets). */
  details: {
    statBlock: string;
    damage: string;
    prone: string;
    helm: string;
    fuel: string;
  };
  /** Every live station's seat spec, in +ADD order. */
  seats: readonly SeatSpec[];
}

/**
 * The station the vehicle is DRIVEN from — every infernal vehicle's helm. The
 * Drive/Dash/Juke (and Fuel/Boost) offers gate on this station's seat; a spec
 * whose seat list omits it simply never surfaces them (the `when` gate reads
 * the seat fact).
 */
const HELM_STATION = 'helm';

/**
 * The SHARED movement spend — the ONE player-level fact every infernal
 * vehicle's Drive writes and every vehicle's `movement.remaining` reads. The
 * stem is `companion.vehicle.*` (the codebase's stem choice, documented here):
 * it sits in the companion namespace BESIDE the per-vehicle stems
 * (`companion.tormentor.*`, …) without being owned by any one vehicle's
 * `factStem`, so the spend belongs to the PLAYER's turn rather than to a
 * vehicle — no vehicle's acquire/abandon lifecycle lists the keyless spend
 * among its dependents, and none ever could. Consequences, all intended:
 *
 * - Same-turn driving across vehicles draws ONE pool (keyless endOfTurn
 *   effects writing one fact accumulate, so every driven foot lands in the
 *   same ledger) while each vehicle caps at its OWN total — remaining is
 *   always `<its own total> − <the shared spend>`, the cross-vehicle
 *   same-turn cap recorded as the Tormentor seats job's goal.
 * - The Dash doubling stays PER-VEHICLE (the `dashed` flag lives under the
 *   vehicle's stem), so dashing one machine never doubles another's pool.
 * - A LEGACY persisted spend under a per-vehicle stem
 *   (`<stem>.movement.spent`, the pre-shared shape Drive used to advertise)
 *   is tolerated: nothing derives or reads that name any more, so the old
 *   keyless effect is an inert fact that still expires at end of turn (the
 *   flat `ac.value`/`speed` bake precedent) — never a two-writer conflict.
 */
const VEHICLE_MOVEMENT_SPENT = 'companion.vehicle.movement.spent';

/**
 * The SHARED seat-cover fact — the seam cover.md PR-2 settled. Seat-sourced
 * cover is a CONTRIBUTION vehicles make to the PLAYER-level cover module, not
 * a vehicle-side copy of it: the cover module's `cover.effective` derive is
 * max(manual, seat) and reads THIS ONE FACT, and every cover-carrying vehicle
 * contributes its best HELD seat degree to it with `combine: 'max'` — so the
 * Tormentor, the Demon Grinder and any later vehicle co-write the fact with no
 * vehicle list anywhere (the engine's max combine enumerates them, the same
 * single-pool shape as VEHICLE_MOVEMENT_SPENT). The name lives in the COVER
 * namespace because the cover module owns the contract (the degree scale and
 * the effective derive); this constant and cover.ts spell it as literals on
 * purpose — a rule module importing another's chunk would break code-splitting
 * (the verify-chunks guard).
 *
 * The contribution is a DERIVATION of the seat facts alone (no acquire gate,
 * no lifecycle wiring): the leave offer's eviction and the acquire/abandon
 * lifecycle already clear the seat facts, and the contribution — reading only
 * those — falls with them automatically. Unset (no cover-carrying vehicle
 * loaded, or none seated) the fact simply reads 0 in the cover module.
 */
const COVER_SEAT = 'cover.seat';

/**
 * Every infernal-vehicle spec BUILT so far — the REGISTRY behind the one-seat-
 * per-player rule. `buildInfernalVehicle` is every vehicle module's entry
 * point (each rule group calls it at its module top level), so a spec joins
 * this map the moment its module loads, and the seat-exclusivity leg reads
 * the WHOLE map rather than the one spec behind the offer: a player holding
 * ANY station of ANY loaded vehicle cannot take a seat on another — the
 * GLOBAL one-seat rule the Demon Grinder plan settled beside per-vehicle
 * ownership (owning one of EACH vehicle rule group is legal). A later
 * vehicle is DATA-ONLY here: its spec registers itself, and no vehicle list
 * exists anywhere to update.
 *
 * Code-split note: Rollup emits this factory as ONE shared chunk every
 * vehicle chunk imports (see scripts/verify-chunks.mjs output), so the map is
 * a single instance per session however many vehicles load; a vehicle whose
 * chunk has not loaded contributes no seat facts to read, so an unloaded
 * vehicle is invisible to the leg by construction (and a character cannot
 * hold a seat on a vehicle whose group is not assigned).
 */
const VEHICLE_SPECS = new Map<string, InfernalVehicleSpec>();

/** The seat fact a station's effect writes on a given vehicle's stem. */
const seatFactOn = (spec: InfernalVehicleSpec, station: string): string =>
  `${spec.factStem}.seats.${station}`;

/** The stat block acquiring bakes, from the spec (HP bakes its BASE — the pool
 * derives from it, the steed shape — plus the damage/mishap thresholds as DATA
 * the recorder gates on; everything else is display-only). AC bakes NO value
 * at all when the vehicle carries an AC mode — the acquire selection's MODE
 * fact is the bake, and `ac.effective` derives the number — and Speed bakes
 * nothing ever: `speed.effective` derives from the fuel, so a flat `speed` name
 * is retired exactly like a flat `ac.value` (a legacy persisted bake stays
 * inert, never a two-writer conflict). */
const acquireState = (spec: InfernalVehicleSpec): Record<string, number> => {
  const F = spec.factStem;
  const state: Record<string, number> = {
    [`${F}.active`]: 1,
    [`${F}.hp.base`]: spec.statBlock.hpBase,
    [`${F}.damageThreshold`]: spec.statBlock.damageThreshold,
    [`${F}.mishapThreshold`]: spec.statBlock.mishapThreshold,
    [`${F}.cargo`]: spec.statBlock.cargo,
    [`${F}.creatureCapacity.max`]: spec.statBlock.creatureCapacity
  };
  for (const a of spec.statBlock.abilities) {
    state[`${F}.${a.ability}`] = a.score;
    state[`${F}.${a.ability}.modifier`] = a.modifier;
  }
  return state;
};

/**
 * Every vehicle record that must die with the acquire. The acquire effect declares
 * them as `dependents` (so a RAW mount-chip removal cascades), and the
 * acquire/abandon applies advertise empty same-key evictions beside their
 * replacement — a keyed replacement alone does not fire `dependents` (the
 * steed cast/dismiss child-eviction pattern). The seats ride the lifecycle
 * station by station (capacity-free is not lifecycle-free).
 */
const childKeys = (spec: InfernalVehicleSpec): string[] => [
  `${spec.id}-occupancy`,
  ...(spec.acMode ? [`${spec.id}-ac-mode`] : []),
  `${spec.id}-fuel`,
  `${spec.id}-boost`,
  `${spec.id}-prone`,
  `${spec.id}-hp-damage`,
  `${spec.id}-hp-heal`,
  `${spec.id}-destroyed`,
  ...spec.seats.map((seat) => `${spec.id}-seat-${seat.station}`)
];

/**
 * The acquire effect (permanent, keyed so a re-acquire or abandon REPLACES rather
 * than stacks). Exported so tests and later passes can seed an already-acquired
 * vehicle without driving the offer. `display` opts it onto the strip as a
 * MOUNT chip under its subject, and the `detailKey` is what the strip's flip
 * path reads — the mount chip flips to a stat-block detail. Every vehicle
 * record is a DEPENDENT, so raw mount-chip removal (playStore's `removeEffect`)
 * evicts them with the acquire instead of stranding a record under an abandoned
 * vehicle (the steed mount/STEED_CHILD_EFFECTS pattern).
 *
 * `acMotionless` is the MODE the acquire-offer segmented control selected (0
 * Moving — the default — 1 Motionless), when the spec carries an AC mode: the
 * selection flows into the effect state exactly the way the creature-type
 * choice flows into the steed effect. A LEGACY persisted acquire (pre-AC-mode)
 * baked a flat AC value and no mode fact; that shape still evaluates (the mode
 * reads as Moving) and its stale bake is inert — nothing derives that name.
 */
export function infernalAcquireEffect(spec: InfernalVehicleSpec, acMotionless = 0): EffectInstance {
  const F = spec.factStem;
  return {
    id: `effect-${spec.id}-acquire`,
    key: `${spec.id}-acquire`,
    state: {
      ...acquireState(spec),
      ...(spec.acMode ? { [`${F}.acMotionless`]: acMotionless } : {})
    },
    dependents: childKeys(spec),
    display: {
      name: `rule.${spec.id}.effect.name`,
      section: 'mount',
      subject: spec.subject,
      detailKey: spec.details.statBlock
    },
    expiry: { kind: 'permanent' }
  };
}

/** The selected mode from a segmented capture (Moving when unset). */
const modeFrom = (selections: Record<string, unknown>): number =>
  typeof selections.mode === 'number' ? selections.mode : 0;

/** The selected fuel/boost ordinal from a segmented capture (unset reads 0). */
const segmentedFrom = (selections: Record<string, unknown>, key: string): number =>
  typeof selections[key] === 'number' ? (selections[key] as number) : 0;

/**
 * The infernal-vehicle rule group. See the module doc — every string is
 * templated from the spec, every number read from it.
 */
export function buildInfernalVehicle(spec: InfernalVehicleSpec): RuleModule {
  const { id, subject } = spec;
  const F = spec.factStem;
  const T = `rule.${id}`;

  // The AC shapes are mutually exclusive: both would emit a second writer for
  // the one `ac.effective` derive (a combine conflict at evaluation). Fail at
  // build, where the spec is in hand, rather than at every evaluation.
  if (spec.acMode && spec.flatAc !== undefined)
    throw new Error(`${id}: a spec sets acMode AND flatAc — pick one AC shape`);

  // The spec joins the registry only once it has proven buildable (see
  // VEHICLE_SPECS) — re-building the same id replaces, never doubles up.
  VEHICLE_SPECS.set(spec.id, spec);

  // ── Effect ids and replacement keys (ONE live record each) ──
  const OCCUPANCY_EFFECT_ID = `effect-${id}-occupancy`;
  const OCCUPANCY_KEY = `${id}-occupancy`;
  const AC_MODE_EFFECT_ID = `effect-${id}-ac-mode`;
  const AC_MODE_KEY = `${id}-ac-mode`;
  const FUEL_EFFECT_ID = `effect-${id}-fuel`;
  const FUEL_KEY = `${id}-fuel`;
  const BOOST_EFFECT_ID = `effect-${id}-boost`;
  const BOOST_KEY = `${id}-boost`;
  const PRONE_EFFECT_ID = `effect-${id}-prone`;
  const PRONE_KEY = `${id}-prone`;
  const HP_DAMAGE_EFFECT_ID = `effect-${id}-hp-damage`;
  const HP_DAMAGE_KEY = `${id}-hp-damage`;
  const HP_HEAL_EFFECT_ID = `effect-${id}-hp-heal`;
  const HP_HEAL_KEY = `${id}-hp-heal`;
  const DESTROYED_EFFECT_ID = `effect-${id}-destroyed`;
  const DESTROYED_KEY = `${id}-destroyed`;

  const CHILD_KEYS = childKeys(spec);

  /** The seat fact a station's effect writes (`<stem>.seats.<station>`). */
  const seatFact = (station: string): string => seatFactOn(spec, station);

  /**
   * True while the player holds ANY station's seat — on ANY loaded vehicle.
   * One seat per player GLOBALLY: the reader enumerates the REGISTRY's every
   * built spec (VEHICLE_SPECS — DG seats, and any later vehicle, are data-only
   * joins), so a seat held on the Tormentor makes the Demon Grinder's takes
   * illegal exactly like a seat held at another station of the same vehicle.
   * Re-taking the seat you hold is the same illegal-but-committable path. A
   * capacity-free station is exclusive like every station — capacity-free is
   * not seat-free.
   */
  const seatedAnywhere = (f: FactReader): boolean =>
    [...VEHICLE_SPECS.values()].some((s) =>
      s.seats.some((seat) => f.num(seatFactOn(s, seat.station)) > 0)
    );

  /**
   * How many SEAT-CONSUMING seats the player holds — the capacity derive's seat
   * term. The registry is the SEAT SPECS (the one place a station says whether
   * its rider sits inside or clings to the outside): a capacity-free station
   * contributes nothing, so the derived occupancy never counts a rider hanging
   * off the hull.
   */
  const activeSeatCount = (f: FactReader): number =>
    spec.seats.reduce((n, seat) => n + (seat.consumesSeat ? f.num(seatFact(seat.station)) : 0), 0);

  // ── Diagnostics (each offer's own keys, templated from the id) ──

  /**
   * The take-seat offer's two legality legs (the duplicate-acquire
   * illegal-but-COMMITTABLE pattern): (a) ONE seat per player, globally — any
   * station's seat fact standing makes re-boarding illegal; (b) the free-seat
   * rule — no boarding while the derived capacity reads full.
   */
  const SEAT_TAKEN = `${T}.take-seat.already_seated`;
  const SEAT_FULL = `${T}.take-seat.full`;
  /** The leave-seat offer's single legality leg (the flip-upright not-prone idiom). */
  const NOT_SEATED = `${T}.leave-seat.not_seated`;

  /**
   * The damage recorder's below-threshold key — the INFORMATIONAL note a
   * Use-Threshold sub-threshold blow carries on its own planned row (threshold
   * model v2: the blow was legal to attempt; the app tells the player it
   * bounced).
   */
  const BELOW_THRESHOLD = `${T}.record-damage.below_threshold`;

  /**
   * The damage recorder's at-mishap-threshold key — the INFORMATIONAL note a
   * single-source recording that meets the baked mishap threshold carries on
   * its own planned row: the high-damage mirror of the bounce note, same slot
   * (a post-hoc consequence on the action row, never a standing notice), same
   * severity ('notice' rides the row and never blocks the record — the note is
   * not the bounce gate). The amount and the threshold travel as diagnostic
   * params for the locale's {{amount}}/{{threshold}} slots.
   */
  const MISHAP_THRESHOLD = `${T}.record-damage.mishap_threshold`;

  /** Each prone offer's single legality leg (the get-up not_prone idiom). */
  const ALREADY_PRONE = `${T}.knocked-prone.already_prone`;
  const NOT_PRONE = `${T}.flip-upright.not_prone`;

  /**
   * The acquire offer's single legality leg (the knocked-prone already-prone
   * idiom): ONE vehicle of this rule group per character — acquiring while one
   * is already present is ILLEGAL, never hidden (a character may own one of
   * EACH vehicle rule group; cross-vehicle ownership is a registry-level
   * question, not this leg's).
   */
  const ALREADY_HAVE = `${T}.acquire.already_have`;

  /**
   * The WRECKED legality leg — the one shared gate every vehicle ACTIVITY and
   * the REPAIR recorder carry while the destroyed wreck stands (the builder's
   * `notLockedLegal` shape): a destroyed war machine cannot act, and the way
   * back is people, not repairs. ONE own diagnostic for every offer that
   * carries it, appended LAST beside each offer's existing legs (all of which
   * keep composing), illegal-but-COMMITTABLE throughout (the engine's
   * illegal-but-visible contract): the offers stay visible and applicable, and
   * a planned-anyway row still executes carrying the diagnostic — the
   * projection showing what the rules would not have allowed. The BOUNDARY is
   * deliberate: damage recording (the blow happened — bookkeeping on a wreck)
   * and the seat offers (sitting on a wreck is somebody's choice) carry NO
   * wrecked leg. Gated offers: every weapon station's fire offer, drive, dash,
   * juke, fuel, boost and the heal recorder (via the factory's opt-in
   * `healLegality`).
   */
  const WRECKED = `${T}.wrecked`;
  const notWrecked: LegalWhen = {
    condition: (f: FactReader): boolean => f.num(`${F}.destroyed`) === 0,
    diagnostics: [{ code: WRECKED, severity: 'error' }]
  };

  /** The structural gate every VEHICLE action shares: the acquire effect is live. */
  const acquired = (f: FactReader): boolean => f.num(`${F}.active`) > 0;

  /** The helm seat's fact — the gate the drive/dash/juke/fuel/boost offers read. */
  const atHelm = (f: FactReader): boolean => f.num(seatFact(HELM_STATION)) > 0;

  /**
   * The abandon marker: same key as the acquire effect, no state, no display —
   * purely a replacement that evicts the acquire effect (and every fact it baked)
   * the moment it is newest. Hidden and permanent so nothing revives the stat
   * block until a fresh acquire replaces the marker in turn. The id deliberately
   * does not extend the acquire effect's id: effect-id matching treats
   * `effect-x-…` as the base `effect-x`, which would blur the two.
   */
  const abandonEffect = (): EffectInstance => ({
    id: `effect-abandon-${id}`,
    key: `${id}-acquire`,
    expiry: { kind: 'permanent' }
  });

  /**
   * Eviction of EVERY vehicle record (an empty same-key effect each — newest
   * wins, so the stored occupancy vanishes and `used` falls back to the acquire
   * default, the records clear, the prone record clears, the HP running totals
   * and the destroyed wreck go). Advertised beside BOTH the acquire effect (a
   * re-acquire starts FRESH: the acquirer counts, upright, whole, in the mode
   * THIS row selected — a new vehicle, not a persisted one) and the abandon
   * marker (no record outlives the acquire that justifies it) — the steed
   * cast/dismiss child-eviction pattern: a keyed replacement alone does not
   * fire `dependents`.
   */
  const evictChildEffects = (): EffectInstance[] =>
    CHILD_KEYS.map(
      (k): EffectInstance => ({ id: `evict-${k}`, key: k, expiry: { kind: 'permanent' } })
    );

  /**
   * The [Moving | Motionless] picker both AC-mode controls render — the steed
   * creature-type segmented precedent (a segmented control can only ever be a
   * `secondaryControl` in PanelRenderer). The values ARE the 0/1 motionless
   * flag: 0 Moving (the default), 1 Motionless.
   */
  const AC_MODE_CONTROL = {
    type: 'segmented',
    var: 'mode',
    prefix: `play.choices.${id}.mode`,
    options: [
      { value: 0, label: `${T}.mode.moving` },
      { value: 1, label: `${T}.mode.motionless` }
    ]
  } as const;

  /**
   * The [None | Soul Coin | Demon Ichor] picker the fuel record renders (the
   * AC-mode segmented precedent — a segmented control can only ever be a
   * `secondaryControl`). The values ARE the ordinals the record stores and the
   * fuel map reads: 0 none, 1 soul coin, 2 demon ichor.
   */
  const FUEL_CONTROL = {
    type: 'segmented',
    var: 'fuel',
    prefix: `play.choices.${id}.fuel`,
    options: [
      { value: 0, label: `${T}.fuel.none` },
      { value: 1, label: `${T}.fuel.soul-coin` },
      { value: 2, label: `${T}.fuel.demon-ichor` }
    ]
  } as const;

  /**
   * The [None | Demon Ichor] boost picker — 0 none (the default), 1 demon
   * ichor. The 1-minute duration is COPY ONLY: nothing times it, the player
   * flips the record back to none when the minute is up.
   */
  const BOOST_CONTROL = {
    type: 'segmented',
    var: 'boost',
    prefix: `play.choices.${id}.boost`,
    options: [
      { value: 0, label: `${T}.boost.none` },
      { value: 1, label: `${T}.boost.demon-ichor` }
    ]
  } as const;

  // ── Seats ──

  /**
   * The station's seat effect: ONE permanent KEYED record writing
   * `<stem>.seats.<station> = 1` — replaceable state, so a planned-anyway
   * re-take replaces by key rather than stacking. `display` files the chip
   * under the vehicle panel (the prone/ac-mode effect display pattern): the
   * at-a-glance "where am I seated".
   */
  const seatEffect = (seat: SeatSpec): EffectInstance => ({
    id: `effect-${id}-seat-${seat.station}`,
    key: `${id}-seat-${seat.station}`,
    state: { [seatFact(seat.station)]: 1 },
    display: { name: seat.effectName, section: 'mount', subject },
    expiry: { kind: 'permanent' }
  });

  /**
   * Eviction of the station's seat — the empty same-key idiom the flip-upright
   * offer uses (newest-wins clears the record while merely planned). Advertised
   * by the LEAVE offer (the clear) and by the acquire lifecycle through
   * CHILD_KEYS (a fresh vehicle starts with no seat).
   */
  const evictSeatEffect = (station: string): EffectInstance => ({
    id: `evict-${id}-seat-${station}`,
    key: `${id}-seat-${station}`,
    expiry: { kind: 'permanent' }
  });

  /**
   * ONE station's TAKE/LEAVE offer pair — the seat helper. Both are free
   * vehicle actions in the vehicle's +ADD (`when: acquired` — unacquired there
   * is no vehicle to sit in), filed with the acquire/abandon EQUIP 'vehicle'
   * family, and both are illegal-but-COMMITTABLE on their legs (the
   * duplicate-acquire pattern, the engine's illegal-but-visible contract: the
   * offer stays visible and applicable with its diagnostic, and a
   * planned-anyway row still executes — the take as the one keyed replacement,
   * the leave as a no-op eviction beside nothing to evict):
   *
   * - TAKE: leg (a) no seat held at ANY station (one seat per player,
   *   globally), leg (b) the free-seat rule (derived used < max) — but ONLY for
   *   a seat-consuming station: a rider on the outside takes no seat, so its
   *   take carries the exclusivity leg ALONE and clinging is LEGAL at a full
   *   vehicle. Apply re-checks the same legs (the dash idiom) so a
   *   planned-anyway row carries its own diagnostics from the fold.
   * - LEAVE: leg (a) THIS station's seat held. Its apply is the empty same-key
   *   eviction alone — leaving a seat never touches occupancy or any other
   *   vehicle state.
   */
  const seatOffers = (seat: SeatSpec): Offer[] => [
    {
      id: `take-${id}-${seat.station}-seat`,
      when: acquired,
      legalWhen: [
        {
          // One seat per player, globally: any station's seat fact standing
          // (this one included — re-taking the seat you hold is illegal).
          condition: (f: FactReader): boolean => !seatedAnywhere(f),
          diagnostics: [{ code: SEAT_TAKEN, severity: 'error' }]
        },
        // The free-seat rule — no boarding while the derived capacity reads
        // full — is a SEAT-CONSUMING station's leg alone (used counts the
        // recorded occupancy plus held consuming seats): a capacity-free
        // station takes no seat, so there is never one to need.
        ...(seat.consumesSeat
          ? [
              {
                condition: (f: FactReader): boolean =>
                  f.num(`${F}.creatureCapacity.used`) < f.num(`${F}.creatureCapacity.max`),
                diagnostics: [{ code: SEAT_FULL, severity: 'error' as const }]
              }
            ]
          : [])
      ],
      ui: {
        section: 'free',
        subject,
        name: seat.take.name,
        description: seat.take.description,
        ...(seat.detailKey ? { detailKey: seat.detailKey } : {}),
        intents: { EQUIP: 'vehicle' },
        actionCost: []
      },
      apply: (f: FactReader): ActionResult => {
        // Re-checked legality (the dash idiom) so a planned-anyway row carries
        // its own diagnostics from the fold — the row still executes as the
        // one keyed replacement (the seat fact stays single; nothing stacks).
        const diagnostics: Diagnostic[] = [];
        if (seatedAnywhere(f)) diagnostics.push({ code: SEAT_TAKEN, severity: 'error' });
        if (
          seat.consumesSeat &&
          f.num(`${F}.creatureCapacity.used`) >= f.num(`${F}.creatureCapacity.max`)
        )
          diagnostics.push({ code: SEAT_FULL, severity: 'error' });
        return { advertise: [seatEffect(seat)], diagnostics };
      }
    },
    {
      id: `leave-${id}-${seat.station}-seat`,
      when: acquired,
      legalWhen: [
        {
          // Illegal while the seat is not held (nothing to leave) — the
          // get-up shape: the offer stays visible, flagged illegal.
          condition: (f: FactReader): boolean => f.num(seatFact(seat.station)) > 0,
          diagnostics: [{ code: NOT_SEATED, severity: 'error' }]
        }
      ],
      ui: {
        section: 'free',
        subject,
        name: seat.leave.name,
        description: seat.leave.description,
        intents: { EQUIP: 'vehicle' },
        actionCost: []
      },
      apply: (f: FactReader): ActionResult => {
        // Re-checked legality (the dash idiom): an illegal row still executes
        // — the empty eviction beside nothing to evict, a fact no-op.
        const diagnostics: Diagnostic[] = [];
        if (f.num(seatFact(seat.station)) === 0)
          diagnostics.push({ code: NOT_SEATED, severity: 'error' });
        return { advertise: [evictSeatEffect(seat.station)], diagnostics };
      }
    }
  ];

  // ── Weapon stations ──

  /**
   * A weapon station's attack numbers as facts the fire offer's vars read (the
   * steed-slam pattern: per-attack derives beside the attack they belong to,
   * constants from the spec). Gated on the acquire like every other vehicle
   * number: unacquired they settle to 0, and the dice line is unreachable
   * anyway — the fire offer's gate being the seat.
   */
  const weaponDerives = (seat: SeatSpec) => {
    const weapon = seat.weapon!;
    return [
      {
        fact: `${F}.${seat.station}.hitBonus`,
        value: (f: FactReader): number => (acquired(f) ? weapon.hitBonus : 0)
      },
      {
        fact: `${F}.${seat.station}.damageBonus`,
        value: (f: FactReader): number => (acquired(f) ? weapon.damageBonus : 0)
      }
    ];
  };

  /**
   * A weapon station's FIRE offer — the station's whole point, and the one seat
   * offer that is a plan-row ACTION. `when` is the acquire AND the station's
   * seat (nobody at the station, no offer — the seat fact is the gate the
   * leave offer's eviction closes); the ACTION POOL is `legalWhen`, never
   * `when` (the engine's illegal-but-visible contract): with no action left the
   * offer stays visible and applicable with its own no-action diagnostic, and a
   * planned-anyway row still fires.
   *
   * The ECONOMY is the generic action spend (the Dash/simple-actions idiom),
   * NOT the weapon attacks' `attackActionSpend`: a VEHICLE action is not a PC
   * weapon attack, so Extra Attack neither applies nor is granted — firing
   * consumes the player's full ACTION, never a follow-up charge, and never
   * grants one. Apply advertises the plain `actions.spent` spend and NOTHING
   * else — no attack-pool facts, no facts of its own: the seat stays taken, no
   * ammunition is counted (that is detail text), and the vehicle's state is
   * untouched. The dice line reads the module derives; range and targets live
   * in the copy and the detail, not in range machinery. A weapon whose spec
   * carries a RIDER also emits it on EVERY fire row as an unconditional
   * 'notice' diagnostic after the error legs — the DASH_RISK idiom exactly:
   * the note states the whole rule, nothing is gated, recorded or counted
   * behind it, and the plan fold attaches it to that row alone.
   */
  const fireOffer = (seat: SeatSpec): Offer => {
    const weapon = seat.weapon!;
    /**
     * The fire offer's dice line: d20 + the derived hit bonus to hit, the
     * weapon's dice + the derived damage bonus (the HEAL_TOUCH count:2
     * precedent for a multi-die damage entry). NO ranges machinery — range and
     * target count are offer copy and detail text, not bands.
     */
    const control = {
      type: 'dice-line',
      dice: [
        { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
        {
          sides: weapon.damageDie,
          count: weapon.damageCount,
          bonus: { var: 'damageBonus' },
          purpose: 'damage',
          damageType: { string: weapon.damageType }
        }
      ]
    } as const;
    /**
     * The fire offer's vars, slam-spelled: both bonuses are CAPTURED reads of
     * the module derives (a planned row freezes the numbers it rolled with),
     * the damage die a plain constant — a vehicle weapon has no grip to follow.
     */
    const vars = {
      hitBonus: { capture: true, default: { fact: `${F}.${seat.station}.hitBonus` } },
      damageDie: { default: { number: weapon.damageDie } },
      damageBonus: { capture: true, default: { fact: `${F}.${seat.station}.damageBonus` } }
    } as const;
    return {
      id: `fire-${id}-${seat.station}`,
      when: (f: FactReader): boolean => acquired(f) && f.num(seatFact(seat.station)) > 0,
      legalWhen: [
        {
          condition: (f: FactReader): boolean => f.num('actions.remaining') > 0,
          diagnostics: [{ code: weapon.noAction, severity: 'error' }]
        },
        notWrecked
      ],
      ui: {
        section: 'action-attack',
        subject,
        name: weapon.fire.name,
        description: weapon.fire.description,
        detailKey: weapon.detailKey,
        intents: { ATTACK: 'weapons' },
        actionCost: ['action'],
        // The companion-suffixed roller label (the steed's COMPANION_DICE_LABEL
        // precedent): the fire panel lives under the vehicle subject, and every
        // subject panel scopes its labels so self-only riders cannot reach a
        // companion's rolls — the player spends the action, the VEHICLE fires.
        annotationLabels: ['dice.any.companion'],
        primaryControl: control
      },
      vars,
      apply: (f: FactReader): ActionResult => {
        // The generic action spend (the simple-actions actionOffer shape): ONE
        // keyless endOfTurn effect writing the action and nothing else, with
        // the legality re-checked so a planned-anyway row carries its own
        // diagnostic from the fold (the row still fires). Both legs, in leg
        // order — and BESIDE them, LAST, the weapon's RIDER rule when the
        // spec carries one (the dash-risk idiom): an unconditional 'notice'
        // stating the whole rule, informational only, never gated and never
        // a mechanic — the row informs, the GM adjudicates.
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: weapon.noAction, severity: 'error' });
        if (f.num(`${F}.destroyed`) > 0) diagnostics.push({ code: WRECKED, severity: 'error' });
        if (weapon.rider) diagnostics.push({ code: weapon.rider, severity: 'notice' });
        return {
          advertise: [{ id: 'cost', state: { 'actions.spent': 1 }, expiry: { kind: 'endOfTurn' } }],
          diagnostics
        };
      }
    };
  };

  const weaponSeats = spec.seats.filter((seat) => seat.weapon !== undefined);

  /**
   * The stations that grant their rider a cover degree — the spec data behind
   * the seat-cover contribution. A spec with none (the Demon Grinder's
   * seat-free base) emits NO contribution at all: what a stat block does not
   * carry does not exist (the juke/acMode optionality precedent).
   */
  const coverSeats = spec.seats.filter((seat) => seat.cover !== undefined);

  // ── Prone and the wreck ──

  /**
   * The vehicle's Prone Deficiency, as STATE TRACKING ONLY. The vehicle is not
   * immune to Prone (its condition-immunity list omits it), and — unlike a
   * creature — it cannot right itself: flipped on its side it stays there and
   * can do nothing until something flips it upright. The fact is NAMESPACED
   * (`<stem>.prone`) under its own key, NEVER the player-global
   * `condition.prone`: conditions are player-global today, and the builder's
   * `proneEffect()` would flip the PLAYER's attack disadvantage flags, notice
   * and movement legs — a prone vehicle is not a prone rider. PERMANENT, unlike
   * the player's `untilShortRest` prone: no rest clears it, because a rest does
   * not right a vehicle — only Flip Upright (or the acquire lifecycle) does.
   * `display` files the chip under the vehicle view like the occupancy record's.
   */
  const proneEffect = (): EffectInstance => ({
    id: PRONE_EFFECT_ID,
    key: PRONE_KEY,
    state: { [`${F}.prone`]: 1 },
    display: {
      name: `${T}.prone-effect.name`,
      section: 'mount',
      subject,
      // The chip flips to the vehicle's own prone detail — the same path the
      // acquire chip uses (the player's condition/prone text would promise a
      // creature's crawling and self-righting).
      detailKey: spec.details.prone
    },
    expiry: { kind: 'permanent' }
  });

  /**
   * Eviction of the prone record — the same empty same-key idiom the player's
   * Get Up uses, advertised three ways: beside the flip-upright offer (the
   * clear), the acquire effect (a re-acquire starts upright) and the abandon
   * marker (the record never outlives the acquire).
   */
  const evictProneEffect = (): EffectInstance => ({
    id: `evict-${PRONE_KEY}`,
    key: PRONE_KEY,
    expiry: { kind: 'permanent' }
  });

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
  const destroyedEffect = (): EffectInstance => ({
    id: DESTROYED_EFFECT_ID,
    key: DESTROYED_KEY,
    state: { [`${F}.destroyed`]: 1 },
    display: {
      name: `${T}.destroyed-effect.name`,
      section: 'mount',
      subject
    },
    expiry: { kind: 'permanent' }
  });

  // ── Panels ──

  /**
   * The subject's top-bar and resource entries, gated on `active` (present only
   * while the acquire effect lives — removing the mount chip takes every fact with
   * it).
   */
  const PANELS: SubjectPanelDeclaration[] = [
    {
      // HP is a POOL (the damageable pass): the steed's chip shape — usedMax
      // renders "remaining/total", so it reads "45/60" and drops with recorded
      // damage. The gate stays `active` (a baked fact, absent when the acquire
      // goes), not the derived hp.max (which settles to 0, never absent).
      subject,
      panel: 'topBar',
      gate: `${F}.active`,
      entry: {
        type: 'usedMax',
        label: `play.stats.${subject}.hp`,
        total: `${F}.hp.max`,
        remaining: `${F}.hp.current`
      }
    },
    // The DERIVED AC chip, for EITHER AC shape: the mode's resolve (moving
    // while rolling, the motionless number while parked) or a flat spec's one
    // fixed number — a flat AC read is retired with the bake either way (a
    // legacy acquire's stale bake must never reach the chip).
    ...(spec.acMode || spec.flatAc !== undefined
      ? [
          {
            subject,
            panel: 'topBar' as const,
            gate: `${F}.active`,
            entry: {
              type: 'value' as const,
              label: `play.stats.${subject}.ac`,
              fact: `${F}.ac.effective`
            }
          }
        ]
      : []),
    {
      // The DERIVED speed (the fuel's — the fuelSpeeds map, plus the boost
      // while it stands): the flat `speed` read is retired with the bake (a
      // legacy acquire's stale bake must never reach the chip).
      subject,
      panel: 'topBar',
      gate: `${F}.active`,
      entry: {
        type: 'value',
        label: `play.stats.${subject}.speed`,
        fact: `${F}.speed.effective`
      }
    },
    {
      // The FUEL as its NAME, not its ordinal: valueLabels maps the numeric
      // current to the i18n keys the segmented control shares, so the chip
      // reads "Soul Coin" (the render sites translate; unmapped reads the raw
      // number). Deliberately NO Boost entry — the boost state is the record
      // chip + the control's pre-show, nothing more.
      subject,
      panel: 'topBar',
      gate: `${F}.active`,
      entry: {
        type: 'value',
        label: `play.stats.${subject}.fuel`,
        fact: `${F}.fuel.current`,
        valueLabels: {
          0: `${T}.fuel.none`,
          1: `${T}.fuel.soul-coin`,
          2: `${T}.fuel.demon-ichor`
        }
      }
    },
    {
      // Cargo capacity: display-only alongside the other stat-block values.
      subject,
      panel: 'topBar',
      gate: `${F}.active`,
      entry: {
        type: 'value',
        label: `play.stats.${subject}.cargo`,
        fact: `${F}.cargo`
      }
    },
    {
      // Like the steed's chip, but spec abilities, no saveFact (a vehicle has
      // no save-proficiency concept — the save recorders roll the plain baked
      // modifier).
      subject,
      panel: 'topBar',
      gate: `${F}.active`,
      entry: {
        type: 'ability',
        label: 'play.topBar.abilities',
        abilities: spec.statBlock.abilities.map((a) => ({
          name: `play.stats.${a.ability}`,
          fact: `${F}.${a.ability}.modifier`
        }))
      }
    },
    // ── Resources (the ledger's vehicle view) ──
    {
      // The one live resource: Creature Capacity. `usedMax` renders
      // "remaining/total"; for capacity the meaningful number is OCCUPANTS, so
      // the `remaining` slot carries `used` — the row reads "1/4", "3/4" (used
      // of max, not open seats).
      subject,
      panel: 'resources',
      gate: `${F}.active`,
      entry: {
        type: 'usedMax',
        label: `play.stats.${subject}.creatureCapacity`,
        total: `${F}.creatureCapacity.max`,
        remaining: `${F}.creatureCapacity.used`
      }
    },
    {
      // The movement pool — the steed's resources row, copied: usedMax renders
      // "remaining/total" ("70/100") against the derived economy, spent by
      // Drive, doubled by Dash, reset each turn. Gate on `active` like every
      // vehicle entry (the derives settle to 0 unacquired, never absent).
      subject,
      panel: 'resources',
      gate: `${F}.active`,
      entry: {
        type: 'usedMax',
        label: `play.stats.${subject}.movement`,
        total: `${F}.movement.total`,
        remaining: `${F}.movement.remaining`
      }
    }
  ];

  // ── The HP recorders (the shared builder factory) ──

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
   * acting) — while the MISHAP TRIGGER also rides the recording ROW itself: the
   * acquire bakes the mishap threshold, and the factory's OPT-IN mishap option
   * names the fact, so a single-source recording that meets it carries ONE
   * informational note on that row alone. The repair offer keeps the minimal
   * surface (no detailKey, no threshold control — repairs never bounce) but
   * carries the ONE shared WRECKED leg (the factory's opt-in healLegality): a
   * destroyed war machine cannot be patched back to life, so repairs are
   * illegal-but-COMMITTABLE while the wreck stands — the row still records
   * (capped at the missing HP) carrying the wrecked diagnostic. The DAMAGE
   * direction carries no legs: a wrecked vehicle still takes the blows that
   * land on it.
   */
  const HP_RECORDERS = hpRecorders({
    idStem: `record-${id}`,
    when: acquired,
    subject,
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
      detailKey: spec.details.damage,
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
    // The one shared WRECKED leg, on the HEAL direction alone (see above).
    healLegality: [notWrecked],
    mishap: {
      thresholdFact: `${F}.mishapThreshold`,
      noteKey: MISHAP_THRESHOLD
    },
    lethal: { effects: () => [destroyedEffect()], keepRecord: true }
  });

  // ── The checks/saves record rollers ──

  /**
   * The outcome picker every vehicle save recorder renders — the steed's
   * SAVE_OUTCOME_CONTROL copy (find-steed) exactly: shared planner.record.*
   * labels, no new keys.
   */
  const SAVE_OUTCOME_CONTROL = {
    type: 'segmented',
    var: 'passed',
    prefix: 'play.choices.save.outcome',
    options: [
      { value: -1, label: 'planner.record.outcome.none' },
      { value: 1, label: 'planner.record.passed' },
      { value: 0, label: 'planner.record.failed' }
    ]
  } as const;

  /**
   * A vehicle SAVE recorder — the steed's steedSaveOffer copy (the PC-parity
   * house rule): a free-section vehicle row while acquired, d20 + the BAKED
   * modifier (the dice-line bonus READS `<stem>.<ability>.modifier` — never a
   * hardcoded number), the shared pass/fail outcome segmented, and the
   * save/dice labels companion-suffixed so a self-only rider cannot reach the
   * vehicle's rolls. UI-only (no apply, the steed shape): rolling records
   * nothing, and the name reuses the shared `planner.record.save.<ability>` key
   * the player's and the steed's rows already render.
   */
  const saveOffer = (a: string): Offer => ({
    id: `${id}-save-${a}`,
    when: acquired,
    ui: {
      section: 'free',
      subject,
      name: `planner.record.save.${a}`,
      annotationLabels: ['save.any.companion', `save.${a}.companion`, 'dice.any.companion'],
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'save' }]
      },
      secondaryControl: SAVE_OUTCOME_CONTROL,
      intents: { SAVE: 'vehicle' },
      actionCost: []
    },
    vars: {
      rollBonus: { capture: true, default: { fact: `${F}.${a}.modifier` } },
      passed: { capture: true, default: { number: -1 } }
    }
  });

  /**
   * A vehicle CHECK recorder — the steed's steedSkillOffer copy: the plain d20 +
   * modifier dice-line under the companion dice label alone, free and UI-only
   * like the save beside it. Deliberately NOT seat-gated (a station's
   * stay-attached check is a live use, but the row records whatever the GM
   * calls for on the VEHICLE, not a station's action) and deliberately NOT
   * wrecked-gated — the bookkeeping boundary of the wrecked pass, exactly like
   * damage recording: a destroyed war machine is still called on to make
   * checks and saves, and the way back is people, not repairs.
   */
  const checkOffer = (a: (typeof spec.statBlock.abilities)[number]): Offer => ({
    id: `${id}-check-${a.ability}`,
    when: acquired,
    ui: {
      section: 'free',
      subject,
      name: a.checkName,
      annotationLabels: ['dice.any.companion'],
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'check' }]
      },
      intents: { CHECK: 'vehicle' },
      actionCost: []
    },
    vars: {
      rollBonus: { capture: true, default: { fact: `${F}.${a.ability}.modifier` } }
    }
  });

  // ── The AC mode, resolved once (a spec without one never emits the derives
  // below — the ?? 0 defaults are unreachable placeholders, never read) ──
  const AC_MOVING = spec.acMode?.moving ?? 0;
  const AC_MOTIONLESS = spec.acMode?.motionless ?? 0;

  // ── Drive/Dash/Juke controls and diagnostics ──

  /** The fire-independent diagnostics of the Helm's three offers. */
  const DRIVE_NO_ACTION = `${T}.drive.no_action`;
  const DRIVE_OUT_OF_MOVEMENT = `${T}.drive.out_of_movement`;
  const DASH_NO_BONUS = `${T}.dash.no_bonus_action`;
  const JUKE_NO_REACTION = `${T}.juke.no_reaction`;
  const JUKE_UNABLE_TO_MOVE = `${T}.juke.unable_to_move`;
  const FUEL_NO_BONUS = `${T}.fuel.no_bonus_action`;
  const BOOST_NO_BONUS = `${T}.boost.no_bonus_action`;
  const BOOST_WITHOUT_SOUL_COIN = `${T}.boost.without_soul_coin`;

  /**
   * The dash RISK note — the informational diagnostic EVERY planned Dash row
   * carries, unconditionally. The stat block's Ability Scores fine print: each
   * encounter the vehicle can Dash a base number of times plus its
   * Constitution modifier, and each Dash beyond that runs the risk of damaging
   * the vehicle. The app has NO encounter tracking — it cannot know where the
   * player sits in that count, and the player counts — so the row states the
   * WHOLE rule and nothing is gated, recorded or counted: ONE 'notice'
   * diagnostic beside its spend, which the plan fold attaches to THAT planned
   * row alone (planDiagnostics is per-instance). The plan stays LEGAL (a notice
   * is informational, never the error path), and the note lives exactly as long
   * as the row does — never a standing notice (a post-choice risk is not a
   * standing condition), never a panel annotation. The allowance travels as
   * diagnostic `params` (computed from the facts at fold time, the spec base +
   * the baked Constitution modifier — no hardcoded total) for the locale's
   * {{allowance}} slot, so a re-baked stat block moves the number with no other
   * edit.
   */
  const DASH_RISK = `${T}.dash.risk`;

  /**
   * The MOVE-TRAIT chips — the trait notes as LINKED annotations on the Drive
   * panel (the user's hands-on correction: the note must LINK to the roll row
   * via the EXISTING annotation-click mechanism — the Extra Attack / Heroic
   * Inspiration / Divine Smite pattern). Each chip's KEY is the trait's note
   * key (a POINTER, never the rulebook: creatures passed over must save, DC
   * in the `values` slot, or take the wheels' damage), it targets the Drive
   * offer's own label below — PER SUBJECT, so one vehicle's chip never lands
   * on another's drive panel — and `addsToPlan` names the trait's ROLL row:
   * tap the chip, the roll row joins the plan. Emitted only while the vehicle
   * is acquired; the chip renders exactly where the Drive panel does (the
   * label rides the drive offer's `annotationLabels`), so no panel, no chip.
   * A spec with no move traits emits NOTHING (the juke/acMode optionality
   * precedent: what a stat block does not carry does not exist).
   */
  const MOVE_TRAIT_LABEL = `move.vehicle.${subject}.companion`;
  const moveTraitAnnotations = (f: FactReader): Annotation[] =>
    spec.moveTraits && acquired(f)
      ? spec.moveTraits.map((trait) => ({
          key: trait.note,
          targets: [MOVE_TRAIT_LABEL],
          values: { dc: trait.saveDc },
          addsToPlan: { offer: `${trait.slug}-${id}` }
        }))
      : [];

  /**
   * The PER-VEHICLE drove marker — the fact Drive's spend writes beside the
   * shared pool (`<stem>.movement.drove`, endOfTurn like the spend itself)
   * and the move-trait roll rows gate on: THIS vehicle has driven this turn.
   * Deliberately the vehicle's OWN stem, never the shared spend fact: the
   * spend pools every machine's feet into one ledger (the cross-vehicle
   * cap), but driving one machine must never unlock another's wheels — the
   * marker names the machine whose wheels actually turned. It ages away with
   * the turn, so a new turn's wheels wait for a new Drive.
   */
  const DROVE_FACT = `${F}.movement.drove`;

  /**
   * A MOVE TRAIT's ROLL row — the trait's dice, offered at the VEHICLE
   * level (`<slug>-<id>`, e.g. wheels-tormentor): the consequence surface of
   * driving (the user-review restructure). The recorder shape throughout —
   * `when` the acquire ALONE (no Helm seat: the wheels roll whether or not
   * anyone drives), the FREE section with NO economy spend (a creature being
   * run over is not anybody's action choice), and NO apply at all: the row
   * rolls dice and commits nothing, exactly like the save/check recorders it
   * sits beside. The damage is a DICE LINE built from the entry (damage
   * ONLY — the save is the creatures' own roll, not ours) whose damageType
   * rides as the IDENTIFIER the render site localizes through the
   * damage-type.* keys, every dice line's convention. ONE legality leg of
   * its own beside the shared wrecked leg: the vehicle has DRIVEN this turn
   * (the DROVE_FACT marker above) — illegal-but-COMMITTABLE before driving
   * (the engine's contract; with no apply, a planned-anyway row carries its
   * gate diagnostics and commits nothing). The offer's DESCRIPTION carries
   * the whole trait rule (numbers hardcoded there per the fire-offer
   * description convention — the dice line carries the formula) and
   * advertises Drive as the trigger.
   */
  const traitRollOffer = (trait: MoveTraitSpec): Offer => ({
    id: `${trait.slug}-${id}`,
    when: acquired,
    legalWhen: [
      {
        condition: (f: FactReader): boolean => f.num(DROVE_FACT) > 0,
        diagnostics: [{ code: `${T}.${trait.slug}.not_driven`, severity: 'error' }]
      },
      notWrecked
    ],
    ui: {
      section: 'free',
      subject,
      name: `${T}.${trait.slug}.name`,
      description: `${T}.${trait.slug}.description`,
      detailKey: spec.details.statBlock,
      // The user's correction: the wheels are in no way a save — the row
      // FILES with the vehicle's weapon offers (the harpoon/bite/swing rows'
      // own ATTACK bucket) while keeping the recorder shape (free, no spend).
      intents: { ATTACK: 'weapons' },
      actionCost: [],
      annotationLabels: ['dice.any.companion'],
      primaryControl: {
        type: 'dice-line',
        dice: [
          {
            sides: trait.damageDie,
            count: trait.damageCount,
            ...(trait.damageBonus > 0 ? { bonus: { number: trait.damageBonus } } : {}),
            purpose: 'damage',
            damageType: { string: trait.damageType }
          }
        ]
      }
    }
  });

  /**
   * Drive's distance slider — the steed's STEED_MOVE_CONTROL/STEED_MOVE_VARS
   * shape exactly (find-steed): record the actual feet driven rather than a
   * fixed chunk, bounded by the (Dash-doubled) total, so a short roll of the
   * machine doesn't consume the whole pool.
   */
  const DRIVE_CONTROL = {
    type: 'slider',
    var: 'distance',
    max: { fact: `${F}.movement.total` },
    step: 5,
    unit: 'ft'
  } as const;
  const DRIVE_VARS = {
    // min 0: an over-committed prefix can read remaining negative — never a
    // meaningful opening distance (authored min, mirroring the steed moves).
    distance: { capture: true, min: 0, default: { fact: `${F}.movement.remaining` } }
  } as const;
  /** Feet to spend for a drive: the captured distance, else all remaining. */
  const driveDistance = (f: FactReader, selections: Record<string, unknown>): number =>
    typeof selections.distance === 'number'
      ? selections.distance
      : f.num(`${F}.movement.remaining`);

  /**
   * The VEHICLE's AC-mode record (a spec with an AC mode only): always present
   * while acquired (a mode is a fact, not a resource — no legality gates),
   * free, in the occupancy intent class, with the same [Moving | Motionless]
   * segmented control the acquire offer carries — pre-showing the CURRENT
   * mode, so the row opens on the mode in force. Apply is IMMEDIATE
   * (record-class): ONE permanent KEYED effect storing the mode as the
   * DISTINCT `acMotionless.recorded` fact the resolved-mode derive prefers —
   * re-applying replaces by key (never stacks), and the acquire lifecycle
   * evicts it (a fresh acquire resets to the acquire selection).
   */
  const acModeRecordOffer = (): Offer => ({
    id: `set-${id}-ac-mode`,
    when: acquired,
    ui: {
      section: 'free',
      subject,
      name: `${T}.ac-mode.name`,
      description: `${T}.ac-mode.description`,
      secondaryControl: AC_MODE_CONTROL,
      intents: { HANDLE: 'gear' },
      actionCost: []
    },
    vars: { mode: { capture: true, default: { fact: `${F}.acMotionless.current` } } },
    apply: (_f: FactReader, selections: Record<string, unknown>): ActionResult => ({
      advertise: [
        {
          id: AC_MODE_EFFECT_ID,
          key: AC_MODE_KEY,
          state: { [`${F}.acMotionless.recorded`]: modeFrom(selections) },
          display: {
            name: `${T}.ac-mode-effect.name`,
            section: 'mount',
            subject
          },
          expiry: { kind: 'permanent' }
        }
      ]
    })
  });

  /**
   * The HELM's Juke — the driver's REACTION (the stat block's defensive
   * swerve: advantage on Dexterity saving throws), built only for a spec that
   * carries a Reaction row (`juke`). `when` is the acquire AND the helm seat
   * like the station's actions; the economy is the reaction pool (the unarmed
   * opportunity-attack spelling): the PLAYER's reaction, spent through the
   * plain `reactions.spent` and NOTHING else — no facts of its own, because
   * the advantage is applied at the table (the plan row records the intent;
   * no dice are wired). TWO legality legs, both illegal-but-COMMITTABLE with
   * their OWN keys: (a) the reaction pool; (b) the vehicle able to move — the
   * derived speed AND the prone record together (out of fuel or fallen over,
   * one shared diagnostic: a machine that cannot roll cannot swerve).
   */
  const jukeOffer = (): Offer => ({
    id: `juke-${id}`,
    when: (f: FactReader): boolean => acquired(f) && atHelm(f),
    legalWhen: [
      {
        condition: (f: FactReader): boolean => f.num('reactions.remaining') > 0,
        diagnostics: [{ code: JUKE_NO_REACTION, severity: 'error' }]
      },
      {
        condition: (f: FactReader): boolean =>
          f.num(`${F}.speed.effective`) > 0 && f.num(`${F}.prone`) === 0,
        diagnostics: [{ code: JUKE_UNABLE_TO_MOVE, severity: 'error' }]
      },
      notWrecked
    ],
    ui: {
      section: 'reaction',
      subject,
      name: `${T}.juke.name`,
      description: `${T}.juke.description`,
      detailKey: spec.details.helm,
      intents: { REACT: 'ward' },
      actionCost: ['reaction']
    },
    apply: (f: FactReader): ActionResult => {
      // The reaction spend alone, with the legality re-checked (the dash
      // idiom) so a planned-anyway row carries its own diagnostics from the
      // fold — the row still spends the reaction. The able-to-move
      // re-check mirrors the leg exactly: unfuelled or prone, the same one
      // diagnostic.
      const diagnostics: Diagnostic[] = [];
      if (f.num('reactions.remaining') <= 0)
        diagnostics.push({ code: JUKE_NO_REACTION, severity: 'error' });
      if (f.num(`${F}.speed.effective`) <= 0 || f.num(`${F}.prone`) > 0)
        diagnostics.push({ code: JUKE_UNABLE_TO_MOVE, severity: 'error' });
      if (f.num(`${F}.destroyed`) > 0) diagnostics.push({ code: WRECKED, severity: 'error' });
      return {
        advertise: [{ id: 'cost', state: { 'reactions.spent': 1 }, expiry: { kind: 'endOfTurn' } }],
        diagnostics
      };
    }
  });

  const vehicle: RuleModule = {
    id,
    meta: {
      name: `${T}.name`,
      description: `${T}.description`,
      keywords: `${T}.keywords`
    },
    panels: PANELS,
    derive: () => [
      {
        // Occupancy used: the RECORDED occupancy (the slider's NPCs/manual
        // base) plus every held SEAT-CONSUMING seat (each inside station's
        // effect contributes 1; a capacity-free station's contributes none — a
        // rider on the outside is no occupant — so a freshly acquired vehicle
        // reads 0/max until someone takes a seat or records an occupancy). The
        // READ clamps the SUM to 0..max — the slider's own bound is UI-only, so
        // a stale or foreign stored value can never read past the stat block,
        // and a planned-anyway boarding at capacity reads max, never max+1.
        // Unacquired, the contribution reads 0.
        fact: `${F}.creatureCapacity.used`,
        value: (f) => {
          if (f.num(`${F}.active`) === 0) return 0;
          const max = f.num(`${F}.creatureCapacity.max`);
          return Math.min(
            Math.max(f.num(`${F}.creatureCapacity.occupancy`) + activeSeatCount(f), 0),
            max
          );
        }
      },
      // The HP POOL, in the steed's shape (a fixed stat block: max = base, no
      // max-modifier, no manual setters — damage and repairs are RECORDS): max
      // derives from the baked base, current starts at the max and follows the
      // net modifier down (floored at 0, never over the max — `currentHp` is the
      // player's own formula, shared so the two can never disagree), and the
      // modifier reads heals recorded − damage recorded. All gated on `active`:
      // unacquired the pool settles to 0 rather than vanishing (the
      // contributions stay registered), which is why the panel gates key on
      // `active`.
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
      ...(spec.acMode
        ? [
            {
              // The RESOLVED AC mode: the vehicle record when one stands, else
              // the acquire bake — the occupancy has-preference idiom, and
              // deliberately a DISTINCT recorded fact: the engine
              // sum-combines two live effects writing one fact, so a mode
              // record writing `acMotionless` itself could never flip a
              // Motionless acquire back to Moving (1 + 0 still reads 1). A
              // LEGACY acquire (no acMotionless baked) resolves to Moving here.
              fact: `${F}.acMotionless.current`,
              value: (f: FactReader): number =>
                (f.has(`${F}.acMotionless.recorded`)
                  ? f.num(`${F}.acMotionless.recorded`)
                  : f.num(`${F}.acMotionless`)) > 0
                  ? 1
                  : 0
            },
            {
              // The stat block's "AC N (M while motionless)" as a DERIVED fact
              // under a deliberately NEW name: legacy persisted acquires bake a
              // flat AC value, and a derive on the same name would
              // two-writer-conflict on every evaluation of such a character
              // (the pass-3 hp.max lesson). The stale legacy bake is inert —
              // nothing derives or reads that name any more. Gated on `active`
              // like the pool, so an unacquired vehicle reads 0 and the panel
              // gate holds the chip back.
              fact: `${F}.ac.effective`,
              value: (f: FactReader): number =>
                acquired(f)
                  ? f.num(`${F}.acMotionless.current`) > 0
                    ? AC_MOTIONLESS
                    : AC_MOVING
                  : 0
            }
          ]
        : []),
      // The FLAT-AC branch (a spec that sets `flatAc`, no mode): the stat
      // block's one number as the SAME derive the mode resolves to — the
      // top-bar chip reads it identically, and no mode fact or control exists
      // anywhere. Like the pool, gated on `active` so an unacquired vehicle
      // reads 0 and the panel gate holds the chip back.
      ...(spec.flatAc !== undefined
        ? [
            {
              fact: `${F}.ac.effective`,
              value: (f: FactReader): number => (acquired(f) ? spec.flatAc! : 0)
            }
          ]
        : []),
      // Every weapon station's numbers, station by station.
      ...weaponSeats.flatMap((seat) => weaponDerives(seat)),
      // The SEAT-COVER contribution (COVER_SEAT above): the vehicle's best
      // HELD cover seat, `combine: 'max'` so every cover-carrying vehicle
      // co-writes the one player-level fact. Deliberately a derivation of the
      // SEAT FACTS ALONE — no `active` gate, no lifecycle wiring: the seat
      // facts only stand while their seat effects do (the leave eviction, the
      // acquire lifecycle), so the contribution vanishes with the seat for
      // free, and two standing seat facts (the planned-anyway exclusivity
      // override) contribute the more protective degree — cover never stacks,
      // the SRD's most-protective-degree rule, which the player-side
      // cover.effective max applies again against the manual record.
      ...(coverSeats.length > 0
        ? [
            {
              fact: COVER_SEAT,
              combine: 'max' as const,
              value: (f: FactReader): number =>
                Math.max(
                  0,
                  ...coverSeats.map((seat) => (f.num(seatFact(seat.station)) > 0 ? seat.cover! : 0))
                )
            }
          ]
        : []),
      // The FUEL and BOOST records, resolved (the AC-mode has-preference idiom
      // on DISTINCT recorded facts — the record writes `fuel.recorded`, NEVER
      // the derived current, so a keyed replacement can flip any value to any
      // other). Gated on the acquire: unacquired they settle to 0, and the
      // records themselves never outlive the acquire lifecycle anyway.
      {
        fact: `${F}.fuel.current`,
        value: (f) => (acquired(f) && f.has(`${F}.fuel.recorded`) ? f.num(`${F}.fuel.recorded`) : 0)
      },
      {
        fact: `${F}.boost.current`,
        value: (f) =>
          acquired(f) && f.has(`${F}.boost.recorded`) ? f.num(`${F}.boost.recorded`) : 0
      },
      {
        // The stat block's Speed line as a DERIVED fact under a deliberately
        // NEW name (the ac.effective precedent): the fuelSpeeds map by fuel
        // ordinal, a standing boost adds its bonus. The boost's arithmetic is
        // deliberately independent of its LEGALITY (a soul coin is required to
        // boost, but an illegally-committed boost still projects its speed —
        // the over-commit projection, like any override). Gated on the acquire
        // like every vehicle number; the flat `speed` name a legacy acquire
        // bakes is inert — nothing derives or reads it.
        fact: `${F}.speed.effective`,
        value: (f) => {
          if (!acquired(f)) return 0;
          const byFuel = spec.fuelSpeeds[f.num(`${F}.fuel.current`)] ?? 0;
          return byFuel + (f.num(`${F}.boost.current`) === 1 ? spec.boostBonus : 0);
        }
      },
      // The MOVEMENT ECONOMY, the steed's derives copied exactly (find-steed's
      // movement block) with ONE cross-vehicle difference: total doubling while
      // Dashed, remaining = the vehicle's OWN total − the SHARED player-level
      // spend (VEHICLE_MOVEMENT_SPENT — every vehicle's Drive writes that one
      // fact, so same-turn driving across vehicles draws a single pool capped
      // at whichever vehicle you are currently driving), every spend endOfTurn
      // so the pool resets with the turn. base is a DERIVATION of the effective
      // speed, never a copy of a number: the pool is the FUEL's, and an
      // unfuelled vehicle stands still (0 ft.) until the Helm feeds it.
      {
        fact: `${F}.movement.base`,
        value: (f) => f.num(`${F}.speed.effective`)
      },
      {
        fact: `${F}.movement.total`,
        value: (f) => f.num(`${F}.movement.base`) * (f.num(`${F}.dashed`) > 0 ? 2 : 1)
      },
      {
        fact: `${F}.movement.remaining`,
        value: (f) => f.num(`${F}.movement.total`) - f.num(VEHICLE_MOVEMENT_SPENT)
      }
    ],
    offer: () => [
      {
        // The PLAYER-side acquire action: ungated (the offer exists whenever the
        // group is loaded, for every character) and carrying NO vehicle subject,
        // so it files under the player's +ADD rather than a vehicle panel that
        // cannot exist before the acquire effect does. Acquiring is EQUIPPING a
        // vehicle: the BUILD family's EQUIP verb in the 'vehicle' sub-bucket,
        // not the HANDLE gear bucket the records use. No `when` — but ONE
        // legality leg: acquiring while this vehicle is already present is
        // ILLEGAL, never hidden (the knocked-prone already-prone idiom — the
        // engine's illegal-but-visible contract: the offer stays visible and
        // applicable with its diagnostic, and a planned-anyway row still
        // executes as the one keyed replacement). The segmented secondary
        // control (a spec with an AC mode) picks the mode the fresh acquire
        // starts in (the steed creature-type precedent: the selection flows
        // into the acquire effect's state).
        id: `acquire-${id}`,
        legalWhen: [
          {
            // Illegal while the vehicle is already present (the presence fact
            // the acquire effect bakes).
            condition: (f: FactReader): boolean => f.num(`${F}.active`) === 0,
            diagnostics: [{ code: ALREADY_HAVE, severity: 'error' }]
          }
        ],
        ui: {
          section: 'free',
          name: `${T}.acquire.name`,
          description: `${T}.acquire.description`,
          detailKey: spec.details.statBlock,
          ...(spec.acMode ? { secondaryControl: AC_MODE_CONTROL } : {}),
          intents: { EQUIP: 'vehicle' },
          actionCost: []
        },
        ...(spec.acMode ? { vars: { mode: { capture: true, default: { number: 0 } } } } : {}),
        // The evicts beside the replacement: a keyed replacement alone does not
        // fire dependents, so a re-acquire resets occupancy to the acquire default
        // (the acquirer counts), starts the vehicle upright AND whole — no damage
        // banked, no wreck — and resets the AC MODE (a spec with one) to this
        // row's selection, explicitly (the steed recast/child-eviction pattern).
        apply: (f: FactReader, selections): ActionResult => {
          // Re-checked legality (the dash idiom) so a planned-anyway row carries
          // its own diagnostics from the fold — the re-acquire still executes as
          // the one keyed replacement (the facts stay single; nothing stacks).
          const diagnostics: Diagnostic[] = [];
          if (f.num(`${F}.active`) > 0) diagnostics.push({ code: ALREADY_HAVE, severity: 'error' });
          return {
            advertise: [infernalAcquireEffect(spec, modeFrom(selections)), ...evictChildEffects()],
            diagnostics
          };
        }
      },
      {
        // The VEHICLE's occupancy record: a vehicle action in the vehicle's +ADD
        // (free, gated on the acquire) whose slider (0..the baked capacity, opening
        // at the RECORDED occupancy) writes ONE permanent KEYED effect — the steed
        // HP-modifier semantics: the keyed effect IS the stored value, re-apply
        // replaces, removing the chip clears the modification. No legality gates:
        // occupancy past the capacity is illegal-but-possible (the derive clamps
        // the read; diagnostics are deferred with acquiring's).
        id: `set-${id}-occupancy`,
        when: acquired,
        ui: {
          section: 'free',
          subject,
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
        // The capture default reads the RECORDED BASE, never the derived `used`:
        // used counts held seats beside the record (clamp(occupancy + seats)), so
        // a seat-inclusive default DOUBLE-COUNTS a seated player — recorded 2 +
        // seated reads used 3, the slider would open at 3, and accepting the
        // default writes occupancy 3 → used 4, inflating on every repeat. Reading
        // the base keeps the counters in their lanes: the slider records the
        // NPCs, the seat counts the player. Unrecorded, the fact resolves
        // undefined and the slider falls back to its min (0) — the seated player
        // is counted via their seat, not via the slider.
        vars: {
          occupancy: { capture: true, default: { fact: `${F}.creatureCapacity.occupancy` } }
        },
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
                subject,
                displayFact: `${F}.creatureCapacity.used`
              },
              expiry: { kind: 'permanent' }
            }
          ]
        })
      },
      ...(spec.acMode ? [acModeRecordOffer()] : []),
      {
        // The VEHICLE's FUEL record — the Helm's refuelling row. The AC-mode
        // record's shape (free section, HANDLE gear, segmented secondaryControl
        // pre-showing the current selection, ONE permanent KEYED effect on the
        // DISTINCT `fuel.recorded` fact) priced as the economy ruling demands:
        // refuelling is the player's BONUS ACTION (the generic spend, never
        // attack accounting), so the row carries the bonus cost chip and the
        // bonus-pool legality leg with its OWN diagnostic — illegal-but-
        // COMMITTABLE (a planned-anyway row still records while the projection
        // reads the over-commit). `when` is the acquire AND the helm seat:
        // nobody at the Helm, no refuelling offer — but the RECORD is vehicle
        // state no seat change ever touches.
        id: `set-${id}-fuel`,
        when: (f: FactReader): boolean => acquired(f) && atHelm(f),
        legalWhen: [
          {
            condition: (f: FactReader): boolean => f.num('bonusActions.remaining') > 0,
            diagnostics: [{ code: FUEL_NO_BONUS, severity: 'error' }]
          },
          notWrecked
        ],
        ui: {
          section: 'free',
          subject,
          name: `${T}.fuel.name`,
          description: `${T}.fuel.description`,
          detailKey: spec.details.fuel,
          secondaryControl: FUEL_CONTROL,
          intents: { HANDLE: 'gear' },
          actionCost: ['bonus']
        },
        vars: { fuel: { capture: true, default: { fact: `${F}.fuel.current` } } },
        apply: (f: FactReader, selections): ActionResult => {
          // Re-checked legality (the dash idiom) so a planned-anyway row carries
          // its own diagnostic from the fold — the record still lands as the
          // one keyed replacement. Both legs, in leg order.
          const diagnostics: Diagnostic[] = [];
          if (f.num('bonusActions.remaining') <= 0)
            diagnostics.push({ code: FUEL_NO_BONUS, severity: 'error' });
          if (f.num(`${F}.destroyed`) > 0) diagnostics.push({ code: WRECKED, severity: 'error' });
          return {
            advertise: [
              // The generic per-turn BONUS spend (the dash/divine-smite idiom —
              // keyless, endOfTurn) beside the record.
              { id: 'cost', state: { 'bonusActions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
              {
                id: FUEL_EFFECT_ID,
                key: FUEL_KEY,
                state: { [`${F}.fuel.recorded`]: segmentedFrom(selections, 'fuel') },
                display: {
                  name: `${T}.fuel-effect.name`,
                  section: 'mount',
                  subject,
                  displayFact: `${F}.fuel.current`
                },
                expiry: { kind: 'permanent' }
              }
            ],
            diagnostics
          };
        }
      },
      {
        // The VEHICLE's BOOST record — the fuel record mirrored: the same
        // filing, economy and record shape on `boost.recorded`, with the stat
        // block's own SECOND legality leg — a boost only burns while the machine
        // runs on a SOUL COIN (fuel.current === 1; none and demon ichor both
        // fail). Illegal-but-COMMITTABLE like every leg: the row still records,
        // the derived speed projecting the bonus the rules would not have
        // allowed. The 1-minute duration is copy only (the detail and the offer
        // description) — nothing times it; the player flips the record back to
        // none when the minute is up.
        id: `set-${id}-boost`,
        when: (f: FactReader): boolean => acquired(f) && atHelm(f),
        legalWhen: [
          {
            condition: (f: FactReader): boolean => f.num('bonusActions.remaining') > 0,
            diagnostics: [{ code: BOOST_NO_BONUS, severity: 'error' }]
          },
          {
            // The stat block's rule: no boosting without a soul coin in the burner.
            condition: (f: FactReader): boolean => f.num(`${F}.fuel.current`) === 1,
            diagnostics: [{ code: BOOST_WITHOUT_SOUL_COIN, severity: 'error' }]
          },
          notWrecked
        ],
        ui: {
          section: 'free',
          subject,
          name: `${T}.boost.name`,
          description: `${T}.boost.description`,
          detailKey: spec.details.fuel,
          secondaryControl: BOOST_CONTROL,
          intents: { HANDLE: 'gear' },
          actionCost: ['bonus']
        },
        vars: { boost: { capture: true, default: { fact: `${F}.boost.current` } } },
        apply: (f: FactReader, selections): ActionResult => {
          // Re-checked legality (the dash idiom): all three legs, so a
          // planned-anyway row carries exactly its own diagnostics while the
          // record still lands as the one keyed replacement.
          const diagnostics: Diagnostic[] = [];
          if (f.num('bonusActions.remaining') <= 0)
            diagnostics.push({ code: BOOST_NO_BONUS, severity: 'error' });
          if (f.num(`${F}.fuel.current`) !== 1)
            diagnostics.push({ code: BOOST_WITHOUT_SOUL_COIN, severity: 'error' });
          if (f.num(`${F}.destroyed`) > 0) diagnostics.push({ code: WRECKED, severity: 'error' });
          return {
            advertise: [
              { id: 'cost', state: { 'bonusActions.spent': 1 }, expiry: { kind: 'endOfTurn' } },
              {
                id: BOOST_EFFECT_ID,
                key: BOOST_KEY,
                state: { [`${F}.boost.recorded`]: segmentedFrom(selections, 'boost') },
                display: {
                  name: `${T}.boost-effect.name`,
                  section: 'mount',
                  subject,
                  displayFact: `${F}.boost.current`
                },
                expiry: { kind: 'permanent' }
              }
            ],
            diagnostics
          };
        }
      },
      // The VEHICLE's damage/repair recorders (see HP_RECORDERS above).
      ...HP_RECORDERS,
      {
        // The VEHICLE's prone RECORDER: models the vehicle BEING knocked prone
        // (imposed by the outside world), free. The ACQUIRE is the one structural
        // gate (unacquired there is no vehicle to knock); the already-prone state
        // is a LEGALITY gate, never a `when` (the engine's illegal-but-visible
        // contract — plan.ts keeps illegal offers applicable with diagnostics
        // and a planned-anyway row still executes): while prone the offer stays
        // visible and applicable, flagged illegal with its already-prone
        // diagnostic, and committing it anyway re-advertises the one keyed
        // record (newest-wins — still a single prone fact). No Speed leg: the
        // vehicle's movement pool is Drive's to spend, not the prone record's
        // concern. State tracking only: no attack flags, no movement legs, no
        // incapacitated modelling.
        id: `knock-${id}-prone`,
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
          subject,
          name: `${T}.knocked-prone.name`,
          description: `${T}.knocked-prone.description`,
          // Both prone offers flip to the vehicle's own condition text — what
          // fallen-prone means for a war machine, not for a rider.
          detailKey: spec.details.prone,
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
          return { advertise: [proneEffect()], diagnostics };
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
        // affordability do not translate — the flip is free and spends none of
        // the vehicle's movement pool.
        id: `flip-${id}-upright`,
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
          subject,
          name: `${T}.flip-upright.name`,
          description: `${T}.flip-upright.description`,
          detailKey: spec.details.prone,
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
      // The VEHICLE's seat offers — the take/leave pair for every live station,
      // straight off the spec's seat list in +ADD order (see seatOffers).
      ...spec.seats.flatMap((seat) => seatOffers(seat)),
      // Every weapon station's fire offer, in seat order.
      ...weaponSeats.map((seat) => fireOffer(seat)),
      {
        // The HELM's Drive — the vehicle's MOVEMENT offer, the steed's move rows
        // copied onto the vehicle (the PC-parity house rule): the row captures a
        // DISTANCE bounded by the derived movement total and defaulting to all
        // remaining (the steed's slider idiom), filed in the MOVE section with
        // the ACTION cost chip the steed's free moves lack — the economy ruling:
        // a vehicle activity consumes the player's full slot through the GENERIC
        // spend, never the weapon attacks' pool (Extra Attack neither applies
        // nor is granted). Apply spends the action AND the distance against the
        // pool in ONE endOfTurn effect (the steed-dash two-facts-one-spend
        // idiom), the distance landing on the SHARED player-level spend every
        // vehicle's remaining reads, so the pool resets with the turn. `when` is
        // the acquire AND
        // the helm seat (the seat fact is the gate the leave offer's eviction
        // closes); legality is the action pool PLUS the steed's
        // out-of-movement leg (remaining >= 5 — a machine with under 5 ft left
        // cannot usefully roll), both illegal-but-COMMITTABLE with OWN keys.
        // Apply re-checks both (the dash idiom), the distance re-check
        // validating the SELECTED distance — an over-distance row carries the
        // steed's out-of-movement diagnostic while its spend still lands (the
        // over-commit projection, unfloored like the steed's). The trait NOTE
        // rides the Drive PANEL as a linked chip (moveTraitAnnotations), not
        // the row: nothing trait-shaped is pushed here.
        id: `drive-${id}`,
        when: (f: FactReader): boolean => acquired(f) && atHelm(f),
        legalWhen: [
          {
            condition: (f: FactReader): boolean => f.num('actions.remaining') > 0,
            diagnostics: [{ code: DRIVE_NO_ACTION, severity: 'error' }]
          },
          {
            condition: (f: FactReader): boolean => f.num(`${F}.movement.remaining`) >= 5,
            diagnostics: [{ code: DRIVE_OUT_OF_MOVEMENT, severity: 'error' }]
          },
          notWrecked
        ],
        ui: {
          section: 'move',
          subject,
          name: `${T}.drive.name`,
          description: `${T}.drive.description`,
          detailKey: spec.details.helm,
          primaryControl: DRIVE_CONTROL,
          // The panel the move-trait chips ride (MOVE_TRAIT_LABEL): the
          // linked note renders here, and only here — leaving the Helm takes
          // the panel, the label and the chip with it.
          annotationLabels: [MOVE_TRAIT_LABEL],
          intents: { MOVE: 'travel' },
          actionCost: ['action']
        },
        vars: DRIVE_VARS,
        apply: (f: FactReader, selections): ActionResult => {
          const diagnostics: Diagnostic[] = [];
          if (f.num('actions.remaining') <= 0)
            diagnostics.push({ code: DRIVE_NO_ACTION, severity: 'error' });
          if (f.num(`${F}.movement.remaining`) < driveDistance(f, selections))
            diagnostics.push({ code: DRIVE_OUT_OF_MOVEMENT, severity: 'error' });
          if (f.num(`${F}.destroyed`) > 0) diagnostics.push({ code: WRECKED, severity: 'error' });
          return {
            advertise: [
              {
                id: 'cost',
                state: {
                  'actions.spent': 1,
                  // The distance lands on the SHARED player-level spend
                  // (VEHICLE_MOVEMENT_SPENT) — the one fact every vehicle's
                  // remaining reads, never this vehicle's own stem — BESIDE
                  // this vehicle's OWN drove marker (DROVE_FACT), the fact
                  // the move-trait roll rows gate on: shared feet, the
                  // machine's own wheels.
                  [VEHICLE_MOVEMENT_SPENT]: driveDistance(f, selections),
                  [DROVE_FACT]: 1
                },
                expiry: { kind: 'endOfTurn' }
              }
            ],
            diagnostics
          };
        }
      },
      {
        // The HELM's Dash — the player's BONUS ACTION (the 2024-format stat
        // block takes the vehicle's Dash as a bonus action; the economy ruling
        // makes it consume the PLAYER's matching slot, the generic spend like
        // every vehicle activity), DOUBLING the vehicle's movement for the
        // turn: the steed's Dash semantics (the two-facts-one-spend idiom —
        // the total derive reads the dashed flag, so the doubling resets with
        // the turn and an unspent pool rises with it). The per-encounter fine
        // print (the spec's Dash allowance each encounter, each Dash beyond
        // risking damage) is NOT counted: the app has no encounter tracking,
        // so every planned Dash row carries the whole rule as its
        // unconditional risk note (DASH_RISK above) and the player counts. The
        // PC Dash's halted leg has no analogue: nothing halts a vehicle's
        // derived pool — an unfuelled machine simply has none to double (base
        // 0, doubled still 0), and Juke's able-to-move leg is where the empty
        // burner bites.
        id: `dash-${id}`,
        when: (f: FactReader): boolean => acquired(f) && atHelm(f),
        legalWhen: [
          {
            condition: (f: FactReader): boolean => f.num('bonusActions.remaining') > 0,
            diagnostics: [{ code: DASH_NO_BONUS, severity: 'error' }]
          },
          notWrecked
        ],
        ui: {
          section: 'bonus-action',
          subject,
          name: `${T}.dash.name`,
          description: `${T}.dash.description`,
          detailKey: spec.details.helm,
          intents: { MOVE: 'dash' },
          actionCost: ['bonus']
        },
        apply: (f: FactReader): ActionResult => {
          // Re-checked legality (the dash idiom) so a planned-anyway row carries
          // its own error from the fold — the row still executes — and BESIDE it
          // the unconditional risk note (the allowance computed from the FACTS
          // here, the spec base + the baked Constitution modifier, travelling as
          // params for the locale's {{allowance}} slot — no fact, no chip,
          // nothing durable: the rule text informs, the player counts).
          const diagnostics: Diagnostic[] = [];
          if (f.num('bonusActions.remaining') <= 0)
            diagnostics.push({ code: DASH_NO_BONUS, severity: 'error' });
          if (f.num(`${F}.destroyed`) > 0) diagnostics.push({ code: WRECKED, severity: 'error' });
          diagnostics.push({
            code: DASH_RISK,
            severity: 'notice',
            params: { allowance: spec.dashAllowanceBase + f.num(`${F}.con.modifier`) }
          });
          return {
            advertise: [
              {
                // The steed's Dash idiom alone: the bonus-action spend and the
                // doubled-this-turn flag in ONE keyless endOfTurn effect (never
                // attack accounting) — nothing else is written.
                id: 'cost',
                state: { 'bonusActions.spent': 1, [`${F}.dashed`]: 1 },
                expiry: { kind: 'endOfTurn' }
              }
            ],
            diagnostics
          };
        }
      },
      // The HELM's Juke — the driver's REACTION, emitted ONLY for a spec
      // that carries one on its stat block (`juke`: the Tormentor yes, the
      // Demon Grinder no — its stat block has no Reaction row at all).
      ...(spec.juke ? [jukeOffer()] : []),
      // Every MOVE TRAIT's vehicle-level roll row (PR-7: the Crushing
      // Wheels), beside the record rollers it shares a shape with.
      ...(spec.moveTraits ?? []).map((trait) => traitRollOffer(trait)),
      // The vehicle's CHECKS and SAVES — the record rollers (the steed's
      // save/skill recorders, the PC-parity copy), each a d20 + the BAKED
      // modifier fact, free and UI-only, filed after the station actions and
      // before the way out (the steed's placement). Saves first, then checks,
      // in stat-block ability order.
      ...spec.statBlock.abilities.map((a) => saveOffer(a.ability)),
      ...spec.statBlock.abilities.map((a) => checkOffer(a)),
      {
        // The VEHICLE-side way out: gated on the acquire (structurally —
        // unacquired, the action does not exist at all), sitting under the
        // vehicle's +ADD panel so it appears exactly once acquiring has made that
        // panel available. Replaces the acquire effect by key (evicting every
        // vehicle record with it); no cost, no legality gates. Files beside the
        // acquire offer: EQUIP 'vehicle', the BUILD family.
        id: `abandon-${id}`,
        when: acquired,
        ui: {
          section: 'free',
          subject,
          name: `${T}.abandon.name`,
          description: `${T}.abandon.description`,
          intents: { EQUIP: 'vehicle' },
          actionCost: []
        },
        apply: (): ActionResult => ({
          advertise: [abandonEffect(), ...evictChildEffects()]
        })
      }
    ],
    // The Prone Deficiency trait, surfaced as a NOTICE while the vehicle is
    // PRONE (the Life-Bond annotate pattern gated on the condition — PC-prone
    // parity: the condition triggers its notice, so acquired-but-upright
    // carries nothing). It is a condition the player must know BEFORE acting on
    // the vehicle's behalf: the vehicle cannot right itself, so it stays prone
    // and can do nothing until something flips it upright. The gate is the
    // prone fact alone — the record never outlives the acquire (the effect's
    // dependents plus the explicit acquire/abandon evictions), so no separate
    // acquired check is needed. 'notice' == NOTICE_TARGET, a reserved label
    // rule modules spell as a literal (see condition-prone / find-steed).
    //
    // The DESTROYED wreck carries its own notice the same way: a state the crew
    // must know before acting on the vehicle's behalf (it can no longer act;
    // the way out is people, not repairs), gated on the destroyed fact alone —
    // the wreck never outlives the acquire either. Distinct key from the prone
    // notice, so a prone wreck (somehow) carries both.
    //
    // A station's `notice` (the clinger's stay-attached rule) carries the same
    // way, gated on the station's seat fact alone: while the player holds the
    // seat, they must know BEFORE acting that the station's one rule applies.
    // Like the seat fact it rides, the notice never outlives the leave offer's
    // eviction or the acquire lifecycle.
    //
    // The MOVE-TRAIT chips join here (moveTraitAnnotations): panel-targeted
    // LINKED annotations, not notices — the note rides the Drive panel (its
    // label) and taps into the plan, the Extra Attack / Divine Smite way.
    annotate: (f: FactReader): Annotation[] => {
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
      for (const seat of spec.seats)
        if (seat.notice && f.num(seatFact(seat.station)) > 0)
          out.push({
            key: seat.notice.key,
            targets: ['notice'],
            source: `${T}.effect.name`,
            body: seat.notice.body
          });
      out.push(...moveTraitAnnotations(f));
      return out;
    }
  };

  return defineRule(vehicle);
}
