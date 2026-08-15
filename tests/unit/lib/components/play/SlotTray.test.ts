import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import SlotTray from '$lib/components/play/SlotTray.svelte';
import type { TrayRow } from '$lib/components/play/SlotTray.svelte';

// i18n mock - returns key as text, interpolating {{param}} like sveltekit-i18n.
// The templates are deliberately distinctive so the tests pin that the strings
// come from the i18n system, not from hardcoded English in the component.
const translations: Record<string, string> = {
  'play.slots.title': 'Spell Slots',
  'play.tray.row':
    '{{name}}: {{open}} open, {{thisTurn}} this turn, {{spent}} spent, {{total}} total',
  'play.slots.legendTitle': 'Key',
  'play.slots.legend.open': 'Open',
  'play.slots.legend.thisTurn': 'This turn',
  'play.slots.legend.spent': 'Spent'
};

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

/**
 * Build a TrayRow - all counts are already projected, so the "spent earlier"
 * pips are `spent - thisTurn`.
 */
function trayRow(
  order: number,
  tile: string,
  name: string,
  total: number,
  spent: number,
  thisTurn: number
): TrayRow {
  return { order, tile, name, total, spent, thisTurn, open: total - spent };
}

describe('SlotTray', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  function renderComponent(
    rows: TrayRow[],
    titleKey: string,
    extraProps: Record<string, unknown> = {}
  ) {
    mount(SlotTray, {
      target: container,
      props: { rows, titleKey, ...extraProps }
    });
  }

  function rows(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('.slot-tray__row'));
  }

  it('renders one row per TrayRow', () => {
    renderComponent(
      [trayRow(1, '1', 'Level 1', 4, 3, 1), trayRow(2, '2', 'Level 2', 3, 0, 0)],
      'play.slots.title'
    );
    expect(rows().length).toBe(2);
  });

  it('renders nothing but the shell when there are no rows', () => {
    renderComponent([], 'play.slots.title');
    expect(rows().length).toBe(0);
    expect(container.querySelectorAll('.slot-tray__pip').length).toBe(0);
  });

  it('splits the pip run into open, this-turn and spent-earlier counts', () => {
    // 4 total, 3 spent overall of which 1 was spent by the current plan:
    // 1 open + 1 this turn + 2 spent earlier = 4 pips.
    renderComponent([trayRow(1, '1', 'Level 1', 4, 3, 1)], 'play.slots.title');
    const row = rows()[0];
    expect(row.querySelectorAll('.slot-tray__pip').length).toBe(4);
    expect(row.querySelectorAll('.slot-tray__pip--open').length).toBe(1);
    expect(row.querySelectorAll('.slot-tray__pip--this-turn').length).toBe(1);
    expect(row.querySelectorAll('.slot-tray__pip--spent').length).toBe(2);
  });

  it('orders the pip run open, then this turn, then spent', () => {
    renderComponent([trayRow(1, '1', 'Level 1', 4, 3, 1)], 'play.slots.title');
    const states = Array.from(rows()[0].querySelectorAll('.slot-tray__pip')).map((pip) => {
      if (pip.classList.contains('slot-tray__pip--open')) return 'open';
      if (pip.classList.contains('slot-tray__pip--this-turn')) return 'thisTurn';
      return 'spent';
    });
    expect(states).toEqual(['open', 'thisTurn', 'spent', 'spent']);
  });

  it('renders every pip as open when nothing has been spent', () => {
    renderComponent([trayRow(3, '3', 'Level 3', 2, 0, 0)], 'play.slots.title');
    const row = rows()[0];
    expect(row.querySelectorAll('.slot-tray__pip--open').length).toBe(2);
    expect(row.querySelectorAll('.slot-tray__pip--this-turn').length).toBe(0);
    expect(row.querySelectorAll('.slot-tray__pip--spent').length).toBe(0);
  });

  it('renders open/total text per row', () => {
    renderComponent(
      [trayRow(1, '1', 'Level 1', 4, 3, 1), trayRow(2, '2', 'Level 2', 3, 0, 0)],
      'play.slots.title'
    );
    const counts = rows().map((row) => row.querySelector('.slot-tray__count')?.textContent?.trim());
    expect(counts).toEqual(['1/4', '3/3']);
  });

  it('labels each row with every count from the i18n template', () => {
    // `spent` in the label is the EARLIER-turn count, matching the outlined
    // pips: 4 total, 3 spent overall of which 1 is this turn => 2 earlier.
    renderComponent([trayRow(1, '1', 'Level 1', 4, 3, 1)], 'play.slots.title');
    expect(rows()[0].getAttribute('aria-label')).toBe(
      'Level 1: 1 open, 1 this turn, 2 spent, 4 total'
    );
  });

  it('reports disjoint counts that sum to the total, matching the pip run', () => {
    // 4 total, 2 spent overall of which 1 is this turn => 2 open + 1 this turn
    // + 1 earlier. The three parts are disjoint and must sum to 4, exactly as
    // the pips do - a label saying "2 spent" here would double-count the cast
    // and describe five slots on a four-slot level.
    renderComponent([trayRow(1, '1', 'Level 1', 4, 2, 1)], 'play.slots.title');
    const row = rows()[0];
    expect(row.getAttribute('aria-label')).toBe('Level 1: 2 open, 1 this turn, 1 spent, 4 total');

    const open = row.querySelectorAll('.slot-tray__pip--open').length;
    const thisTurn = row.querySelectorAll('.slot-tray__pip--this-turn').length;
    const earlier = row.querySelectorAll('.slot-tray__pip--spent').length;
    expect([open, thisTurn, earlier]).toEqual([2, 1, 1]);
    expect(open + thisTurn + earlier).toBe(4);
  });

  it('marks the decorative pips as hidden from the accessibility tree', () => {
    renderComponent([trayRow(1, '1', 'Level 1', 4, 3, 1)], 'play.slots.title');
    const pips = Array.from(rows()[0].querySelectorAll('.slot-tray__pip'));
    expect(pips.length).toBeGreaterThan(0);
    for (const pip of pips) {
      expect(pip.closest('[aria-hidden="true"]')).toBeTruthy();
    }
  });

  it('sorts rows by order ascending', () => {
    // Pass rows out of order to verify sorting happens.
    renderComponent(
      [
        trayRow(9, '9', 'Level 9', 1, 0, 0),
        trayRow(1, '1', 'Level 1', 4, 1, 0),
        trayRow(6, '6', 'Level 6', 1, 1, 1),
        trayRow(2, '2', 'Level 2', 3, 0, 0)
      ],
      'play.slots.title'
    );
    const tiles = rows().map((row) => row.querySelector('.slot-tray__tile')?.textContent?.trim());
    expect(tiles).toEqual(['1', '2', '6', '9']);
  });

  it('renders the tray title from the titleKey prop', () => {
    renderComponent([trayRow(1, '1', 'Level 1', 4, 3, 1)], 'play.slots.title');
    expect(container.querySelector('.slot-tray__title')?.textContent?.trim()).toBe('Spell Slots');
  });

  it('renders tile text from the row.tile property', () => {
    renderComponent(
      [trayRow(1, '1', 'Level 1', 4, 1, 0), trayRow(2, '2', 'Level 2', 3, 0, 0)],
      'play.slots.title'
    );
    const tiles = rows().map((row) => row.querySelector('.slot-tray__tile')?.textContent?.trim());
    expect(tiles).toEqual(['1', '2']);
  });

  it('renders row name in aria-label using the shared tray.row key', () => {
    renderComponent([trayRow(6, 'ACT', 'Bonus Action', 1, 1, 1)], 'play.slots.title');
    expect(rows()[0].getAttribute('aria-label')).toBe(
      'Bonus Action: 0 open, 1 this turn, 0 spent, 1 total'
    );
  });

  it('handles negative open (over-budget plan) without clamping', () => {
    // The engine applies an illegal over-budget cast and advertises its spend,
    // so the tray receives a negative `open` on purpose. The tray must show it
    // rather than round it up to 0.
    // 2 level-1 slots, 3 cast this turn.
    renderComponent([trayRow(1, '1', 'Level 1', 2, 3, 3)], 'play.slots.title');
    const row = rows()[0];
    expect(row.querySelector('.slot-tray__count')?.textContent?.trim()).toBe('-1/2');
    // `open` stays negative; the earlier-spend count floors at 0, so the label
    // never reports a negative spend.
    expect(row.getAttribute('aria-label')).toBe('Level 1: -1 open, 3 this turn, 0 spent, 2 total');
    // The pip run itself stays sane - negative open contributes no pips.
    expect(row.querySelectorAll('.slot-tray__pip--open').length).toBe(0);
    expect(row.querySelectorAll('.slot-tray__pip--this-turn').length).toBe(3);
    expect(row.querySelectorAll('.slot-tray__pip--spent').length).toBe(0);
  });

  it('floors earlier-spent pips at 0 but does not floor negative open', () => {
    // When `thisTurn` exceeds `spent`, the earlier count would go negative.
    // The pip run must floor it at 0, but `open` stays negative.
    renderComponent([trayRow(1, '1', 'Level 1', 2, 1, 3)], 'play.slots.title');
    const row = rows()[0];
    // open = 2 - 1 = 1 (but thisTurn = 3, so spent - thisTurn = -2, floored to 0)
    expect(row.getAttribute('aria-label')).toBe('Level 1: 1 open, 3 this turn, 0 spent, 2 total');
    expect(row.querySelectorAll('.slot-tray__pip--open').length).toBe(1);
    expect(row.querySelectorAll('.slot-tray__pip--this-turn').length).toBe(3);
    expect(row.querySelectorAll('.slot-tray__pip--spent').length).toBe(0);
  });

  it('renders zero-total rows correctly', () => {
    renderComponent([trayRow(0, '0', 'Level 0', 0, 0, 0)], 'play.slots.title');
    const row = rows()[0];
    expect(row.querySelector('.slot-tray__count')?.textContent?.trim()).toBe('0/0');
    expect(row.querySelectorAll('.slot-tray__pip').length).toBe(0);
  });

  it('names all three states in the legend as real text', () => {
    // The legend words are the a11y guarantee that no state is carried by
    // texture alone, so they must survive even though the hint sentence went.
    renderComponent([trayRow(1, '1', 'Level 1', 4, 3, 1)], 'play.slots.title');
    const legendItems = Array.from(container.querySelectorAll('.slot-tray__legend-item')).map(
      (item) => item.textContent?.trim()
    );
    expect(legendItems).toEqual(['Open', 'This turn', 'Spent']);
  });

  it('renders no explanatory sentence under the legend', () => {
    renderComponent([trayRow(1, '1', 'Level 1', 4, 3, 1)], 'play.slots.title');
    expect(container.querySelector('.slot-tray__legend-hint')).toBeNull();
    // The i18n mock echoes unknown keys, so a surviving lookup would leak the
    // raw key into the DOM - catch that too.
    expect(container.textContent).not.toContain('legendHint');
  });

  it('applies the id prop so the disclosure button can point aria-controls at it', () => {
    renderComponent([trayRow(1, '1', 'Level 1', 4, 3, 1)], 'play.slots.title', {
      id: 'ledger-slot-tray'
    });
    expect(container.querySelector('#ledger-slot-tray')).toBeTruthy();
  });
});
