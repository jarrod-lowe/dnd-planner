import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule, Annotation } from '$lib/rules-view';

const createDiceLineEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe',
    description: 'Greataxe',
    activities: [],
    ui: {
      name: 'rule.attacks.greataxe.name',
      description: 'rule.attacks.greataxe.description',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      },
      followups: [
        {
          type: 'effect',
          button: 'rule.attacks.greataxe.followup',
          condition: { fact: 'always.true' },
          addRule: { effect: { id: 'x' } }
        }
      ],
      vars: {
        hitBonus: { default: { number: 5 } }
      }
    }
  } as unknown as Rule,
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

const createEntryWithGatedSecondary = (): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe-cleave',
    description: 'Greataxe',
    activities: [],
    ui: {
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      },
      secondaryControl: {
        type: 'dice-line',
        enabled: {
          condition: { fact: 'attack.greataxe.mastery', operator: 'equals', value: 1 },
          button: 'rule.attacks.greataxe-cleave.button'
        },
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      },
      vars: {
        hitBonus: { default: { number: 5 } }
      }
    }
  } as unknown as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - summary prop contract', () => {
  it('renders title and description when summary is false', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: false }
    });
    expect(container.querySelector('.panel-renderer__title')).toBeTruthy();
    expect(container.querySelector('.panel-renderer__description')).toBeTruthy();
  });

  it('renders the title but no description when summary is true', () => {
    // The header (title + warning) is the SAME code path in both modes — only
    // what sits below it (description, followups, etc.) is summary-only
    // suppressed. See docs/plans/ideas/better-summary-panels.md "Correction".
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.querySelector('.panel-renderer__title')).toBeTruthy();
    expect(container.querySelector('.panel-renderer__title')?.textContent).toContain(
      'rule.attacks.greataxe.name'
    );
    expect(container.querySelector('.panel-renderer__description')).toBeNull();
  });

  it('still renders the primary control in summary mode', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.querySelector('.panel-renderer__dice-line')).toBeTruthy();
  });

  it('suppresses followups in summary mode', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        facts: { 'always.true': true },
        summary: true,
        onFollowup: vi.fn()
      }
    });
    expect(container.querySelector('.panel-renderer__followups')).toBeNull();
  });

  it('renders followups when summary is false', () => {
    const entry = createDiceLineEntry();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        facts: { 'always.true': true },
        summary: false,
        onFollowup: vi.fn()
      }
    });
    expect(container.querySelector('.panel-renderer__followups')).toBeTruthy();
  });

  it('suppresses the secondary enable button in summary mode', () => {
    const entry = createEntryWithGatedSecondary();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        facts: { 'attack.greataxe.mastery': 1 },
        summary: true
      }
    });
    expect(container.querySelector('.panel-renderer__enable-button')).toBeNull();
  });

  it('shows the secondary enable button when summary is false', () => {
    const entry = createEntryWithGatedSecondary();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        facts: { 'attack.greataxe.mastery': 1 },
        summary: false
      }
    });
    expect(container.querySelector('.panel-renderer__enable-button')).toBeTruthy();
  });

  it('suppresses informational annotations in summary mode (they would render a second block-level line)', () => {
    const entry = createDiceLineEntry();
    const annotations: Annotation[] = [
      { key: 'play.annotations.some-buff', targets: ['attack.any'] }
    ];
    (entry.rule.ui as { annotationLabels?: string[] }).annotationLabels = ['attack.any'];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true, activeAnnotations: annotations }
    });
    expect(container.querySelector('.panel-renderer__annotations')).toBeNull();
  });

  it('still renders informational annotations when summary is false', () => {
    const entry = createDiceLineEntry();
    const annotations: Annotation[] = [
      { key: 'play.annotations.some-buff', targets: ['attack.any'] }
    ];
    (entry.rule.ui as { annotationLabels?: string[] }).annotationLabels = ['attack.any'];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: false, activeAnnotations: annotations }
    });
    expect(container.querySelector('.panel-renderer__annotations')).toBeTruthy();
  });

  it('renders exactly one interactive warning indicator in summary mode, from the same header PanelRenderer always owns', () => {
    // Corrected design (docs/plans/ideas/better-summary-panels.md "Correction
    // (2026-09-10)"): the header — title + WarningIndicator — is ONE code
    // path used by both modes, so the warning must still be present, and
    // still clickable, when collapsed. `PlanRow` no longer renders any copy
    // of its own.
    const entry: AvailableRuleEntry = {
      ...createDiceLineEntry(),
      legal: false,
      applicable: true,
      diagnostics: [{ code: 'play.diagnostics.someError', severity: 'error' }]
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    const warnings = container.querySelectorAll('.warning-indicator');
    expect(warnings.length).toBe(1);
    expect(warnings[0].tagName).toBe('BUTTON');
  });

  it('keeps the warning indicator interactive (a button) when summary is false', () => {
    const entry: AvailableRuleEntry = {
      ...createDiceLineEntry(),
      legal: false,
      applicable: true,
      diagnostics: [{ code: 'play.diagnostics.someError', severity: 'error' }]
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: false }
    });
    expect(container.querySelector('button.warning-indicator')).toBeTruthy();
  });

  it('reveals the warning message when the indicator is clicked in summary mode', async () => {
    const entry: AvailableRuleEntry = {
      ...createDiceLineEntry(),
      legal: false,
      applicable: true,
      diagnostics: [{ code: 'play.diagnostics.someError', severity: 'error' }]
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    const warning = container.querySelector('button.warning-indicator') as HTMLElement;
    expect(warning).toBeTruthy();
    expect(container.querySelector('.warning-tooltip')).toBeNull();

    await fireEvent.click(warning);

    const tooltip = container.querySelector('.warning-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip?.textContent).toContain('play.diagnostics.someError');
  });

  it('does not unmount the primary control instance when summary toggles', async () => {
    // PanelDiceLine keeps rolled results in local $state, cleared only by its own
    // dice/modifier-signature effect. If PanelRenderer wrapped the control render
    // in an {#if summary}...{:else}...{/if}, toggling `summary` would remount the
    // control and this roll would vanish.
    const entry = createDiceLineEntry();
    const { container, rerender } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: false }
    });
    const chip = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    expect(chip).toBeTruthy();
    await fireEvent.click(chip);
    const rolledText = chip.textContent;
    expect(rolledText).not.toBe('');

    await rerender({ entry, editable: true, facts: {}, summary: true });
    // The dice-line control is still present (not removed from the DOM), and
    // still shows the same rolled value rather than resetting to the expression.
    const chipAfter = container.querySelector('.panel-renderer__die-chip') as HTMLElement;
    expect(chipAfter).toBeTruthy();
    expect(chipAfter.textContent).toBe(rolledText);
  });
});
