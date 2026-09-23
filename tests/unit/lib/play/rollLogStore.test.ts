import { describe, it, expect, beforeEach } from 'vitest';
import { rollLog, type RollLogEntry } from '$lib/play/rollLogStore.svelte';
import type { RollResult } from '$lib/components/play/panel-renderer/types';

/** A caller-supplied log entry: everything except the store-assigned fields. */
function entry(
  overrides: Partial<Omit<RollLogEntry, 'id' | 'replaced'>> = {}
): Omit<RollLogEntry, 'id' | 'replaced'> {
  const result: RollResult = { total: 11, natural: 8, bonus: 3, sides: 12 };
  return {
    title: 'Greataxe',
    rollType: 'play.toast.rollType.damage',
    result,
    ...overrides
  };
}

describe('rollLogStore', () => {
  beforeEach(() => {
    rollLog.clearRollLog();
    rollLog.close();
  });

  it('prepends entries so rolls reads latest-first', () => {
    rollLog.logRoll(entry({ title: 'First' }));
    rollLog.logRoll(entry({ title: 'Second' }));

    expect(rollLog.rolls.map((r) => r.title)).toEqual(['Second', 'First']);
  });

  it('marks earlier same-key entries replaced; the new entry and other keys are not', () => {
    rollLog.logRoll(entry({ key: 'item1:ctrl:0' }));
    rollLog.logRoll(entry({ key: 'item2:ctrl:0' }));
    rollLog.logRoll(entry({ key: 'item1:ctrl:0' }));

    const [newest, otherKey, oldest] = rollLog.rolls;
    expect(oldest.replaced).toBe(true); // same key, earlier
    expect(otherKey.replaced).toBe(false); // different key
    expect(newest.replaced).toBe(false); // the entry that just landed
  });

  it('marks EVERY earlier same-key entry replaced, not only the most recent', () => {
    rollLog.logRoll(entry({ key: 'x' }));
    rollLog.logRoll(entry({ key: 'x' }));
    rollLog.logRoll(entry({ key: 'x' }));

    expect(rollLog.rolls.map((r) => r.replaced)).toEqual([false, true, true]);
  });

  it('never marks unkeyed entries replaced', () => {
    rollLog.logRoll(entry());
    rollLog.logRoll(entry());

    expect(rollLog.rolls.map((r) => r.replaced)).toEqual([false, false]);
  });

  it('clearRollLog empties the log', () => {
    rollLog.logRoll(entry());
    expect(rollLog.rolls.length).toBe(1);

    rollLog.clearRollLog();

    expect(rollLog.rolls).toEqual([]);
  });

  it('open/close toggle isOpen', () => {
    expect(rollLog.isOpen).toBe(false);

    rollLog.open();
    expect(rollLog.isOpen).toBe(true);

    rollLog.close();
    expect(rollLog.isOpen).toBe(false);
  });

  it('assigns unique, monotonically increasing ids', () => {
    rollLog.logRoll(entry());
    rollLog.logRoll(entry());
    rollLog.logRoll(entry());

    const ids = rollLog.rolls.map((r) => r.id);
    expect(ids.length).toBe(3);
    expect(new Set(ids).size).toBe(ids.length);

    // rolls reads latest-first; reversed is chronological, and each later entry
    // must have a strictly greater id than the one before it.
    const chronological = [...ids].reverse();
    for (let i = 1; i < chronological.length; i++) {
      expect(chronological[i]).toBeGreaterThan(chronological[i - 1]);
    }
  });
});
