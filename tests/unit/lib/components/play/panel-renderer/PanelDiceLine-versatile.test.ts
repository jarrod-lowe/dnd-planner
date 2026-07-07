import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { AvailableRuleEntry, Rule, VarDefinition } from '$lib/rules-view';
import type { DiceLineControl } from '$lib/components/play/panel-renderer/types';

const createVersatileSpearEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'spear-use-action',
    description: 'Spear',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.dnd-5e-2024.attacks.spear.name',
      annotationLabels: [
        'attack.any',
        'attack.melee',
        'attack.weapon',
        'dice.any',
        'property.versatile'
      ],
      primaryControl: {
        type: 'dice-line',
        ranges: { var: 'ranges' },
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' } },
          {
            sides: { var: 'damageDie' },
            bonus: { var: 'damageBonus' },
            damageType: { string: 'piercing' }
          }
        ]
      }
    },
    vars: {
      ranges: {
        default: {
          array: [
            { distance: 5, type: 'melee', label: '1H' },
            { distance: 5, type: 'melee', label: '2H', damageDie: 8, extraHands: 1 },
            { distance: 20, type: 'thrown' },
            { distance: 60, type: 'thrown', disadvantage: true }
          ]
        }
      },
      hitBonus: { default: { number: 5 } },
      damageDie: { default: { number: 6 } },
      damageBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - versatile weapon (spear)', () => {
  it('shows range label when present - "5ft 1H" for first range', () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.textContent).toContain('5ft 1H');
  });

  it('cycles to "5ft 2H" when range is tapped once', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Initially shows "5ft 1H"
    expect(container.textContent).toContain('5ft 1H');
    // Tap to cycle
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Now shows "5ft 2H"
    expect(container.textContent).toContain('5ft 2H');
  });

  it('cycles to "20ft" (no label) for thrown range', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    // Cycle twice to reach 20ft thrown
    await fireEvent.click(rangeEl);
    await fireEvent.click(rangeEl);
    expect(container.textContent).toContain('20ft');
    // Should NOT contain "1H" or "2H" label for thrown
    expect(container.textContent).not.toContain('20ft 1H');
    expect(container.textContent).not.toContain('20ft 2H');
  });

  it('cycles to "60ft" with disadvantage indicator for long thrown range', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    // Cycle three times to reach 60ft thrown
    await fireEvent.click(rangeEl);
    await fireEvent.click(rangeEl);
    await fireEvent.click(rangeEl);
    expect(container.textContent).toContain('60ft');
    // Disadvantage indicator should be visible
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeTruthy();
  });

  it('shows d6 damage die for 1H melee range', () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Default range is 1H - damage die should be d6
    expect(container.textContent).toContain('d6');
  });

  it('shows d8 damage die for 2H melee range', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Cycle to 2H range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Damage die should now show d8 (overridden by range entry)
    expect(container.textContent).toContain('d8');
    expect(container.textContent).not.toContain('d6');
  });

  it('shows d6 damage die for thrown range (no override)', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Cycle to thrown range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    await fireEvent.click(rangeEl);
    // Damage die should be d6 (default, no override on thrown entry)
    expect(container.textContent).toContain('d6');
  });

  it('rolls damage die with d8 sides when 2H range is selected', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Cycle to 2H range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Mock: floor(0.5 * 8) + 1 = 5, plus bonus 3 = 8
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // 5 + 3 = 8
    expect(container.textContent).toContain('8');
  });

  it('rolls damage die with d6 sides when 1H range is selected', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Already on 1H range by default
    // Mock: floor(0.5 * 6) + 1 = 4, plus bonus 3 = 7
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // 4 + 3 = 7
    expect(container.textContent).toContain('7');
  });

  it('cycles back to 1H after going through all 4 ranges', async () => {
    const entry = createVersatileSpearEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    // Cycle through all 4 ranges: 1H -> 2H -> 20ft -> 60ft -> 1H
    await fireEvent.click(rangeEl); // -> 2H
    await fireEvent.click(rangeEl); // -> 20ft
    await fireEvent.click(rangeEl); // -> 60ft
    await fireEvent.click(rangeEl); // -> back to 1H
    expect(container.textContent).toContain('5ft 1H');
    // Damage die should be d6 again
    expect(container.textContent).toContain('d6');
  });

  // === Range selection feedback ===

  it('calls onSelectionChange with extraHands when cycling to 2H range', async () => {
    const entry = createVersatileSpearEntry();
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    // Cycle to 2H range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Should call onSelectionChange with extraHands: 1 (from 2H range entry)
    expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ extraHands: 1 }));
  });

  it('calls onSelectionChange with extraHands 0 when cycling to 1H range', async () => {
    const entry = createVersatileSpearEntry();
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    // Start on 1H - no selection change yet (initial state)
    // Cycle through all to get back to 1H
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl); // -> 2H
    onSelectionChange.mockClear();
    await fireEvent.click(rangeEl); // -> 20ft thrown
    expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ extraHands: 0 }));
  });

  it('initializes rangeIndex from selections', () => {
    const entry = createVersatileSpearEntry();
    // Pre-select rangeIndex 1 (2H range)
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        facts: {},
        selections: { rangeIndex: 1 }
      }
    });
    // Should show "5ft 2H" (range index 1)
    expect(container.textContent).toContain('5ft 2H');
    // Damage die should be d8 (2H override)
    expect(container.textContent).toContain('d8');
  });

  // === GWF gating on versatile range selection ===
  // Gating is done in PanelRenderer (effectiveGwfActive), which passes
  // the correct gwfActive value to PanelDiceLine. These tests verify
  // PanelDiceLine correctly applies/suppresses the GWF floor based on
  // the gwfActive prop it receives.

  it('does NOT apply GWF floor when gwfActive is false (1H range)', async () => {
    const entry = createVersatileSpearEntry();
    const control = entry.rule.ui!.primaryControl as DiceLineControl;
    const vars = entry.rule.vars as Record<string, VarDefinition>;
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars, gwfActive: false }
    });
    // Default range is 1H — PanelRenderer sets gwfActive=false for 1H
    vi.spyOn(Math, 'random').mockReturnValue(0); // floor(0 * 6) + 1 = 1
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // Without GWF floor: 1 + 3 = 4
    expect(container.textContent).toContain('4');
    expect(container.textContent).not.toContain('6');
  });

  it('applies GWF floor when gwfActive is true (2H range)', async () => {
    const entry = createVersatileSpearEntry();
    const control = entry.rule.ui!.primaryControl as DiceLineControl;
    const vars = entry.rule.vars as Record<string, VarDefinition>;
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars, gwfActive: true }
    });
    // Cycle to 2H range — PanelRenderer sets gwfActive=true for 2H
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Damage die is d8 in 2H mode, roll a 1 — GWF SHOULD floor it to 3
    vi.spyOn(Math, 'random').mockReturnValue(0); // floor(0 * 8) + 1 = 1
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // With GWF floor: 3 + 3 = 6
    expect(container.textContent).toContain('6');
  });

  it('does NOT apply GWF floor when gwfActive is false (thrown range)', async () => {
    const entry = createVersatileSpearEntry();
    const control = entry.rule.ui!.primaryControl as DiceLineControl;
    const vars = entry.rule.vars as Record<string, VarDefinition>;
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars, gwfActive: false }
    });
    // Cycle to thrown range (20ft) — PanelRenderer sets gwfActive=false for thrown
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl); // -> 2H
    await fireEvent.click(rangeEl); // -> 20ft thrown
    vi.spyOn(Math, 'random').mockReturnValue(0); // floor(0 * 6) + 1 = 1
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // Click damage die
    // Without GWF floor: 1 + 3 = 4
    expect(container.textContent).toContain('4');
    expect(container.textContent).not.toContain('6');
  });
});
