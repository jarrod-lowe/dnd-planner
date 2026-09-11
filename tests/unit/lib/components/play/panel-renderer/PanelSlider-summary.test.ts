import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

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
        max: { var: 'maxDistance' },
        unit: 'ft'
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

describe('PanelSlider - summary short form', () => {
  it('shows the formatted current value with unit, and no other markup', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, summary: true }
    });
    expect(container.querySelector('.panel-renderer__slider-summary')?.textContent?.trim()).toBe(
      '20 ft'
    );
  });

  it('renders no input, no notches, no track in summary mode', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, summary: true }
    });
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('.panel-renderer__slider')).toBeNull();
  });

  it('updates the shown value when the selection changes', async () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts, summary: true, selections: { distance: 5 } }
    });
    expect(container.querySelector('.panel-renderer__slider-summary')?.textContent?.trim()).toBe(
      '5 ft'
    );
    await rerender({
      entry,
      editable: true,
      facts,
      summary: true,
      selections: { distance: 15 }
    });
    expect(container.querySelector('.panel-renderer__slider-summary')?.textContent?.trim()).toBe(
      '15 ft'
    );
  });

  it('reads "Free Use" for spell-level value 0 in summary mode', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true, selections: { distance: 0 } }
    });
    // Mock i18n returns the raw key.
    expect(container.querySelector('.panel-renderer__slider-summary')?.textContent?.trim()).toBe(
      'play.slider.freeUse'
    );
  });

  it('reads "Level N" for spell-level value >= 1 in summary mode', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true, selections: { distance: 2 } }
    });
    expect(container.querySelector('.panel-renderer__slider-summary')?.textContent?.trim()).toBe(
      'play.slider.level'
    );
  });
});
