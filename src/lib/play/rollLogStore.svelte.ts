import type { RollResult } from '$lib/components/play/panel-renderer/types';

/** One logged roll: the exact payload the dice-roll toast rendered. */
export interface RollLogEntry {
  id: number;
  /** Replacement key — a re-roll of the same die/slot shares it. */
  key?: string;
  /** True once a later entry logged the same `key`. */
  replaced: boolean;
  title: string;
  rollType: string;
  result: RollResult;
  modifiers?: string[];
  damageTypeKey?: string;
  unitKey?: string;
}

// Module-level runes state (companionStore pattern). Memory only: the log is
// current-turn scratch, never synced to the server — refresh empties it.
let rolls = $state<RollLogEntry[]>([]);
let isOpen = $state(false);

// Never reset: ids stay unique across clears for the life of the session.
let nextId = 1;

export const rollLog = {
  /** Latest roll first. */
  get rolls(): RollLogEntry[] {
    return rolls;
  },
  get isOpen(): boolean {
    return isOpen;
  },
  /**
   * Prepend a roll. The store assigns the id; a keyed entry marks EVERY earlier
   * entry sharing its key `replaced` (rollers overwrite in place, so nothing
   * else tracks re-rolls) — replaced entries stay at their chronological
   * position for the panel to style. Unkeyed entries are never replaced.
   */
  logRoll(entry: Omit<RollLogEntry, 'id' | 'replaced'>): void {
    rolls = [
      { ...entry, id: nextId++, replaced: false },
      ...rolls.map((earlier) =>
        entry.key !== undefined && earlier.key === entry.key
          ? { ...earlier, replaced: true }
          : earlier
      )
    ];
  },
  clearRollLog(): void {
    rolls = [];
  },
  open(): void {
    isOpen = true;
  },
  close(): void {
    isOpen = false;
  }
};
