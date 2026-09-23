import { describe, it, expect, vi, beforeEach } from 'vitest';

// The helper fires the roll toast through svelte-sonner's imperative API; mock
// it so we can inspect the component and props it was called with instead of
// rendering a real toast. i18n is NOT mocked per-file: the shared setup.ts mock
// falls back to rendering the key, so a "translated" label is the key itself.
vi.mock('svelte-sonner', () => ({
  toast: {
    custom: vi.fn()
  }
}));

import { toast } from 'svelte-sonner';
import DiceRollToast from '$lib/components/play/panel-renderer/DiceRollToast.svelte';
import { showDiceRollToast } from '$lib/components/play/panel-renderer/diceRollToast';
import { rollLog } from '$lib/play/rollLogStore.svelte';
import type { RollResult } from '$lib/components/play/panel-renderer/types';

const lastCall = (): { componentProps: Record<string, unknown> } => {
  const mock = vi.mocked(toast.custom);
  const call = mock.mock.calls[mock.mock.calls.length - 1];
  return call[1] as { componentProps: Record<string, unknown> };
};

describe('showDiceRollToast', () => {
  beforeEach(() => {
    rollLog.clearRollLog();
  });

  it('fires toast.custom with DiceRollToast, the translated roll type, and the toast chrome', () => {
    const result: RollResult = {
      total: 11,
      natural: 8,
      bonus: 3,
      sides: 12,
      purpose: 'damage',
      damageType: 'fire'
    };
    showDiceRollToast('Greataxe', result);
    expect(toast.custom).toHaveBeenCalledTimes(1);
    expect(toast.custom).toHaveBeenCalledWith(DiceRollToast, {
      componentProps: {
        title: 'Greataxe',
        rollType: 'play.toast.rollType.damage',
        result,
        damageTypeKey: 'fire',
        unitKey: undefined
      },
      duration: 4000,
      unstyled: true
    });
  });

  it('passes the unit through when the roll carries one', () => {
    const result: RollResult = {
      total: 8,
      natural: 8,
      sides: 8,
      rolls: [5, 3],
      count: 2,
      purpose: 'healing',
      unit: 'hp'
    };
    showDiceRollToast('Prayer of Healing', result);
    const { componentProps } = lastCall();
    expect(componentProps['unitKey']).toBe('hp');
    expect(componentProps['damageTypeKey']).toBeUndefined();
    expect(componentProps['rollType']).toBe('play.toast.rollType.healing');
  });

  it('orders modifiers: advantage label, extra labels, then signed result modifiers', () => {
    const result: RollResult = {
      total: 25,
      natural: 18,
      mode: 'advantage',
      droppedRoll: 4,
      bonus: 3,
      sides: 20,
      purpose: 'to-hit',
      modifiers: [{ label: 'rule.demo.aura', value: 3 }]
    };
    showDiceRollToast('Javelin', result, ['rule.demo.info']);
    expect(lastCall().componentProps['modifiers']).toEqual([
      'play.toast.modifier.advantage',
      'rule.demo.info',
      'rule.demo.aura +3'
    ]);
  });

  it('leads with the disadvantage label on a disadvantaged roll', () => {
    const result: RollResult = {
      total: 7,
      natural: 1,
      mode: 'disadvantage',
      droppedRoll: 14,
      sides: 20
    };
    showDiceRollToast('Greataxe', result);
    expect(lastCall().componentProps['modifiers']).toEqual(['play.toast.modifier.disadvantage']);
  });

  it('formats result modifiers with an explicit + on non-negative values', () => {
    const result: RollResult = {
      total: 12,
      natural: 7,
      sides: 20,
      modifiers: [
        { label: 'rule.demo.aura', value: 5 },
        { label: 'rule.demo.curse', value: -2 }
      ]
    };
    showDiceRollToast('Save', result);
    expect(lastCall().componentProps['modifiers']).toEqual([
      'rule.demo.aura +5',
      'rule.demo.curse -2'
    ]);
  });

  it('omits modifiers entirely when nothing contributes one', () => {
    const result: RollResult = { total: 14, natural: 14, sides: 20 };
    showDiceRollToast('Check', result, []);
    expect(lastCall().componentProps['modifiers']).toBeUndefined();
  });

  it('logs an entry carrying exactly the toast payload plus the rollKey', () => {
    const result: RollResult = {
      total: 25,
      natural: 18,
      mode: 'advantage',
      droppedRoll: 4,
      bonus: 3,
      sides: 20,
      purpose: 'to-hit',
      modifiers: [{ label: 'rule.demo.aura', value: 3 }]
    };
    showDiceRollToast('Javelin', result, ['rule.demo.info'], 'item1:ctrl:0');

    expect(rollLog.rolls.length).toBe(1);
    const logged = rollLog.rolls[0];
    // The log entry is the toast payload verbatim, keyed for replacement.
    // (result/modifiers use structural equality: the log's $state wraps stored
    // objects in reactive proxies, so reference identity never holds.)
    const { componentProps } = lastCall();
    expect(logged.key).toBe('item1:ctrl:0');
    expect(logged.title).toBe(componentProps['title']);
    expect(logged.rollType).toBe(componentProps['rollType']);
    expect(logged.result).toEqual(result);
    expect(logged.modifiers).toEqual(componentProps['modifiers']);
    expect(logged.damageTypeKey).toBe(componentProps['damageTypeKey']);
    expect(logged.unitKey).toBe(componentProps['unitKey']);
  });

  it('logs key: undefined when no rollKey is passed', () => {
    const result: RollResult = { total: 14, natural: 14, sides: 20 };
    showDiceRollToast('Check', result);

    expect(rollLog.rolls.length).toBe(1);
    expect(rollLog.rolls[0].key).toBeUndefined();
  });
});
