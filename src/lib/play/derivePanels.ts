import type { Facts } from '$lib/rules-engine';
import { type UiEntry, isUiEntry } from './extractTopBar';

/**
 * M4/W4 — the v2 replacement for `extractTopBarEntries` / `extractResourceEntries`.
 *
 * v1 declared the top-bar and resources panels as `ui.topBar` / `ui.resources`
 * blocks on the rule objects, and the store extracted them from
 * `[...ruleGroups, ...effects]`. v2 modules deliberately don't carry that display
 * metadata (the parity harness only checks facts/offers/annotations), so the panels
 * need a v2 source. Since every panel entry is a pure declaration that references
 * facts the v2 engine already produces, this is a fixed **facts-driven catalog**:
 * an entry surfaces when its driving fact is present in the evaluated facts (the
 * owning module is loaded), and the existing `resolveEntryValue` / `isEntryVisible`
 * render it — so the PanelRenderer/top-bar UI is unchanged.
 *
 * The catalog mirrors the v1 declarations exactly (labels + fact refs). The
 * character-sheet sections (`magic` spell slots, `abilities`, `stats`, `skills`,
 * `passive`) have their own extractor and are out of scope here — this covers the
 * play-mode top bar + resources panel.
 */

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/** Top-bar catalog: each entry plus the fact whose presence gates it. */
const TOP_BAR: { gate: string; entry: UiEntry }[] = [
  { gate: 'hp.max', entry: { type: 'usedMax', label: 'play.topBar.hp', total: 'hp.max', remaining: 'hp.current' } },
  { gate: 'ac.value', entry: { type: 'value', label: 'play.topBar.ac', fact: 'ac.value' } },
  { gate: 'character.movement.remaining', entry: { type: 'value', label: 'play.topBar.speed', fact: 'character.movement.remaining' } },
  {
    gate: 'concentration.max',
    entry: { type: 'concentration', label: 'play.topBar.conc', activeLabel: 'play.topBar.concActive', noneLabel: 'play.topBar.concNone' }
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
  { type: 'usedMax', label: 'play.stats.actions', total: 'actions.max', remaining: 'actions.remaining' },
  { type: 'usedMax', label: 'play.stats.bonusActions', total: 'bonusActions.max', remaining: 'bonusActions.remaining' },
  { type: 'usedMax', label: 'play.stats.reactions', total: 'reactions.max', remaining: 'reactions.remaining' },
  { type: 'usedMax', label: 'play.stats.movement', total: 'character.movement.total', remaining: 'character.movement.remaining' },
  { type: 'usedMax', label: 'play.stats.hands', total: 'hands.max', remaining: 'hands.remaining' },
  { type: 'usedMax', label: 'play.stats.spellcasting', total: 'spellcasting.max', remaining: 'spellcasting.remaining' },
  { type: 'usedMax', label: 'play.stats.divinity', total: 'divinity.total', remaining: 'divinity.remaining' },
  { type: 'usedMax', label: 'play.stats.layOnHands', total: 'layOnHands.pool.total', remaining: 'layOnHands.pool.remaining' },
  { type: 'usedMax', label: 'play.stats.paladinSmite', total: 'paladinSmite.total', remaining: 'paladinSmite.remaining' },
  { type: 'usedMax', label: 'play.stats.paladinFindSteed', total: 'paladinFindSteed.total', remaining: 'paladinFindSteed.remaining' },
  { type: 'usedMax', label: 'play.stats.savageAttacker', total: 'savageAttacker.max', remaining: 'savageAttacker.remaining' }
];

/** Hit-die sizes a class might grant; the present one drives the hitDie entry. */
const HIT_DICE = [6, 8, 10, 12] as const;

const UI_ENTRY_TYPE_ORDER: Record<string, number> = {
  usedMax: 0,
  value: 1,
  modifier: 2,
  hitDie: 3,
  concentration: 4,
  ability: 5
};

const present = (facts: Facts, fact: string): boolean => facts[fact] !== undefined;

function sortEntries(entries: UiEntry[]): UiEntry[] {
  return entries.sort(
    (a, b) => (UI_ENTRY_TYPE_ORDER[a.type] ?? 99) - (UI_ENTRY_TYPE_ORDER[b.type] ?? 99)
  );
}

/** The play top-bar entries for the current facts (owning module loaded ⇒ present). */
export function deriveTopBarEntries(facts: Facts): UiEntry[] {
  const entries = TOP_BAR.filter(({ gate }) => present(facts, gate)).map(({ entry }) => entry);
  return sortEntries(entries);
}

/** The resources-panel entries for the current facts (incl. the class hit die). */
export function deriveResourceEntries(facts: Facts): UiEntry[] {
  const entries: UiEntry[] = RESOURCES.filter((e) => e.type === 'usedMax' && present(facts, e.total));
  for (const die of HIT_DICE) {
    const total = `hitDie.d${die}.total`;
    if (present(facts, total)) {
      entries.push({ type: 'hitDie', label: 'play.stats.hitDie', total, remaining: `hitDie.d${die}.remaining`, dieSize: die });
    }
  }
  // Heroic Inspiration is a plain value in the resources panel.
  if (present(facts, 'heroicInspiration.remaining')) {
    entries.push({ type: 'value', label: 'play.stats.heroicInspiration', fact: 'heroicInspiration.remaining' });
  }
  return sortEntries(entries.filter(isUiEntry));
}
