import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { DiceLineControl, DiceLineToggle } from '$lib/components/play/panel-renderer/types';
import type { EffectInstance } from '$lib/rules-engine';

/**
 * The Frightened LoS chip (v2 — the walkthrough's "Reading 2: persistent global
 * toggle, chip-styled, immediate"): the persistent state chip a dice-line
 * renders AFTER its dice when its disadvantage source is one of the toggle's
 * governed facts. The Aura-of-Protection modifier chip is the look (same
 * classes, aria-pressed, filled when on); the DIFFERENCE is the state model —
 * the modifier's toggle is ephemeral panel state, this one's ON derives from
 * the committed facts and its tap commits an effect through the callback
 * (PanelRenderer wires it to the store's follow-up channel). The chip STAYS
 * while hidden (label flips) so the player can flip back — presence keys on
 * the fact NAME the line reads, never its value.
 */
const CF = 'rule.dnd-5e-2024.condition-frightened';

const hideEffect = (): EffectInstance => ({
  id: 'frightened-source-hidden',
  key: 'frightened-source',
  state: { 'frightened.sourceHidden': 1 },
  expiry: { kind: 'untilShortRest' }
});

const revealEffect = (): EffectInstance => ({
  id: 'frightened-source-visible',
  key: 'frightened-source',
  expiry: { kind: 'untilShortRest' }
});

/** A toggle resolved IN SIGHT (on): filled, "in sight" label, tap commits the hide. */
const inSightToggle = (): DiceLineToggle => ({
  key: `${CF}.notice`,
  governs: ['attack.str.disadvantage', 'check.disadvantage'],
  on: true,
  labelKey: `${CF}.fear-source-in-sight`,
  effect: hideEffect()
});

/** The same toggle resolved HIDDEN (off): outline, "out of sight" label, tap reveals. */
const outOfSightToggle = (): DiceLineToggle => ({
  key: `${CF}.notice`,
  governs: ['attack.str.disadvantage', 'check.disadvantage'],
  on: false,
  labelKey: `${CF}.fear-source-out-of-sight`,
  effect: revealEffect()
});

/** A d20 to-hit line reading a governed disadvantage fact (the greataxe shape). */
const governedControl = (): DiceLineControl => ({
  type: 'dice-line',
  dice: [{ sides: 20, bonus: { number: 5 }, purpose: 'to-hit' }],
  advantage: { fact: 'attack.str.disadvantage' }
});

/** A line whose disadvantage source is NOT governed (Prone's melee-only fact). */
const ungovernedControl = (): DiceLineControl => ({
  type: 'dice-line',
  dice: [{ sides: 20, bonus: { number: 5 }, purpose: 'to-hit' }],
  advantage: { fact: 'attack.melee.disadvantage' }
});

function chip(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('button.panel-renderer__toggle');
}

function chipSpan(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('span.panel-renderer__toggle');
}

describe('PanelDiceLine — the persistent state toggle chip', () => {
  it('renders the chip after the dice of a line reading a governed disadvantage fact', () => {
    const { container } = render(PanelDiceLine, {
      props: {
        control: governedControl(),
        editable: true,
        facts: {},
        vars: {},
        toggles: [inSightToggle()],
        onToggle: () => {}
      }
    });

    const line = container.querySelector<HTMLElement>('.panel-renderer__dice-line')!;
    expect(line).not.toBeNull();
    const toggle = chip(container);
    expect(toggle, 'the chip is a button in the Aura modifier shape').not.toBeNull();
    expect(toggle!.classList.contains('panel-renderer__modifier')).toBe(true);
    // After the dice: the chip follows the line's die chips, not the label.
    const dieChip = line.querySelector('.panel-renderer__die-chip');
    expect(dieChip).not.toBeNull();
    expect(
      dieChip!.compareDocumentPosition(toggle!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('no chip on a line whose disadvantage source is not governed', () => {
    const { container } = render(PanelDiceLine, {
      props: {
        control: ungovernedControl(),
        editable: true,
        facts: {},
        vars: {},
        toggles: [inSightToggle()],
        onToggle: () => {}
      }
    });
    expect(chip(container)).toBeNull();
    expect(chipSpan(container)).toBeNull();
  });

  it('no chip on a line with no disadvantage source at all', () => {
    const control: DiceLineControl = {
      type: 'dice-line',
      dice: [{ sides: 6, bonus: { number: 2 }, purpose: 'damage' }]
    };
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars: {}, toggles: [inSightToggle()] }
    });
    expect(chip(container)).toBeNull();
  });

  it('in sight: aria-pressed true, filled look, "in sight" label; tap commits the hide', async () => {
    const onToggle = vi.fn();
    const { container } = render(PanelDiceLine, {
      props: {
        control: governedControl(),
        editable: true,
        facts: {},
        vars: {},
        toggles: [inSightToggle()],
        onToggle
      }
    });

    const toggle = chip(container)!;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.classList.contains('panel-renderer__modifier--on')).toBe(true);
    expect(toggle.getAttribute('data-toggle-key')).toBe(`${CF}.notice`);
    expect(toggle.textContent).toContain(`${CF}.fear-source-in-sight`);

    await fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(hideEffect());
  });

  it('hidden: the chip STAYS — aria-pressed false, outline, "out of sight" label; tap reveals', async () => {
    const onToggle = vi.fn();
    const { container } = render(PanelDiceLine, {
      props: {
        control: governedControl(),
        editable: true,
        facts: {},
        vars: {},
        toggles: [outOfSightToggle()],
        onToggle
      }
    });

    const toggle = chip(container)!;
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.classList.contains('panel-renderer__modifier--on')).toBe(false);
    expect(toggle.textContent).toContain(`${CF}.fear-source-out-of-sight`);

    await fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledWith(revealEffect());
  });

  it('not editable: the chip stays as a plain span (state stays readable, nothing commits)', () => {
    const onToggle = vi.fn();
    const { container } = render(PanelDiceLine, {
      props: {
        control: governedControl(),
        editable: false,
        facts: {},
        vars: {},
        toggles: [inSightToggle()],
        onToggle
      }
    });

    const span = chipSpan(container)!;
    expect(span).not.toBeNull();
    expect(chip(container)).toBeNull();
    expect(span.classList.contains('panel-renderer__modifier--on')).toBe(true);
    expect(span.textContent).toContain(`${CF}.fear-source-in-sight`);
  });

  it('summary: a display-only chip — no focusable element on the collapsed line', () => {
    const { container } = render(PanelDiceLine, {
      props: {
        control: governedControl(),
        editable: true,
        facts: {},
        vars: {},
        toggles: [inSightToggle()],
        onToggle: () => {},
        summary: true
      }
    });

    // The no-focusable-in-summary rule: the chip renders (the state is worth
    // reading collapsed) but as a span, never a button.
    const span = chipSpan(container)!;
    expect(span).not.toBeNull();
    expect(chip(container)).toBeNull();
    expect(container.querySelectorAll('button').length).toBe(0);
    expect(span.textContent).toContain(`${CF}.fear-source-in-sight`);
  });

  it('no toggles prop (the pre-v2 mount shape): renders exactly as it always did', () => {
    const { container } = render(PanelDiceLine, {
      props: { control: governedControl(), editable: true, facts: {}, vars: {} }
    });
    expect(chip(container)).toBeNull();
    expect(chipSpan(container)).toBeNull();
  });
});
