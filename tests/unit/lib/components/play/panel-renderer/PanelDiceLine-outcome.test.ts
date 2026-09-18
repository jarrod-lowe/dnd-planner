import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { DiceLineControl } from '$lib/components/play/panel-renderer/types';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

// Mirrors the concentration check the engine authors: a d20 save die whose
// natural persists via writeBack, compared against an `outcomeVs` target (the
// captured DC) once a roll exists. The i18n mock (tests/setup.ts) echoes keys
// it has no template for, so asserting the RAW KEY proves the label is routed
// through $t rather than hardcoded English.
const createCheckEntry = (withOutcomeVs = true): AvailableRuleEntry => ({
  rule: {
    id: 'concentration-check',
    description: 'Concentration Check',
    activities: [],
    ui: {
      section: 'free',
      name: 'planner.concentration.check.name',
      primaryControl: {
        type: 'dice-line',
        ...(withOutcomeVs ? { outcomeVs: { var: 'dc' } } : {}),
        dice: [
          {
            sides: 20,
            bonus: { var: 'saveBonus' },
            purpose: 'save',
            writeBack: { var: 'roll' }
          }
        ]
      }
    },
    vars: {
      saveBonus: { default: { number: 3 } },
      // The DC is a captured var whose default reads the derived fact, so a
      // row added before the fact exists resolves nothing — the shape the
      // "fails to resolve" test below needs to be genuine rather than vacuous.
      dc: { default: { fact: 'concentration.dc' } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelDiceLine - outcome chip', () => {
  it('shows the pass chip when natural plus the authored bonus meets the target', () => {
    const entry = createCheckEntry();
    // Kept natural 14 + authored save bonus 3 = 17 vs DC 12.
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { roll: 14, dc: 12 } }
    });
    const chip = container.querySelector('.panel-renderer__outcome');
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toBe('planner.record.passed');
    expect(chip?.classList.contains('panel-renderer__outcome--pass')).toBe(true);
    expect(chip?.classList.contains('panel-renderer__outcome--fail')).toBe(false);
    expect(chip?.getAttribute('aria-live')).toBe('polite');
    // It sits after the die chip it pronounces on, not before it.
    const dieChip = container.querySelector('.panel-renderer__die-chip');
    expect(
      (dieChip as Node).compareDocumentPosition(chip as Node) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('passes at exactly the target (a save at the DC succeeds)', () => {
    const entry = createCheckEntry();
    // 9 + 3 = 12 === DC 12 — the boundary passes.
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { roll: 9, dc: 12 } }
    });
    const chip = container.querySelector('.panel-renderer__outcome');
    expect(chip?.textContent).toBe('planner.record.passed');
    expect(chip?.classList.contains('panel-renderer__outcome--pass')).toBe(true);
  });

  it('shows the fail chip below the target', () => {
    const entry = createCheckEntry();
    // 8 + 3 = 11 < DC 12.
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { roll: 8, dc: 12 } }
    });
    const chip = container.querySelector('.panel-renderer__outcome');
    expect(chip?.textContent).toBe('planner.record.failed');
    expect(chip?.classList.contains('panel-renderer__outcome--fail')).toBe(true);
    expect(chip?.classList.contains('panel-renderer__outcome--pass')).toBe(false);
  });

  it('renders nothing before the die is rolled', () => {
    const entry = createCheckEntry();
    // The DC is already captured; the roll is not. An unrolled line must not
    // announce a "failed" outcome off an unset roll.
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { dc: 12 } }
    });
    expect(container.querySelector('.panel-renderer__outcome')).toBeNull();
  });

  it('renders nothing without outcomeVs even when a roll exists', () => {
    const entry = createCheckEntry(false);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { roll: 14 } }
    });
    expect(container.querySelector('.panel-renderer__outcome')).toBeNull();
    // The rolled chip itself still shows its total.
    const dieChip = container.querySelector('.panel-renderer__die-chip');
    expect(dieChip?.textContent?.trim()).toBe('17');
  });

  it('renders nothing when outcomeVs fails to resolve', () => {
    const entry = createCheckEntry();
    // `dc` neither rides selections nor has a default here — the target is
    // unset, so there is nothing to compare against.
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { roll: 14 } }
    });
    expect(container.querySelector('.panel-renderer__outcome')).toBeNull();
  });

  it('excludes situational modifier toggles from the comparison', () => {
    // 9 + authored 3 = 12 vs target 13 → FAILED. The Aura modifier is
    // switched ON by default and would total 15 (pass) if wrongly folded in
    // — but toggles are ephemeral panel state the engine's apply never sees,
    // so the chip must compare the authored bonus alone.
    const control = {
      type: 'dice-line',
      outcomeVs: { number: 13 },
      dice: [
        {
          sides: 20,
          bonus: { number: 3 },
          purpose: 'save',
          writeBack: { var: 'roll' }
        }
      ]
    } as DiceLineControl;
    const modifiers = [
      {
        key: 'aura',
        label: 'rule.demo.aura',
        appliesTo: 'save' as const,
        value: 3,
        defaultOn: true
      }
    ];
    const { container } = render(PanelDiceLine, {
      props: { control, editable: true, facts: {}, vars: {}, selections: { roll: 9 }, modifiers }
    });
    const chip = container.querySelector('.panel-renderer__outcome');
    expect(chip?.textContent).toBe('planner.record.failed');
  });

  it('renders the chip in the collapsed summary strip, non-interactively', () => {
    const entry = createCheckEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { roll: 8, dc: 12 }, summary: true }
    });
    const chip = container.querySelector('.panel-renderer__outcome');
    expect(chip).not.toBeNull();
    expect(chip?.tagName).toBe('SPAN');
    expect(chip?.textContent).toBe('planner.record.failed');
    expect(chip?.getAttribute('aria-live')).toBe('polite');
    // The summary strip stays non-interactive: no button, input, or tabindex.
    expect(container.querySelectorAll('button, input, a[href], [tabindex]').length).toBe(0);
  });
});
