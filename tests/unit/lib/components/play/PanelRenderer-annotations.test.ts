import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';
import type { Annotation } from '$lib/rules-view';
import type { EffectInstance } from '$lib/rules-engine';

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
});

// --- the Frightened LoS toggle (v2: persistent global toggle, chip-styled, immediate) ---

const CF = 'rule.dnd-5e-2024.condition-frightened';

const hideEffect = (): EffectInstance => ({
  id: 'frightened-source-hidden',
  key: 'frightened-source',
  state: { 'frightened.sourceHidden': 1 },
  expiry: { kind: 'untilShortRest' }
});

const revealEffect = (): EffectInstance => ({
  id: 'frightened-source-visible',
  key: 'frightened-source',
  expiry: { kind: 'untilShortRest' }
});

/** The annotation the module emits while frightened (both surfaces on one payload). */
const frightenedToggleAnnotation = (): Annotation => ({
  key: `${CF}.notice`,
  targets: ['notice', 'dice.any'],
  toggle: {
    offFact: 'frightened.sourceHidden',
    onLabelKey: `${CF}.fear-source-in-sight`,
    offLabelKey: `${CF}.fear-source-out-of-sight`,
    onEffect: hideEffect(),
    offEffect: revealEffect(),
    governs: ['attack.str.disadvantage', 'check.disadvantage'],
    // The authored committed gate: the condition effect's key. A planned-only
    // record row advertises the same facts, so this key — checked against the
    // COMMITTED effect keys — is what keeps the chip off cancelled projections.
    committedKey: 'frightened'
  }
});

/** The committed keys of a COMMITTED frightened condition (post-endTurn). */
const frightenedCommitted = (): Set<string> => new Set(['frightened']);

