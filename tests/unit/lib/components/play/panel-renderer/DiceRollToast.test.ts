import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import DiceRollToast from '$lib/components/play/panel-renderer/DiceRollToast.svelte';
import type { RollResult } from '$lib/components/play/panel-renderer/types';

describe('DiceRollToast', () => {
  it('renders title and roll type', () => {
    const result: RollResult = { total: 20, natural: 14, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Check', result }
    });
    expect(container.textContent).toContain('Greataxe');
    expect(container.textContent).toContain('Check');
  });

  it('renders normal roll with bonus', () => {
    const result: RollResult = { total: 20, natural: 14, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Check', result }
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
      props: { title: 'Javelin', rollType: 'Check', result }
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
      props: { title: 'Greataxe', rollType: 'Check', result }
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
        rollType: 'Check',
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
      props: { title: 'Greataxe', rollType: 'Check', result }
    });
    expect(container.querySelector('.dice-toast__modifiers')).toBeNull();
  });

  it('renders modifiers semicolon-separated', () => {
    const result: RollResult = { total: 20, natural: 14, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: {
        title: 'Greataxe',
        rollType: 'Check',
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
      props: { title: 'Greataxe', rollType: 'Check', result }
    });
    const crit = container.querySelector('.dice-toast__nat--crit');
    expect(crit).toBeTruthy();
    expect(crit?.textContent).toContain('20');
  });

  it('highlights nat 1 with fumble class', () => {
    const result: RollResult = { total: 7, natural: 1, bonus: 6, sides: 20 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Check', result }
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
      props: { title: 'Greataxe', rollType: 'Check', result }
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
      props: { title: 'Greataxe', rollType: 'Check', result }
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
      props: { title: 'Greataxe', rollType: 'Check', result }
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
      props: { title: 'Greataxe', rollType: 'Check', result }
    });
    expect(container.querySelector('.dice-toast__damage-icon')).toBeNull();
  });

  it('renders GWF floor format (original|3) with bonus', () => {
    const result: RollResult = { total: 6, natural: 3, gwfFloor: 1, bonus: 3, sides: 12 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Damage', result }
    });
    // Should show (1 | 3) format with strikethrough on original
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('3');
    expect(container.textContent).toContain('6');
    const dropped = container.querySelector('.dice-toast__dropped');
    expect(dropped).toBeTruthy();
    expect(dropped?.textContent).toContain('1');
  });

  it('renders GWF floor format without bonus', () => {
    const result: RollResult = { total: 3, natural: 3, gwfFloor: 2, sides: 12 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Damage', result }
    });
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('3');
    const dropped = container.querySelector('.dice-toast__dropped');
    expect(dropped).toBeTruthy();
    expect(dropped?.textContent).toContain('2');
  });

  it('does not render GWF format when gwfFloor is undefined', () => {
    const result: RollResult = { total: 10, natural: 7, bonus: 3, sides: 12 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Damage', result }
    });
    // Normal display — no parenthetical GWF format
    const dropped = container.querySelector('.dice-toast__dropped');
    // dropped only appears for advantage/disadvantage or GWF
    expect(dropped).toBeNull();
  });

  // === Multi-die, no-bonus total (e.g. 2d8 healing) ===

  it('shows the total for a multi-die roll with no bonus', () => {
    const result: RollResult = { total: 8, natural: 8, sides: 8, rolls: [5, 3], count: 2 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Prayer of Healing', rollType: 'Roll', result }
    });
    // Shows each die, an equals, and the total
    expect(container.textContent).toContain('5 + 3');
    expect(container.textContent).toContain('=');
    const total = container.querySelector('.dice-toast__total');
    expect(total).toBeTruthy();
    expect(total?.textContent).toContain('8');
  });

  it('does not add an equals/total for a single-die roll with no bonus', () => {
    const result: RollResult = { total: 6, natural: 6, sides: 8 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Heal', rollType: 'Roll', result }
    });
    expect(container.textContent).toContain('6');
    expect(container.querySelector('.dice-toast__total')).toBeNull();
    expect(container.textContent).not.toContain('=');
  });

  // === Unit (e.g. HP for healing) ===

  it('renders the unit after the total when unitKey is provided', () => {
    const result: RollResult = { total: 8, natural: 8, sides: 8, rolls: [5, 3], count: 2 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Prayer of Healing', rollType: 'Roll', result, unitKey: 'hp' }
    });
    // i18n mock returns the key
    expect(container.textContent).toContain('play.toast.unit.hp');
    expect(container.querySelector('.dice-toast__unit')).toBeTruthy();
  });

  it('does not render the unit when no unitKey', () => {
    const result: RollResult = { total: 8, natural: 8, sides: 8, rolls: [5, 3], count: 2 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Prayer of Healing', rollType: 'Roll', result }
    });
    expect(container.querySelector('.dice-toast__unit')).toBeNull();
  });

  it('prefers the damage type over a unit when both are present', () => {
    const result: RollResult = { total: 11, natural: 8, bonus: 3, sides: 12 };
    const { container } = render(DiceRollToast, {
      props: {
        title: 'Greataxe',
        rollType: 'Damage',
        result,
        damageTypeKey: 'slashing',
        unitKey: 'hp'
      }
    });
    expect(container.querySelector('.dice-toast__damage-icon')).toBeTruthy();
    expect(container.querySelector('.dice-toast__unit')).toBeNull();
  });

  // === Critical damage ===

  it('renders a critical tag when result.critical', () => {
    const result: RollResult = {
      total: 17,
      natural: 14,
      bonus: 3,
      sides: 12,
      rolls: [7, 7],
      count: 2,
      critical: true
    };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Damage', result, damageTypeKey: 'slashing' }
    });
    const crit = container.querySelector('.dice-toast__crit');
    expect(crit).toBeTruthy();
    // The tag shows the crit symbol (via i18n); its accessible name carries the word.
    expect(crit?.getAttribute('aria-label')).toContain('play.choices.attack.critical');
    expect(crit?.textContent).toContain('play.choices.attack.criticalSymbol');
  });

  it('does not render a critical tag when result.critical is absent', () => {
    const result: RollResult = { total: 10, natural: 7, bonus: 3, sides: 12 };
    const { container } = render(DiceRollToast, {
      props: { title: 'Greataxe', rollType: 'Damage', result, damageTypeKey: 'slashing' }
    });
    expect(container.querySelector('.dice-toast__crit')).toBeNull();
  });
});
