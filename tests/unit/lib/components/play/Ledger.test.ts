import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import Ledger from '$lib/components/play/Ledger.svelte';
import type { UiEntry } from '$lib/play/extractTopBar';
import type { Facts } from '$lib/rules-view';

// i18n mock - returns key as text
const translations: Record<string, string> = {
  'play.ledger.title': 'Resources',
  'play.ledger.overBudget': 'Over budget',
  'play.stats.hp': 'HP',
  'play.stats.actions': 'Actions',
  'play.stats.hitDie': 'Hit Die d{{dieSize}}',
  'play.companion.steed': 'Steed',
  'play.ledger.short.hp': 'HP',
  'play.ledger.short.actions': 'ACT',
  'play.ledger.short.hitDie': 'HD'
};

// The i18n mock returns the key as text for unmatched keys, interpolating
// {{param}} placeholders when params are present (like the real sveltekit-i18n).
vi.mock('$lib/i18n', () => ({
  t: readable((key: string, params?: Record<string, unknown>) => {
    const template = translations[key] ?? key;
    if (!params) return template;
    return Object.entries(params).reduce(
      (text, [k, v]) => text.replaceAll(`{{${k}}}`, String(v)),
      template
    );
  }),
  locale: {
    ...readable('en'),
    set: vi.fn()
  },
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en', 'en-x-tlh']
}));

// Mock Element.prototype.animate for JSDOM
if (!Element.prototype.animate) {
  Element.prototype.animate = vi.fn().mockReturnValue({
    finished: Promise.resolve(),
    cancel: vi.fn()
  });
}

describe('Ledger', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  function renderComponent(
    resourceEntries: UiEntry[] = [],
    facts: Facts = {},
    extraProps: Record<string, unknown> = {}
  ) {
    mount(Ledger, {
      target: container,
      props: {
        resourceEntries,
        facts,
        ...extraProps
      }
    });
  }

  it('renders no cells when resourceEntries is empty', () => {
    renderComponent([]);
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(0);
  });

  it('renders usedMax entry as remaining/total cell', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.stats.hp',
          total: 'hp.max',
          remaining: 'hp.current'
        } satisfies UiEntry
      ],
      { 'hp.max': 35, 'hp.current': 28 }
    );
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(1);
    expect(cells[0].textContent).toContain('28/35');
    expect(cells[0].textContent).toContain('HP');
  });

  it('renders hitDie entry as remaining/total dX cell', () => {
    renderComponent(
      [
        {
          type: 'hitDie',
          label: 'play.stats.hitDie',
          nameParams: { dieSize: 8 },
          total: 'hitDie.d8.total',
          remaining: 'hitDie.d8.remaining',
          dieSize: 8
        } satisfies UiEntry
      ],
      { 'hitDie.d8.total': 5, 'hitDie.d8.remaining': 3 }
    );
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(1);
    expect(cells[0].textContent).toContain('3/5 d8');
  });

  it('renders one cell per hit-die size for a multiclass character (3d10 + 2d6)', () => {
    // Exactly the entries deriveResourceEntries emits for a multiclass
    // character: two hitDie entries sharing one label key, distinguished by
    // their fact refs and the {{dieSize}} nameParam the label interpolates.
    renderComponent(
      [
        {
          type: 'hitDie',
          label: 'play.stats.hitDie',
          nameParams: { dieSize: 10 },
          total: 'hitDie.d10.total',
          remaining: 'hitDie.d10.remaining',
          dieSize: 10
        },
        {
          type: 'hitDie',
          label: 'play.stats.hitDie',
          nameParams: { dieSize: 6 },
          total: 'hitDie.d6.total',
          remaining: 'hitDie.d6.remaining',
          dieSize: 6
        }
      ] satisfies UiEntry[],
      {
        'hitDie.d10.total': 3,
        'hitDie.d10.remaining': 2,
        'hitDie.d6.total': 2,
        'hitDie.d6.remaining': 1
      }
    );
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(2);
    expect(container.textContent).toContain('2/3 d10');
    expect(container.textContent).toContain('1/2 d6');
    // Screen-reader labels carry the die size so the two rows differ.
    const labels = Array.from(cells).map((c) => c.getAttribute('aria-label'));
    expect(labels).toContain('Hit Die d10: 2 of 3');
    expect(labels).toContain('Hit Die d6: 1 of 2');
  });

  it('hides entry when not visible (total is 0)', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.stats.actions',
          total: 'actions.max',
          remaining: 'actions.remaining'
        } satisfies UiEntry
      ],
      { 'actions.max': 0, 'actions.remaining': 0 }
    );
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(0);
  });

  it('applies muted style when remaining is zero (depleted)', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.stats.actions',
          total: 'actions.max',
          remaining: 'actions.remaining'
        } satisfies UiEntry
      ],
      { 'actions.max': 1, 'actions.remaining': 0 }
    );
    const cell = container.querySelector('.ledger__cell--muted');
    expect(cell).toBeTruthy();
  });

  it('applies muted style when remaining is negative (overdrawn)', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.stats.actions',
          total: 'actions.max',
          remaining: 'actions.remaining'
        } satisfies UiEntry
      ],
      { 'actions.max': 2, 'actions.remaining': -2 }
    );
    const cell = container.querySelector('.ledger__cell--muted');
    expect(cell).toBeTruthy();
  });

  it('does not apply muted style when remaining equals total (full = available)', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.stats.actions',
          total: 'actions.max',
          remaining: 'actions.remaining'
        } satisfies UiEntry
      ],
      { 'actions.max': 1, 'actions.remaining': 1 }
    );
    const cell = container.querySelector('.ledger__cell--muted');
    expect(cell).toBeNull();
  });

  it('applies warning style to the cell that is actually overdrawn (remaining < 0)', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.stats.actions',
          total: 'actions.max',
          remaining: 'actions.remaining'
        } satisfies UiEntry
      ],
      { 'actions.max': 1, 'actions.remaining': -1 },
      { status: { legal: false } }
    );
    const cell = container.querySelector('.ledger__cell--warn');
    expect(cell).toBeTruthy();
  });

  it('does not flag a spent-but-in-budget resource as over budget when another is overspent', () => {
    // Regression: overspending one resource (actions) must NOT paint other
    // legitimately-spent resources (movement) as over budget. Only the overdrawn
    // cell warns; the global status.legal drives the plan-level badge, not every
    // cell that happens to have been spent.
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.stats.actions',
          total: 'actions.max',
          remaining: 'actions.remaining'
        },
        {
          type: 'usedMax',
          label: 'play.stats.movement',
          total: 'character.movement.total',
          remaining: 'character.movement.remaining'
        }
      ] satisfies UiEntry[],
      {
        'actions.max': 1,
        'actions.remaining': -1,
        'character.movement.total': 30,
        'character.movement.remaining': 25
      },
      { status: { legal: false } }
    );
    const warnCells = container.querySelectorAll('.ledger__cell--warn');
    // Exactly one cell warns — the overdrawn actions cell, not the in-budget move.
    expect(warnCells.length).toBe(1);
    expect(warnCells[0].textContent).toContain('-1/1');
    // The plan-level "Over budget" badge still shows (global indicator).
    expect(container.querySelector('.ledger__warn-badge')).toBeTruthy();
  });

  it('uses label from entry for display', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.stats.actions',
          total: 'actions.max',
          remaining: 'actions.remaining'
        } satisfies UiEntry
      ],
      { 'actions.max': 1, 'actions.remaining': 0 }
    );
    const cell = container.querySelector('.ledger__cell');
    const label = container.querySelector('.ledger__cell-label');
    // Visible label is the compact short form...
    expect(label?.textContent).toBe('ACT');
    // ...while the full name (label + counts) is preserved for screen readers
    // and hover, which now agree.
    expect(cell?.getAttribute('title')).toBe('Actions: 0 of 1');
    expect(cell?.getAttribute('aria-label')).toBe('Actions: 0 of 1');
  });

  it('uses nameParams for parameterized labels', () => {
    renderComponent(
      [
        {
          type: 'hitDie',
          label: 'play.stats.hitDie',
          nameParams: { dieSize: 8 },
          total: 'hitDie.d8.total',
          remaining: 'hitDie.d8.remaining',
          dieSize: 8
        } satisfies UiEntry
      ],
      { 'hitDie.d8.total': 5, 'hitDie.d8.remaining': 3 }
    );
    const label = container.querySelector('.ledger__cell-label');
    expect(label?.textContent).toBe('HD');
  });

  it('renders multiple resource entries', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.stats.hp',
          total: 'hp.max',
          remaining: 'hp.current'
        },
        {
          type: 'usedMax',
          label: 'play.stats.actions',
          total: 'actions.max',
          remaining: 'actions.remaining'
        }
      ] satisfies UiEntry[],
      { 'hp.max': 35, 'hp.current': 28, 'actions.max': 1, 'actions.remaining': 0 }
    );
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(2);
  });
});

