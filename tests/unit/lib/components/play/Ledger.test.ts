import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushSync } from 'svelte';
import { readable } from 'svelte/store';
import Ledger from '$lib/components/play/Ledger.svelte';
import type { UiEntry } from '$lib/play/extractTopBar';
import type { Facts } from '$lib/rules-view';
import type { EffectInstance } from '$lib/rules-engine';

// i18n mock - returns key as text
const translations: Record<string, string> = {
  'play.ledger.title': 'Resources',
  'play.ledger.overBudget': 'Over budget',
  'play.stats.hp': 'HP',
  'play.stats.actions': 'Actions',
  'play.stats.hitDie': 'Hit Die d{{dieSize}}',
  // Deliberately distinctive so tests pin that the composition comes from
  // this key, not a hardcoded English "label: N of M" string.
  'play.stats.valueLabel': '{{label}} => {{remaining}} / {{total}}',
  'play.companion.steed': 'Steed',
  'play.ledger.short.hp': 'HP',
  'play.ledger.short.actions': 'ACT',
  'play.ledger.short.hitDie': 'HD',
  'play.stats.spellSlots': 'Spell Slots',
  'play.ledger.short.spellSlots': 'Cast',
  // Deliberately distinctive templates: the tests pin that every slot string
  // comes from the i18n system, not from hardcoded English in the component.
  'play.slots.toggle': 'Show spell slot breakdown',
  'play.slots.title': 'Spell slots',
  'play.slots.tilesLabel': 'Spell slots => {{summary}}',
  'play.slots.levelSummary': '{{open}} open at L{{level}}',
  'play.slots.summarySeparator': ' | ',
  'play.slots.noneOpen': 'nothing open',
  'play.tray.row':
    '{{name}}: {{open}} open, {{thisTurn}} this turn, {{spent}} spent, {{total}} total',
  'play.slots.levelName': 'Level {{level}}',
  'play.slots.levelTile': '{{level}}',
  'play.slots.legendTitle': 'Key',
  'play.slots.legend.open': 'Open',
  'play.slots.legend.thisTurn': 'This turn',
  'play.slots.legend.spent': 'Spent',
  // Action economy keys
  'play.economy.toggle': 'Show action economy breakdown',
  'play.stats.actions': 'Actions',
  'play.stats.bonusActions': 'Bonus Actions',
  'play.stats.reactions': 'Reactions',
  'play.economy.poolOpen': '{{name}}: {{open}} open',
  'play.economy.noneOpen': 'nothing open',
  'play.economy.summarySeparator': ' | ',
  'play.economy.tilesLabel': 'Action economy => {{summary}}',
  'play.ledger.short.steed.actions': 'ST.A',
  'play.stats.steed.actions': 'Steed Actions',
  'play.ledger.short.steed.bonusActions': 'ST.B',
  'play.stats.steed.bonusActions': 'Steed Bonus Actions'
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
    expect(labels).toContain('Hit Die d10 => 2 / 3');
    expect(labels).toContain('Hit Die d6 => 1 / 2');
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
    expect(cell?.getAttribute('title')).toBe('Actions => 0 / 1');
    expect(cell?.getAttribute('aria-label')).toBe('Actions => 0 / 1');
  });

  it('composes the aria-label and title from the play.stats.valueLabel template', () => {
    // The full "label + counts" string must come from the i18n system so
    // non-English locales translate the ": N of M" scaffolding too.
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
    expect(cell?.getAttribute('aria-label')).toBe('Actions => 0 / 1');
    expect(cell?.getAttribute('title')).toBe('Actions => 0 / 1');
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

describe('Ledger — spell slot cell', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  const slotEntry: UiEntry = {
    type: 'slotLevels',
    label: 'play.stats.spellSlots',
    levels: [1, 2]
  };

  /**
   * An advertised effect that spends one slot of `level` this turn — the shape
   * every slot-spending rule emits. `expiry` is required on EffectInstance, so
   * a bare `{ id, state }` literal would pass vitest but fail `pnpm check`.
   */
  function slotSpend(id: string, level: number): EffectInstance {
    return {
      id,
      state: { [`spellcasting.slots.level${level}.spent`]: 1 },
      expiry: { kind: 'untilLongRest' }
    };
  }

  function renderSlots(
    facts: Facts,
    effects: EffectInstance[] = [],
    entries: UiEntry[] = [slotEntry]
  ) {
    mount(Ledger, {
      target: container,
      props: { resourceEntries: entries, facts, effects }
    });
    flushSync();
  }

  function toggle(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('.ledger__slot-toggle');
    expect(button).toBeTruthy();
    return button as HTMLButtonElement;
  }

  function tileStates(): string[] {
    return Array.from(container.querySelectorAll<HTMLElement>('.ledger__slot-tile')).map((tile) => {
      if (tile.classList.contains('ledger__slot-tile--open')) return 'open';
      if (tile.classList.contains('ledger__slot-tile--this-turn')) return 'this-turn';
      if (tile.classList.contains('ledger__slot-tile--spent')) return 'spent';
      return 'unknown';
    });
  }

  function tileDigits(): (string | null)[] {
    return Array.from(container.querySelectorAll('.ledger__slot-tile')).map(
      (tile) => tile.textContent
    );
  }

  it('renders exactly ONE tile for a level, however many slots it holds', () => {
    // 4 slots, 1 spent earlier -> 3 open. The ledger answers "can I cast at
    // this level?", so it is one tile per LEVEL; the per-slot breakdown is the
    // tray's job.
    renderSlots({
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 1
    });
    expect(container.querySelectorAll('.ledger__cell').length).toBe(1);
    expect(container.querySelectorAll('.ledger__slot-tile').length).toBe(1);
    expect(tileStates()).toEqual(['open']);
    expect(tileDigits()).toEqual(['1']);
    // The short label is still the ledger's own cell-label element.
    expect(container.querySelector('.ledger__cell-label')?.textContent).toBe('Cast');
  });

  it('renders one tile per level, ascending, for a two-level caster', () => {
    // L1: 4 total, 2 spent earlier. L2: 2 total, none spent. Two levels, two
    // tiles — not six.
    renderSlots({
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 2,
      'spellcasting.slots.level2.total': 2,
      'spellcasting.slots.level2.spent': 0
    });
    expect(container.querySelectorAll('.ledger__slot-tile').length).toBe(2);
    expect(tileDigits()).toEqual(['1', '2']);
    expect(tileStates()).toEqual(['open', 'open']);
  });

  it('marks a level open while any slot remains, even with a spend this turn', () => {
    // 3 total, 1 spent by the current plan -> 2 still open. Open wins: the
    // question the tile answers is "castable right now?".
    renderSlots(
      {
        'spellcasting.slots.level1.total': 3,
        'spellcasting.slots.level1.spent': 1
      },
      [slotSpend('bless-slot', 1)]
    );
    expect(tileStates()).toEqual(['open']);
  });

  it('renders a hatched this-turn tile when the current plan exhausted the level', () => {
    // 2 total, both spent by this turn's plan -> nothing open, but removing a
    // plan row gets the level back, so it is the recoverable this-turn state.
    renderSlots(
      {
        'spellcasting.slots.level1.total': 2,
        'spellcasting.slots.level1.spent': 2
      },
      [slotSpend('bless-slot', 1), slotSpend('smite-slot', 1)]
    );
    expect(container.querySelectorAll('.ledger__slot-tile').length).toBe(1);
    expect(tileStates()).toEqual(['this-turn']);
  });

  it('renders a spent tile when the level was exhausted on earlier turns', () => {
    // 2 total, 2 spent, nothing advertised this turn -> gone until a rest.
    renderSlots({
      'spellcasting.slots.level1.total': 2,
      'spellcasting.slots.level1.spent': 2
    });
    expect(container.querySelectorAll('.ledger__slot-tile').length).toBe(1);
    expect(tileStates()).toEqual(['spent']);
  });

  it('prefers this-turn over spent when a closed level mixes both', () => {
    // 3 total: 2 spent earlier, 1 spent by the plan. Nothing open, but the
    // plan is what closed it, so the tile stays recoverable.
    renderSlots(
      {
        'spellcasting.slots.level1.total': 3,
        'spellcasting.slots.level1.spent': 3
      },
      [slotSpend('bless-slot', 1)]
    );
    expect(tileStates()).toEqual(['this-turn']);
  });

  it('renders a caret affordance, hidden from assistive tech, that reflects the open state', () => {
    // aria-expanded already carries the disclosure state, so the glyph must
    // add no screen-reader noise — it exists purely so sighted users can see
    // the cell opens.
    renderSlots({
      'spellcasting.slots.level1.total': 2,
      'spellcasting.slots.level1.spent': 0
    });
    const caret = container.querySelector('.ledger__slot-caret');
    expect(caret).toBeTruthy();
    expect(caret?.getAttribute('aria-hidden')).toBe('true');
    // It lives inside the toggle, so its rotation can key off aria-expanded.
    expect(toggle().contains(caret as Node)).toBe(true);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    toggle().click();
    flushSync();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.ledger__slot-caret')).toBeTruthy();
  });

  it('exposes the tile row as a single labelled image carrying the open-slot summary', () => {
    renderSlots({
      'spellcasting.slots.level1.total': 4,
      'spellcasting.slots.level1.spent': 2,
      'spellcasting.slots.level2.total': 1,
      'spellcasting.slots.level2.spent': 0
    });
    const tiles = container.querySelector('.ledger__slot-tiles');
    expect(tiles?.getAttribute('role')).toBe('img');
    expect(tiles?.getAttribute('aria-label')).toBe('Spell slots => 2 open at L1 | 1 open at L2');
    // Individual tiles are decorative — the row label carries the meaning.
    const decorative = Array.from(container.querySelectorAll('.ledger__slot-tile')).every(
      (tile) => tile.getAttribute('aria-hidden') === 'true'
    );
    expect(decorative).toBe(true);
  });

  it('falls back to the none-open phrase when every slot is spent', () => {
    renderSlots({
      'spellcasting.slots.level1.total': 2,
      'spellcasting.slots.level1.spent': 2
    });
    expect(container.querySelector('.ledger__slot-tiles')?.getAttribute('aria-label')).toBe(
      'Spell slots => nothing open'
    );
  });

  it('starts collapsed: no tray, aria-expanded false', () => {
    renderSlots({
      'spellcasting.slots.level1.total': 2,
      'spellcasting.slots.level1.spent': 0
    });
    expect(container.querySelector('.slot-tray')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-controls')).toBeTruthy();
  });

  it('opens the tray on click and points aria-controls at it', () => {
    renderSlots({
      'spellcasting.slots.level1.total': 2,
      'spellcasting.slots.level1.spent': 1
    });
    toggle().click();
    flushSync();

    const tray = container.querySelector('.slot-tray');
    expect(tray).toBeTruthy();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(tray?.id).toBe(toggle().getAttribute('aria-controls'));
    // The tray shows the per-level breakdown row.
    expect(container.querySelector('.slot-tray__row')?.getAttribute('aria-label')).toBe(
      'Level 1: 1 open, 0 this turn, 1 spent, 2 total'
    );
  });

  it('closes on Escape and returns focus to the toggle', () => {
    renderSlots({
      'spellcasting.slots.level1.total': 2,
      'spellcasting.slots.level1.spent': 0
    });
    toggle().focus();
    toggle().click();
    flushSync();
    expect(container.querySelector('.slot-tray')).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    flushSync();

    expect(container.querySelector('.slot-tray')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle());
  });

  it('closes on an outside click', () => {
    renderSlots({
      'spellcasting.slots.level1.total': 2,
      'spellcasting.slots.level1.spent': 0
    });
    toggle().click();
    flushSync();
    expect(container.querySelector('.slot-tray')).toBeTruthy();

    document.body.click();
    flushSync();
    expect(container.querySelector('.slot-tray')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('hides the cell when the character has no slots at any listed level', () => {
    renderSlots({
      'spellcasting.slots.level1.total': 0,
      'spellcasting.slots.level2.total': 0
    });
    expect(container.querySelectorAll('.ledger__cell').length).toBe(0);
  });

  it('keeps usedMax and hitDie cells rendering alongside the slot cell', () => {
    // Regression for the {#each} key widening: the key was `entry.total`, which
    // a slotLevels entry does not have. Existing cells must keep their identity.
    renderSlots(
      {
        'hp.max': 35,
        'hp.current': 28,
        'hitDie.d8.total': 5,
        'hitDie.d8.remaining': 3,
        'spellcasting.slots.level1.total': 2,
        'spellcasting.slots.level1.spent': 0
      },
      [],
      [
        { type: 'usedMax', label: 'play.stats.hp', total: 'hp.max', remaining: 'hp.current' },
        {
          type: 'hitDie',
          label: 'play.stats.hitDie',
          nameParams: { dieSize: 8 },
          total: 'hitDie.d8.total',
          remaining: 'hitDie.d8.remaining',
          dieSize: 8
        },
        slotEntry
      ]
    );
    expect(container.querySelectorAll('.ledger__cell').length).toBe(3);
    expect(container.textContent).toContain('28/35');
    expect(container.textContent).toContain('3/5 d8');
    // One level configured -> one tile.
    expect(container.querySelectorAll('.ledger__slot-tile').length).toBe(1);
  });
});

describe('Ledger — action economy cell', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  const economyEntry: UiEntry = {
    type: 'actionPools',
    label: 'play.stats.actions',
    factPrefix: '',
    pools: [
      { key: 'actions', label: 'play.stats.actions', shortLabel: 'play.stats.actions' },
      { key: 'bonusActions', label: 'play.stats.bonusActions', shortLabel: 'play.stats.bonusActions' },
      { key: 'reactions', label: 'play.stats.reactions', shortLabel: 'play.stats.reactions' }
    ]
  };

  /**
   * An advertised effect that spends one action-pool item this turn.
   */
  function actionSpend(id: string, poolKey: string, count: number = 1): EffectInstance {
    return {
      id,
      state: { [`${poolKey}.spent`]: count },
      expiry: { kind: 'untilLongRest' }
    };
  }

  function renderEconomy(
    facts: Facts,
    effects: EffectInstance[] = [],
    entries: UiEntry[] = [economyEntry],
    extraProps: Record<string, unknown> = {}
  ) {
    mount(Ledger, {
      target: container,
      props: { resourceEntries: entries, facts, effects, ...extraProps }
    });
    flushSync();
  }

  function toggle(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>('.ledger__slot-toggle');
    expect(button).toBeTruthy();
    return button as HTMLButtonElement;
  }

  function tileStates(): string[] {
    return Array.from(container.querySelectorAll<HTMLElement>('.ledger__slot-tile')).map((tile) => {
      if (tile.classList.contains('ledger__slot-tile--open')) return 'open';
      if (tile.classList.contains('ledger__slot-tile--this-turn')) return 'this-turn';
      if (tile.classList.contains('ledger__slot-tile--spent')) return 'spent';
      return 'unknown';
    });
  }

  function tileTexts(): (string | null)[] {
    return Array.from(container.querySelectorAll('.ledger__slot-tile')).map(
      (tile) => tile.textContent
    );
  }

  it('renders one tile per pool with correct state classes - all open', () => {
    renderEconomy({
      'actions.max': 1,
      'actions.spent': 0,
      'bonusActions.max': 1,
      'bonusActions.spent': 0,
      'reactions.max': 1,
      'reactions.spent': 0
    });
    expect(container.querySelectorAll('.ledger__cell').length).toBe(1);
    expect(container.querySelectorAll('.ledger__slot-tile').length).toBe(3);
    expect(tileStates()).toEqual(['open', 'open', 'open']);
    expect(tileTexts()).toEqual(['Actions', 'Bonus Actions', 'Reactions']);
    expect(container.querySelector('.ledger__cell-label')?.textContent).toBe('ACT');
  });

  it('renders one tile spent via advertised effect as this-turn state', () => {
    renderEconomy(
      {
        'actions.max': 1,
        'actions.spent': 1,
        'bonusActions.max': 1,
        'bonusActions.spent': 0,
        'reactions.max': 1,
        'reactions.spent': 0
      },
      [actionSpend('attack-action', 'actions', 1)]
    );
    expect(tileStates()).toEqual(['this-turn', 'open', 'open']);
  });

  it('renders all tiles as spent when all pools exhausted on earlier turns', () => {
    renderEconomy({
      'actions.max': 1,
      'actions.spent': 1,
      'bonusActions.max': 1,
      'bonusActions.spent': 1,
      'reactions.max': 1,
      'reactions.spent': 1
    });
    expect(tileStates()).toEqual(['spent', 'spent', 'spent']);
  });

  it('exposes tile-row aria summary text from i18n templates', () => {
    renderEconomy({
      'actions.max': 1,
      'actions.spent': 0,
      'bonusActions.max': 1,
      'bonusActions.spent': 1,
      'reactions.max': 1,
      'reactions.spent': 0
    });
    const tiles = container.querySelector('.ledger__slot-tiles');
    expect(tiles?.getAttribute('role')).toBe('img');
    expect(tiles?.getAttribute('aria-label')).toBe(
      'Action economy => Actions: 1 open | Bonus Actions: 0 open | Reactions: 1 open'
    );
  });

  it('falls back to none-open phrase when every pool is spent', () => {
    renderEconomy({
      'actions.max': 1,
      'actions.spent': 1,
      'bonusActions.max': 1,
      'bonusActions.spent': 1,
      'reactions.max': 1,
      'reactions.spent': 1
    });
    expect(container.querySelector('.ledger__slot-tiles')?.getAttribute('aria-label')).toBe(
      'Action economy => nothing open'
    );
  });

  it('opens the tray on click with correct aria attributes', () => {
    renderEconomy({
      'actions.max': 1,
      'actions.spent': 0,
      'bonusActions.max': 1,
      'bonusActions.spent': 0,
      'reactions.max': 1,
      'reactions.spent': 0
    });
    const button = toggle();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-controls')).toBeTruthy();

    button.click();
    flushSync();

    expect(button.getAttribute('aria-expanded')).toBe('true');
    const tray = container.querySelector('.slot-tray');
    expect(tray).toBeTruthy();
    expect(tray?.id).toBe(button.getAttribute('aria-controls'));
  });

  it('renders tray rows with names from play.stats.* keys', () => {
    renderEconomy(
      {
        'actions.max': 1,
        'actions.spent': 0,
        'bonusActions.max': 1,
        'bonusActions.spent': 0,
        'reactions.max': 1,
        'reactions.spent': 0
      },
      [],
      [economyEntry]
    );
    toggle().click();
    flushSync();

    const rows = container.querySelectorAll('.slot-tray__row');
    expect(rows.length).toBe(3);
    expect(rows[0].getAttribute('aria-label')).toBe(
      'Actions: 1 open, 0 this turn, 0 spent, 1 total'
    );
    expect(rows[1].getAttribute('aria-label')).toBe(
      'Bonus Actions: 1 open, 0 this turn, 0 spent, 1 total'
    );
    expect(rows[2].getAttribute('aria-label')).toBe(
      'Reactions: 1 open, 0 this turn, 0 spent, 1 total'
    );
  });

  it('closes on Escape and returns focus to the toggle', () => {
    renderEconomy({
      'actions.max': 1,
      'actions.spent': 0,
      'bonusActions.max': 1,
      'bonusActions.spent': 0,
      'reactions.max': 1,
      'reactions.spent': 0
    });
    toggle().focus();
    toggle().click();
    flushSync();
    expect(container.querySelector('.slot-tray')).toBeTruthy();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    flushSync();

    expect(container.querySelector('.slot-tray')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle());
  });

  it('closes on an outside click', () => {
    renderEconomy({
      'actions.max': 1,
      'actions.spent': 0,
      'bonusActions.max': 1,
      'bonusActions.spent': 0,
      'reactions.max': 1,
      'reactions.spent': 0
    });
    toggle().click();
    flushSync();
    expect(container.querySelector('.slot-tray')).toBeTruthy();

    document.body.click();
    flushSync();
    expect(container.querySelector('.slot-tray')).toBeNull();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('renders steed economy with 2 tiles and steed short label', () => {
    const steedEconomyEntry: UiEntry = {
      type: 'actionPools',
      label: 'play.stats.steed.actions',
      factPrefix: 'companion.steed.',
      subject: 'steed',
      pools: [
        { key: 'actions', label: 'play.stats.steed.actions', shortLabel: 'play.stats.actions' },
        {
          key: 'bonusActions',
          label: 'play.stats.steed.bonusActions',
          shortLabel: 'play.stats.bonusActions'
        }
      ]
    };

    renderEconomy(
      {
        'companion.steed.actions.max': 1,
        'companion.steed.actions.spent': 0,
        'companion.steed.bonusActions.max': 1,
        'companion.steed.bonusActions.spent': 0
      },
      [],
      [steedEconomyEntry],
      { activeSubject: 'steed' }
    );

    expect(container.querySelectorAll('.ledger__slot-tile').length).toBe(2);
    expect(container.querySelector('.ledger__cell-label')?.textContent).toBe('ST.A');
    expect(tileTexts()).toEqual(['Actions', 'Bonus Actions']);
  });

  it('renders steed tray title from entry.label', () => {
    const steedEconomyEntry: UiEntry = {
      type: 'actionPools',
      label: 'play.stats.steed.actions',
      factPrefix: 'companion.steed.',
      subject: 'steed',
      pools: [
        { key: 'actions', label: 'play.stats.steed.actions', shortLabel: 'play.stats.actions' }
      ]
    };

    renderEconomy(
      {
        'companion.steed.actions.max': 1,
        'companion.steed.actions.spent': 0
      },
      [],
      [steedEconomyEntry],
      { activeSubject: 'steed' }
    );

    toggle().click();
    flushSync();

    expect(container.querySelector('.slot-tray__title')?.textContent?.trim()).toBe('Steed Actions');
  });

  it('shows negative tray count for over-budget advertised spend without clamping', () => {
    renderEconomy(
      {
        'actions.max': 1,
        'actions.spent': 2
      },
      [actionSpend('over-budget-action', 'actions', 2)]
    );
    toggle().click();
    flushSync();

    const row = container.querySelector('.slot-tray__row');
    expect(row?.querySelector('.slot-tray__count')?.textContent?.trim()).toBe('-1/1');
  });

  it('opening economy tray closes open slots tray and vice versa', () => {
    const slotEntry: UiEntry = {
      type: 'slotLevels',
      label: 'play.stats.spellSlots',
      levels: [1]
    };

    renderEconomy(
      {
        'spellcasting.slots.level1.total': 2,
        'spellcasting.slots.level1.spent': 0,
        'actions.max': 1,
        'actions.spent': 0,
        'bonusActions.max': 1,
        'bonusActions.spent': 0,
        'reactions.max': 1,
        'reactions.spent': 0
      },
      [],
      [slotEntry, economyEntry]
    );

    // Open slots tray
    const slotToggle = container.querySelectorAll('.ledger__slot-toggle')[0] as HTMLButtonElement;
    slotToggle.click();
    flushSync();
    expect(container.querySelector('.slot-tray')).toBeTruthy();
    expect(slotToggle.getAttribute('aria-expanded')).toBe('true');

    // Open economy tray - should close slots tray
    const economyToggle = container.querySelectorAll('.ledger__slot-toggle')[1] as HTMLButtonElement;
    economyToggle.click();
    flushSync();

    expect(economyToggle.getAttribute('aria-expanded')).toBe('true');
    expect(slotToggle.getAttribute('aria-expanded')).toBe('false');
    // Only one tray should exist
    expect(container.querySelectorAll('.slot-tray').length).toBe(1);
  });

  it('hides the cell when all pools have max <= 0', () => {
    renderEconomy({
      'actions.max': 0,
      'actions.spent': 0,
      'bonusActions.max': 0,
      'bonusActions.spent': 0,
      'reactions.max': 0,
      'reactions.spent': 0
    });
    expect(container.querySelectorAll('.ledger__cell').length).toBe(0);
  });

  it('keeps usedMax and hitDie cells rendering alongside the economy cell', () => {
    renderEconomy(
      {
        'hp.max': 35,
        'hp.current': 28,
        'hitDie.d8.total': 5,
        'hitDie.d8.remaining': 3,
        'actions.max': 1,
        'actions.spent': 0,
        'bonusActions.max': 1,
        'bonusActions.spent': 0,
        'reactions.max': 1,
        'reactions.spent': 0
      },
      [],
      [
        { type: 'usedMax', label: 'play.stats.hp', total: 'hp.max', remaining: 'hp.current' },
        {
          type: 'hitDie',
          label: 'play.stats.hitDie',
          nameParams: { dieSize: 8 },
          total: 'hitDie.d8.total',
          remaining: 'hitDie.d8.remaining',
          dieSize: 8
        },
        economyEntry
      ]
    );
    expect(container.querySelectorAll('.ledger__cell').length).toBe(3);
    expect(container.textContent).toContain('28/35');
    expect(container.textContent).toContain('3/5 d8');
    // Three pools -> three tiles
    expect(container.querySelectorAll('.ledger__slot-tile').length).toBe(3);
  });
});
