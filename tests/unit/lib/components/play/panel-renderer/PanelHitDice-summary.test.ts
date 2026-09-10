import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

// Mirrors the control authored on `record-short-rest` (core-events.ts):
// pools per die size resolved from `hitDie.*` facts, CON bonus, hp unit.
const createHitDiceEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'record-short-rest',
    description: 'Short Rest',
    activities: [],
    ui: {
      section: 'rest',
      name: 'planner.record.rest.short',
      primaryControl: {
        type: 'hit-dice',
        unit: 'hp',
        bonus: { fact: 'con.modifier' },
        pools: [6, 8, 10, 12].map((sides) => ({
          sides,
          total: { fact: `hitDie.d${sides}.total` },
          remaining: { fact: `hitDie.d${sides}.remaining` }
        }))
      }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

const baseFacts = (): Record<string, number> => ({
  'con.modifier': 2,
  'hp.modifier.current': -20,
  'hitDie.d6.total': 0,
  'hitDie.d6.remaining': 0,
  'hitDie.d8.total': 0,
  'hitDie.d8.remaining': 0,
  'hitDie.d10.total': 4,
  'hitDie.d10.remaining': 3,
  'hitDie.d12.total': 0,
  'hitDie.d12.remaining': 0
});

describe('PanelHitDice - summary short form', () => {
  it('renders "remaining/total dSize" for a single pool', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), summary: true }
    });
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    expect(hitDice?.textContent?.trim()).toBe('3/4 d10');
  });

  it('renders every pool with a die total > 0, one after another', () => {
    const entry = createHitDiceEntry();
    const facts = {
      ...baseFacts(),
      'hitDie.d8.total': 2,
      'hitDie.d8.remaining': 2
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, summary: true }
    });
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    const text = hitDice?.textContent?.replace(/\s+/g, ' ').trim();
    expect(text).toContain('2/2 d8');
    expect(text).toContain('3/4 d10');
  });

  it('skips pools whose total resolves to 0', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), summary: true }
    });
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    expect(hitDice?.textContent).not.toContain('d6');
    expect(hitDice?.textContent).not.toContain('d8');
    expect(hitDice?.textContent).not.toContain('d12');
  });

  it('renders no buttons (nothing focusable) in summary mode', () => {
    const entry = createHitDiceEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: baseFacts(), summary: true }
    });
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('reduces the shown remaining count for slots spent by an earlier rest', () => {
    // 6 d10 total, 5 remaining (post-plan): one committed spend from an
    // earlier rest, no rolls of this row's own — same committed-based
    // threshold the non-summary pool aria-label announces.
    const entry = createHitDiceEntry();
    const facts = {
      ...baseFacts(),
      'hitDie.d10.total': 6,
      'hitDie.d10.remaining': 5
    };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, summary: true }
    });
    const hitDice = container.querySelector('.panel-renderer__hit-dice-summary');
    expect(hitDice?.textContent?.trim()).toBe('5/6 d10');
  });
});
