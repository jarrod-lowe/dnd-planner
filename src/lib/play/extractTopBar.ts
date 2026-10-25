import type { Facts } from '$lib/rules-view';
import { isUiEntry } from '$lib/rules-engine/panels';
import type {
  UiEntry,
  UiEntryValue,
  UiEntryConcentration,
  UiEntryAbility,
  UiEntryUsedMax,
  UiEntryType
} from '$lib/rules-engine/panels';
import { deriveSlotLevels } from './slotLevels';
import { deriveActionPools } from './actionPools';

// ── Unified UI Entry Types ──
//
// The entry family (and its `isUiEntry` guard) lives in the rules engine
// (`rules-engine/panels.ts`): rule modules declare subject entries as data on
// the module, so the payload contract is engine-side. Re-exported here — the
// play layer's historical import site — for the renderers and tests.

export type {
  UiEntryType,
  UiEntryUsedMax,
  UiEntryValue,
  UiEntryModifier,
  UiEntryHitDie,
  UiEntrySlotLevels,
  UiEntryActionPools,
  UiEntryConcentration,
  UiEntryAbility,
  UiEntry
} from '$lib/rules-engine/panels';
export { isUiEntry };

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
  'play.stats.steed.fellGlare': 'play.ledger.short.steed.fellGlare',
  'play.stats.tormentor-damage-control.creatureCapacity':
    'play.ledger.short.tormentor-damage-control.creatureCapacity'
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
