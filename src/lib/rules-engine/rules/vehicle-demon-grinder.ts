import type { EffectInstance } from '../builder';
import {
  buildInfernalVehicle,
  infernalAcquireEffect,
  type InfernalVehicleSpec
} from './infernal-vehicle';

/**
 * Demon Grinder — the second infernal vehicle, as a PURE SPEC on the shared
 * factory (rules/infernal-vehicle.ts), the Tormentor's sibling
 * (rules/vehicle-tormentor.ts): everything below is DATA, and every behaviour
 * the group carries is the factory's, templated from it. ONE rule group owns
 * the whole vehicle; owning one of EACH vehicle rule group is legal (the
 * acquire's already-have leg reads only this stem's presence), while ONE seat
 * per player holds GLOBALLY across every vehicle (the factory's registry —
 * this spec joins it data-only, no vehicle list anywhere).
 *
 * PR-3 was the SEAT-FREE base; PR-4 added the first STATIONS: the Helm (one
 * crew, three-quarters cover — the gate behind Drive/Dash/Fuel/Boost) and ONE
 * Harpoon Flinger (one crew, half cover, +5 to hit, 2d8 piercing with no
 * damage bonus — 10 harpoons untracked, copy only). PR-5 adds the WRECKING
 * BALL (one crew, half cover, +9 to hit, 8d8+4 bludgeoning — the doubled
 * damage against objects and structures is copy only, the GM adjudicates).
 * The Chomper station follows in its own pass. NO passenger or clinger
 * station exists on this vehicle, and the derived creature capacity counts
 * each held seat toward the 8.
 *
 * The stat block's two deliberate divergences from the Tormentor, both as
 * DATA: the AC is FLAT 19 (no motionless rider — `flatAc`, never `acMode`,
 * so no mode machinery of any kind exists) and there is NO Reaction (no Juke
 * — the spec omits `juke`, so the factory never emits the offer at all, not
 * even dormant behind the Helm gate).
 */

const ID = 'demon-grinder';
const T = `rule.${ID}`;
const F = 'companion.demonGrinder';

/**
 * The Demon Grinder, as authored data. The per-station and per-ability i18n
 * keys are LITERALS here (module-i18n-coverage scans this source for
 * `${PREFIX}.suffix` templates); everything else the factory templates from
 * `id`/`subject`/`factStem` is checked at the EMITTED surface by
 * tests/unit/rules-engine/infernal-vehicle.test.ts (the Demon Grinder walk).
 */
