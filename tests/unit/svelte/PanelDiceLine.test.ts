import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { DiceLineControl } from '$lib/components/play/panel-renderer/types';

// The i18n mock (tests/setup.ts) returns the key itself for unknown keys, so
// menu labels surface as their `play.choices.attack.*` keys — handy for
// asserting that labels are i18n'd rather than hardcoded English.
// Queries use class + data-die-index (not #id) so they stay robust to the
// per-instance unique ids the component generates via nextDiceLineId().
const control: DiceLineControl = {
  type: 'dice-line',
  dice: [
    { sides: 20, bonus: { number: 5 }, purpose: 'to-hit' },
    {
      sides: 8,
      bonus: { number: 3 },
      damageType: { string: 'slashing' },
      purpose: 'damage'
    },
    { sides: 8, bonus: { number: 2 }, unit: 'hp', purpose: 'healing' }
  ]
};

const baseProps = { control, editable: true, facts: {}, vars: {} };

const main = (c: HTMLElement, i: number) =>
  c.querySelector(`.panel-renderer__die-chip--main[data-die-index="${i}"]`);
const trigger = (c: HTMLElement, i: number) =>
  c.querySelector(`.panel-renderer__options-trigger[data-die-index="${i}"]`);
const popover = (c: HTMLElement, i: number) =>
  c.querySelector(`.panel-renderer__popover[data-die-index="${i}"]`);

