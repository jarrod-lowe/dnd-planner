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