/** A greataxe-shaped row: labels carry dice.any, its d20 reads a governed fact. */
const createFrightenedEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe',
    description: 'Greataxe',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.attacks.greataxe.name',
      annotationLabels: ['attack.any', 'attack.melee', 'attack.weapon', 'dice.any'],
      primaryControl: {
        type: 'dice-line',
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
          { sides: { var: 'damageDie' }, bonus: { var: 'damageBonus' }, purpose: 'damage' }
        ],
        advantage: { fact: 'attack.str.disadvantage' }
      }
    },
    vars: {
      hitBonus: { default: { number: 5 } },
      damageDie: { default: { number: 12 } },
      damageBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - annotations - the toggle channel', () => {
  it('resolves the toggle from the live facts and renders it as the dice-line chip', () => {
    const { container } = render(PanelRenderer, {
      props: {
        entry: createFrightenedEntry(),
        editable: true,
        facts: { 'condition.frightened': 1 },
        activeAnnotations: [frightenedToggleAnnotation()],
        committedEffectKeys: frightenedCommitted(),
        onFollowup: () => {}
      }
    });

    const toggle = container.querySelector<HTMLButtonElement>('button.panel-renderer__toggle');
    expect(toggle, 'the chip renders on the governed dice line').not.toBeNull();
    // In sight (offFact reads 0): pressed, filled, "in sight" label.
    expect(toggle!.getAttribute('aria-pressed')).toBe('true');
    expect(toggle!.classList.contains('panel-renderer__modifier--on')).toBe(true);
    expect(toggle!.textContent).toContain(`${CF}.fear-source-in-sight`);
  });

  it('hidden facts flip the resolved chip — and it does not render as a text annotation', () => {
    const { container } = render(PanelRenderer, {
      props: {
        entry: createFrightenedEntry(),
        editable: true,
        facts: { 'condition.frightened': 1, 'frightened.sourceHidden': 1 },
        activeAnnotations: [frightenedToggleAnnotation()],
        committedEffectKeys: frightenedCommitted(),
        onFollowup: () => {}
      }
    });

    const toggle = container.querySelector<HTMLButtonElement>('button.panel-renderer__toggle')!;
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(toggle.classList.contains('panel-renderer__modifier--on')).toBe(false);
    expect(toggle.textContent).toContain(`${CF}.fear-source-out-of-sight`);

    // The toggle-carrying annotation is REPRESENTED by its chip, exactly as a
    // valued rider is — a second, static copy of the notice text on the panel
    // would double up and outlive the flip.
    expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
  });

  it("a tap routes the CURRENT state's effect through the panel's follow-up handler", async () => {
    const onFollowup = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry: createFrightenedEntry(),
        editable: true,
        facts: { 'condition.frightened': 1 },
        activeAnnotations: [frightenedToggleAnnotation()],
        committedEffectKeys: frightenedCommitted(),
        onFollowup
      }
    });

    await fireEvent.click(
      container.querySelector<HTMLButtonElement>('button.panel-renderer__toggle')!
    );
    expect(onFollowup).toHaveBeenCalledTimes(1);
    expect(onFollowup).toHaveBeenCalledWith(hideEffect());
  });

  it('a hidden tap routes the reveal eviction through the same channel', async () => {
    const onFollowup = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry: createFrightenedEntry(),
        editable: true,
        facts: { 'condition.frightened': 1, 'frightened.sourceHidden': 1 },
        activeAnnotations: [frightenedToggleAnnotation()],
        committedEffectKeys: frightenedCommitted(),
        onFollowup
      }
    });

    await fireEvent.click(
      container.querySelector<HTMLButtonElement>('button.panel-renderer__toggle')!
    );
    expect(onFollowup).toHaveBeenCalledWith(revealEffect());
  });

  it('no follow-up handler: the chip still shows the state, as a non-committing span', () => {
    const { container } = render(PanelRenderer, {
      props: {
        entry: createFrightenedEntry(),
        editable: true,
        facts: { 'condition.frightened': 1 },
        activeAnnotations: [frightenedToggleAnnotation()],
        committedEffectKeys: frightenedCommitted()
      }
    });

    expect(container.querySelector('button.panel-renderer__toggle')).toBeNull();
    const span = container.querySelector<HTMLElement>('span.panel-renderer__toggle');
    expect(span).not.toBeNull();
    expect(span!.textContent).toContain(`${CF}.fear-source-in-sight`);
  });

  it('committed gate denied (a merely PLANNED condition): no chip, no text fallback', () => {
    // The facts read exactly as committed — a planned record-frightened row
    // advertises the same condition fact into the fold — but the keyed effect
    // is not in the committed set, so the chip (whose tap would commit
    // persistent state for a projection the player can still cancel) must not
    // exist in ANY form.
    const { container } = render(PanelRenderer, {
      props: {
        entry: createFrightenedEntry(),
        editable: true,
        facts: { 'condition.frightened': 1 },
        activeAnnotations: [frightenedToggleAnnotation()],
        committedEffectKeys: new Set<string>(),
        onFollowup: () => {}
      }
    });

    expect(container.querySelector('button.panel-renderer__toggle')).toBeNull();
    expect(container.querySelector('span.panel-renderer__toggle')).toBeNull();
    // Still chip-represented: the gated annotation must not fall back to a
    // static text chip on the panel either (the representation rule holds in
    // both gate states; the NOTICE strip's half is unaffected).
    expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
  });

  it('no committed-effect keys wired: a gated toggle is DENIED, not shown ungated', () => {
    // A mount that does not know the committed set (a picker panel) must not
    // get the chip by default — deny, like `addableOfferIds`, never allow.
    const { container } = render(PanelRenderer, {
      props: {
        entry: createFrightenedEntry(),
        editable: true,
        facts: { 'condition.frightened': 1 },
        activeAnnotations: [frightenedToggleAnnotation()],
        onFollowup: () => {}
      }
    });

    expect(container.querySelector('button.panel-renderer__toggle')).toBeNull();
    expect(container.querySelector('span.panel-renderer__toggle')).toBeNull();
  });
});
