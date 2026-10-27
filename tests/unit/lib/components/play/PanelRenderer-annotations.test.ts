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

  it('interpolates annotation values into the label', () => {
    // The concentration save reminder carries the computed DC in `values`;
    // the panel renders $t(key, values) with double-brace params, exactly as
    // the notices strip interpolates a body. An uninterpolated {{dc}} left in
    // the text would hand the player a template, not a number.
    const entry = createEntryWithAnnotations();
    const annotations: Annotation[] = [
      {
        key: 'play.annotations.concentration-save',
        targets: ['attack.any'],
        values: { dc: 13 }
      }
    ];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, activeAnnotations: annotations }
    });
    const annotationSpan = container.querySelector('.panel-renderer__annotation');
    expect(annotationSpan).toBeTruthy();
    expect(annotationSpan?.textContent).toContain('DC 13');
    expect(annotationSpan?.textContent).not.toContain('{{dc}}');
  });

  it('renders a plain label for an annotation without values', () => {
    // Backward compatible: no values → plain $t(key), nothing to interpolate.
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

  describe('notice diagnostics (the per-row informational note)', () => {
    // The HP recorder's below-threshold bounce rides the bounced row as a
    // 'notice' diagnostic (planDiagnostics is per-instance): sub-threshold
    // damage is legal to attempt, so the note is informational — never the
    // illegal/error path. Expanded rows render it in the same note block as
    // informational annotations; collapsed rows render it as its own note
    // line (a legal row gives no signal to expand, so the note must be
    // visible collapsed).
    const createEntryWithNotice = (
      diagnostics: AvailableRuleEntry['diagnostics']
    ): AvailableRuleEntry => ({
      rule: {
        id: 'record-tormentor-damage',
        description: 'Record Vehicle Damage',
        activities: [],
        ui: {
          name: 'rule.tormentor.record-damage.name',
          primaryControl: {
            type: 'slider',
            var: 'amount',
            min: { number: 0 },
            max: { fact: 'hp.max' },
            unit: 'hp'
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics
    });

    it('renders a notice diagnostic as an informational note on the panel', () => {
      const entry = createEntryWithNotice([
        { code: 'rule.tormentor.record-damage.below_threshold', severity: 'notice' }
      ]);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {} }
      });
      const block = container.querySelector('.panel-renderer__annotations');
      expect(block).toBeTruthy();
      const note = block!.querySelector('.panel-renderer__annotation');
      expect(note).toBeTruthy();
      expect(note!.textContent).toContain('rule.tormentor.record-damage.below_threshold');
    });

    it('renders notice diagnostics beside informational annotations in one note block', () => {
      const entry = createEntryWithNotice([
        { code: 'rule.tormentor.record-damage.below_threshold', severity: 'notice' }
      ]);
      const annotations: Annotation[] = [
        { key: 'play.annotations.some-buff', targets: ['attack.any'] }
      ];
      const { container } = render(PanelRenderer, {
        props: {
          entry: {
            ...entry,
            rule: { ...entry.rule, ui: { ...entry.rule.ui!, annotationLabels: ['attack.any'] } }
          },
          editable: true,
          facts: {},
          activeAnnotations: annotations
        }
      });
      const notes = container.querySelectorAll('.panel-renderer__annotation');
      expect(notes.length).toBe(2);
    });

    it('renders no note block for a legal row with no diagnostics', () => {
      const { container } = render(PanelRenderer, {
        props: { entry: createEntryWithNotice([]), editable: true, facts: {} }
      });
      expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
    });

    it('renders no note block for error diagnostics alone — those ride the illegal warning path', () => {
      // An error diagnostic flips the row illegal (plan fold), and its message
      // renders through the warning indicator — the note block is for
      // informational notices only.
      const { container } = render(PanelRenderer, {
        props: {
          entry: createEntryWithNotice([{ code: 'some.error.code', severity: 'error' }]),
          editable: true,
          facts: {}
        }
      });
      expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
    });

    it('shows the notice on the collapsed (summary) row as its own note line', () => {
      // A legal row gives the player no signal to expand, so the notice must
      // be visible without expanding — the at-a-glance risk warning is the
      // whole point of the note. The line reuses the expanded note block's
      // classes and renders once (never beside the expanded copy).
      const entry = createEntryWithNotice([
        { code: 'rule.tormentor.record-damage.below_threshold', severity: 'notice' }
      ]);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const block = container.querySelector('.panel-renderer__annotations');
      expect(block).toBeTruthy();
      expect(block!.textContent).toContain('rule.tormentor.record-damage.below_threshold');
      expect(container.querySelectorAll('.panel-renderer__annotation').length).toBe(1);
    });

    it('renders the notice exactly once on an expanded row (no collapsed duplicate)', () => {
      const entry = createEntryWithNotice([
        { code: 'rule.tormentor.record-damage.below_threshold', severity: 'notice' }
      ]);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: false }
      });
      expect(container.querySelectorAll('.panel-renderer__annotation').length).toBe(1);
    });

    it('renders no note line on a collapsed row without notice diagnostics', () => {
      const { container } = render(PanelRenderer, {
        props: { entry: createEntryWithNotice([]), editable: true, facts: {}, summary: true }
      });
      expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
    });

    it('renders no note line on a collapsed row for error diagnostics alone', () => {
      const { container } = render(PanelRenderer, {
        props: {
          entry: createEntryWithNotice([{ code: 'some.error.code', severity: 'error' }]),
          editable: true,
          facts: {},
          summary: true
        }
      });
      expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
    });

    it('interpolates the notice diagnostic params into the note line', () => {
      // The Tormentor Dash risk note carries the live per-encounter allowance
      // as Diagnostic.params (the app tracks no counter — the note is what
      // the player counts by). The rendered line must show the NUMBER
      // ("Dash 5 times"), never the template slot.
      const entry = createEntryWithNotice([
        { code: 'rule.tormentor.dash.risk', severity: 'notice', params: { allowance: 5 } }
      ]);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const block = container.querySelector('.panel-renderer__annotations');
      expect(block).toBeTruthy();
      expect(block!.textContent).toContain('Dash 5 times');
      expect(block!.textContent).not.toContain('{{allowance}}');
    });

    it('interpolates a re-derived allowance — CON 18 reads 7, never a baked total', () => {
      // The allowance is computed from the facts at fold time, so a re-baked
      // stat block moves the number in the params; the note renders whatever
      // it is handed.
      const entry = createEntryWithNotice([
        { code: 'rule.tormentor.dash.risk', severity: 'notice', params: { allowance: 7 } }
      ]);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: false }
      });
      const notes = container.querySelectorAll('.panel-renderer__annotation');
      expect(notes.length).toBe(1);
      expect(notes[0]!.textContent).toContain('Dash 7 times');
      expect(notes[0]!.textContent).not.toContain('{{allowance}}');
    });
  });
});
