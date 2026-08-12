import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PlanRow from '$lib/components/play/PlanRow.svelte';
import type { Annotation, AvailableRuleEntry } from '$lib/rules-view';
import type { PlannedItem } from '$lib/play/types';

// A planned save row: its panel carries the `save.any` label, so both riders
// below match it. The valued one must reach ONLY the dice line (as a toggle),
// the valueless one ONLY the mod-chip strip.
const entry: AvailableRuleEntry = {
  rule: {
    id: 'record-save-wis',
    ui: {
      section: 'free',
      name: 'planner.record.save.wis',
      annotationLabels: ['save.any', 'save.wis'],
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { number: 5 }, purpose: 'save' }]
      },
      intents: { SAVE: 'you' },
      actionCost: []
    },
    vars: {},
    // Required by the view contract's legacy `Rule` shape; unused by PlanRow.
    activities: []
  },
  legal: true,
  applicable: true,
  diagnostics: []
};

const item: PlannedItem = {
  instanceId: 'inst-1',
  rule: { ...entry.rule, selections: {} } as PlannedItem['rule'],
  order: 0,
  verb: 'SAVE' as PlannedItem['verb']
};

const valued: Annotation = {
  key: 'rule.demo.aura',
  targets: ['save.any'],
  rider: {
    label: 'rule.demo.aura',
    type: 'modifier',
    value: { kind: 'flat', bonus: 3 },
    appliesTo: 'save'
  }
};

const informational: Annotation = {
  key: 'rule.demo.note',
  targets: ['save.any'],
  rider: { label: 'rule.demo.note', type: 'modifier' }
};

const props = {
  item,
  entry,
  facts: {},
  activeAnnotations: [valued, informational]
};

describe('PlanRow rider chips', () => {
  it('does not repeat a valued rider as a static mod chip', () => {
    const { container } = render(PlanRow, { props });
    const chipText = Array.from(container.querySelectorAll('.mod-chip__label')).map(
      (el) => el.textContent
    );
    // The valued rider is represented by the interactive dice-line chip instead;
    // rendering it here too would show it twice, once dead and once live.
    expect(chipText).not.toContain('rule.demo.aura');
  });

  it('still shows an informational rider as a mod chip', () => {
    const { container } = render(PlanRow, { props });
    const chipText = Array.from(container.querySelectorAll('.mod-chip__label')).map(
      (el) => el.textContent
    );
    expect(chipText).toContain('rule.demo.note');
  });

  it('renders the valued rider as the dice line toggle', () => {
    const { container } = render(PlanRow, { props });
    const toggle = container.querySelector('.panel-renderer__modifier[data-modifier-key]');
    expect(toggle).toBeInstanceOf(HTMLButtonElement);
    expect(toggle?.textContent?.trim()).toBe('rule.demo.aura +3');
  });

  it('no longer brands effect chips with an FX badge', () => {
    const { container } = render(PlanRow, { props });
    expect(container.querySelector('.mod-chip__fx-badge')).toBeNull();
    expect(container.textContent).not.toContain('FX');
  });
});
