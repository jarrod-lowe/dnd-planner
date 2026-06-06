import type { Facts } from '$lib/rules-engine';

// ── Unified UI Entry Types ──

export type UiEntryType = 'usedMax' | 'value' | 'modifier' | 'hitDie' | 'concentration' | 'ability';

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
    proficiencyFact?: string;
  }>;
}

export type UiEntry =
  | UiEntryUsedMax
  | UiEntryValue
  | UiEntryModifier
  | UiEntryHitDie
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
        ((a as Record<string, unknown>).proficiencyFact === undefined ||
          typeof (a as Record<string, unknown>).proficiencyFact === 'string')
    );
  }

  return false;
}

/** @deprecated Use isUiEntry */
export const isTopBarEntry = isUiEntry;

// ── Extraction ──

const UI_ENTRY_TYPE_ORDER: Record<string, number> = {
  usedMax: 0,
  value: 1,
  modifier: 2,
  hitDie: 3,
  concentration: 4,
  ability: 5
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

export function extractTopBarEntries(
  rules: { ui?: Record<string, unknown> }[]
): UiEntry[] {
  return extractUiEntries(rules, 'topBar');
}

export function extractResourceEntries(
  rules: { ui?: Record<string, unknown> }[]
): UiEntry[] {
  return extractUiEntries(rules, 'resources');
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
  // concentration and ability are always visible when present
  return true;
}