describe('PanelDiceLine', () => {
  it('renders a split button (main roll + options trigger) for a d20', () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    expect(main(container, 0)).toBeInstanceOf(HTMLButtonElement);
    expect(trigger(container, 0)).toBeInstanceOf(HTMLButtonElement);
    expect(main(container, 0)).not.toBe(trigger(container, 0));
  });

  it('the options trigger announces a menu that controls its popover', () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    expect(trigger(container, 0)?.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger(container, 0)?.getAttribute('aria-controls')).toBe(popover(container, 0)?.id);
    expect(popover(container, 0)).toBeTruthy();
  });

  it('exposes the popover as a menu of menuitems', () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    expect(popover(container, 0)?.getAttribute('role')).toBe('menu');
    expect(popover(container, 0)!.querySelectorAll('[role="menuitem"]').length).toBe(3);
    expect(popover(container, 1)!.querySelectorAll('[role="menuitem"]').length).toBe(2);
  });

  it('exposes the d20 roll-mode options as i18n-keyed buttons', () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    const menu = popover(container, 0)!;
    expect(menu.querySelector('[data-roll-mode="advantage"]')?.textContent).toBe(
      'play.choices.attack.advantage'
    );
    expect(menu.querySelector('[data-roll-mode="normal"]')?.textContent).toBe(
      'play.choices.attack.normal'
    );
    expect(menu.querySelector('[data-roll-mode="disadvantage"]')?.textContent).toBe(
      'play.choices.attack.disadvantage'
    );
  });

  it('exposes normal/critical options for a damage die', () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    const menu = popover(container, 1)!;
    expect(menu.querySelector('[data-crit-mode="normal"]')).toBeTruthy();
    expect(menu.querySelector('[data-crit-mode="critical"]')).toBeTruthy();
  });

  it('rolls normally when the main part is clicked', async () => {
    const onRoll = vi.fn();
    const { container } = render(PanelDiceLine, { props: { ...baseProps, onRoll } });
    await fireEvent.click(main(container, 0)!);
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result, dieIndex] = onRoll.mock.calls[0];
    expect(dieIndex).toBe(0);
    expect(result.mode).toBe('normal');
  });

  it('rolls with advantage when the advantage option is chosen', async () => {
    const onRoll = vi.fn();
    const { container } = render(PanelDiceLine, { props: { ...baseProps, onRoll } });
    await fireEvent.click(popover(container, 0)!.querySelector('[data-roll-mode="advantage"]')!);
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result, dieIndex] = onRoll.mock.calls[0];
    expect(dieIndex).toBe(0);
    expect(result.mode).toBe('advantage');
  });

  it('rolls a critical when the critical option is chosen for a damage die', async () => {
    const onRoll = vi.fn();
    const { container } = render(PanelDiceLine, { props: { ...baseProps, onRoll } });
    await fireEvent.click(popover(container, 1)!.querySelector('[data-crit-mode="critical"]')!);
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result, dieIndex] = onRoll.mock.calls[0];
    expect(dieIndex).toBe(1);
    expect(result.critical).toBe(true);
  });

  it('renders a plain single roll button for a healing die (no options trigger)', () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    expect(trigger(container, 2)).toBeNull();
    expect(popover(container, 2)).toBeNull();
    expect(container.querySelector('[data-die-index="2"]')).toBeInstanceOf(HTMLButtonElement);
  });

  it('renders static spans (no buttons) when not editable', () => {
    const { container } = render(PanelDiceLine, { props: { ...baseProps, editable: false } });
    expect(container.querySelectorAll('button').length).toBe(0);
    expect(container.querySelectorAll('span.panel-renderer__die-chip').length).toBeGreaterThan(0);
  });

  it('reflects open state on the trigger aria-expanded', async () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    const t = trigger(container, 0)!;
    expect(t.getAttribute('aria-expanded')).toBe('false');
    // ArrowDown opens the menu (the keyboard path that sets state in JS; the
    // popovertarget click path is browser-only and can't run in jsdom).
    await fireEvent.keyDown(t, { key: 'ArrowDown' });
    expect(t.getAttribute('aria-expanded')).toBe('true');
  });

  it('dismisses the popover when a nested container scrolls', async () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    const t = trigger(container, 0)!;
    await fireEvent.keyDown(t, { key: 'ArrowDown' });
    expect(t.getAttribute('aria-expanded')).toBe('true');
    // Scroll events don't bubble; the dice line lives inside nested overflow
    // containers, so a capture-phase listener must catch this and dismiss.
    container
      .querySelector('.panel-renderer__dice-line')!
      .dispatchEvent(new Event('scroll', { bubbles: false }));
    await tick();
    expect(t.getAttribute('aria-expanded')).toBe('false');
  });

  const modifiers = [
    { key: 'aura', label: 'rule.demo.aura', appliesTo: 'save' as const, value: 3, defaultOn: true },
    { key: 'ring', label: 'rule.demo.ring', appliesTo: 'save' as const, value: 1, defaultOn: true }
  ];

  const saveControl: DiceLineControl = {
    type: 'dice-line',
    dice: [{ sides: 20, bonus: { number: 5 }, purpose: 'save' }]
  };

  const saveProps = { control: saveControl, editable: true, facts: {}, vars: {}, modifiers };

  const modChip = (c: HTMLElement, key: string) =>
    c.querySelector(`.panel-renderer__modifier[data-modifier-key="${key}"]`);

  it('renders one toggle chip per modifier, on by default', () => {
    const { container } = render(PanelDiceLine, { props: saveProps });
    expect(modChip(container, 'aura')).toBeInstanceOf(HTMLButtonElement);
    expect(modChip(container, 'ring')).toBeInstanceOf(HTMLButtonElement);
    expect(modChip(container, 'aura')?.getAttribute('aria-pressed')).toBe('true');
    expect(modChip(container, 'aura')?.textContent?.trim()).toBe('rule.demo.aura +3');
  });

  it('folds active modifiers into the displayed bonus so the chip shows the real roll', async () => {
    const { container } = render(PanelDiceLine, { props: saveProps });
    // die bonus 5 + aura 3 + ring 1
    expect(main(container, 0)?.textContent?.trim()).toBe('d20+9');
    await fireEvent.click(modChip(container, 'aura')!);
    await tick();
    expect(main(container, 0)?.textContent?.trim()).toBe('d20+6');
  });

  it('clears a stale rolled total when a modifier is toggled', async () => {
    const { container } = render(PanelDiceLine, { props: saveProps });
    await fireEvent.click(main(container, 0)!);
    await tick();
    // A rolled chip shows its total, not the expression.
    expect(main(container, 0)?.textContent?.trim()).not.toContain('d20');
    await fireEvent.click(modChip(container, 'aura')!);
    await tick();
    // The total was computed with the aura on and no longer matches the roll
    // you would now make, so the chip reverts to the (updated) expression.
    expect(main(container, 0)?.textContent?.trim()).toBe('d20+6');
  });

  it('adds every active modifier to the rolled total', async () => {
    const onRoll = vi.fn();
    const { container } = render(PanelDiceLine, { props: { ...saveProps, onRoll } });
    await fireEvent.click(main(container, 0)!);
    const [result] = onRoll.mock.calls[0];
    // d20 natural + die bonus 5 + aura 3 + ring 1
    expect(result.total).toBe(result.natural + 9);
    expect(result.bonus).toBe(5);
    expect(result.modifiers).toEqual([
      { label: 'rule.demo.aura', value: 3 },
      { label: 'rule.demo.ring', value: 1 }
    ]);
  });

  it('drops a modifier from the total when its chip is toggled off', async () => {
    const onRoll = vi.fn();
    const { container } = render(PanelDiceLine, { props: { ...saveProps, onRoll } });
    await fireEvent.click(modChip(container, 'aura')!);
    await tick();
    expect(modChip(container, 'aura')?.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(main(container, 0)!);
    const [result] = onRoll.mock.calls[0];
    expect(result.total).toBe(result.natural + 6);
    expect(result.modifiers).toEqual([{ label: 'rule.demo.ring', value: 1 }]);
  });

  it('only applies a modifier to the die whose purpose it targets', async () => {
    const onRoll = vi.fn();
    const mixed: DiceLineControl = {
      type: 'dice-line',
      dice: [
        { sides: 20, bonus: { number: 5 }, purpose: 'to-hit' },
        { sides: 8, bonus: { number: 3 }, damageType: { string: 'slashing' }, purpose: 'damage' }
      ]
    };
    const { container } = render(PanelDiceLine, {
      props: { control: mixed, editable: true, facts: {}, vars: {}, modifiers, onRoll }
    });
    // Neither die has purpose 'save', so no chip applies and no chip renders.
    expect(modChip(container, 'aura')).toBeNull();
    await fireEvent.click(main(container, 0)!);
    const [result] = onRoll.mock.calls[0];
    expect(result.total).toBe(result.natural + 5);
    expect(result.modifiers).toBeUndefined();
  });

  it('renders static spans (not buttons) for modifiers when not editable', () => {
    const { container } = render(PanelDiceLine, { props: { ...saveProps, editable: false } });
    expect(modChip(container, 'aura')).toBeInstanceOf(HTMLSpanElement);
  });

  it('does not leak a modifier onto a sibling die of a different purpose on the same line', async () => {
    const onRoll = vi.fn();
    const mixed: DiceLineControl = {
      type: 'dice-line',
      dice: [
        { sides: 20, bonus: { number: 5 }, purpose: 'save' },
        { sides: 8, bonus: { number: 3 }, damageType: { string: 'slashing' }, purpose: 'damage' }
      ]
    };
    const { container } = render(PanelDiceLine, {
      props: { control: mixed, editable: true, facts: {}, vars: {}, modifiers, onRoll }
    });
    // The save die on this line matches, so both chips render once (not once per die).
    expect(modChip(container, 'aura')).toBeInstanceOf(HTMLButtonElement);
    expect(modChip(container, 'ring')).toBeInstanceOf(HTMLButtonElement);

    await fireEvent.click(main(container, 0)!);
    const [saveResult] = onRoll.mock.calls[0];
    expect(saveResult.total).toBe(saveResult.natural + 9);
    expect(saveResult.modifiers).toEqual([
      { label: 'rule.demo.aura', value: 3 },
      { label: 'rule.demo.ring', value: 1 }
    ]);

    onRoll.mockClear();
    await fireEvent.click(main(container, 1)!);
    const [damageResult] = onRoll.mock.calls[0];
    expect(damageResult.total).toBe(damageResult.natural + 3);
    expect(damageResult.modifiers).toBeUndefined();
  });
});
