import type { Facts } from '$lib/rules-view';
import { deriveSlotLevels } from './slotLevels';
import { deriveActionPools } from './actionPools';

// ── Unified UI Entry Types ──

export type UiEntryType =
  | 'usedMax'
  | 'value'
  | 'modifier'
  | 'hitDie'
  | 'slotLevels'
  | 'actionPools'
  | 'concentration'
  | 'ability';

interface UiEntryBase {
  label: string;
  nameParams?: Record<string, unknown>;
  subject?: string;
}

export interface UiEntryUsedMax extends UiEntryBase {
  type: 'usedMax';
  total: string;
  remaining: string;
}

export interface UiEntryValue extends UiEntryBase {
  type: 'value';
  fact: string;
}

export interface UiEntryModifier extends UiEntryBase {
  type: 'modifier';
  fact: string;
  proficiencyFact?: string;
}

export interface UiEntryHitDie extends UiEntryBase {
  type: 'hitDie';
  total: string;
  remaining: string;
  dieSize: number;
}

/**
 * Per-level spell slots, rendered as a row of tiles plus a breakdown tray.
 *
 * Only the level numbers are stored: the driving facts are
 * `spellcasting.slots.level{n}.total` / `.spent` by construction, exactly as
 * `hitDie` carries only its `dieSize`.
 */
export interface UiEntrySlotLevels extends UiEntryBase {
  type: 'slotLevels';
  levels: number[];
}

/**
 * Per-pool action economy (Actions / Bonus Actions / Reactions), rendered as a
 * row of tiles plus a breakdown tray — the same display as `slotLevels`.
 *
 * `factPrefix` selects subject: '' (player) reads `actions.max` etc.;
 * 'companion.steed.' reads `companion.steed.actions.max` etc. Each pool carries
 * its own label (full, for the tray) and shortLabel (compact, for tiles).
 */
export interface UiEntryActionPools extends UiEntryBase {
  type: 'actionPools';
  /** Fact prefix: '' for the player, 'companion.steed.' for the steed. */
  factPrefix: string;
  pools: Array<{ key: string; label: string; shortLabel: string }>;
}

export interface UiEntryConcentration extends UiEntryBase {
  type: 'concentration';
  activeLabel: string;
  noneLabel: string;
}

export interface UiEntryAbility extends UiEntryBase {
  type: 'ability';
  abilities: Array<{
    name: string;
    fact: string;
    saveFact?: string;
    proficiencyFact?: string;
  }>;
}

export type UiEntry =
  | UiEntryUsedMax
  | UiEntryValue
  | UiEntryModifier
  | UiEntryHitDie
  | UiEntrySlotLevels
  | UiEntryActionPools
  | UiEntryConcentration
  | UiEntryAbility;

// ── Backward-compat aliases (will be removed after migration) ──

/** @deprecated Use UiEntry */
export type TopBarEntry = UiEntry;
/** @deprecated Use UiEntryValue */
export type TopBarValueEntry = UiEntryValue;
/** @deprecated Use UiEntryConcentration */
export type TopBarConcentrationEntry = UiEntryConcentration;
/** @deprecated Use UiEntryAbility */
export type TopBarAbilityEntry = UiEntryAbility;
/** @deprecated Use UiEntryUsedMax */
export type TopBarHpEntry = UiEntryUsedMax;
/** @deprecated Use UiEntryType */
export type TopBarDisplayType = UiEntryType;

// ── Type Guard ──

