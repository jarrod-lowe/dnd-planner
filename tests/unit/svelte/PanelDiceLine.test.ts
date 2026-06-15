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

  it('the options trigger has aria-haspopup and a sibling popover', () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    expect(trigger(container, 0)?.getAttribute('aria-haspopup')).toBe('true');
    expect(trigger(container, 0)?.getAttribute('aria-controls')).toBe(popover(container, 0)?.id);
    expect(popover(container, 0)).toBeTruthy();
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
    await fireEvent.click(t);
    expect(t.getAttribute('aria-expanded')).toBe('true');
  });

  it('dismisses the popover when a nested container scrolls', async () => {
    const { container } = render(PanelDiceLine, { props: baseProps });
    const t = trigger(container, 0)!;
    await fireEvent.click(t);
    expect(t.getAttribute('aria-expanded')).toBe('true');
    // Scroll events don't bubble; the dice line lives inside nested overflow
    // containers, so a capture-phase listener must catch this and dismiss.
    container
      .querySelector('.panel-renderer__dice-line')!
      .dispatchEvent(new Event('scroll', { bubbles: false }));
    await tick();
    expect(t.getAttribute('aria-expanded')).toBe('false');
  });
});
