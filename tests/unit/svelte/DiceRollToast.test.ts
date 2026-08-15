import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import DiceRollToast from '$lib/components/play/panel-renderer/DiceRollToast.svelte';
import type { RollResult } from '$lib/components/play/panel-renderer/types';

const base = { title: 'Wisdom Save', rollType: 'Save' };

const equation = (c: HTMLElement) => c.querySelector('.dice-toast__detail')?.textContent?.trim();

describe('DiceRollToast equation', () => {
  it('includes active roll modifiers in the bonus term so the arithmetic adds up', () => {
    const result: RollResult = {
      natural: 12,
      bonus: 5,
      total: 20,
      sides: 20,
      purpose: 'save',
      modifiers: [{ label: 'rule.demo.aura', value: 3 }]
    };
    const { container } = render(DiceRollToast, { props: { ...base, result } });
    // 12 + 8 = 20, not the misleading "12 + 5 = 20".
    expect(equation(container)?.replace(/\s+/g, ' ')).toBe('12 + 8 = 20');
  });

  it('shows a bonus term for a modifier even when the die has no authored bonus', () => {
    const result: RollResult = {
      natural: 12,
      total: 15,
      sides: 20,
      purpose: 'save',
      modifiers: [{ label: 'rule.demo.aura', value: 3 }]
    };
    const { container } = render(DiceRollToast, { props: { ...base, result } });
    expect(equation(container)?.replace(/\s+/g, ' ')).toBe('12 + 3 = 15');
  });

  it('is unchanged for a roll with no modifiers', () => {
    const result: RollResult = {
      natural: 12,
      bonus: 5,
      total: 17,
      sides: 20,
      purpose: 'save'
    };
    const { container } = render(DiceRollToast, { props: { ...base, result } });
    expect(equation(container)?.replace(/\s+/g, ' ')).toBe('12 + 5 = 17');
  });
});

describe('DiceRollToast replaced total (effective heal)', () => {
  // Hit-dice heals can be floored at 1 or capped by missing HP, so the payload
  // carries the raw equation total plus the effective heal separately. The
  // toast renders the TRUE math, then the replaced value: the raw total struck
  // out with the effective heal beside it — the same struck-out "replaced"
  // visual the dropped adv/disadv roll and the GWF floor already use.
  it('strikes the raw total and shows the capped heal beside it', () => {
    const result: RollResult = {
      natural: 8,
      bonus: 2,
      total: 10,
      sides: 10,
      effective: 3,
      purpose: 'healing'
    };
    const { container } = render(DiceRollToast, { props: { ...base, result } });
    expect(equation(container)?.replace(/\s+/g, ' ')).toBe('8 + 2 = 10 3');
    const struck = container.querySelector('.dice-toast__dropped s');
    expect(struck?.textContent).toContain('10');
    expect(container.querySelector('.dice-toast__total')?.textContent).toContain('3');
  });

  it('strikes a negative raw total and shows the floored heal beside it', () => {
    const result: RollResult = {
      natural: 1,
      bonus: -3,
      total: -2,
      sides: 10,
      effective: 1,
      purpose: 'healing'
    };
    const { container } = render(DiceRollToast, { props: { ...base, result } });
    expect(equation(container)?.replace(/\s+/g, ' ')).toBe('1 − 3 = -2 1');
    const struck = container.querySelector('.dice-toast__dropped s');
    expect(struck?.textContent).toContain('-2');
    expect(container.querySelector('.dice-toast__total')?.textContent).toContain('1');
  });

  it('strikes the bare natural and shows the capped heal when there is no bonus', () => {
    const result: RollResult = {
      natural: 8,
      total: 8,
      sides: 10,
      effective: 3,
      purpose: 'healing'
    };
    const { container } = render(DiceRollToast, { props: { ...base, result } });
    // No bonus term: the single die's value itself is the replaced number.
    expect(equation(container)?.replace(/\s+/g, ' ')).toBe('8 3');
    const struck = container.querySelector('.dice-toast__dropped s');
    expect(struck?.textContent).toContain('8');
    expect(container.querySelector('.dice-toast__total')?.textContent).toContain('3');
  });

  it('renders no strikethrough when the effective heal equals the total', () => {
    const result: RollResult = {
      natural: 8,
      bonus: 2,
      total: 10,
      sides: 10,
      effective: 10,
      purpose: 'healing'
    };
    const { container } = render(DiceRollToast, { props: { ...base, result } });
    expect(equation(container)?.replace(/\s+/g, ' ')).toBe('8 + 2 = 10');
    expect(container.querySelector('.dice-toast__dropped')).toBeNull();
  });

  it('renders no strikethrough when no effective heal is carried', () => {
    const result: RollResult = {
      natural: 8,
      bonus: 2,
      total: 10,
      sides: 10,
      purpose: 'healing'
    };
    const { container } = render(DiceRollToast, { props: { ...base, result } });
    expect(equation(container)?.replace(/\s+/g, ' ')).toBe('8 + 2 = 10');
    expect(container.querySelector('.dice-toast__dropped')).toBeNull();
  });
});
