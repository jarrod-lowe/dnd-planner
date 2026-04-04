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
  modifierFact?: string;
  saveFact?: string;
}

export interface StatEntryModifier extends StatEntryBase {
  type: 'modifier';
  fact: string;
  proficiencyFact?: string;
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
    if (typeof obj.fact !== 'string') return false;
    if (obj.type === 'value') {
      if (obj.modifierFact !== undefined && typeof obj.modifierFact !== 'string') return false;
      if (obj.saveFact !== undefined && typeof obj.saveFact !== 'string') return false;
    }
    if (obj.type === 'modifier') {
      if (obj.proficiencyFact !== undefined && typeof obj.proficiencyFact !== 'string')
        return false;
    }
    return true;
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
