import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createSliderEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: {
    id: 'move',
    description: 'Move',
    activities: [],
    ui: {
      section: 'move',
      name: 'rule.dnd-5e-2024.movement.move-walk.name',
      primaryControl: {
        type: 'slider',
        var: 'distance',
        max: { var: 'maxDistance' }
      }
    },
    vars: {
      distance: { default: { fact: 'character.movement.remaining' } },
      maxDistance: { default: { fact: 'character.movement.total' } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

describe('PanelRenderer - slider control', () => {
  it('renders a slider when primaryControl type is slider', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    expect(container.querySelector('input[type="range"]')).toBeTruthy();
  });

  it('sets slider max from resolved value', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.max).toBe('30');
  });

  it('renders a disabled slider when read-only', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.disabled).toBe(true);
    expect(slider.value).toBe('20');
    expect(slider.max).toBe('30');
  });

  it('fires onSelectionChange when slider value changes', async () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, onSelectionChange }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '15';
    await fireEvent.input(slider);
    expect(onSelectionChange).toHaveBeenCalledWith({ distance: 15 });
  });

  it('sets slider min from resolved value when provided', () => {
    const entry = createSliderEntry({
      rule: {
        ...createSliderEntry().rule,
        ui: {
          ...createSliderEntry().rule.ui,
          primaryControl: {
            type: 'slider',
            var: 'distance',
            min: { number: 5 },
            max: { var: 'maxDistance' }
          }
        }
      } as Rule
    });
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.min).toBe('5');
  });

  it('defaults slider min to 0 when not provided', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.min).toBe('0');
  });

  it('renders slider for secondaryControl when type is slider', () => {
    const entry = createSliderEntry({
      rule: {
        ...createSliderEntry().rule,
        ui: {
          ...createSliderEntry().rule.ui,
          secondaryControl: {
            type: 'slider',
            var: 'secondaryDistance',
            max: { var: 'maxDistance' }
          }
        },
        vars: {
          ...createSliderEntry().rule.vars,
          secondaryDistance: { default: { fact: 'character.movement.remaining' } }
        }
      } as Rule
    });
    const facts = { 'character.movement.remaining': 10, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const sliders = container.querySelectorAll('input[type="range"]');
    expect(sliders.length).toBe(2);
    expect(sliders[1].closest('.panel-renderer__control--secondary')).toBeTruthy();
  });

  it('uses selection value over var default for current value', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const selections = { distance: 12 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, selections }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe('12');
  });

  it('has panel-renderer__slider class on the slider container', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    expect(container.querySelector('.panel-renderer__slider')).toBeTruthy();
  });

  it('updates displayed value immediately during drag (local state)', async () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    const valueSpan = container.querySelector('.panel-renderer__slider-value') as HTMLSpanElement;

    // Simulate dragging to 10
    slider.value = '10';
    await fireEvent.input(slider);

    // The displayed text should immediately show 10
    expect(valueSpan.textContent).toContain('10');
  });

  const createSpellLevelSliderEntry = (): AvailableRuleEntry => {
    const base = createSliderEntry();
    return {
      ...base,
      rule: {
        ...base.rule,
        ui: {
          ...base.rule.ui,
          primaryControl: {
            type: 'slider',
            var: 'distance',
            min: { number: 0 },
            max: { number: 5 },
            valueFormat: 'spellLevel'
          }
        }
      } as Rule
    };
  };

  // NOTE: the test harness mocks i18n so $t(key) returns the key itself
  // (see tests/setup.ts). These assert that valueFormat selects the correct
  // translation key per value; the rendered text is the key, not the label.
  it('uses the free-use translation key for value 0 when valueFormat is spellLevel', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { distance: 0 } }
    });
    const valueSpan = container.querySelector('.panel-renderer__slider-value') as HTMLSpanElement;
    expect(valueSpan.textContent?.trim()).toBe('play.slider.freeUse');
  });

  it('uses the level translation key for value N>=1 when valueFormat is spellLevel', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { distance: 2 } }
    });
    const valueSpan = container.querySelector('.panel-renderer__slider-value') as HTMLSpanElement;
    expect(valueSpan.textContent?.trim()).toBe('play.slider.level');
  });

  it('shows the raw number when no valueFormat is set', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const valueSpan = container.querySelector('.panel-renderer__slider-value') as HTMLSpanElement;
    expect(valueSpan.textContent?.trim()).toBe('20');
  });

  it('exposes the formatted spell-level value to assistive tech via aria-valuetext', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { distance: 0 } }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.getAttribute('aria-valuetext')).toBe('play.slider.freeUse');
  });

  it('updates aria-valuetext to the level label for N>=1', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { distance: 2 } }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.getAttribute('aria-valuetext')).toBe('play.slider.level');
  });

  it('sets aria-valuetext to the numeric display when no valueFormat is set', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.getAttribute('aria-valuetext')).toBe('20');
  });

  it('keeps each slider independent when multiple exist', () => {
    // Two sliders: walk (distance) and secondary slider
    const entry = createSliderEntry({
      rule: {
        ...createSliderEntry().rule,
        ui: {
          ...createSliderEntry().rule.ui,
          secondaryControl: {
            type: 'slider',
            var: 'secondaryDistance',
            max: { var: 'maxDistance' }
          }
        },
        vars: {
          ...createSliderEntry().rule.vars,
          secondaryDistance: { default: { fact: 'character.movement.remaining' } }
        }
      } as Rule
    });
    // Primary slider has selection=5, secondary has no selection (defaults to fact=10)
    const facts = { 'character.movement.remaining': 10, 'character.movement.total': 30 };
    const selections = { distance: 5 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, selections }
    });
    const sliders = container.querySelectorAll('input[type="range"]');
    // Primary slider should show 5 (from selections)
    expect(sliders[0].value).toBe('5');
    // Secondary slider should show 10 (from facts, no selection)
    expect(sliders[1].value).toBe('10');
  });

  describe('notch-based slider selection sync', () => {
    const createNotchSliderEntry = (): AvailableRuleEntry => ({
      rule: {
        id: 'cast-aid',
        description: 'Aid',
        activities: [],
        ui: {
          section: 'action-spell',
          name: 'rule.spell-aid.offer-aid.name',
          primaryControl: {
            type: 'slider',
            var: 'slotLevel',
            notches: [
              { value: 2, enabled: { fact: 'spellcasting.slots.level2.total' } },
              { value: 3, enabled: { fact: 'spellcasting.slots.level3.total' } },
              { value: 4, enabled: { fact: 'spellcasting.slots.level4.total' } },
              { value: 5, enabled: { fact: 'spellcasting.slots.level5.total' } }
            ],
            valueFormat: 'spellLevel'
          }
        },
        vars: {
          slotLevel: {
            capture: true,
            default: { fact: 'aid.lowestAvailableSlotLevel' }
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    });

    it('syncs selection to first active notch when selection value does not match any notch', () => {
      const entry = createNotchSliderEntry();
      // Facts make all notches active, but aid.lowestAvailableSlotLevel is absent
      const facts = {
        'spellcasting.slots.level2.total': 3,
        'spellcasting.slots.level3.total': 2,
        'spellcasting.slots.level4.total': 1,
        'spellcasting.slots.level5.total': 1
      };
      // slotLevel=0 from resolveInitialSelections defaulting missing fact to 0
      const selections = { slotLevel: 0 };
      const onSelectionChange = vi.fn();
      render(PanelRenderer, {
        props: { entry, editable: true, facts, selections, onSelectionChange }
      });
      // The slider should sync selections to the first active notch value (2)
      expect(onSelectionChange).toHaveBeenCalledWith({ slotLevel: 2 });
    });
  });
});