export function isUiEntry(entry: unknown): entry is UiEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const obj = entry as Record<string, unknown>;

  if (obj.type === 'usedMax') {
    return (
      typeof obj.label === 'string' &&
      typeof obj.total === 'string' &&
      typeof obj.remaining === 'string'
    );
  }

  if (obj.type === 'value') {
    return typeof obj.label === 'string' && typeof obj.fact === 'string';
  }

  if (obj.type === 'modifier') {
    if (typeof obj.label !== 'string') return false;
    if (typeof obj.fact !== 'string') return false;
    if (obj.proficiencyFact !== undefined && typeof obj.proficiencyFact !== 'string') return false;
    return true;
  }

  if (obj.type === 'hitDie') {
    return (
      typeof obj.label === 'string' &&
      typeof obj.total === 'string' &&
      typeof obj.remaining === 'string' &&
      typeof obj.dieSize === 'number'
    );
  }

  if (obj.type === 'slotLevels') {
    if (typeof obj.label !== 'string') return false;
    if (!Array.isArray(obj.levels)) return false;
    return obj.levels.every((level: unknown) => typeof level === 'number');
  }

  if (obj.type === 'actionPools') {
    if (typeof obj.label !== 'string') return false;
    if (typeof obj.factPrefix !== 'string') return false;
    if (!Array.isArray(obj.pools)) return false;
    return obj.pools.every(
      (p: unknown) =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Record<string, unknown>).key === 'string' &&
        typeof (p as Record<string, unknown>).label === 'string' &&
        typeof (p as Record<string, unknown>).shortLabel === 'string'
    );
  }

  if (obj.type === 'concentration') {
    return (
      typeof obj.label === 'string' &&
      typeof obj.activeLabel === 'string' &&
      typeof obj.noneLabel === 'string'
    );
  }

  if (obj.type === 'ability') {
    if (typeof obj.label !== 'string') return false;
    if (!Array.isArray(obj.abilities)) return false;
    return obj.abilities.every(
      (a: unknown) =>
        typeof a === 'object' &&
        a !== null &&
        typeof (a as Record<string, unknown>).name === 'string' &&
        typeof (a as Record<string, unknown>).fact === 'string' &&
        ((a as Record<string, unknown>).saveFact === undefined ||
          typeof (a as Record<string, unknown>).saveFact === 'string') &&
        ((a as Record<string, unknown>).proficiencyFact === undefined ||
          typeof (a as Record<string, unknown>).proficiencyFact === 'string')
    );
  }

  return false;
}

/** @deprecated Use isUiEntry */
export const isTopBarEntry = isUiEntry;

// ── Extraction ──

/** Canonical display order. Kept identical to the copy in `derivePanels.ts`. */
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

export function extractUiEntries(
  rules: { ui?: Record<string, unknown> }[],
  section: 'topBar' | 'resources'
): UiEntry[] {
  const entries: UiEntry[] = [];
  for (const rule of rules) {
    const items = rule.ui?.[section];
    if (!Array.isArray(items)) continue;
    const subject = typeof rule.ui?.subject === 'string' ? rule.ui.subject : undefined;
    for (const entry of items) {
      if (isUiEntry(entry)) {
        entries.push({ ...entry, subject });
      }
    }
  }
  return entries.sort(
    (a, b) => (UI_ENTRY_TYPE_ORDER[a.type] ?? 99) - (UI_ENTRY_TYPE_ORDER[b.type] ?? 99)
  );
}

export function extractTopBarEntries(rules: { ui?: Record<string, unknown> }[]): UiEntry[] {
  return extractUiEntries(rules, 'topBar');
}

export function extractResourceEntries(rules: { ui?: Record<string, unknown> }[]): UiEntry[] {
  return extractUiEntries(rules, 'resources');
}

// ── Resource short labels (resources panel) ──

/**
 * Maps a resource entry's full i18n label key to a compact short-label key
 * (under `play.ledger.short.*`) for the resources panel. Entries without a
 * short form return `undefined`, so the caller can fall back to the long label.
 * Explicit (rather than convention-derived) so unknown labels never render a
 * raw dotted key path.
 */
