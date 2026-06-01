import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import DiceRollToast from '$lib/components/play/panel-renderer/DiceRollToast.svelte';
import type { RollResult } from '$lib/components/play/panel-renderer/types';

describe('DiceRollToast', () => {
  it('renders title and roll type', () => {
    const result: RollResult = { total: 20, natural: 14, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    expect(container.textContent).toContain('Greataxe');
    expect(container.textContent).toContain('Attack');
  });

  it('renders normal roll with bonus', () => {
    const result: RollResult = { total: 20, natural: 14, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    expect(container.textContent).toContain('14');
    expect(container.textContent).toContain('+');
    expect(container.textContent).toContain('6');
    expect(container.textContent).toContain('20');
  });

  it('renders normal roll with negative bonus using minus', () => {
    const result: RollResult = { total: 12, natural: 14, bonus: -2, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Check', rollType: 'Roll', result }
    });
    expect(container.textContent).toContain('14');
    expect(container.textContent).toContain('− 2');
    expect(container.textContent).toContain('12');
  });

  it('renders roll with no bonus', () => {
    const result: RollResult = { total: 14, natural: 14, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Check', rollType: 'Roll', result }
    });
    expect(container.textContent).toContain('14');
  });

  it('renders advantage with both rolls', () => {
    const result: RollResult = {
      total: 21,
      natural: 18,
      mode: 'advantage',
      droppedRoll: 4,
      bonus: 3,
      sides: 20
    };
    const { container } = render(DiceRollToast, {
      props: { title: 'Javelin', rollType: 'Attack', result }
    });
    expect(container.textContent).toContain('18');
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('21');
    // Should have strikethrough on dropped roll
    const dropped = container.querySelector('.dice-toast__dropped');
    expect(dropped).toBeTruthy();
    expect(dropped?.textContent).toContain('4');
  });

  it('renders disadvantage with both rolls', () => {
    const result: RollResult = {
      total: 13,
      natural: 7,
      mode: 'disadvantage',
      droppedRoll: 15,
      bonus: 6,
      sides: 20
    };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('15');
    expect(container.textContent).toContain('13');
    const dropped = container.querySelector('.dice-toast__dropped');
    expect(dropped).toBeTruthy();
    expect(dropped?.textContent).toContain('15');
  });

  it('renders modifiers line when provided', () => {
    const result: RollResult = { total: 20, natural: 14, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: {
        title: 'Greataxe',
        rollType: 'Attack',
        result,
        modifiers: ['Advantage', 'Great Weapon Fighting']
      }
    });
    const mods = container.querySelector('.dice-toast__modifiers');
    expect(mods).toBeTruthy();
    expect(mods?.textContent).toContain('Advantage');
    expect(mods?.textContent).toContain('Great Weapon Fighting');
  });

  it('does not render modifiers line when empty', () => {
    const result: RollResult = { total: 20, natural: 14, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    expect(container.querySelector('.dice-toast__modifiers')).toBeNull();
  });

  it('renders modifiers semicolon-separated', () => {
    const result: RollResult = { total: 20, natural: 14, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: {
        title: 'Greataxe',
        rollType: 'Attack',
        result,
        modifiers: ['Advantage', 'Great Weapon Fighting']
      }
    });
    const mods = container.querySelector('.dice-toast__modifiers');
    expect(mods?.textContent).toContain(';');
  });

  it('highlights nat 20 with crit class', () => {
    const result: RollResult = { total: 26, natural: 20, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    const crit = container.querySelector('.dice-toast__nat--crit');
    expect(crit).toBeTruthy();
    expect(crit?.textContent).toContain('20');
  });

  it('highlights nat 1 with fumble class', () => {
    const result: RollResult = { total: 7, natural: 1, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    const fumble = container.querySelector('.dice-toast__nat--fumble');
    expect(fumble).toBeTruthy();
    expect(fumble?.textContent).toContain('1');
  });

  it('does not highlight nat 20 on non-d20', () => {
    const result: RollResult = { total: 23, natural: 20, bonus: 3, sides: 12 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Damage', result }
    });
    expect(container.querySelector('.dice-toast__nat--crit')).toBeNull();
  });

  it('highlights nat 20 in advantage kept roll', () => {
    const result: RollResult = {
      total: 26,
      natural: 20,
      mode: 'advantage',
      droppedRoll: 4,
      bonus: 6,
      sides: 20
    };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    // The kept roll (20) should have crit class
    const kept = container.querySelector('.dice-toast__kept .dice-toast__nat--crit');
    expect(kept).toBeTruthy();
  });

  it('highlights nat 20 in disadvantage dropped roll', () => {
    const result: RollResult = {
      total: 13,
      natural: 7,
      mode: 'disadvantage',
      droppedRoll: 20,
      bonus: 6,
      sides: 20
    };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    // The dropped roll (20) should have crit class even though dropped
    const dropped = container.querySelector('.dice-toast__dropped .dice-toast__nat--crit');
    expect(dropped).toBeTruthy();
  });

  it('highlights nat 1 in disadvantage kept roll', () => {
    const result: RollResult = {
      total: 7,
      natural: 1,
      mode: 'disadvantage',
      droppedRoll: 14,
      bonus: 6,
      sides: 20
    };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    const kept = container.querySelector('.dice-toast__kept .dice-toast__nat--fumble');
    expect(kept).toBeTruthy();
  });

  it('renders damage type icon when damageTypeKey provided', () => {
    const result: RollResult = { total: 11, natural: 8, bonus: 3, sides: 12 };
    const { container } = render(DiceRollToast, {
      props: {
        title: 'Greataxe',
        rollType: 'Damage',
        result,
        damageTypeKey: 'slashing'
      }
    });
    const icon = container.querySelector('.dice-toast__damage-icon svg');
    expect(icon).toBeTruthy();
  });

  it('renders damage type name after total', () => {
    const result: RollResult = { total: 11, natural: 8, bonus: 3, sides: 12 };
    const { container } = render(DiceRollToast, {
      props: {
        title: 'Greataxe',
        rollType: 'Damage',
        result,
        damageTypeKey: 'slashing'
      }
    });
    // i18n mock returns the key, so we check for the key
    expect(container.textContent).toContain('damage-type.slashing');
  });

  it('does not render damage type when no damageTypeKey', () => {
    const result: RollResult = { total: 20, natural: 14, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Attack', result }
    });
    expect(container.querySelector('.dice-toast__damage-icon')).toBeNull();
  });
});
