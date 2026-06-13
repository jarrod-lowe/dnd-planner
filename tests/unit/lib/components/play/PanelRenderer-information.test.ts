import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createTextInfoEntry = (
  label: string,
  labelValues?: Record<string, unknown>
): AvailableRuleEntry => ({
  rule: {
    id: 'spell-save',
    description: 'Spell Save',
    activities: [],
    ui: {
      name: 'rule.spells.test.name',
      information: [{ type: 'text', label, labelValues }]
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - text information', () => {
  it('renders text information from label', () => {
    const entry = createTextInfoEntry('rule.test.description');
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {} }
    });
    expect(container.textContent).toContain('rule.test.description');
  });

  it('renders text with labelValues resolved from facts', () => {
    const entry = createTextInfoEntry('play.information.saveDc', {
      saveType: { fact: 'spellcasting.saveType' },
      dc: { fact: 'spellcasting.saveDC' }
    });
    const facts = { 'spellcasting.saveType': 'DEX', 'spellcasting.saveDC': 14 };
    const { container } = render(PanelRenderer, {
      props: { entry, facts }
    });
    expect(container.textContent).toContain('DEX Save DC 14');
  });

  it('renders text information with correct CSS class', () => {
    const entry = createTextInfoEntry('rule.test.description');
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {} }
    });
    expect(container.querySelector('.panel-renderer__information--text')).toBeTruthy();
  });

  it('renders text information in editable mode', () => {
    const entry = createTextInfoEntry('rule.test.description');
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {}, editable: true }
    });
    expect(container.textContent).toContain('rule.test.description');
    expect(container.querySelector('.panel-renderer__information--text')).toBeTruthy();
  });

  it('renders nothing when information is absent', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'no-info',
        description: 'No Info',
        activities: []
      },
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {} }
    });
    expect(container.querySelector('.panel-renderer__information')).toBeNull();
  });

  it('renders text information with scale and offset on labelValues', () => {
    const entry = createTextInfoEntry('play.information.saveDc', {
      saveType: { string: 'CON' },
      dc: { number: 3, scale: 5, offset: -5 }
    });
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {} }
    });
    // number: 3, scale: 5, offset: -5 → 3*5 + (-5) = 10
    expect(container.textContent).toContain('CON Save DC 10');
  });

  it('renders dynamic scale/offset value from var selection', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'test-aid',
        description: 'Test Aid',
        activities: [],
        ui: {
          name: 'rule.test.name',
          information: [
            {
              type: 'text',
              label: 'play.information.aidBonus',
              labelValues: {
                hp: { var: 'slotLevel', scale: 5, offset: -5 }
              }
            }
          ]
        },
        vars: {
          slotLevel: { capture: true, default: { number: 2 } }
        }
      } as unknown as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const { container } = render(PanelRenderer, {
      props: { entry, facts: {}, selections: { slotLevel: 4 } }
    });
    // slotLevel=4, scale=5, offset=-5 → 4*5-5 = 15
    expect(container.textContent).toContain('+15 HP');
  });
});
