import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

// Mirrors the cast-divine-smite descriptor: a slot-level slider primaryControl
// plus a two-chip secondaryControl dice-line (regular damage + Fiend/Undead).
// Both die counts track slotLevel live via selections:
//   regular:   slotLevel + 1, floored at 2 (free use & L1 = 2d8)
//   fiend:     slotLevel + 2, floored at 3 (one more die than regular)
const createSmiteEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'cast-divine-smite',
    description: 'Divine Smite',
    activities: [],
    ui: {
      section: 'bonus-action-spell',
      name: 'rule.spell-divine-smite.offer-divine-smite.name',
      primaryControl: {
        type: 'slider',
        var: 'slotLevel',
        min: { number: 0 },
        max: { number: 5 },
        valueFormat: 'spellLevel'
      },
      secondaryControl: {
        type: 'dice-line',
        dice: [
          {
            sides: 8,
            count: { var: 'slotLevel', offset: 1, min: 2 },
            damageType: { string: 'radiant' }
          },
          {
            sides: 8,
            count: { var: 'slotLevel', offset: 2, min: 3 },
            label: 'rule.spell-divine-smite.offer-divine-smite.fiendUndeadLabel',
            damageType: { string: 'radiant' }
          }
        ]
      }
    },
    vars: {
      slotLevel: { capture: true, default: { number: 1 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - Divine Smite dice-line', () => {
  it('renders two dice chips with only the Fiend/Undead chip labelled', () => {
    const entry = createSmiteEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { slotLevel: 2 } }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    expect(chips).toHaveLength(2);
    // Only the second chip (Fiend/Undead) carries a label; the default chip is
    // unlabeled to avoid clutter.
    const labels = container.querySelectorAll('.panel-renderer__die-label');
    expect(labels).toHaveLength(1);
    expect(labels[0].textContent).toContain('fiendUndeadLabel');
  });

  it.each([
    { slot: 0, regular: '2d8', fiend: '3d8' }, // free use == L1
    { slot: 1, regular: '2d8', fiend: '3d8' },
    { slot: 2, regular: '3d8', fiend: '4d8' },
    { slot: 3, regular: '4d8', fiend: '5d8' },
    { slot: 5, regular: '6d8', fiend: '7d8' } // cap
  ])('shows $regular / $fiend at slotLevel $slot', ({ slot, regular, fiend }) => {
    const entry = createSmiteEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {}, selections: { slotLevel: slot } }
    });
    expect(container.textContent).toContain(regular);
    expect(container.textContent).toContain(fiend);
  });

  it('renders non-clickable expression chips when not editable', () => {
    const entry = createSmiteEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {}, selections: { slotLevel: 2 } }
    });
    expect(container.querySelectorAll('button.panel-renderer__die-chip')).toHaveLength(0);
    expect(container.querySelectorAll('span.panel-renderer__die-chip')).toHaveLength(2);
  });

  it('rolls Fiend/Undead with exactly one more die than regular', async () => {
    // Math.random() = 0.5 => each d8 = floor(0.5*8)+1 = 5.
    // At L3: regular = 4 dice => 20, Fiend/Undead = 5 dice => 25.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const entry = createSmiteEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { slotLevel: 3 } }
    });
    const chips = container.querySelectorAll('button.panel-renderer__die-chip');
    expect(chips).toHaveLength(2);

    await fireEvent.click(chips[0]);
    expect(chips[0].textContent).toBe('20');

    await fireEvent.click(chips[1]);
    expect(chips[1].textContent).toBe('25');

    vi.restoreAllMocks();
  });

  it('clears a stale roll when the slot level changes', async () => {
    // Roll at L1 (2d8), then move the slider to L5 (6d8): the stale L1 total
    // must be invalidated so the chip shows the current expression again.
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // each d8 = 5; 2 dice => 10
    const entry = createSmiteEntry();
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { slotLevel: 1 } }
    });
    const chips = container.querySelectorAll('button.panel-renderer__die-chip');
    await fireEvent.click(chips[0]);
    expect(chips[0].textContent).toBe('10');

    await rerender({
      entry: createSmiteEntry(),
      editable: true,
      facts: {},
      selections: { slotLevel: 5 }
    });
    const chipsAfter = container.querySelectorAll('button.panel-renderer__die-chip');
    expect(chipsAfter[0].textContent).toBe('6d8'); // expression, not stale "10"
    vi.restoreAllMocks();
  });

  it('includes the Fiend/Undead label in its chip button accessible name', () => {
    const entry = createSmiteEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { slotLevel: 2 } }
    });
    const chips = container.querySelectorAll('button.panel-renderer__die-chip');
    // Default chip: no label -> no aria-label override (name is its dice text).
    expect(chips[0].getAttribute('aria-label')).toBeFalsy();
    // Fiend/Undead chip: label is composed into the accessible name.
    expect(chips[1].getAttribute('aria-label')).toContain('fiendUndeadLabel');
  });
});
