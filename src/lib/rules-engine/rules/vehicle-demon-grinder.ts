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
 * acquire's already-have leg reads only this stem's presence).
 *
 * PR-3 is the SEAT-FREE base: the spec's seat list is EMPTY, so no station
 * exists yet and every helm-gated offer (Drive/Dash/Juke/Fuel/Boost) is
 * emitted by the factory but never surfaces — the `when` gate reads a helm
 * seat fact nothing writes until PR-4 adds the station. What the base carries
 * on day one: the acquire/abandon lifecycle, the occupancy slider (0–8), the
 * HP recorders (threshold 10 Use/Ignore + the mishap note at 20 + the wrecked
 * boundary), the prone pair + Prone Deficiency notice, the checks/saves
 * record rollers, and the fuel/speed/movement derives (the pool is the
 * fuel's; nobody can set the fuel until the Helm exists).
 *
 * The stat block's two deliberate divergences from the Tormentor, both as
 * DATA: the AC is FLAT 19 (no motionless rider — `flatAc`, never `acMode`,
 * so no mode machinery of any kind exists) and there is NO Reaction (no Juke
 * — the offer stays factory-emitted and helm-gated off with the rest, and
 * whether a Juke-less helm ever surfaces it is PR-4's question).
 */

const ID = 'demon-grinder';
const T = `rule.${ID}`;
const F = 'companion.demonGrinder';

/**
 * The Demon Grinder, as authored data. The per-ability i18n keys are LITERALS
 * here (module-i18n-coverage scans this source for `${PREFIX}.suffix`
 * templates); everything else the factory templates from
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
  // fuel map; the Fuel/Boost OFFERS are helm-gated and land with PR-4's Helm).
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
    // The Helm and Fuel details land with PR-4's stations; the dormant
    // helm-gated offers already point at their keys.
    helm: 'vehicle/demon-grinder-helm',
    fuel: 'vehicle/demon-grinder-fuel'
  },
  // SEAT-FREE (PR-3): no station exists. PR-4 adds the Helm and one Harpoon
  // Flinger; the Chomper and Wrecking Ball follow.
  seats: []
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
