import { describe, it, expect } from 'vitest';
import type { Rule } from '$lib/rules-engine';
import { decrementCountDowns } from '$lib/play/countDown';

describe('countDown decrement', () => {
  it('decrements countDown by 1 on effects with ui.countDown', () => {
    const effects: Rule[] = [
      { id: 'effect-timed', ui: { countDown: 10, duration: 10 }, activities: [] }
    ];

    const result = decrementCountDowns(effects);

    expect(result).toHaveLength(1);
    expect(result[0].ui?.countDown).toBe(9);
  });

  it('removes effects when countDown reaches 0', () => {
    const effects: Rule[] = [
      { id: 'effect-timed', ui: { countDown: 1, duration: 10 }, activities: [] }
    ];

    const result = decrementCountDowns(effects);

    expect(result).toHaveLength(0);
  });

  it('leaves effects without countDown unchanged', () => {
    const effects: Rule[] = [{ id: 'effect-normal', ui: { model: 'other' }, activities: [] }];

    const result = decrementCountDowns(effects);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('effect-normal');
  });

  it('handles mixed effects', () => {
    const effects: Rule[] = [
      { id: 'effect-timed', ui: { countDown: 5, duration: 10 }, activities: [] },
      { id: 'effect-expired', ui: { countDown: 1, duration: 10 }, activities: [] },
      { id: 'effect-normal', ui: { model: 'other' }, activities: [] }
    ];

    const result = decrementCountDowns(effects);

    expect(result).toHaveLength(2);
    expect(result.find((e) => e.id === 'effect-timed')?.ui?.countDown).toBe(4);
    expect(result.find((e) => e.id === 'effect-normal')).toBeDefined();
    expect(result.find((e) => e.id === 'effect-expired')).toBeUndefined();
  });
});
