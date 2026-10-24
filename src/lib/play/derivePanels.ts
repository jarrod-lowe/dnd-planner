import type { Facts } from '$lib/rules-view';
import {
  HIT_DIE_SIZES,
  gateHolds,
  isUiEntry,
  type RuleModule,
  type SubjectPanel,
  type UiEntry
} from '$lib/rules-engine';

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
 *
 * SUBJECT (companion / vehicle) entries are NOT catalogued here: their modules
 * declare them as data (`module.panels`), and `declaredEntries` below aggregates
 * those declarations generically — adding a subject is a declaration on its
 * module, never a change to this catalog.
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
    // The EFFECTIVE total: the live total (species base + armor penalty, Dash
    // boost — a combine:sum fact) masked to 0 while halted (any Speed-0
    // condition, e.g. Grappled — SRD "Your Speed is 0 and can't increase").
    // The chip must show what the player can spend, not the math-keeps-base
    // total; the ledger's movement row carries the same mask. Gated on the
    // live total so the chip surfaces before anything is spent.
    gate: 'character.movement.total',
    entry: { type: 'value', label: 'play.topBar.speed', fact: 'character.movement.effective_total' }
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

/** Resources-panel catalog: usedMax pools gated on their `total` fact, plus the action-economy pools gated on any pool `max`. */
const RESOURCES: UiEntry[] = [
  // HP appears in the ledger as well as the top bar (hp.yaml
  // declared both a topBar and a resources entry).
  { type: 'usedMax', label: 'play.stats.hp', total: 'hp.max', remaining: 'hp.current' },
  {
    type: 'actionPools',
    label: 'play.stats.actions',
    factPrefix: '',
    pools: [
      {
        key: 'actions',
        label: 'play.stats.actions',
        shortLabel: 'play.ledger.short.actions',
        tile: 'play.economy.tile.actions'
      },
      {
        key: 'bonusActions',
        label: 'play.stats.bonusActions',
        shortLabel: 'play.ledger.short.bonusActions',
        tile: 'play.economy.tile.bonusActions'
      },
      {
        key: 'reactions',
        label: 'play.stats.reactions',
        shortLabel: 'play.ledger.short.reactions',
        tile: 'play.economy.tile.reactions'
      }
    ]
  },
  {
    // The total is the EFFECTIVE (halted-masked) one: while a Speed-0
    // condition is live the row reads 0/0 — honest, per the top-bar chip —
    // and its zero-value visibility then follows the shared usedMax rule.
    type: 'usedMax',
    label: 'play.stats.movement',
    total: 'character.movement.effective_total',
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

/** Canonical display order. Kept identical to the copy in `extractTopBar.ts`. */
const UI_ENTRY_TYPE_ORDER: Record<string, number> = {
  usedMax: 0,
  actionPools: 0, // Ties usedMax to preserve catalog position (after HP, before movement)
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

/**
 * Entries the LOADED modules declare for their subjects (`module.panels`) —
 * the generic companion / vehicle surface. An entry surfaces when its gate
 * holds in the evaluated facts; the declaration's `subject` is stamped onto
 * the emitted entry so the subject-filtering UI (top bar, ledger) needs no
 * per-subject knowledge. Declarations ride their module (eager registry or
 * lazy chunk), so they arrive exactly when the module does.
 */
function declaredEntries(facts: Facts, modules: RuleModule[], panel: SubjectPanel): UiEntry[] {
  const entries: UiEntry[] = [];
  for (const module of modules) {
    for (const declaration of module.panels ?? []) {
      if (declaration.panel !== panel || !gateHolds(facts, declaration.gate)) continue;
      if (isUiEntry(declaration.entry))
        entries.push({ ...declaration.entry, subject: declaration.subject });
    }
  }
  return entries;
}

/**
 * The play top-bar entries for the current facts (owning module loaded ⇒
 * present), plus the subject entries the loaded modules declare.
 */
export function deriveTopBarEntries(facts: Facts, modules: RuleModule[] = []): UiEntry[] {
  const entries = TOP_BAR.filter(({ gate }) => present(facts, gate)).map(({ entry }) => entry);
  entries.push(...declaredEntries(facts, modules, 'topBar'));
  return sortEntries(entries);
}

/**
 * The resources-panel entries for the current facts (incl. the class hit die),
 * plus the subject entries the loaded modules declare.
 */
export function deriveResourceEntries(facts: Facts, modules: RuleModule[] = []): UiEntry[] {
  const entries: UiEntry[] = RESOURCES.filter(
    (e) =>
      (e.type === 'usedMax' && present(facts, e.total)) ||
      (e.type === 'actionPools' &&
        e.pools.some((p) => present(facts, `${e.factPrefix}${p.key}.max`)))
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
  // Subject resources ride along under their subject (Ledger filters by subject).
  entries.push(...declaredEntries(facts, modules, 'resources'));
  return sortEntries(entries.filter(isUiEntry));
}
