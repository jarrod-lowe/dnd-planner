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
  it('renders option buttons for options', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.querySelectorAll('.panel-renderer__radio-option').length).toBeGreaterThan(0);
  });

  it('renders the correct number of option buttons for each option', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const buttons = container.querySelectorAll('.panel-renderer__radio-option');
    expect(buttons.length).toBe(4); // [0, 0.5, 1, 2]
  });

  it('renders option spans when read-only', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {} }
    });
    const options = container.querySelectorAll('.panel-renderer__radio-option');
    expect(options.length).toBe(4);
    // No buttons in read-only mode
    expect(container.querySelectorAll('.panel-renderer__radio-option button').length).toBe(0);
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
    const active = container.querySelector('.panel-renderer__radio-option--active');
    expect(active).toBeTruthy();
    expect(active?.textContent).toContain('1');
  });

  it('fires onSelectionChange when option button is clicked', async () => {
    const entry = createSelectEntry();
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const buttons = container.querySelectorAll('.panel-renderer__radio-option');
    await fireEvent.click(buttons[2]); // value 1
    expect(onSelectionChange).toHaveBeenCalledWith({ level: 1 });
  });

  it('has panel-renderer__select class on the select container', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.querySelector('.panel-renderer__select')).toBeTruthy();
  });

  it('has panel-renderer__radio-option class on each option button', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    expect(container.querySelectorAll('.panel-renderer__radio-option').length).toBe(4);
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

  it('handles options from ValueSource array', () => {
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
    const buttons = container.querySelectorAll('.panel-renderer__radio-option');
    expect(buttons.length).toBe(3);
  });

  it('handles numeric option values as option button values', async () => {
    const entry = createSelectEntry();
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const buttons = container.querySelectorAll('.panel-renderer__radio-option');
    // Click the 0.5 option (index 1)
    await fireEvent.click(buttons[1]);
    expect(onSelectionChange).toHaveBeenCalledWith({ level: 0.5 });
  });

  it('renders option buttons with labels when options is inline array', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'proficiency-athletics',
        description: 'Athletics',
        activities: [],
        ui: {
          section: 'configuration',
          name: 'rule.dnd-5e-2024.ability-scores.proficiency-athletics.name',
          primaryControl: {
            type: 'select',
            var: 'level',
            options: [
              { value: 0.5, label: '○' },
              { value: 1, label: '●' },
              { value: 2, label: '●●' }
            ]
          }
        },
        vars: {
          level: { capture: true, default: { number: 1 } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Should render 3 radio-style buttons
    const buttons = container.querySelectorAll('.panel-renderer__radio-option');
    expect(buttons).toHaveLength(3);
    expect(container.textContent).toContain('○');
    expect(container.textContent).toContain('●');
    expect(container.textContent).toContain('●●');
  });

  it('renders disabled option buttons as spans when read-only with inline options', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'proficiency-athletics',
        description: 'Athletics',
        activities: [],
        ui: {
          section: 'configuration',
          name: 'rule.dnd-5e-2024.ability-scores.proficiency-athletics.name',
          primaryControl: {
            type: 'select',
            var: 'level',
            options: [
              { value: 0.5, label: '○' },
              { value: 1, label: '●' },
              { value: 2, label: '●●' }
            ]
          }
        },
        vars: {
          level: { capture: true, default: { number: 1 } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {} }
    });
    // Should still render the 3 option buttons
    const options = container.querySelectorAll('.panel-renderer__radio-option');
    expect(options).toHaveLength(3);
    // Read-only options should be spans, not buttons
    const buttons = container.querySelectorAll('.panel-renderer__radio-option button');
    expect(buttons.length).toBe(0);
    // Should show the labels, not raw numbers
    expect(container.textContent).toContain('○');
    expect(container.textContent).toContain('●');
    expect(container.textContent).toContain('●●');
  });

  it('marks the correct inline option as active', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'proficiency-athletics',
        description: 'Athletics',
        activities: [],
        ui: {
          section: 'configuration',
          name: 'rule.dnd-5e-2024.ability-scores.proficiency-athletics.name',
          primaryControl: {
            type: 'select',
            var: 'level',
            options: [
              { value: 0.5, label: '○' },
              { value: 1, label: '●' },
              { value: 2, label: '●●' }
            ]
          }
        },
        vars: {
          level: { capture: true, default: { number: 1 } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    // Default level is 1, so the second option should be active
    const activeOption = container.querySelector('.panel-renderer__radio-option--active');
    expect(activeOption).toBeTruthy();
    expect(activeOption?.textContent).toContain('●');
    expect(activeOption?.textContent).not.toContain('●●');
  });

  it('fires onSelectionChange when inline option button is clicked', async () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'proficiency-athletics',
        description: 'Athletics',
        activities: [],
        ui: {
          section: 'configuration',
          name: 'rule.dnd-5e-2024.ability-scores.proficiency-athletics.name',
          primaryControl: {
            type: 'select',
            var: 'level',
            options: [
              { value: 0.5, label: '○' },
              { value: 1, label: '●' },
              { value: 2, label: '●●' }
            ]
          }
        },
        vars: {
          level: { capture: true, default: { number: 0.5 } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onSelectionChange }
    });
    const buttons = container.querySelectorAll('.panel-renderer__radio-option');
    // Click the "●●" button (value 2)
    await fireEvent.click(buttons[2]);
    expect(onSelectionChange).toHaveBeenCalledWith({ level: 2 });
  });

  it('still renders all option buttons in read-only mode with ValueSource options', () => {
    const entry = createSelectEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {} }
    });
    // Read-only with ValueSource options should show 4 spans
    const spans = container.querySelectorAll('.panel-renderer__radio-option');
    expect(spans.length).toBe(4);
    // Should contain the string representations of the options
    expect(container.textContent).toContain('0');
    expect(container.textContent).toContain('0.5');
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('2');
  });
});
