import type { Facts } from '$lib/rules-view';
import { HIT_DIE_SIZES } from '$lib/rules-engine';
import { type UiEntry, isUiEntry } from './extractTopBar';

/**
 * The facts-driven top-bar / resources catalog.
 *
 * The legacy engine declared the top-bar and resources panels as `ui.topBar` / `ui.resources`
 * blocks on the rule objects, and the store extracted them from
 * `[...ruleGroups, ...effects]`. rule modules deliberately don't carry that display
 * metadata (the parity harness only checks facts/offers/annotations), so the panels
 * need a source here. Since every panel entry is a pure declaration that references
 * facts the engine already produces, this is a fixed **facts-driven catalog**:
 * an entry surfaces when its driving fact is present in the evaluated facts (the
 * owning module is loaded), and the existing `resolveEntryValue` / `isEntryVisible`
 * render it — so the PanelRenderer/top-bar UI is unchanged.
 *
 * The catalog mirrors those declarations exactly (labels + fact refs). The
 * character-sheet sections (`magic` spell slots, `abilities`, `stats`, `skills`,
 * `passive`) have their own extractor and are out of scope here — this covers the
 * play-mode top bar + resources panel.
 */

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/** Spell slot levels the engine models (Prayer of Healing can reach 6–9). */
const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Top-bar catalog: each entry plus the fact whose presence gates it. */
const TOP_BAR: { gate: string; entry: UiEntry }[] = [
  {
    gate: 'hp.max',
    entry: { type: 'usedMax', label: 'play.topBar.hp', total: 'hp.max', remaining: 'hp.current' }
  },
  { gate: 'ac.value', entry: { type: 'value', label: 'play.topBar.ac', fact: 'ac.value' } },
  {
    gate: 'character.movement.remaining',
    entry: { type: 'value', label: 'play.topBar.speed', fact: 'character.movement.remaining' }
  },
  {
    gate: 'concentration.max',
    entry: {
      type: 'concentration',
      label: 'play.topBar.conc',
      activeLabel: 'play.topBar.concActive',
      noneLabel: 'play.topBar.concNone'
    }
  },
  {
    gate: 'str.modifier',
    entry: {
      type: 'ability',
      label: 'play.topBar.abilities',
      abilities: ABILITIES.map((a) => ({
        name: `play.stats.${a}`,
        fact: `${a}.modifier`,
        saveFact: `${a}.save`,
        proficiencyFact: `${a}.save.proficient`
      }))
    }
  }
];

/** Resources-panel catalog: usedMax pools, each gated on its `total` fact. */
const RESOURCES: UiEntry[] = [
  // HP appears in the ledger as well as the top bar (hp.yaml
  // declared both a topBar and a resources entry).
  { type: 'usedMax', label: 'play.stats.hp', total: 'hp.max', remaining: 'hp.current' },
  {
    type: 'usedMax',
    label: 'play.stats.actions',
    total: 'actions.max',
    remaining: 'actions.remaining'
  },
  {
    type: 'usedMax',
    label: 'play.stats.bonusActions',
    total: 'bonusActions.max',
    remaining: 'bonusActions.remaining'
  },
  {
    type: 'usedMax',
    label: 'play.stats.reactions',
    total: 'reactions.max',
    remaining: 'reactions.remaining'
  },
  {
    type: 'usedMax',
    label: 'play.stats.movement',
    total: 'character.movement.total',
    remaining: 'character.movement.remaining'
  },
  { type: 'usedMax', label: 'play.stats.hands', total: 'hands.max', remaining: 'hands.remaining' },
  {
    type: 'usedMax',
    label: 'play.stats.spellcasting',
    total: 'spellcasting.max',
    remaining: 'spellcasting.remaining'
  },
  {
    type: 'usedMax',
    label: 'play.stats.divinity',
    total: 'divinity.total',
    remaining: 'divinity.remaining'
  },
  {
    type: 'usedMax',
    label: 'play.stats.layOnHands',
    total: 'layOnHands.pool.total',
    remaining: 'layOnHands.pool.remaining'
  },
  {
    type: 'usedMax',
    label: 'play.stats.paladinSmite',
    total: 'paladinSmite.total',
    remaining: 'paladinSmite.remaining'
  },
  {
    type: 'usedMax',
    label: 'play.stats.paladinFindSteed',
    total: 'paladinFindSteed.total',
    remaining: 'paladinFindSteed.remaining'
  },
  {
    type: 'usedMax',
    label: 'play.stats.savageAttacker',
    total: 'savageAttacker.max',
    remaining: 'savageAttacker.remaining'
  }
];

/**
 * Steed (companion) top-bar catalog — the same chips the player gets, minus
 * concentration (a steed never concentrates). Entries carry `subject: 'steed'`
 * so IntentTopBar surfaces them only while the steed view is active.
 */
const STEED_TOP_BAR: { gate: string; entry: UiEntry }[] = [
  {
    gate: 'companion.steed.hp.max',
    entry: {
      type: 'usedMax',
      label: 'play.topBar.hp',
      total: 'companion.steed.hp.max',
      remaining: 'companion.steed.hp.current',
      subject: 'steed'
    }
  },
  {
    gate: 'companion.steed.ac.value',
    entry: {
      type: 'value',
      label: 'play.topBar.ac',
      fact: 'companion.steed.ac.value',
      subject: 'steed'
    }
  },
  {
    gate: 'companion.steed.movement.remaining',
    entry: {
      type: 'value',
      label: 'play.topBar.speed',
      fact: 'companion.steed.movement.remaining',
      subject: 'steed'
    }
  },
  {
    gate: 'companion.steed.str.modifier',
    entry: {
      type: 'ability',
      label: 'play.topBar.abilities',
      // No proficiencyFact: a steed has no save proficiencies, so find-steed
      // derives each `.save` as its plain `.modifier`.
      abilities: ABILITIES.map((a) => ({
        name: `play.stats.${a}`,
        fact: `companion.steed.${a}.modifier`,
        saveFact: `companion.steed.${a}.save`
      })),
      subject: 'steed'
    }
  }
];

