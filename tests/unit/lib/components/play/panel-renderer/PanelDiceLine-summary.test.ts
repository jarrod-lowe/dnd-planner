import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { DiceLineControl } from '$lib/components/play/panel-renderer/types';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

// No button, input, anchor-with-href, or explicit tabindex may appear inside a
// collapsed summary row — this is the "nothing focusable" contract.
const focusableCount = (container: HTMLElement) =>
  container.querySelectorAll('button, input, a[href], [tabindex]').length;

// d20 to-hit (+5) | d12+3 slashing damage. Damage chip is index 1.
const createAttackEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe',
    description: 'Greataxe',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        ranges: { var: 'ranges' },
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
          {
            sides: { var: 'damageDie' },
            bonus: { var: 'damageBonus' },
            damageType: { string: 'slashing' },
            purpose: 'damage'
          }
        ]
      }
    },
    vars: {
      ranges: { default: { array: [{ distance: 5, type: 'melee' }] } },
      hitBonus: { default: { number: 5 } },
      damageDie: { default: { number: 12 } },
      damageBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// A simple d20+3 line — no ranges/modifiers, matching PanelDiceLine.test.ts.
const createDiceLineEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'roll-initiative',
    description: 'Initiative',
    activities: [],
    ui: {
      section: 'free',
      name: 'rule.dnd-5e-2024.initiative.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'initiativeBonus' } }]
      }
    },
    vars: {
      initiativeBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// A fixed inline label (not a `ranges` array) — e.g. a reach note authored
// directly on the control. Rendered "like range text" per the DiceLineControl
// doc comment.
const createFixedLabelEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'reach-attack',
    description: 'Reach Attack',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.attacks.reach.name',
      primaryControl: {
        type: 'dice-line',
        label: 'rule.attacks.reach.range',
        dice: [{ sides: 20, bonus: { number: 5 } }]
      }
    },
    vars: {}
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// A d20 die that (unnaturally) carries a damageType, so the test exercises the
// `!dieIsD20` guard itself rather than relying on a to-hit die simply having
// no damage type to format.
const createD20WithDamageTypeEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'weird-d20-damage',
    description: 'Weird D20 Damage',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.attacks.weird.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { number: 5 }, damageType: { string: 'fire' } }]
      }
    },
    vars: {}
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// A to-hit die whose range starts at disadvantage, so a plain roll (default
// roll mode) lands as a disadvantage result without needing to cycle ranges.
const createDisadvantageEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'sneak-attack',
    description: 'Sneak Attack',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.attacks.sneak.name',
      primaryControl: {
        type: 'dice-line',
        ranges: { var: 'ranges' },
        dice: [{ sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' }]
      }
    },
    vars: {
      ranges: { default: { array: [{ distance: 60, type: 'ranged', disadvantage: true }] } },
      hitBonus: { default: { number: 5 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelDiceLine - summary short form', () => {
  it('shows the unrolled expression', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.textContent).toContain('d20');
    expect(container.textContent).toContain('+3');
  });

  it('shows the rolled value once a die has been rolled', async () => {
    const entry = createDiceLineEntry(); // d20+3
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // floor(0.8*20)+1 = 17, +3 = 20
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: false }
    });
    const chip = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    await fireEvent.click(chip);

    await rerender({ entry, editable: true, facts: {}, summary: true });

    expect(container.textContent).toContain('20');
    expect(container.textContent).not.toContain('d20');
  });

  it('mixes rolled and unrolled dice on a partially-rolled line', async () => {
    const entry = createAttackEntry(); // d20+5 to-hit | d12+3 damage
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // to-hit: floor(0.8*20)+1=17, +5=22
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: false }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[0]); // roll only the to-hit die

    await rerender({ entry, editable: true, facts: {}, summary: true });

    const text = container.textContent ?? '';
    expect(text).toContain('22'); // rolled to-hit
    expect(text).toContain('d12'); // still-unrolled damage expression
    expect(text).toContain('+3');
  });

  it('renders no button and no input in summary mode', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.querySelectorAll('button').length).toBe(0);
    expect(container.querySelectorAll('input').length).toBe(0);
    // The range still shows (as plain text below), but never as a button. No
    // modifier chips, no options triggers.
    expect(container.querySelector('.panel-renderer__modifier')).toBeNull();
    expect(container.querySelector('.panel-renderer__options-trigger')).toBeNull();
  });

  it("shows the damage die's damage-type icon in the short form", () => {
    const entry = createAttackEntry(); // to-hit (no damage type) | d12 slashing damage
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.querySelectorAll('.panel-renderer__damage-type-icon').length).toBe(1);
  });

  it('never shows a damage-type icon on a d20 die, even if one is authored', () => {
    const entry = createD20WithDamageTypeEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.querySelector('.panel-renderer__damage-type-icon')).toBeNull();
  });

  it('shows a ranged weapon range text, non-interactively', () => {
    const entry = createAttackEntry(); // ranges: [{ distance: 5, type: 'melee' }]
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    const range = container.querySelector('.panel-renderer__range');
    expect(range).not.toBeNull();
    expect(range?.tagName).toBe('SPAN');
    expect(range?.textContent).toBe('5ft');
    expect(focusableCount(container)).toBe(0);
  });

  it('shows an authored inline label (control.label) the same non-interactive way', () => {
    const entry = createFixedLabelEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    const label = container.querySelector('.panel-renderer__range');
    expect(label).not.toBeNull();
    expect(label?.tagName).toBe('SPAN');
    expect(label?.textContent).toBe('rule.attacks.reach.range'); // i18n mock echoes the key
    expect(focusableCount(container)).toBe(0);
  });

  it('has nothing focusable anywhere in the summary strip', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(focusableCount(container)).toBe(0);
  });

  it('drops roll modifiers from the summary even when one is active', () => {
    // The die's bonus already folds the active modifier in (formatBonus), so
    // the summary must show the folded total (+8) without a modifier chip.
    const control: DiceLineControl = {
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { number: 5 }, purpose: 'save' }]
    };
    const modifiers = [
      {
        key: 'aura',
        label: 'rule.demo.aura',
        appliesTo: 'save' as const,
        value: 3,
        defaultOn: true
      }
    ];
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars: {}, modifiers, summary: true }
    });
    expect(container.querySelector('.panel-renderer__modifier')).toBeNull();
    expect(focusableCount(container)).toBe(0);
    expect(container.textContent).toContain('d20+8');
  });

  it('carries advantage/disadvantage styling onto the summary chip', async () => {
    const entry = createDisadvantageEntry();
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.4) // disadvantage roll 1: floor(0.4*20)+1 = 9
      .mockReturnValueOnce(0.7); // disadvantage roll 2: floor(0.7*20)+1 = 15 (dropped)
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: false }
    });
    const chip = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    await fireEvent.click(chip);

    await rerender({ entry, editable: true, facts: {}, summary: true });

    const summaryChip = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    expect(summaryChip.classList.contains('panel-renderer__die-chip--disadv')).toBe(true);
    expect(summaryChip.tagName).toBe('SPAN');
  });

  // Codex P2 finding: an UNROLLED d20 under default disadvantage (a range
  // carrying `disadvantage: true`, or `control.advantage` resolving truthy)
  // shows a `▼` indicator in the full render (`defaultRollMode !== 'normal'`)
  // but the summary branch styled chips only from `rollResults`, so the
  // default-disadvantage state vanished for a die nobody had rolled yet. The
  // brief requires the short form to reflect adv/dis "taking it into
  // account" even before a roll.
  it('shows the default-disadvantage indicator on an unrolled d20 in summary', () => {
    const entry = createDisadvantageEntry(); // range: disadvantage: true, not yet rolled
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    const indicator = container.querySelector('.panel-renderer__disadv-indicator');
    expect(indicator).not.toBeNull();
    expect(indicator?.textContent).toBe('▼');
    // Still nothing focusable — the indicator is a plain span, not a control.
    expect(focusableCount(container)).toBe(0);
  });

  it('does not show a disadvantage indicator on a normal-mode unrolled d20', () => {
    const entry = createDiceLineEntry(); // no ranges, no control.advantage — normal mode
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeNull();
  });

  it('keeps the default-disadvantage indicator alongside the rolled-mode styling once rolled', async () => {
    const entry = createDisadvantageEntry();
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.4) // disadvantage roll 1: floor(0.4*20)+1 = 9
      .mockReturnValueOnce(0.7); // disadvantage roll 2: floor(0.7*20)+1 = 15 (dropped)
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: false }
    });
    const chip = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    await fireEvent.click(chip);

    await rerender({ entry, editable: true, facts: {}, summary: true });

    const indicator = container.querySelector('.panel-renderer__disadv-indicator');
    expect(indicator).not.toBeNull();
    const summaryChip = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    expect(summaryChip.classList.contains('panel-renderer__die-chip--disadv')).toBe(true);
  });
});
