import {
  defineRule,
  type ActionResult,
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
 * Deliberately out of scope this pass (later passes on the plan): the Helm /
 * Harpoon Flinger stations and the Juke reaction, movement economy, damage
 * tracking, thresholds and immunities, the AC-while-motionless mode, and any
 * legality check on boarding (multiple boardings are illegal-but-possible; the
 * keyed effect keeps the facts single and diagnostics are deferred).
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

/** The stat block boarding bakes. Display-only: HP has no current/spent pair. */
const BOARD_STATE: Record<string, number> = {
  [`${F}.active`]: 1,
  [`${F}.ac.value`]: 21,
  [`${F}.hp.max`]: 60,
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
 * steed's never carried one). The occupancy record is a DEPENDENT, so raw
 * mount-chip removal (playStore's `removeEffect`) evicts it with the board
 * instead of stranding a recorded occupancy under a de-boarded vehicle (the
 * steed mount/STEED_CHILD_EFFECTS pattern).
 */
export function tormentorBoardEffect(): EffectInstance {
  return {
    id: 'effect-tormentor-damage-control',
    key: 'tormentor-damage-control',
    state: { ...BOARD_STATE },
    dependents: [OCCUPANCY_KEY],
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
 * Eviction of the occupancy record (an empty same-key effect — newest wins, so
 * the stored occupancy vanishes and `used` falls back to the board default).
 * Advertised beside BOTH the board effect (a re-board resets occupancy to 1:
 * the boarder counts) and the de-board marker (the record never outlives the
 * board that justifies it) — the steed cast/dismiss child-eviction pattern: a
 * keyed replacement alone does not fire `dependents`.
 */
function evictOccupancyEffect(): EffectInstance {
  return { id: `evict-${OCCUPANCY_KEY}`, key: OCCUPANCY_KEY, expiry: { kind: 'permanent' } };
}

/** The structural gate every STATION action shares: the board effect is live. */
const boarded = (f: FactReader): boolean => f.num(`${F}.active`) > 0;

/**
 * The subject's top-bar and resource entries, gated on `active` (present only
 * while the board effect lives — removing the mount chip takes every fact with
 * it).
 */
const TORMENTOR_PANELS: SubjectPanelDeclaration[] = [
  // HP is a display-only value, not a usedMax pool — no damage tracking yet.
  {
    subject: SUBJECT,
    panel: 'topBar',
    gate: `${F}.active`,
    entry: { type: 'value', label: 'play.stats.tormentor-damage-control.hp', fact: `${F}.hp.max` }
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
      // The evict beside the replacement: a keyed replacement alone does not
      // fire dependents, so a re-board resets occupancy to the board default
      // explicitly (the steed recast/child-eviction pattern).
      apply: (): ActionResult => ({
        advertise: [tormentorBoardEffect(), evictOccupancyEffect()]
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
      // The STATION-side way out: gated on the board (structurally — unboarded,
      // the action does not exist at all), sitting under the station's +ADD
      // panel so it appears exactly once boarding has made that panel
      // available. Replaces the board effect by key (evicting the occupancy
      // record with it); no cost, no legality gates.
      id: 'deboard-tormentor',
      when: boarded,
      ui: {
        section: 'free',
        subject: SUBJECT,
        name: `${T}.deboard.name`,
        description: `${T}.deboard.description`,
        intents: { HANDLE: 'gear' },
        actionCost: []
      },
      apply: (): ActionResult => ({
        advertise: [tormentorDeboardEffect(), evictOccupancyEffect()]
      })
    }
  ]
};

export default defineRule(vehicleTormentor);
