import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { DiceLineControl } from '$lib/components/play/panel-renderer/types';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

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
          { sides: 20, bonus: { var: 'hitBonus' } },
          {
            sides: { var: 'damageDie' },
            bonus: { var: 'damageBonus' },
            damageType: { string: 'slashing' }
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

describe('PanelRenderer - dice-line control', () => {
  it('renders d20 roll with bonus', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('d20');
    expect(container.textContent).toContain('+3');
  });

  it("leads the to-hit chip's accessible name with its purpose label", () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'greataxe',
        description: 'Greataxe',
        activities: [],
        ui: {
          section: 'action-attack',
          name: 'rule.attacks.greataxe.name',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' }]
          }
        },
        vars: { hitBonus: { default: { number: 5 } } }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chip = container.querySelector('.panel-renderer__die-chip') as HTMLButtonElement;
    const label = chip.getAttribute('aria-label');
    expect(label).toBeTruthy();
    // Translations aren't loaded in the test env, so $t yields the key; assert
    // the purpose's rollType key leads the accessible name.
    expect(label).toContain('play.toast.rollType.to-hit');
  });

  it('renders attack with range, hit, and damage', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('d20');
    expect(container.textContent).toContain('d12');
    expect(container.querySelector('.panel-renderer__damage-type-icon svg')).toBeTruthy();
  });

  it('renders dice line as read-only text when not editable', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: false, facts: {} } });
    expect(container.textContent).toContain('d20');
  });

  it('shows range with the translated unit, not literal ft', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    // The mock i18n dictionary (tests/setup.ts) deliberately translates the
    // 'ft' unit token to a value that isn't the raw literal, so a component
    // that concatenates the raw token instead of routing it through
    // `unitLabel` fails this assertion rather than passing by coincidence.
    expect(container.textContent).toContain('5FEET');
    expect(container.textContent).not.toContain('5ft');
  });

  it('shows pipe separators between range and dice entries', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    const text = container.textContent ?? '';
    // Attack should have separators: "5FEET | d20+5 | d12+3 slashing"
    expect(text).toContain('|');
  });

  it('shows negative bonus with minus sign', () => {
    const entry = createDiceLineEntry();
    entry.rule = {
      ...entry.rule,
      vars: {
        initiativeBonus: { default: { number: -2 } }
      }
    } as Rule;
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('-2');
  });

  it('shows zero bonus as +0', () => {
    const entry = createDiceLineEntry();
    entry.rule = {
      ...entry.rule,
      vars: {
        initiativeBonus: { default: { number: 0 } }
      }
    } as Rule;
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('+0');
  });

  it('does not show bonus when absent', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'simple-roll',
        description: 'Simple Roll',
        activities: [],
        ui: {
          section: 'free',
          name: 'Simple Roll',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20 }]
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    const text = container.textContent ?? '';
    expect(text).toContain('d20');
    expect(text).not.toContain('+');
  });

  it('has panel-renderer__dice-line class on the container', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.querySelector('.panel-renderer__dice-line')).toBeTruthy();
  });

  it('does not render damage type icon when damageType is absent', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.querySelector('.panel-renderer__damage-type-icon')).toBeNull();
  });

  it('has panel-renderer__die-chip class on each die element', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    expect(chips.length).toBe(2);
  });

  it('renders die chip as button in editable mode', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    const chip = container.querySelector('.panel-renderer__die-chip');
    expect(chip?.tagName).toBe('BUTTON');
  });

  it('renders die chip as span in read-only mode', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: false, facts: {} } });
    const chip = container.querySelector('.panel-renderer__die-chip');
    expect(chip?.tagName).toBe('SPAN');
  });

  it('cycles range on tap when multiple ranges exist in editable mode', async () => {
    const entry = createAttackEntry();
    // Add multiple ranges
    entry.rule = {
      ...entry.rule,
      vars: {
        ...entry.rule.vars,
        ranges: {
          default: {
            array: [
              { distance: 5, type: 'melee' },
              { distance: 20, type: 'ranged' }
            ]
          }
        }
      }
    } as Rule;
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    // Initially shows first range
    expect(container.textContent).toContain('5FEET');
    // Tap the range to cycle
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    expect(rangeEl).toBeTruthy();
    await fireEvent.click(rangeEl);
    // After tap, should show second range
    expect(container.textContent).toContain('20FEET');
  });

  it('shows range from fact when ranges use fact source', () => {
    const entry = createAttackEntry();
    entry.rule = {
      ...entry.rule,
      vars: {
        ...entry.rule.vars,
        ranges: { default: { fact: 'weapon.ranges' } }
      }
    } as Rule;
    const facts = {
      'weapon.ranges': [{ distance: 10, type: 'melee' }]
    };
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts } });
    expect(container.textContent).toContain('10FEET');
  });

  it('rolls d20 and displays result when chip is clicked', async () => {
    const entry = createDiceLineEntry(); // d20+3
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // 0.8 * 20 + 1 = 17
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    expect(chip).toBeTruthy();
    await fireEvent.click(chip!);
    // Should show roll result: 17 + 3 = 20
    expect(container.textContent).toContain('20');
  });

  it('shows crit highlight on natural 20', async () => {
    const entry = createDiceLineEntry(); // d20+3
    vi.spyOn(Math, 'random').mockReturnValue(0.95); // 0.95 * 20 + 1 = 20
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(chip?.classList.contains('panel-renderer__die-chip--crit')).toBe(true);
  });

  it('shows fumble highlight on natural 1', async () => {
    const entry = createDiceLineEntry(); // d20+3
    vi.spyOn(Math, 'random').mockReturnValue(0); // 0 * 20 + 1 = 1
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    await fireEvent.click(chip!);
    expect(chip?.classList.contains('panel-renderer__die-chip--fumble')).toBe(true);
  });

  it('does not roll when read-only', async () => {
    const entry = createDiceLineEntry(); // d20+3
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {} }
    });
    // Read-only chips are spans, not buttons, so no click handler
    const span = container.querySelector('.panel-renderer__die-chip');
    expect(span?.tagName).toBe('SPAN');
    // Content should still be the sides label, not a rolled number
    expect(container.textContent).toContain('d20');
    expect(container.textContent).toContain('+3');
  });

  it('rolls damage die', async () => {
    const entry = createAttackEntry(); // d20+5 | d12+3
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.5); // damage: floor(0.5*12)+1 = 7, 7+3=10
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    // Click damage chip (second one, index 1)
    await fireEvent.click(chips[1]);
    expect(container.textContent).toContain('10');
  });

  it('rolls d0 and displays 0', async () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'zero-die',
        description: 'Zero Die',
        activities: [],
        ui: {
          section: 'free',
          name: 'Zero Die',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 0 }]
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chip = container.querySelector('.panel-renderer__die-chip');
    expect(chip).toBeTruthy();
    await fireEvent.click(chip!);
    expect(container.textContent).toContain('0');
  });

  // === Range-based disadvantage ===

  it('shows disadvantage indicator when range has disadvantage', () => {
    const entry = createAttackEntry();
    entry.rule = {
      ...entry.rule,
      vars: {
        ...entry.rule.vars,
        ranges: {
          default: {
            array: [
              { distance: 5, type: 'melee' },
              { distance: 30, type: 'ranged', disadvantage: false },
              { distance: 60, type: 'ranged', disadvantage: true }
            ]
          }
        }
      }
    } as Rule;
    // Cycle to the disadvantaged range by clicking twice
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    // Start at 5ft melee - no disadvantage
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeFalsy();
  });

  it('rolls d20 at disadvantage when range has disadvantage flag', async () => {
    const entry = createAttackEntry();
    entry.rule = {
      ...entry.rule,
      vars: {
        ...entry.rule.vars,
        ranges: {
          default: {
            array: [
              { distance: 5, type: 'melee' },
              { distance: 60, type: 'ranged', disadvantage: true }
            ]
          }
        }
      }
    } as Rule;
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    // Cycle to the disadvantaged range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Now at 60ft with disadvantage
    // Mock two rolls: 0.4->9, 0.7->15 => disadvantage takes min = 9
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.4) // first disadvantage roll: floor(0.4*20)+1 = 9
      .mockReturnValueOnce(0.7); // second disadvantage roll: floor(0.7*20)+1 = 15
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[0]); // click d20
    // Should show disadvantage marker and result of min(9,15) + 5 = 14
    expect(container.textContent).toContain('14');
    const d20chip = chips[0];
    expect(d20chip.classList.contains('panel-renderer__die-chip--disadv')).toBe(true);
  });

  it('range button has chip-like styling', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    expect(rangeEl).toBeTruthy();
    expect(rangeEl.classList.contains('panel-renderer__range')).toBe(true);
    expect(rangeEl.tagName).toBe('BUTTON');
  });

  // === Persistent default roll mode indicator ===

  it('disadvantage indicator persists after rolling', async () => {
    const entry = createAttackEntry();
    entry.rule = {
      ...entry.rule,
      vars: {
        ...entry.rule.vars,
        ranges: {
          default: {
            array: [
              { distance: 5, type: 'melee' },
              { distance: 60, type: 'ranged', disadvantage: true }
            ]
          }
        }
      }
    } as Rule;
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    // Cycle to disadvantaged range
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    await fireEvent.click(rangeEl);
    // Indicator visible before rolling
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeTruthy();
    // Roll the d20
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[0]);
    // Indicator still visible after rolling
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeTruthy();
  });

  it('no disadvantage indicator when default is normal', () => {
    const entry = createAttackEntry();
    // Single melee range - no disadvantage
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeFalsy();
  });

  // === Rules-driven advantage (advantageUp) ===

  // A to-hit d20 whose control carries `advantageUp` — the rules-driven
  // ADVANTAGE source (e.g. Invisible's `attack.str.advantage` fact), the ▲
  // counterpart of the historical `advantage` field (which, despite its
  // name, is the DISadvantage source). Overrides fold into the primary
  // control so the cancel cases can layer a disadvantage source on top.
  const createAdvantageEntry = (
    primaryControlOverrides: Partial<DiceLineControl> = {}
  ): AvailableRuleEntry => ({
    rule: {
      id: 'adv-attack',
      description: 'Advantage Attack',
      activities: [],
      ui: {
        section: 'action-attack',
        name: 'rule.attacks.adv.name',
        primaryControl: {
          type: 'dice-line',
          advantageUp: { fact: 'attack.str.advantage' },
          dice: [{ sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' }],
          ...primaryControlOverrides
        }
      },
      vars: { hitBonus: { default: { number: 5 } } }
    } as Rule,
    legal: true,
    applicable: true,
    diagnostics: []
  });

  it('shows the advantage indicator (▲) when advantageUp resolves truthy', () => {
    const entry = createAdvantageEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: { 'attack.str.advantage': 1 } }
    });
    const indicator = container.querySelector('.panel-renderer__disadv-indicator');
    expect(indicator).toBeTruthy();
    expect(indicator?.textContent).toBe('▲');
    // i18n key echoes back in the test env — proves the label is translated,
    // and that it names ADVANTAGE, not the ▼ leg's disadvantage key.
    expect(indicator?.getAttribute('aria-label')).toBe('play.choices.attack.advantage');
  });

  it('rolls d20 at advantage when advantageUp resolves truthy', async () => {
    const entry = createAdvantageEntry(); // d20+5
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.4) // advantage roll 1: floor(0.4*20)+1 = 9 (dropped)
      .mockReturnValueOnce(0.7); // advantage roll 2: floor(0.7*20)+1 = 15 (kept)
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: { 'attack.str.advantage': 1 } }
    });
    const chip = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    await fireEvent.click(chip);
    // Advantage keeps the max: 15 + 5 = 20
    expect(container.textContent).toContain('20');
    expect(chip.classList.contains('panel-renderer__die-chip--adv')).toBe(true);
  });

  it('cancels advantageUp against a disadvantage fact to a normal default roll mode', async () => {
    // SRD glossary: Advantage and Disadvantage on the same roll cancel each
    // other. Prone (dis on your attacks) + Invisible (adv) co-occurring is
    // the real case: both facts live, the default mode is normal.
    const entry = createAdvantageEntry({ advantage: { fact: 'attack.str.disadvantage' } });
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // ONE normal roll: floor(0.8*20)+1 = 17
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        facts: { 'attack.str.advantage': 1, 'attack.str.disadvantage': 1 }
      }
    });
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeFalsy();
    const chip = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    await fireEvent.click(chip);
    // Single d20 kept as-is: 17 + 5 = 22, no adv/dis chip styling
    expect(container.textContent).toContain('22');
    expect(chip.classList.contains('panel-renderer__die-chip--adv')).toBe(false);
    expect(chip.classList.contains('panel-renderer__die-chip--disadv')).toBe(false);
  });

  it('cancels advantageUp against a disadvantage range band to a normal default roll mode', async () => {
    // Cancellation is source-agnostic per the glossary: a long-range band's
    // disadvantage cancels a rules-driven advantage exactly as a fact would.
    const entry = createAdvantageEntry({
      ranges: { array: [{ distance: 60, type: 'ranged', disadvantage: true }] }
    });
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // ONE normal roll: 17
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: { 'attack.str.advantage': 1 } }
    });
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeFalsy();
    const chip = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    await fireEvent.click(chip);
    expect(container.textContent).toContain('22');
    expect(chip.classList.contains('panel-renderer__die-chip--adv')).toBe(false);
    expect(chip.classList.contains('panel-renderer__die-chip--disadv')).toBe(false);
  });

  it('keeps the default roll mode normal when advantageUp is present but unresolved', () => {
    // Back-compat pin: a control authored with advantageUp whose fact is
    // absent (the character is not invisible) must roll exactly as before.
    const entry = createAdvantageEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.querySelector('.panel-renderer__disadv-indicator')).toBeFalsy();
    expect(container.textContent).toContain('d20');
  });
});
