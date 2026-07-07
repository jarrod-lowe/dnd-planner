import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';
import type { Annotation } from '$lib/rules-view';

const createEntryWithAnnotations = (): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe',
    description: 'Greataxe',
    activities: [],
    ui: {
      name: 'rule.attacks.greataxe.name',
      annotationLabels: ['attack.any', 'attack.melee'],
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      }
    },
    vars: { hitBonus: { default: { number: 5 } } }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - annotations', () => {
  it('renders matching annotations', () => {
    const entry = createEntryWithAnnotations();
    const annotations: Annotation[] = [
      { key: 'play.annotations.some-buff', targets: ['attack.any'] }
    ];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, activeAnnotations: annotations }
    });
    expect(container.querySelector('.panel-renderer__annotations')).toBeTruthy();
  });

  it('renders nothing when no annotations match', () => {
    const entry = createEntryWithAnnotations();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, activeAnnotations: [] }
    });
    expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
  });

  it('renders annotation text from translation key', () => {
    const entry = createEntryWithAnnotations();
    const annotations: Annotation[] = [
      { key: 'play.annotations.some-buff', targets: ['attack.any'] }
    ];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, activeAnnotations: annotations }
    });
    const annotationSpan = container.querySelector('.panel-renderer__annotation');
    expect(annotationSpan).toBeTruthy();
    expect(annotationSpan?.textContent).toContain('play.annotations.some-buff');
  });

  it('ignores annotationLabels on controls (only top-level ui.annotationLabels is used)', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'two-controls',
        description: 'Two Controls',
        activities: [],
        ui: {
          name: 'rule.two-controls.name',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20 }],
            annotationLabels: ['attack.any']
          },
          secondaryControl: {
            type: 'dice-line',
            dice: [{ sides: 6 }],
            annotationLabels: ['damage.melee']
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const annotations: Annotation[] = [
      { key: 'play.annotations.damage-buff', targets: ['damage.melee'] }
    ];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, activeAnnotations: annotations }
    });
    expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
  });

  it('collects labels from top-level ui.annotationLabels', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'reaction-attack',
        description: 'Reaction Attack',
        activities: [],
        ui: {
          name: 'rule.reaction-attack.name',
          annotationLabels: ['attack.any', 'attack.melee', 'attack.reaction']
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const annotations: Annotation[] = [
      { key: 'play.annotations.sentinel-buff', targets: ['attack.reaction'] }
    ];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, activeAnnotations: annotations }
    });
    expect(container.querySelector('.panel-renderer__annotations')).toBeTruthy();
    expect(container.querySelector('.panel-renderer__annotation')?.textContent).toContain(
      'play.annotations.sentinel-buff'
    );
  });

  it('renders annotations in non-editable mode', () => {
    const entry = createEntryWithAnnotations();
    const annotations: Annotation[] = [
      { key: 'play.annotations.some-buff', targets: ['attack.any'] }
    ];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts: {}, activeAnnotations: annotations }
    });
    expect(container.querySelector('.panel-renderer__annotations')).toBeTruthy();
  });
});
