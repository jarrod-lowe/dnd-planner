import {
  defineRule,
  type ActionResult,
  type EffectInstance,
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
 * declares its subject's top-bar entries as data (`panels`), so the vehicle
 * surfaces without touching the play layer.
 *
 * Deliberately out of scope this pass (later passes on the plan): creature
 * capacity + occupancy, the Helm / Harpoon Flinger stations and the Juke
 * reaction, movement economy, damage tracking, thresholds and immunities, the
 * AC-while-motionless mode, and any legality check on boarding (multiple
 * boardings are illegal-but-possible; the keyed effect keeps the facts single
 * and diagnostics are deferred).
 */

const ID = 'tormentor';
const T = `rule.${ID}`;
/** The seat's subject id: the seg-button view, the +ADD stripe, the effect chip. */
const SUBJECT = 'tormentor-damage-control';
/** Every fact this module bakes lives under one stem. */
const F = 'companion.tormentorDamageControl';

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
  [`${F}.con.modifier`]: 2
};

/**
 * The board effect (permanent, keyed so a re-board or de-board REPLACES rather
 * than stacks). Exported so tests and later passes can seed an already-boarded
 * vehicle without driving the offer. `display` opts it onto the strip as a
 * MOUNT chip under its subject, and the `detailKey` is what the strip's flip
 * path reads — the first mount chip that flips to a stat-block detail (the
 * steed's never carried one).
 */
export function tormentorBoardEffect(): EffectInstance {
  return {
    id: 'effect-tormentor-damage-control',
    key: 'tormentor-damage-control',
    state: { ...BOARD_STATE },
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
 * The subject's top-bar entries, gated on `active` (present only while the
 * board effect lives — removing the mount chip takes every fact with it).
 * No `resources` entries yet: creature capacity is the next pass.
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
      apply: (): ActionResult => ({ advertise: [tormentorBoardEffect()] })
    },
    {
      // The STATION-side way out: gated on the board (structurally — unboarded,
      // the action does not exist at all), sitting under the station's +ADD
      // panel so it appears exactly once boarding has made that panel
      // available. Replaces the board effect by key; no cost, no legality
      // gates.
      id: 'deboard-tormentor',
      when: (f) => f.num(`${F}.active`) > 0,
      ui: {
        section: 'free',
        subject: SUBJECT,
        name: `${T}.deboard.name`,
        description: `${T}.deboard.description`,
        intents: { HANDLE: 'gear' },
        actionCost: []
      },
      apply: (): ActionResult => ({ advertise: [tormentorDeboardEffect()] })
    }
  ]
};

export default defineRule(vehicleTormentor);