const RESOURCE_SHORT_LABELS: Record<string, string> = {
  'play.stats.actions': 'play.ledger.short.actions',
  'play.stats.bonusActions': 'play.ledger.short.bonusActions',
  'play.stats.reactions': 'play.ledger.short.reactions',
  'play.stats.hp': 'play.ledger.short.hp',
  'play.stats.movement': 'play.ledger.short.movement',
  'play.stats.hands': 'play.ledger.short.hands',
  'play.stats.hitDie': 'play.ledger.short.hitDie',
  'play.stats.spellcasting': 'play.ledger.short.spellcasting',
  'play.stats.spellSlots': 'play.ledger.short.spellSlots',
  'play.stats.divinity': 'play.ledger.short.divinity',
  'play.stats.layOnHands': 'play.ledger.short.layOnHands',
  'play.stats.paladinSmite': 'play.ledger.short.paladinSmite',
  'play.stats.paladinFindSteed': 'play.ledger.short.paladinFindSteed',
  'play.stats.savageAttacker': 'play.ledger.short.savageAttacker',
  'play.stats.steed.hp': 'play.ledger.short.steed.hp',
  'play.stats.steed.movement': 'play.ledger.short.steed.movement',
  'play.stats.steed.actions': 'play.ledger.short.steed.actions',
  'play.stats.steed.bonusActions': 'play.ledger.short.steed.bonusActions',
  'play.stats.steed.healingTouch': 'play.ledger.short.steed.healingTouch',
  'play.stats.steed.feyStep': 'play.ledger.short.steed.feyStep',
  'play.stats.steed.fellGlare': 'play.ledger.short.steed.fellGlare'
};

export function resourceShortLabelKey(label: string): string | undefined {
  return RESOURCE_SHORT_LABELS[label];
}

// ── Shared Value Resolution ──

export function resolveEntryValue(entry: UiEntry, facts: Facts): string {
  if (entry.type === 'usedMax') {
    const total = Number(facts[entry.total] ?? 0);
    const remaining = Number(facts[entry.remaining] ?? 0);
    return `${remaining}/${total}`;
  }
  if (entry.type === 'value') {
    return String(facts[entry.fact] ?? '');
  }
  if (entry.type === 'modifier') {
    const n = Number(facts[entry.fact] ?? 0);
    return `${n >= 0 ? '+' : ''}${n}`;
  }
  if (entry.type === 'hitDie') {
    const total = Number(facts[entry.total] ?? 0);
    const remaining = Number(facts[entry.remaining] ?? 0);
    return `${remaining}/${total} d${entry.dieSize}`;
  }
  if (entry.type === 'slotLevels') {
    // Compact fallback only — the tray renders the per-level breakdown. The
    // this-turn split is irrelevant to a summed "open/total", so no advertised
    // effects are needed here.
    const levels = deriveSlotLevels(facts, []).filter((l) => entry.levels.includes(l.level));
    const open = levels.reduce((sum, l) => sum + l.open, 0);
    const total = levels.reduce((sum, l) => sum + l.total, 0);
    return `${open}/${total}`;
  }
  if (entry.type === 'actionPools') {
    // Compact fallback only — the tray renders the per-pool breakdown. No
    // advertised effects needed: the this-turn split doesn't affect the summed
    // "open/total".
    const pools = deriveActionPools(
      facts,
      [],
      entry.factPrefix,
      entry.pools.map((p) => p.key)
    );
    const open = pools.reduce((sum, p) => sum + p.open, 0);
    const total = pools.reduce((sum, p) => sum + p.total, 0);
    return `${open}/${total}`;
  }
  return '';
}

export function isEntryVisible(entry: UiEntry, facts: Facts): boolean {
  if (entry.type === 'usedMax') {
    const total = facts[entry.total];
    return total !== undefined && Number(total) !== 0;
  }
  if (entry.type === 'value') {
    return facts[entry.fact] !== undefined;
  }
  if (entry.type === 'modifier') {
    return facts[entry.fact] !== undefined;
  }
  if (entry.type === 'hitDie') {
    const total = facts[entry.total];
    return total !== undefined && Number(total) !== 0;
  }
  if (entry.type === 'slotLevels') {
    return entry.levels.some((level) => {
      const total = facts[`spellcasting.slots.level${level}.total`];
      return total !== undefined && Number(total) > 0;
    });
  }
  if (entry.type === 'actionPools') {
    return entry.pools.some((p) => {
      const total = facts[`${entry.factPrefix}${p.key}.max`];
      return total !== undefined && Number(total) > 0;
    });
  }
  // concentration and ability are always visible when present
  return true;
}
