import type { EffectInstance } from '../builder';
import {
  buildInfernalVehicle,
  infernalAcquireEffect,
  type InfernalVehicleSpec
} from './infernal-vehicle';

/**
 * Tormentor — the first infernal vehicle, as a PURE SPEC on the shared factory
 * (rules/infernal-vehicle.ts): everything below is DATA, and every behaviour
 * the group carries is the factory's, templated from it. ONE rule group owns
 * the whole vehicle; each later vehicle is its OWN rule group on the same
 * factory (the settled design — a shared group with per-vehicle subjects was
 * considered and set aside), so a second vehicle never touches this file.
 *
 * What that buys, mechanically: bringing the vehicle in is ACQUIRING it —
 * equipping a war machine, not manning a station (the Damage-Control seat
 * fiction is retired). Acquiring is a PLAYER action (the ungated free-section
 * offer with NO vehicle subject, filed under the BUILD family's EQUIP verb in
 * the 'vehicle' sub-bucket) whose apply advertises ONE permanent keyed effect
 * baking the display-only stat block into `companion.tormentor.*` facts (the
 * steed `steedEffect` pattern); that effect makes the VEHICLE's +ADD panel
 * available, and the abandon offer replaces it by key (the steed
 * dismiss/`retireSteedEffects` pattern). The vehicle is one SUBJECT
 * (`tormentor`), and the module declares its top-bar/resource entries as data
 * (`panels`) so it surfaces without touching the play layer.
 *
 * The Tormentor's story pass by pass: the passenger seat and the derived
 * creature capacity (PR-A), the Harpoon Flinger station and its attack (PR-B),
 * the Helm with Drive/Dash/Juke under the economy ruling (PR-C), fuel and
 * boost with the derived speed (PR-D), the clinger seat on the outside (PR-E),
 * the AC mode (v2 — the player records [Moving | Motionless], AC derives),
 * the damageable HP pool with thresholds/mishap/wrecked legality, and the
 * checks/saves record rollers. The factory's doc comments carry the mechanics
 * of each piece; the numbers below are the stat block's.
 *
 * Deliberately out of scope (existing simplifications, unchanged): damage
 * immunities as MECHANICS (detail text only — the recorder never refuses
 * fire/poison/psychic; the mishap threshold IS wired, as the recorder's
 * per-row note), any prone attack/movement or incapacitated mechanics beyond
 * the record, the clinger's Dexterity checks as MECHANICS (the notice states
 * the rule and the vehicle's Dex-check recorder is the row the player rolls it
 * on), and MULTIPLE vehicles of the same rule group per character (acquiring
 * while a Tormentor is already present is ILLEGAL — one Tormentor per
 * character; owning one of EACH vehicle rule group is legal).
 */

const ID = 'tormentor';
const T = `rule.${ID}`;
const F = 'companion.tormentor';

/**
 * The Tormentor, as authored data. The per-station and per-ability i18n keys
 * are LITERALS here (module-i18n-coverage scans this source for
 * `${PREFIX}.suffix` templates — a key the factory built from a station or
 * ability string would be invisible to it); everything else the factory
 * templates from `id`/`subject`/`factStem` is checked at the EMITTED surface
 * by tests/unit/rules-engine/infernal-vehicle.test.ts.
 */