describe('Ledger — subject filtering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  const playerHpEntry: UiEntry = {
    type: 'usedMax',
    label: 'play.stats.hp',
    total: 'hp.max',
    remaining: 'hp.current'
  };

  const steedHpEntry: UiEntry = {
    type: 'usedMax',
    label: 'play.stats.steed.hp',
    total: 'companion.steed.hp.max',
    remaining: 'companion.steed.hp.current',
    subject: 'steed'
  };

  const steedActionsEntry: UiEntry = {
    type: 'usedMax',
    label: 'play.stats.steed.actions',
    total: 'companion.steed.actions.max',
    remaining: 'companion.steed.actions.remaining',
    subject: 'steed'
  };

  const allEntries: UiEntry[] = [playerHpEntry, steedHpEntry, steedActionsEntry];

  const allFacts = {
    'hp.max': 35,
    'hp.current': 28,
    'companion.steed.hp.max': 15,
    'companion.steed.hp.current': 10,
    'companion.steed.actions.max': 1,
    'companion.steed.actions.remaining': 1
  };

  it('shows player entries when activeSubject is undefined', () => {
    mount(Ledger, {
      target: container,
      props: {
        resourceEntries: allEntries,
        facts: allFacts,
        activeSubject: undefined
      }
    });
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(1);
    expect(cells[0].textContent).toContain('28/35');
  });

  it('shows steed entries when activeSubject is steed', () => {
    mount(Ledger, {
      target: container,
      props: {
        resourceEntries: allEntries,
        facts: allFacts,
        activeSubject: 'steed'
      }
    });
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(2);
    expect(container.textContent).toContain('10/15');
    // Player HP should NOT appear
    expect(container.textContent).not.toContain('28/35');
  });

  it('shows no cells when activeSubject does not match any entries', () => {
    mount(Ledger, {
      target: container,
      props: {
        resourceEntries: allEntries,
        facts: allFacts,
        activeSubject: 'familiar'
      }
    });
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(0);
  });
});
