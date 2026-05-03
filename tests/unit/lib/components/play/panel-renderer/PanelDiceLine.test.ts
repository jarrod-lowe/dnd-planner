import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

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
        dice: [
          { expression: 'd20', bonus: { var: 'initiativeBonus' } }
        ]
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
          { expression: 'd20', bonus: { var: 'hitBonus' } },
          { expression: { var: 'damageDie' }, bonus: { var: 'damageBonus' }, damageType: { string: 'slashing' } }
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

  it('renders attack with range, hit, and damage', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('d20');
    expect(container.textContent).toContain('d12');
    expect(container.textContent).toContain('slashing');
  });

  it('renders dice line as read-only text when not editable', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: false, facts: {} } });
    expect(container.textContent).toContain('d20');
  });

  it('shows range with ft suffix', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    expect(container.textContent).toContain('5ft');
  });

  it('shows pipe separators between range and dice entries', () => {
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    const text = container.textContent ?? '';
    // Attack should have separators: "5ft | d20+5 | d12+3 slashing"
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
            dice: [{ expression: 'd20' }]
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
        ranges: { default: { array: [{ distance: 5, type: 'melee' }, { distance: 20, type: 'ranged' }] } }
      }
    } as Rule;
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts: {} } });
    // Initially shows first range
    expect(container.textContent).toContain('5ft');
    // Tap the range to cycle
    const rangeEl = container.querySelector('.panel-renderer__range') as HTMLElement;
    expect(rangeEl).toBeTruthy();
    await fireEvent.click(rangeEl);
    // After tap, should show second range
    expect(container.textContent).toContain('20ft');
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
    expect(container.textContent).toContain('10ft');
  });
});
