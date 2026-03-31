/**
 * Stat entry types and extraction logic for the rules-based stats column.
 */

export interface StatEntryBase {
  name: string;
  nameParams?: Record<string, unknown>;
  section: string;
}

export interface StatEntryValue extends StatEntryBase {
  type: 'value';
  fact: string;
}

export interface StatEntryModifier extends StatEntryBase {
  type: 'modifier';
  fact: string;
}

export interface StatEntryUsedMax extends StatEntryBase {
  type: 'usedMax';
  total: string;
  remaining: string;
}

export type StatEntry = StatEntryValue | StatEntryModifier | StatEntryUsedMax;

export function isStatEntry(entry: unknown): entry is StatEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const obj = entry as Record<string, unknown>;
  if (typeof obj.name !== 'string') return false;
  if (typeof obj.section !== 'string') return false;

  if (obj.type === 'value' || obj.type === 'modifier') {
    return typeof obj.fact === 'string';
  }
  if (obj.type === 'usedMax') {
    return typeof obj.total === 'string' && typeof obj.remaining === 'string';
  }
  return false;
}

export function extractStats(rules: { ui?: Record<string, unknown> }[]): StatEntry[] {
  const stats: StatEntry[] = [];
  for (const rule of rules) {
    const uiStats = rule.ui?.stats;
    if (!Array.isArray(uiStats)) continue;
    for (const entry of uiStats) {
      if (isStatEntry(entry)) {
        stats.push(entry);
      }
    }
  }
  return stats;
}