const TORMENTOR: InfernalVehicleSpec = {
  id: ID,
  /** The vehicle's subject id: the seg-button view, the +ADD stripe, the chip. */
  subject: 'tormentor',
  /** Every fact this module bakes lives under one stem. */
  factStem: F,
  statBlock: {
    // HP bakes its BASE (the pool derives); the thresholds are DATA the
    // recorder gates on; everything else is display-only.
    hpBase: 60,
    damageThreshold: 10,
    mishapThreshold: 20,
    cargo: 500,
    // Creature Capacity 4 Medium creatures — the occupancy slider's ceiling.
    creatureCapacity: 4,
    // STR 16 (+3) / DEX 14 (+2) / CON 14 (+2), in stat-block order: the
    // acquire bake, the abilities chip and the six record rollers all read
    // this list.
    abilities: [
      { ability: 'str', score: 16, modifier: 3, checkName: `${T}.check-str.name` },
      { ability: 'dex', score: 14, modifier: 2, checkName: `${T}.check-dex.name` },
      { ability: 'con', score: 14, modifier: 2, checkName: `${T}.check-con.name` }
    ]
  },
  // The stat block's "AC 21 (19 while motionless)" — the one AC mode. A
  // vehicle with a flat AC (no rider on the stat block's AC line) omits this.
  acMode: { moving: 21, motionless: 19 },
  // Fuel none / soul coin / demon ichor → 0 / 100 / 80 ft.
  fuelSpeeds: [0, 100, 80],
  // A demon-ichor boost adds 30 ft. while it stands.
  boostBonus: 30,
  // Each encounter: 3 Dashes plus the vehicle's Constitution modifier.
  dashAllowanceBase: 3,
  // The stat block's Reaction row (the driver's Juke swerve) — a vehicle
  // whose stat block carries no Reaction (the Demon Grinder) omits this and
  // never gets the offer.
  juke: true,
  details: {
    statBlock: 'vehicle/tormentor',
    damage: 'vehicle/tormentor-damage',
    prone: 'vehicle/tormentor-prone',
    helm: 'vehicle/tormentor-helm',
    fuel: 'vehicle/tormentor-fuel'
  },
  seats: [
    /**
     * The PASSENGER station — the seat infrastructure's first (the stat
     * block's Passenger seat: a place to ride, nothing more — no passenger
     * detail exists, there is nothing to say). Riding in the open grants NO
     * cover (tormentor2.png): the seat carries no cover ordinal.
     */
    {
      station: 'passenger',
      take: { name: `${T}.take-seat.name`, description: `${T}.take-seat.description` },
      leave: { name: `${T}.leave-seat.name`, description: `${T}.leave-seat.description` },
      effectName: `${T}.seat-passenger-effect.name`,
      consumesSeat: true
    },
    /**
     * The HARPOON FLINGER station (the stat block's Harpoon Flinger, NOT
     * "Harpoonist": station labels are stat-block names). Taking it is the
     * same take/leave pair on the shared helper; what the station ADDS is its
     * ACTION, the fire offer — the seat is the `when` gate, the numbers are
     * the derives the dice-line reads. The attack DETAIL (the 10 harpoons,
     * the magical weapons) hangs off the fire offer; the seat chip stays
     * plain like the passenger's. The station's mount grants HALF cover
     * (tormentor2.png): spec data on the seat, contributed to the player's
     * cover.seat fact by the factory (cover.md PR-2).
     */
    {
      station: 'harpoon',
      take: {
        name: `${T}.take-harpoon-seat.name`,
        description: `${T}.take-harpoon-seat.description`
      },
      leave: {
        name: `${T}.leave-harpoon-seat.name`,
        description: `${T}.leave-harpoon-seat.description`
      },
      effectName: `${T}.seat-harpoon-effect.name`,
      consumesSeat: true,
      cover: 1,
      weapon: {
        fire: { name: `${T}.fire-harpoon.name`, description: `${T}.fire-harpoon.description` },
        noAction: `${T}.fire-harpoon.no_action`,
        detailKey: 'vehicle/tormentor-harpoon',
        hitBonus: 7,
        damageBonus: 2,
        damageDie: 8,
        damageCount: 2,
        damageType: 'piercing'
      }
    },
    /**
     * The HELM station (the stat block's Helm, one crew). Taking it is the
     * same take/leave pair on the shared helper; what the station ADDS is its
     * ECONOMY offers — Drive, Dash and Juke, the driver's handle on the war
     * machine (all factory machinery, gated on this station's seat). The chip
     * stays plain like the other seats'; the station's explanation hangs off
     * its offers' DETAIL. The helm's cockpit grants THREE-QUARTERS cover
     * (tormentor2.png): spec data on the seat, contributed to the player's
     * cover.seat fact by the factory (cover.md PR-2).
     */
    {
      station: 'helm',
      take: { name: `${T}.take-helm-seat.name`, description: `${T}.take-helm-seat.description` },
      leave: { name: `${T}.leave-helm-seat.name`, description: `${T}.leave-helm-seat.description` },
      effectName: `${T}.seat-helm-effect.name`,
      consumesSeat: true,
      cover: 2
    },
    /**
     * The CLINGER station (the stat block's Clinger: a rider holding on to
     * the OUTSIDE of the vehicle). The take/leave pair is the shared helper's
     * like every station's, with the one structural difference the whole
     * station IS: `consumesSeat: false` — the take carries no free-seat leg
     * (clinging is legal at a full vehicle) and the capacity derive never
     * counts the fact. Everything else is seat-as-usual: one-seat-per-player
     * exclusivity both directions, the chip, the lifecycle eviction. Hanging
     * off the OUTSIDE grants NO cover (open air — no cover ordinal, like the
     * passenger). The station's rule (while in combat, a clinger must make
     * Dexterity checks to stay attached — the stat block states no DC or
     * frequency) rides as a STANDING NOTICE while the seat is held (the
     * notice taxonomy: a condition to know BEFORE acting) and the take links
     * the station detail.
     */
    {
      station: 'clinger',
      take: {
        name: `${T}.take-clinger-seat.name`,
        description: `${T}.take-clinger-seat.description`
      },
      leave: {
        name: `${T}.leave-clinger-seat.name`,
        description: `${T}.leave-clinger-seat.description`
      },
      effectName: `${T}.seat-clinger-effect.name`,
      consumesSeat: false,
      detailKey: 'vehicle/tormentor-clinger',
      notice: { key: `${T}.clinger-notice`, body: `${T}.clinger-notice.body` }
    }
  ]
};

/**
 * The acquire effect, exported so tests and later passes can seed an
 * already-acquired Tormentor without driving the offer — the factory's
 * `infernalAcquireEffect` on this spec (see its doc there for the shape).
 */
export function tormentorAcquireEffect(acMotionless = 0): EffectInstance {
  return infernalAcquireEffect(TORMENTOR, acMotionless);
}

export default buildInfernalVehicle(TORMENTOR);
