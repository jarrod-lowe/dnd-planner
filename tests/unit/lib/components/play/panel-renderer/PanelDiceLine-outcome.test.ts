import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import PanelDiceLine from '$lib/components/play/panel-renderer/PanelDiceLine.svelte';
import type { DiceLineControl, RollModifier } from '$lib/components/play/panel-renderer/types';
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

// The rider-capturing concentration shape: the same d20 save die, but its
// writeBack names a riderVar, so the roll persists the active modifier total
// beside the natural — and the outcome chip must judge the SAME total the
// engine re-reads (natural + authored bonus + the rider captured at roll
// time), never the natural alone.
const createRiderCheckControl = (): DiceLineControl => ({
  type: 'dice-line',
  outcomeVs: { number: 12 },
  dice: [
    {
      sides: 20,
      bonus: { number: 1 },
      purpose: 'save',
      writeBack: { var: 'roll', riderVar: 'riderBonus' }
    }
  ]
});

/** The Aura of Protection chip the concentration panel surfaces on saves. */
const aura = (defaultOn: boolean): RollModifier => ({
  key: 'aura',
  label: 'rule.demo.aura',
  appliesTo: 'save',
  value: 3,
  defaultOn
});

afterEach(() => {
  vi.restoreAllMocks();
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

  // The bug this branch fixes, pinned from the live roll side: the dice line
  // DISPLAYS natural + base + active modifiers (formatBonus folds the aura
  // in), so a natural 9 with the aura reads as 13 vs DC 12 — the chip used to
  // judge the natural and authored bonus alone (10) and announced failure
  // while the player watched a passing total. With a riderVar the roll
  // captures the rider and the chip judges the same 13.
  it('judges the rider the roll captured: natural 9 + base 1 + aura 3 vs 12 passes', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // floor(0.4*20)+1 = 9
    const { container } = render(PanelDiceLine, {
      props: {
        control: createRiderCheckControl(),
        editable: true,
        facts: {},
        vars: {},
        selections: {},
        modifiers: [aura(true)]
      }
    });
    await fireEvent.click(container.querySelector('.panel-renderer__die-chip')!);
    const chip = container.querySelector('.panel-renderer__outcome');
    expect(chip?.textContent).toBe('planner.record.passed');
    expect(chip?.classList.contains('panel-renderer__outcome--pass')).toBe(true);
  });

  it('fails the same natural when the rider is switched off — it never applied', async () => {
    // The aura chip starts OFF, so the roll captures a rider of 0: 9 + 1 + 0 =
    // 10 < 12 fails. The toggle state at ROLL time is what persists, exactly
    // as the engine's apply will re-read it.
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // floor(0.4*20)+1 = 9
    const { container } = render(PanelDiceLine, {
      props: {
        control: createRiderCheckControl(),
        editable: true,
        facts: {},
        vars: {},
        selections: {},
        modifiers: [aura(false)]
      }
    });
    await fireEvent.click(container.querySelector('.panel-renderer__die-chip')!);
    const chip = container.querySelector('.panel-renderer__outcome');
    expect(chip?.textContent).toBe('planner.record.failed');
    expect(chip?.classList.contains('panel-renderer__outcome--fail')).toBe(true);
  });

  it('judges the PERSISTED rider on a seeded roll without rolling', () => {
    // A re-mounted row carrying its persisted roll AND rider: the verdict
    // comes from selections (9 + 1 + 3 = 13 vs 12 → passed), matching the
    // engine's apply, which reads the same two selections — even though no
    // live modifier chip exists on the remounted line to re-derive it from.
    const { container } = render(PanelDiceLine, {
      props: {
        control: createRiderCheckControl(),
        editable: true,
        facts: {},
        vars: {},
        selections: { roll: 9, riderBonus: 3 }
      }
    });
    const chip = container.querySelector('.panel-renderer__outcome');
    expect(chip?.textContent).toBe('planner.record.passed');
  });
});

// The toggle-after-roll half of the chip==engine invariant: a modifier toggle
// is display state and must never hide or flip a RECORDED verdict. The
// engine's apply re-reads the persisted riderBonus the roll captured, so the
// chip keeps judging that captured rider — the alternative (clearing the roll
// on toggle) would un-render the verdict while the engine still resolved it.
describe('PanelDiceLine - outcome chip across a modifier toggle', () => {
  it('keeps judging the captured rider after the aura is toggled off', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4); // floor(0.4*20)+1 = 9
    const mods = [aura(true)];
    const propsFor = (selections: Record<string, unknown>) => ({
      control: createRiderCheckControl(),
      editable: true,
      facts: {},
      vars: {},
      selections,
      modifiers: mods
    });
    const { container, rerender } = render(PanelDiceLine, { props: propsFor({}) });
    await fireEvent.click(container.querySelector('.panel-renderer__die-chip')!);
    // The parent's round-trip: the plan row now carries what the roll wrote.
    await rerender(propsFor({ roll: 9, riderBonus: 3 }));

    // Rolled with the aura ON (9 + 1 + 3 = 13 ≥ 12 → passed). Toggling it off
    // moves the would-be total to 10 (a fail) — the verdict must stay the
    // roll-time one, re-seeded from the persisted pair.
    await fireEvent.click(container.querySelector('button.panel-renderer__modifier')!);
    const outcome = container.querySelector('.panel-renderer__outcome');
    expect(outcome).not.toBeNull();
    expect(outcome?.textContent).toBe('planner.record.passed');
    expect(outcome?.classList.contains('panel-renderer__outcome--pass')).toBe(true);
    // And the die chip beside it still shows the roll-time total.
    expect(container.querySelector('.panel-renderer__die-chip')?.textContent?.trim()).toBe('13');
  });
});