const DEMON_GRINDER: InfernalVehicleSpec = {
  id: ID,
  /** The vehicle's subject id: the seg-button view, the +ADD stripe, the chip. */
  subject: 'demon-grinder',
  /** Every fact this module bakes lives under one stem. */
  factStem: F,
  statBlock: {
    // HP bakes its BASE (the pool derives); the thresholds are DATA the
    // recorder gates on; everything else is display-only.
    hpBase: 200,
    damageThreshold: 10,
    mishapThreshold: 20,
    // Cargo 1 ton = 2,000 lb.: the chip renders the raw pound figure (the
    // factory's cargo entry is a plain value chip), the stat-block detail
    // carries the "1 ton" wording.
    cargo: 2000,
    // Creature Capacity 8 Medium creatures — the occupancy slider's ceiling.
    creatureCapacity: 8,
    // STR 18 (+4) / DEX 10 (+0) / CON 18 (+4), in stat-block order: the
    // acquire bake, the abilities chip and the six record rollers all read
    // this list.
    abilities: [
      { ability: 'str', score: 18, modifier: 4, checkName: `${T}.check-str.name` },
      { ability: 'dex', score: 10, modifier: 0, checkName: `${T}.check-dex.name` },
      { ability: 'con', score: 18, modifier: 4, checkName: `${T}.check-con.name` }
    ]
  },
  // AC 19, FLAT — the stat block's AC line carries no motionless rider (the
  // "19 + Dex mod" source rule with DEX +0 prints none), so the spec sets
  // `flatAc` and NO mode machinery exists: no mode control on the acquire, no
  // mode record, no mode facts — the derived ac.effective is the one number.
  flatAc: 19,
  // Fuel none / soul coin / demon ichor → 0 / 100 / 80 ft. (the same generic
  // fuel map; the Fuel/Boost offers are helm-gated behind the Helm below).
  fuelSpeeds: [0, 100, 80],
  // A demon-ichor boost adds 30 ft. while it stands.
  boostBonus: 30,
  // Each encounter: 3 Dashes plus the vehicle's Constitution modifier (7 for
  // the Grinder — interpolated from the facts, never hardcoded).
  dashAllowanceBase: 3,
  details: {
    statBlock: 'vehicle/demon-grinder',
    damage: 'vehicle/demon-grinder-damage',
    prone: 'vehicle/demon-grinder-prone',
    helm: 'vehicle/demon-grinder-helm',
    fuel: 'vehicle/demon-grinder-fuel'
  },
  // The stations in +ADD order (stat-block order). PR-4's base seats: the
  // Helm and ONE Harpoon Flinger; PR-5 slots the Wrecking Ball between them
  // (stat-block order — the Chomper lands ahead of it in its own pass, and
  // the second flinger / multi-harpoonist after that). NO passenger or
  // clinger station: the Grinder's stat block carries none.
  seats: [
    /**
     * The HELM station (the stat block's Helm, one crew): the take/leave
     * pair on the shared helper, and the seat fact is the `when` gate the
     * factory's Drive/Dash/Fuel/Boost offers read — nobody at the Helm, no
     * driving offers. The helm's cockpit grants THREE-QUARTERS cover: spec
     * data on the seat, contributed to the player's cover.seat fact by the
     * factory (cover.md PR-2). The station's explanation hangs off its
     * offers' DETAIL (the drive/dash/fuel/boost rows link the helm/fuel
     * details); the seat chip stays plain like every station's.
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
     * The WRECKING BALL station (the stat block's, PR-5): one crew, HALF
     * cover, and the station's ACTION through the factory's weapon-station
     * machinery — the seat is the swing offer's `when` gate, the numbers are
     * the derives the dice-line reads (+9 to hit, 8d8+4 bludgeoning — the
     * ball's weight behind every swing, unlike the flinger's zero-bonus
     * shape). The station's one RIDER — the damage is doubled against objects
     * and structures — is DETAIL and offer COPY only: nothing in the engine
     * doubles anything (what counts as an object or a structure is the GM's
     * call at the table — the Tormentor "magical + 10 harpoons" precedent).
     * The mount grants HALF cover: spec data on the seat (cover.md PR-2).
     */
    {
      station: 'wrecking-ball',
      take: {
        name: `${T}.take-wrecking-ball-seat.name`,
        description: `${T}.take-wrecking-ball-seat.description`
      },
      leave: {
        name: `${T}.leave-wrecking-ball-seat.name`,
        description: `${T}.leave-wrecking-ball-seat.description`
      },
      effectName: `${T}.seat-wrecking-ball-effect.name`,
      consumesSeat: true,
      cover: 1,
      weapon: {
        fire: {
          name: `${T}.fire-wrecking-ball.name`,
          description: `${T}.fire-wrecking-ball.description`
        },
        noAction: `${T}.fire-wrecking-ball.no_action`,
        detailKey: 'vehicle/demon-grinder-wrecking-ball',
        hitBonus: 9,
        damageBonus: 4,
        damageDie: 8,
        damageCount: 8,
        damageType: 'bludgeoning'
      }
    },
    /**
     * The HARPOON FLINGER station (the stat block's, ONE of its two — the
     * multi-harpoonist pass adds the second): one crew, half cover, and the
     * station's ACTION via the factory's weapon-station machinery — the seat
     * is the fire offer's `when` gate, the numbers are the derives the
     * dice-line reads (+5 to hit, 2d8 piercing with NO damage bonus). The 10
     * harpoons and the magical attacks (the Magic Weapons trait) are DETAIL
     * copy only — nothing tracks ammunition. The mount grants HALF cover:
     * spec data on the seat (cover.md PR-2).
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
        detailKey: 'vehicle/demon-grinder-harpoon',
        hitBonus: 5,
        damageBonus: 0,
        damageDie: 8,
        damageCount: 2,
        damageType: 'piercing'
      }
    }
  ]
};

/**
 * The acquire effect, exported so tests and later passes can seed an
 * already-acquired Demon Grinder without driving the offer — the factory's
 * `infernalAcquireEffect` on this spec. No `acMotionless` parameter: a
 * flat-AC vehicle has no mode for an acquire row to select.
 */
export function demonGrinderAcquireEffect(): EffectInstance {
  return infernalAcquireEffect(DEMON_GRINDER);
}

export default buildInfernalVehicle(DEMON_GRINDER);
