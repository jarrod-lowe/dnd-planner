import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

// Mirrors the control authored on `record-short-rest` (core-events.ts):
// pools per die size resolved from `hitDie.*` facts, CON bonus, hp unit.
const createHitDiceEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'record-short-rest',
    description: 'Short Rest',
    activities: [],
    ui: {
      section: 'rest',
      name: 'planner.record.rest.short',
      primaryControl: {
        type: 'hit-dice',
        unit: 'hp',
        bonus: { fact: 'con.modifier' },
        pools: [6, 8, 10, 12].map((sides) => ({
          sides,
          total: { fact: `hitDie.d${sides}.total` },
          remaining: { fact: `hitDie.d${sides}.remaining` }
        }))
      }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

const baseFacts = (): Record<string, number> => ({
  'con.modifier': 2,
  'hitDie.d6.total': 0,
  'hitDie.d6.remaining': 0,
  'hitDie.d8.total': 2,
  'hitDie.d8.remaining': 2,
  'hitDie.d10.total': 3,
  'hitDie.d10.remaining': 1,
  'hitDie.d12.total': 0,
  'hitDie.d12.remaining': 0
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PanelRenderer - hit-dice control', () => {
  it('renders one roller per slot and skips pools with no dice', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts() }
    });
    // d8 pool (2 slots) + d10 pool (3 slots); d6/d12 pools resolve total 0.
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    expect(chips.length).toBe(5);
    expect(container.textContent).not.toContain('d6');
    expect(container.textContent).not.toContain('d12');
  });

  it('disables spent slots but keeps them visible', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts() }
    });
    // DOM order: d8 slots 0-1, then d10 slots 0-2. d10 remaining is 1, so
    // d10 slots 1 and 2 (index >= remaining) are spent.
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    expect(chips[3].disabled).toBe(true);
    expect(chips[4].disabled).toBe(true);
    expect(chips[0].disabled).toBe(false);
    expect(chips[2].disabled).toBe(false);
  });

  it('emits the natural roll via onSelectionChange keyed by size and slot', async () => {
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // floor(0.5*10)+1 = 6
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), onSelectionChange }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    await fireEvent.click(chips[2]); // d10 slot 0
    expect(onSelectionChange).toHaveBeenCalledWith({
      rolls: { d10: { '0': 6 } }
    });
  });

  it('re-rolling a slot replaces its value instead of accumulating', async () => {
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.2); // floor(0.2*10)+1 = 3
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        facts: baseFacts(),
        selections: { rolls: { d10: { '0': 6 } } },
        onSelectionChange
      }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    await fireEvent.click(chips[2]); // d10 slot 0 again
    const calls = onSelectionChange.mock.calls;
    expect(calls[calls.length - 1][0]).toEqual({
      rolls: { d10: { '0': 3 } }
    });
  });

  it('keeps rolls when the dice signature changes (spent boundary moves)', async () => {
    const entry = createHitDiceEntry();
    const facts = baseFacts();
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts, selections }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chip.textContent?.trim()).toBe('8'); // 6 + CON 2
    // The pending row re-evaluates as other plan items commit: the d10 pool's
    // spent boundary moves (1 remaining -> 0). The rolled slot 0 keeps its roll.
    await rerender({
      entry,
      editable: true,
      facts: { ...facts, 'hitDie.d10.remaining': 0 },
      selections
    });
    const chipAfter = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chipAfter.textContent?.trim()).toBe('8');
  });

  it('fires onRoll with natural, CON bonus, and the floored heal', async () => {
    const entry = createHitDiceEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d10 -> 6
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    await fireEvent.click(chips[2]);
    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result, slotIndex] = onRoll.mock.calls[0];
    expect(result.natural).toBe(6);
    expect(result.bonus).toBe(2);
    expect(result.total).toBe(8);
    expect(result.sides).toBe(10);
    expect(result.unit).toBe('hp');
    expect(result.purpose).toBe('healing');
    expect(slotIndex).toBe(0);
  });

  it('floors the heal at 1 HP when the roll plus CON is lower', async () => {
    const entry = createHitDiceEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0); // d10 -> 1
    const facts = { ...baseFacts(), 'con.modifier': -2 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    await fireEvent.click(chips[2]);
    const [result] = onRoll.mock.calls[0];
    expect(result.natural).toBe(1);
    expect(result.total).toBe(1);
  });

  it('does not roll spent slots or fire callbacks when read-only', async () => {
    const entry = createHitDiceEntry();
    const onSelectionChange = vi.fn();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: baseFacts(), onSelectionChange, onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    expect(chips.length).toBe(5);
    for (const chip of chips) {
      expect(chip.tagName).toBe('SPAN');
    }
    // Spans have no click handlers; nothing should fire.
    await fireEvent.click(chips[2]);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onRoll).not.toHaveBeenCalled();
  });

  it('labels each roller with size and slot, and spent rollers as spent', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts() }
    });
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    expect(chips[2].getAttribute('aria-label')).toBe('d10 hit die 1 of 3');
    expect(chips[3].getAttribute('aria-label')).toBe('d10 hit die 2 of 3 (spent)');
    const pool = container.querySelector('.panel-renderer__hit-dice-pool[data-die-sides="10"]');
    expect(pool?.getAttribute('aria-label')).toBe('d10 hit dice, 1 of 3 unspent');
  });

  it('announces a rolled slot with its roll and heal', async () => {
    const entry = createHitDiceEntry();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // d10 -> 6, heal 8
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), selections }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chip.getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 6, heals 8 hp');
  });

  it('announces the roll of a slot the spent boundary has moved past', () => {
    const entry = createHitDiceEntry();
    // d10 remaining 0: every slot is spent, but slot 0 still carries a roll
    // from before the boundary moved — its label must keep announcing the roll.
    const facts = { ...baseFacts(), 'hitDie.d10.remaining': 0 };
    const selections = { rolls: { d10: { '0': 6 } } };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, selections }
    });
    const chips = container.querySelectorAll<HTMLButtonElement>(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    );
    expect(chips[2].disabled).toBe(true);
    expect(chips[2].getAttribute('aria-label')).toBe('d10 hit die 1 of 3, rolled 6, heals 8 hp');
    // An unrolled spent slot still announces only its spent state.
    expect(chips[3].getAttribute('aria-label')).toBe('d10 hit die 2 of 3 (spent)');
  });

  it('renders nothing when every pool is empty', () => {
    const entry = createHitDiceEntry();
    const facts: Record<string, number> = { 'con.modifier': 2 };
    for (const sides of [6, 8, 10, 12]) {
      facts[`hitDie.d${sides}.total`] = 0;
      facts[`hitDie.d${sides}.remaining`] = 0;
    }
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    expect(container.querySelector('.panel-renderer__hit-dice')).toBeNull();
    expect(container.textContent).not.toContain('Each die');
  });

  it('shows the CON modifier on the chip like any other dice line', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts() }
    });
    // No bespoke bonus line — the modifier rides the chip expression itself,
    // exactly as a dice-line's "d20+3" chip does.
    expect(container.querySelector('.panel-renderer__hit-dice-bonus')).toBeNull();
    const chips = container.querySelectorAll('.panel-renderer__hit-dice .panel-renderer__die-chip');
    expect(chips[0].textContent?.trim()).toBe('d8+2');
    expect(chips[2].textContent?.trim()).toBe('d10+2');
  });

  it('shows the natural roll plus the modifier on a rolled chip, without the heal floor', () => {
    const entry = createHitDiceEntry();
    // CON -2 and a natural 1: the 1-HP floor is engine-side (it shows in the
    // structural HP preview and the toast), so the chip itself reads 1 - 2 = -1,
    // the same natural-plus-modifier total any other dice line would show.
    const facts = { ...baseFacts(), 'con.modifier': -2 };
    const selections = { rolls: { d10: { '0': 1 } } };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, selections }
    });
    const chip = container.querySelectorAll(
      '.panel-renderer__hit-dice .panel-renderer__die-chip'
    )[2];
    expect(chip.textContent?.trim()).toBe('-1');
  });
});
