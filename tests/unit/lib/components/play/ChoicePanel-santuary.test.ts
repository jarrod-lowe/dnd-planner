import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import ChoicePanel from '$lib/components/play/ChoicePanel.svelte';
import type { AvailableRuleEntry, Rule, Facts } from '$lib/rules-engine';

const createSanctuaryEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'cast-sanctuary',
    description: 'Sanctuary',
    activities: [],
    ui: {
      model: 'sanctuary',
      section: 'bonus-action-spell',
      name: 'rule.spell-sanctuary.offer-sanctuary.name'
    },
    vars: {
      slotLevel: { capture: true, default: { fact: 'sanctuary.lowestAvailableSlotLevel' } }
    },
    selections: { slotLevel: 1 }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

const factsWithSlots: Facts = {
  'spellcasting.slots.level1.total': 2,
  'spellcasting.slots.level1.remaining': 2,
  'spellcasting.slots.level2.total': 1,
  'spellcasting.slots.level2.remaining': 1,
  'spellcasting.slots.level3.total': 0,
  'spellcasting.slots.level3.remaining': 0,
  'spellcasting.saveDC': 13
};

describe('ChoicePanel - sanctuary model', () => {
  it('renders read-only view as a button', () => {
    const entry = createSanctuaryEntry();
    const { container } = render(ChoicePanel, {
      props: { entry, editable: false, onTap: vi.fn(), facts: factsWithSlots }
    });

    const button = container.querySelector('button.choice-panel');
    expect(button).toBeTruthy();
    expect(container.textContent).toContain('sanctuary');
  });

  it('renders editable view with slot level chip', () => {
    const entry = createSanctuaryEntry(true);
    const onSelectionChange = vi.fn();
    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts: factsWithSlots, onSelectionChange }
    });

    // Should show slot level indicator
    expect(container.querySelector('.choice-panel__sanctuary-level')).toBeTruthy();
  });

  it('renders editable view as a div, not button', () => {
    const entry = createSanctuaryEntry(true);
    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts: factsWithSlots, onSelectionChange: vi.fn() }
    });

    const div = container.querySelector('div.choice-panel--editable');
    expect(div).toBeTruthy();
  });

  it('shows save DC in read-only view', () => {
    const entry = createSanctuaryEntry();
    const { container } = render(ChoicePanel, {
      props: { entry, editable: false, onTap: vi.fn(), facts: factsWithSlots }
    });

    expect(container.textContent).toContain('WIS Save DC 13');
  });

  it('shows save DC in editable view', () => {
    const entry = createSanctuaryEntry(true);
    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts: factsWithSlots, onSelectionChange: vi.fn() }
    });

    expect(container.textContent).toContain('WIS Save DC 13');
  });
});
