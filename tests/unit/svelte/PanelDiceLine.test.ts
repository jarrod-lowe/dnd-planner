import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { DiceLineControl, DiceLineToggle } from '$lib/components/play/panel-renderer/types';
import type { EffectInstance } from '$lib/rules-engine';

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

describe('PanelDiceLine — state-toggle chips (the Frightened line-of-sight shape)', () => {
  // The i18n mock surfaces keys verbatim, so the pressed/unpressed labels are
  // asserted as their distinct keys — the a11y contract (aria-pressed + two
  // different accessible names) lives here.
  const onEffect: EffectInstance = {
    id: 'effect-frightened-source-hidden',
    key: 'frightened-source',
    state: { 'frightened.sourceHidden': 1 },
    expiry: { kind: 'untilShortRest' }
  };
  const offEffect: EffectInstance = {
    id: 'effect-frightened-source-visible',
    key: 'frightened-source',
    expiry: { kind: 'untilShortRest' }
  };
  const losToggle = (pressed: boolean): DiceLineToggle => ({
    key: 'rule.demo.los',
    fact: 'frightened.sourceHidden',
    labelOn: 'rule.demo.los.in-sight',
    labelOff: 'rule.demo.los.out-of-sight',
    appliesTo: ['to-hit', 'check'],
    pressed,
    onEffect,
    offEffect
  });
  const toggleChip = (c: HTMLElement) =>
    c.querySelector('.panel-renderer__modifier[data-toggle-key="rule.demo.los"]');

  it('renders a pressed button whose label and aria-pressed reflect the resolved state', () => {
    const { container } = render(PanelDiceLine, {
      props: { ...baseProps, toggles: [losToggle(true)], onToggleEffect: vi.fn() }
    });
    const chip = toggleChip(container);
    expect(chip).toBeInstanceOf(HTMLButtonElement);
    expect(chip?.getAttribute('aria-pressed')).toBe('true');
    expect(chip?.textContent?.trim()).toBe('rule.demo.los.in-sight');
  });

  it('the unpressed state swaps BOTH the accessible name and aria-pressed', () => {
    const { container } = render(PanelDiceLine, {
      props: { ...baseProps, toggles: [losToggle(false)], onToggleEffect: vi.fn() }
    });
    const chip = toggleChip(container);
    expect(chip?.getAttribute('aria-pressed')).toBe('false');
    expect(chip?.textContent?.trim()).toBe('rule.demo.los.out-of-sight');
  });

  it('tapping writes the ROW selection and commits the seed effect — both directions', async () => {
    const onToggleEffect = vi.fn();
    const onSelectionChange = vi.fn();
    const pressed = render(PanelDiceLine, {
      props: { ...baseProps, toggles: [losToggle(true)], onToggleEffect, onSelectionChange }
    });
    await fireEvent.click(toggleChip(pressed.container)!);
    expect(onToggleEffect).toHaveBeenCalledTimes(1);
    expect(onToggleEffect).toHaveBeenCalledWith(offEffect);
    // The ROW's own sight value flips (previous rows keep theirs — they hold
    // their own selections; only this row's is written).
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    expect(onSelectionChange).toHaveBeenCalledWith({ 'frightened.sourceHidden': 1 });

    onToggleEffect.mockClear();
    onSelectionChange.mockClear();
    const unpressed = render(PanelDiceLine, {
      props: { ...baseProps, toggles: [losToggle(false)], onToggleEffect, onSelectionChange }
    });
    await fireEvent.click(toggleChip(unpressed.container)!);
    expect(onToggleEffect).toHaveBeenCalledWith(onEffect);
    expect(onSelectionChange).toHaveBeenCalledWith({ 'frightened.sourceHidden': 0 });
  });

  it('a pressed chip FORCES the disadvantage roll-mode (the per-row leg)', async () => {
    // No disadvantage fact, no range flag — the chip alone defaults the d20
    // to 2d20-take-low (Frightened's disadvantage lives per row, here).
    const onRoll = vi.fn();
    const { container } = render(PanelDiceLine, {
      props: { ...baseProps, toggles: [losToggle(true)], onToggleEffect: vi.fn(), onRoll }
    });
    await fireEvent.click(main(container, 0)!);
    expect(onRoll.mock.calls[0][0].mode).toBe('disadvantage');
  });

  it('an unpressed chip forces nothing; a disadvantage FACT still applies beside it', async () => {
    // A control wired like the real attack lines: its disadvantage source is
    // the shared flag fact.
    const flaggedControl: DiceLineControl = {
      type: 'dice-line',
      advantage: { fact: 'attack.str.disadvantage' },
      dice: [{ sides: 20, bonus: { number: 5 }, purpose: 'to-hit' }]
    };

    // Out of sight (unpressed): the roll is normal — no fact, no forcing.
    const normalRoll = vi.fn();
    const normal = render(PanelDiceLine, {
      props: {
        control: flaggedControl,
        editable: true,
        facts: {},
        vars: {},
        toggles: [losToggle(false)],
        onToggleEffect: vi.fn(),
        onRoll: normalRoll
      }
    });
    await fireEvent.click(main(normal.container, 0)!);
    expect(normalRoll.mock.calls[0][0].mode).toBe('normal');

    // Poisoned shape: the shared flag is 1 while THIS row's source is out of
    // sight — the flag's disadvantage stands (source-pure, never subtracted).
    const poisonedRoll = vi.fn();
    const poisoned = render(PanelDiceLine, {
      props: {
        control: flaggedControl,
        editable: true,
        facts: { 'attack.str.disadvantage': 1 },
        vars: {},
        toggles: [losToggle(false)],
        onToggleEffect: vi.fn(),
        onRoll: poisonedRoll
      }
    });
    await fireEvent.click(main(poisoned.container, 0)!);
    expect(poisonedRoll.mock.calls[0][0].mode).toBe('disadvantage');
  });

  it('renders an indication span (never a button) when not editable or no commit handler', () => {
    const onToggleEffect = vi.fn();
    const notEditable = render(PanelDiceLine, {
      props: { ...baseProps, editable: false, toggles: [losToggle(true)], onToggleEffect }
    });
    expect(toggleChip(notEditable.container)).toBeInstanceOf(HTMLSpanElement);

    const noHandler = render(PanelDiceLine, {
      props: { ...baseProps, toggles: [losToggle(true)] }
    });
    expect(toggleChip(noHandler.container)).toBeInstanceOf(HTMLSpanElement);
  });

  it('renders nothing when no die purpose matches (saves never govern the LoS chip)', () => {
    const saveOnly: DiceLineControl = {
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { number: 0 }, purpose: 'save' }]
    };
    const { container } = render(PanelDiceLine, {
      props: {
        control: saveOnly,
        editable: true,
        facts: {},
        vars: {},
        toggles: [losToggle(true)],
        onToggleEffect: vi.fn()
      }
    });
    expect(toggleChip(container)).toBeNull();
  });

  it('clears a stale rolled total when a state toggle flips the roll mode', async () => {
    const { container, rerender } = render(PanelDiceLine, {
      props: { ...baseProps, toggles: [losToggle(true)], onToggleEffect: vi.fn() }
    });
    await fireEvent.click(main(container, 0)!);
    await tick();
    // A rolled chip shows its total, not the expression.
    expect(main(container, 0)?.textContent?.trim()).not.toContain('d20');
    // The sight flips (pressed → unpressed): the displayed result was made
    // under a mode this line no longer defaults to, so it reverts to the
    // expression — same invalidation a modifier toggle gets.
    await rerender({ ...baseProps, toggles: [losToggle(false)], onToggleEffect: vi.fn() });
    await tick();
    expect(main(container, 0)?.textContent?.trim()).toBe('d20+5');
  });

  it('drops the chip in summary mode (nothing focusable in a collapsed row)', () => {
    const { container } = render(PanelDiceLine, {
      props: { ...baseProps, summary: true, toggles: [losToggle(true)], onToggleEffect: vi.fn() }
    });
    expect(toggleChip(container)).toBeNull();
  });
});