/**
 * Steed (companion) resources — shown in the ledger under the 'steed' subject view
 * (the Ledger filters `entry.subject === activeSubject`). Surface only when a steed
 * is summoned (its derives are present).
 */
const STEED_CORE: { label: string; total: string; remaining: string }[] = [
  {
    label: 'play.stats.steed.hp',
    total: 'companion.steed.hp.max',
    remaining: 'companion.steed.hp.current'
  },
  {
    label: 'play.stats.steed.movement',
    total: 'companion.steed.movement.total',
    remaining: 'companion.steed.movement.remaining'
  },
  {
    label: 'play.stats.steed.actions',
    total: 'companion.steed.actions.max',
    remaining: 'companion.steed.actions.remaining'
  },
  {
    label: 'play.stats.steed.bonusActions',
    total: 'companion.steed.bonusActions.max',
    remaining: 'companion.steed.bonusActions.remaining'
  }
];

/** creatureType (0/1/2) → its once-per-rest special-ability pool (only the match shows). */
const STEED_ABILITY_BY_TYPE: Record<number, { pool: string; label: string }> = {
  0: { pool: 'healingTouch', label: 'play.stats.steed.healingTouch' },
  1: { pool: 'feyStep', label: 'play.stats.steed.feyStep' },
  2: { pool: 'fellGlare', label: 'play.stats.steed.fellGlare' }
};

function deriveSteedResources(facts: Facts): UiEntry[] {
  const entries: UiEntry[] = STEED_CORE.filter((e) => present(facts, e.total)).map((e) => ({
    type: 'usedMax',
    label: e.label,
    total: e.total,
    remaining: e.remaining,
    subject: 'steed'
  }));
  const ct = facts['companion.steed.creatureType'];
  const ability = typeof ct === 'number' ? STEED_ABILITY_BY_TYPE[ct] : undefined;
  if (ability && present(facts, `companion.steed.${ability.pool}.total`)) {
    entries.push({
      type: 'usedMax',
      label: ability.label,
      total: `companion.steed.${ability.pool}.total`,
      remaining: `companion.steed.${ability.pool}.remaining`,
      subject: 'steed'
    });
  }
  return entries;
}

/** Canonical display order. Kept identical to the copy in `extractTopBar.ts`. */
const UI_ENTRY_TYPE_ORDER: Record<string, number> = {
  usedMax: 0,
  value: 1,
  modifier: 2,
  hitDie: 3,
  slotLevels: 4,
  concentration: 5,
  ability: 6
};

const present = (facts: Facts, fact: string): boolean => facts[fact] !== undefined;

function sortEntries(entries: UiEntry[]): UiEntry[] {
  return entries.sort(
    (a, b) => (UI_ENTRY_TYPE_ORDER[a.type] ?? 99) - (UI_ENTRY_TYPE_ORDER[b.type] ?? 99)
  );
}

/** The play top-bar entries for the current facts (owning module loaded ⇒ present). */
export function deriveTopBarEntries(facts: Facts): UiEntry[] {
  const entries = [...TOP_BAR, ...STEED_TOP_BAR]
    .filter(({ gate }) => present(facts, gate))
    .map(({ entry }) => entry);
  return sortEntries(entries);
}

/** The resources-panel entries for the current facts (incl. the class hit die). */
export function deriveResourceEntries(facts: Facts): UiEntry[] {
  const entries: UiEntry[] = RESOURCES.filter(
    (e) => e.type === 'usedMax' && present(facts, e.total)
  );
  for (const die of HIT_DIE_SIZES) {
    const total = `hitDie.d${die}.total`;
    if (present(facts, total)) {
      entries.push({
        type: 'hitDie',
        // The label interpolates {{dieSize}}, so consumers (Ledger aria-labels)
        // get a distinguishable "Hit Die d10" / "Hit Die d6" for free.
        label: 'play.stats.hitDie',
        nameParams: { dieSize: die },
        total,
        remaining: `hitDie.d${die}.remaining`,
        dieSize: die
      });
    }
  }
  // Spell slots: one entry covering every level the character actually has.
  // Purely fact-driven, so a half-caster (paladin, ranger) needs no per-class
  // code — the levels are whichever `spellcasting.slots.levelN.total` facts the
  // loaded modules produced.
  const slotLevels = SLOT_LEVELS.filter(
    (level) => Number(facts[`spellcasting.slots.level${level}.total`] ?? 0) > 0
  );
  if (slotLevels.length > 0) {
    entries.push({ type: 'slotLevels', label: 'play.stats.spellSlots', levels: slotLevels });
  }
  // Heroic Inspiration is a plain value in the resources panel.
  if (present(facts, 'heroicInspiration.remaining')) {
    entries.push({
      type: 'value',
      label: 'play.stats.heroicInspiration',
      fact: 'heroicInspiration.remaining'
    });
  }
  // Steed resources ride along under the 'steed' subject (Ledger filters by subject).
  entries.push(...deriveSteedResources(facts));
  return sortEntries(entries.filter(isUiEntry));
}
