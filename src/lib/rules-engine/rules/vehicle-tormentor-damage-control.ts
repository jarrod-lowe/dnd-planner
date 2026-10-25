import {
  defineRule,
  type ActionResult,
  type EffectInstance,
  type RuleModule,
  type SubjectPanelDeclaration
} from '../builder';

/**
 * Tormentor (Damage Control) — the first VEHICLE subject.
 *
 * The Tormentor is a huge war vehicle this app models as an extension of the
 * steed surface: seats (action stations) become separate vehicle subjects, and
 * this group is the pseudo-seat for a character riding along on generic
 * non-station duty. Boarding bakes the vehicle's display-only stat block into
 * `companion.tormentorDamageControl.*` facts via ONE permanent keyed effect
 * (the steed `steedEffect` pattern); the module declares its subject's top-bar
 * entries as data (`panels`), so the vehicle surfaces without touching the
 * play layer.
 *
 * Deliberately out of scope this pass (later passes on the plan): creature
 * capacity + occupancy, the Helm / Harpoon Flinger stations and the Juke
 * reaction, movement economy, damage tracking, thresholds and immunities, the
 * AC-while-motionless mode, and any legality check on boarding (multiple
 * boardings are illegal-but-possible; the keyed effect keeps the facts single
 * and diagnostics are deferred).
 */

const ID = 'vehicle-tormentor-damage-control';
const T = `rule.${ID}`;
/** The subject id: the seg-button view, the +ADD stripe, the effect chip. */
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
 * The board effect (permanent, keyed so a re-board REPLACES rather than
 * stacks). Exported so tests and later passes can seed an already-boarded
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

const vehicleTormentorDamageControl: RuleModule = {
  id: ID,
  meta: {
    name: `${T}.board.name`,
    description: `${T}.board.description`,
    keywords: `${T}.board.keywords`
  },
  panels: TORMENTOR_PANELS,
  offer: () => [
    {
      // Ungated: the offer exists whenever the group is loaded, for every
      // character. No `when`, no `legalWhen` (see the scope note above).
      id: 'board-tormentor',
      ui: {
        section: 'free',
        subject: SUBJECT,
        name: `${T}.board.name`,
        description: `${T}.board.description`,
        detailKey: 'vehicle/tormentor-damage-control',
        intents: { HANDLE: 'gear' },
        actionCost: []
      },
      apply: (): ActionResult => ({ advertise: [tormentorBoardEffect()] })
    }
  ]
};

export default defineRule(vehicleTormentorDamageControl);
