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

  it('shows current value as text when read-only', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts }
    });
    expect(container.querySelector('input[type="range"]')).toBeNull();
    expect(container.textContent).toContain('20');
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
});
