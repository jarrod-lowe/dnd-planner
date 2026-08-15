import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import SlotTray from '$lib/components/play/SlotTray.svelte';
import type { SlotLevel } from '$lib/play/slotLevels';

// i18n mock - returns key as text, interpolating {{param}} like sveltekit-i18n.
// The templates are deliberately distinctive so the tests pin that the strings
// come from the i18n system, not from hardcoded English in the component.
const translations: Record<string, string> = {
  'play.slots.title': 'Spell slots',
  'play.slots.levelRow':
    'Level {{level}} => {{open}} open, {{thisTurn}} this turn, {{spent}} spent, {{total}} total',
  'play.slots.levelTile': 'L{{level}}',
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
 * Build a SlotLevel the way `deriveSlotLevels` does: `spent` is the projected
 * total (prior turns PLUS this turn), so `thisTurn` is a subset of it and the
 * "spent earlier" pips are `spent - thisTurn`.
 */
function slotLevel(level: number, total: number, spent: number, thisTurn: number): SlotLevel {
  return { level, total, spent, thisTurn, open: total - spent };
}

describe('SlotTray', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  function renderComponent(levels: SlotLevel[], extraProps: Record<string, unknown> = {}) {
    mount(SlotTray, {
      target: container,
      props: { levels, ...extraProps }
    });
  }

  function rows(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('.slot-tray__row'));
  }

  it('renders one row per level', () => {
    renderComponent([slotLevel(1, 4, 3, 1), slotLevel(2, 3, 0, 0)]);
    expect(rows().length).toBe(2);
  });

  it('renders nothing but the shell when there are no slot levels', () => {
    // `deriveSlotLevels` filters levels with total 0 out entirely, so a level
    // with no slots never reaches the tray - it simply is not in the array.
    renderComponent([]);
    expect(rows().length).toBe(0);
    expect(container.querySelectorAll('.slot-tray__pip').length).toBe(0);
  });

  it('splits the pip run into open, this-turn and spent-earlier counts', () => {
    // 4 total, 3 spent overall of which 1 was spent by the current plan:
    // 1 open + 1 this turn + 2 spent earlier = 4 pips.
    renderComponent([slotLevel(1, 4, 3, 1)]);
    const row = rows()[0];
    expect(row.querySelectorAll('.slot-tray__pip').length).toBe(4);
    expect(row.querySelectorAll('.slot-tray__pip--open').length).toBe(1);
    expect(row.querySelectorAll('.slot-tray__pip--this-turn').length).toBe(1);
    expect(row.querySelectorAll('.slot-tray__pip--spent').length).toBe(2);
  });

  it('orders the pip run open, then this turn, then spent', () => {
    renderComponent([slotLevel(1, 4, 3, 1)]);
    const states = Array.from(rows()[0].querySelectorAll('.slot-tray__pip')).map((pip) => {
      if (pip.classList.contains('slot-tray__pip--open')) return 'open';
      if (pip.classList.contains('slot-tray__pip--this-turn')) return 'thisTurn';
      return 'spent';
    });
    expect(states).toEqual(['open', 'thisTurn', 'spent', 'spent']);
  });

  it('renders every pip as open when nothing has been spent', () => {
    renderComponent([slotLevel(3, 2, 0, 0)]);
    const row = rows()[0];
    expect(row.querySelectorAll('.slot-tray__pip--open').length).toBe(2);
    expect(row.querySelectorAll('.slot-tray__pip--this-turn').length).toBe(0);
    expect(row.querySelectorAll('.slot-tray__pip--spent').length).toBe(0);
  });

  it('renders open/total text per row', () => {
    renderComponent([slotLevel(1, 4, 3, 1), slotLevel(2, 3, 0, 0)]);
    const counts = rows().map((row) => row.querySelector('.slot-tray__count')?.textContent?.trim());
    expect(counts).toEqual(['1/4', '3/3']);
  });

  it('labels each row with every count from the i18n template', () => {
    renderComponent([slotLevel(1, 4, 3, 1)]);
    expect(rows()[0].getAttribute('aria-label')).toBe(
      'Level 1 => 1 open, 1 this turn, 3 spent, 4 total'
    );
  });

  it('marks the decorative pips as hidden from the accessibility tree', () => {
    renderComponent([slotLevel(1, 4, 3, 1)]);
    const pips = Array.from(rows()[0].querySelectorAll('.slot-tray__pip'));
    expect(pips.length).toBeGreaterThan(0);
    for (const pip of pips) {
      expect(pip.closest('[aria-hidden="true"]')).toBeTruthy();
    }
  });

  it('renders levels in ascending order, including levels above 5', () => {
    // prayer-of-healing can be upcast to level 9, so the tray must handle 6-9.
    renderComponent([
      slotLevel(1, 4, 1, 0),
      slotLevel(2, 3, 0, 0),
      slotLevel(6, 1, 1, 1),
      slotLevel(9, 1, 0, 0)
    ]);
    const tiles = rows().map((row) => row.querySelector('.slot-tray__tile')?.textContent?.trim());
    expect(tiles).toEqual(['L1', 'L2', 'L6', 'L9']);
  });

  it('renders the level-6 row with the this-turn state', () => {
    renderComponent([slotLevel(6, 1, 1, 1)]);
    const row = rows()[0];
    expect(row.querySelectorAll('.slot-tray__pip--this-turn').length).toBe(1);
    expect(row.getAttribute('aria-label')).toBe('Level 6 => 0 open, 1 this turn, 1 spent, 1 total');
  });

  it('surfaces a negative open honestly for an over-budget plan (deliberate — do not clamp)', () => {
    // The engine applies an illegal over-budget cast and advertises its spend,
    // so `deriveSlotLevels` hands the tray a negative `open` on purpose. The
    // tray must show it rather than round it up to 0: the count text and the
    // row's aria-label both have to say how far into the red the plan is.
    // 2 level-1 slots, 3 cast this turn.
    renderComponent([slotLevel(1, 2, 3, 3)]);
    const row = rows()[0];
    expect(row.querySelector('.slot-tray__count')?.textContent?.trim()).toBe('-1/2');
    expect(row.getAttribute('aria-label')).toBe(
      'Level 1 => -1 open, 3 this turn, 3 spent, 2 total'
    );
    // The pip run itself stays sane - `pipRun` floors each repeat at 0, so the
    // negative open contributes no pips and the three this-turn spends show.
    expect(row.querySelectorAll('.slot-tray__pip--open').length).toBe(0);
    expect(row.querySelectorAll('.slot-tray__pip--this-turn').length).toBe(3);
    expect(row.querySelectorAll('.slot-tray__pip--spent').length).toBe(0);
  });

  it('never draws more pips than the level has slots for a cast + long rest plan', async () => {
    // Composition test: the tray is fed what `deriveSlotLevels` ACTUALLY derives
    // for a plan holding both a cast and a long rest. The rest restores the slot
    // in the same evaluation, so the projected `spent` is 0 - and if the
    // derivation still counted the advertised spend as `thisTurn`, the run would
    // be 4 open + 1 this turn = FIVE pips on a four-slot level.
    const { deriveSlotLevels } = await import('$lib/play/slotLevels');
    const levels = deriveSlotLevels(
      {
        'spellcasting.slots.level1.total': 4,
        'spellcasting.slots.level1.spent': 0,
        'rest.long': 1
      },
      [
        {
          id: 'bless',
          state: { 'spellcasting.slots.level1.spent': 1 },
          expiry: { kind: 'untilLongRest' }
        },
        { id: 'rest', state: { 'rest.long': 1 }, expiry: { kind: 'endOfTurn' } }
      ]
    );
    renderComponent(levels);
    const row = rows()[0];
    expect(row.querySelectorAll('.slot-tray__pip').length).toBe(4);
    expect(row.querySelectorAll('.slot-tray__pip--open').length).toBe(4);
    expect(row.querySelectorAll('.slot-tray__pip--this-turn').length).toBe(0);
    expect(row.getAttribute('aria-label')).toBe('Level 1 => 4 open, 0 this turn, 0 spent, 4 total');
  });

  it('names all three states in the legend as real text', () => {
    // The legend words are the a11y guarantee that no state is carried by
    // texture alone, so they must survive even though the hint sentence went.
    renderComponent([slotLevel(1, 4, 3, 1)]);
    const legendItems = Array.from(container.querySelectorAll('.slot-tray__legend-item')).map(
      (item) => item.textContent?.trim()
    );
    expect(legendItems).toEqual(['Open', 'This turn', 'Spent']);
  });

  it('renders no explanatory sentence under the legend', () => {
    renderComponent([slotLevel(1, 4, 3, 1)]);
    expect(container.querySelector('.slot-tray__legend-hint')).toBeNull();
    // The i18n mock echoes unknown keys, so a surviving lookup would leak the
    // raw key into the DOM - catch that too.
    expect(container.textContent).not.toContain('legendHint');
  });

  it('renders the tray title from i18n', () => {
    renderComponent([slotLevel(1, 4, 3, 1)]);
    expect(container.textContent).toContain('Spell slots');
  });

  it('applies the id prop so the disclosure button can point aria-controls at it', () => {
    renderComponent([slotLevel(1, 4, 3, 1)], { id: 'ledger-slot-tray' });
    expect(container.querySelector('#ledger-slot-tray')).toBeTruthy();
  });
});
