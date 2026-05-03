import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createSelectEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: {
    id: 'proficiency-athletics',
    description: 'Athletics',
    activities: [],
    ui: {
      section: 'configuration',
      name: 'rule.dnd-5e-2024.skill-proficiency.athletics.name',
      primaryControl: {
        type: 'select',
        var: 'level',
        options: { var: 'levels' }
      }
    },
    vars: {
      levels: { default: { array: [0, 0.5, 1, 2] } },
      level: { default: { number: 0 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

describe('PanelRenderer - select control', () => {
  it('renders radio buttons for options', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.querySelectorAll('input[type="radio"]').length).toBeGreaterThan(0);
  });

  it('renders the correct number of radio buttons for each option', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(4); // [0, 0.5, 1, 2]
  });

  it('shows selected value as text when read-only', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {} }
    });
    expect(container.querySelectorAll('input[type="radio"]').length).toBe(0);
  });

  it('displays the current selected value in read-only mode', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {} }
    });
    // default level is 0
    expect(container.textContent).toContain('0');
  });

  it('uses selection value over var default for current value', () => {
    const entry = createSelectEntry();
    const selections = { level: 1 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections }
    });
    const checked = container.querySelector('input[type="radio"]:checked') as HTMLInputElement;
    expect(checked.value).toBe('1');
  });

  it('fires onSelectionChange when radio is selected', async () => {
    const entry = createSelectEntry();
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const radios = container.querySelectorAll('input[type="radio"]');
    await fireEvent.click(radios[2]); // value 1
    expect(onSelectionChange).toHaveBeenCalledWith({ level: 1 });
  });

  it('has panel-renderer__select class on the select container', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.querySelector('.panel-renderer__select')).toBeTruthy();
  });

  it('has panel-renderer__radio class on each radio label', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.querySelectorAll('.panel-renderer__radio').length).toBe(4);
  });

  it('renders radio buttons inside the control div in editable mode', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const controlDiv = container.querySelector('.panel-renderer__control');
    expect(controlDiv).toBeTruthy();
    expect(controlDiv!.querySelector('.panel-renderer__select')).toBeTruthy();
  });

  it('renders select value inside the control div in read-only mode', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {} }
    });
    const controlDiv = container.querySelector('.panel-renderer__control');
    expect(controlDiv).toBeTruthy();
    expect(controlDiv!.querySelector('.panel-renderer__select')).toBeTruthy();
  });

  it('handles options from inline array', () => {
    const entry = createSelectEntry({
      rule: {
        ...createSelectEntry().rule,
        ui: {
          ...createSelectEntry().rule.ui,
          primaryControl: {
            type: 'select',
            var: 'choice',
            options: { array: ['a', 'b', 'c'] }
          }
        },
        vars: {
          choice: { default: { string: 'a' } }
        }
      } as Rule
    });
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(3);
  });

  it('handles numeric option values as radio button values', async () => {
    const entry = createSelectEntry();
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const radios = container.querySelectorAll('input[type="radio"]');
    // Click the 0.5 option (index 1)
    await fireEvent.click(radios[1]);
    expect(onSelectionChange).toHaveBeenCalledWith({ level: 0.5 });
  });

  it('displays display value in read-only when display source provided', () => {
    const entry = createSelectEntry({
      rule: {
        ...createSelectEntry().rule,
        ui: {
          ...createSelectEntry().rule.ui,
          primaryControl: {
            type: 'select',
            var: 'level',
            options: { var: 'levels' },
            display: { var: 'displayValue' }
          }
        },
        vars: {
          ...createSelectEntry().rule.vars,
          displayValue: { default: { string: 'Proficient' } }
        }
      } as Rule
    });
    const selections = { level: 1 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {}, selections }
    });
    expect(container.textContent).toContain('Proficient');
  });
});
