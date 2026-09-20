import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushSync } from 'svelte';
import { readable } from 'svelte/store';

// The mock returns the raw key for unknown keys (as tests/setup.ts does), so a
// rendered raw key proves the string went through `$t` rather than being
// hardcoded. Only the keys whose interpolation must be observed carry a
// template here — the count badge and a notice body with a DC.
const translations: Record<string, string> = {
  'play.notices.count': '×{{count}}',
  'rule.spells.searing-smite.notice-burning.body':
    "At the start of each burning target's turn: roll its fire dice, then it makes a DC {{dc}} CON save to end the spell."
};

vi.mock('$lib/i18n', () => ({
  t: readable((key: string, params?: Record<string, string | number>) => {
    const template = translations[key] ?? key;
    if (!params) return template;
    return Object.entries(params).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
      template
    );
  }),
  locale: readable('en'),
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en']
}));

// The strip's toast path goes through the shared helper; asserting on the
// mock proves the strip delegates rather than re-implementing the toast.
vi.mock('$lib/components/play/panel-renderer/diceRollToast', () => ({
  showDiceRollToast: vi.fn()
}));

import NoticeStrip from '$lib/components/play/NoticeStrip.svelte';
import NoticeStripHarness from './NoticeStripHarness.svelte';
import { showDiceRollToast } from '$lib/components/play/panel-renderer/diceRollToast';
import type { Annotation } from '$lib/rules-engine';

const SENTINEL_DISENGAGE: Annotation = {
  key: 'rule.dnd-5e-2024.feat-sentinel.notice-disengage',
  targets: ['notice'],
  source: 'rule.dnd-5e-2024.feat-sentinel.name',
  body: 'rule.dnd-5e-2024.feat-sentinel.notice-disengage.body'
};

const SENTINEL_RETALIATE: Annotation = {
  key: 'rule.dnd-5e-2024.feat-sentinel.notice-retaliate',
  targets: ['notice'],
  source: 'rule.dnd-5e-2024.feat-sentinel.name',
  body: 'rule.dnd-5e-2024.feat-sentinel.notice-retaliate.body'
};

const SENTINEL_SPEED: Annotation = {
  key: 'rule.dnd-5e-2024.feat-sentinel.notice-speed',
  targets: ['notice'],
  source: 'rule.dnd-5e-2024.feat-sentinel.name',
  body: 'rule.dnd-5e-2024.feat-sentinel.notice-speed.body'
};

const SEARING_BURNING: Annotation = {
  key: 'rule.spells.searing-smite.notice-burning',
  targets: ['notice'],
  source: 'rule.spells.searing-smite.name',
  body: 'rule.spells.searing-smite.notice-burning.body',
  values: { dc: 13 }
};

// The same notice once the burn actually rides it: a roll the PLAYER makes
// each turn (the fire damage), authored through the structured `roll` channel.
const SEARING_BURNING_ROLL: Annotation = {
  ...SEARING_BURNING,
  roll: { sides: 6, count: 2, purpose: 'damage', damageType: 'fire' }
};

/** The header disclosure — the only control in the strip. */
function disclosure(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector<HTMLButtonElement>('.notice-strip__disclosure');
}

function cells(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('.notice-strip__cell'));
}

function stripText(container: HTMLElement): string {
  return container.querySelector('.notice-strip')?.textContent ?? '';
}

describe('NoticeStrip', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.mocked(showDiceRollToast).mockClear();
  });

  it('renders one cell per notice, in engine order, with source, label and body', () => {
    mount(NoticeStrip, {
      target: container,
      props: { notices: [SENTINEL_DISENGAGE, SENTINEL_RETALIATE, SEARING_BURNING] }
    });

    const rendered = cells(container);
    expect(rendered).toHaveLength(3);

    // Each cell names its origin, its label and its body — all through $t,
    // so the raw keys appear (the i18n mock falls back to the key).
    expect(rendered[0].querySelector('.notice-strip__source')?.textContent).toContain(
      'rule.dnd-5e-2024.feat-sentinel.name'
    );
    expect(rendered[0].querySelector('.notice-strip__label')?.textContent).toContain(
      'rule.dnd-5e-2024.feat-sentinel.notice-disengage'
    );
    expect(rendered[0].querySelector('.notice-strip__body')?.textContent).toContain(
      'rule.dnd-5e-2024.feat-sentinel.notice-disengage.body'
    );

    // Engine order is preserved; the UI does not re-sort.
    expect(rendered[2].querySelector('.notice-strip__label')?.textContent).toContain(
      'rule.spells.searing-smite.notice-burning'
    );
  });

  it('renders a cell without a source or body as label-only', () => {
    const bare: Annotation = { key: 'rule.example.bare', targets: ['notice'] };
    mount(NoticeStrip, { target: container, props: { notices: [bare] } });

    const rendered = cells(container);
    expect(rendered).toHaveLength(1);
    const cell = rendered[0];
    expect(cell.querySelector('.notice-strip__label')?.textContent).toContain('rule.example.bare');
    expect(cell.querySelector('.notice-strip__source')).toBeNull();
    expect(cell.querySelector('.notice-strip__body')).toBeNull();
  });

  it('header count matches the notice count, interpolated through $t', () => {
    mount(NoticeStrip, {
      target: container,
      props: { notices: [SENTINEL_DISENGAGE, SENTINEL_RETALIATE, SENTINEL_SPEED] }
    });

    // The mock renders the count as `×N`; a hardcoded digit would not carry
    // the marker, and a hardcoded label would not be a bare number.
    expect(container.querySelector('.notice-strip__count')?.textContent?.trim()).toBe('×3');
  });

  it('renders collapsed with count 0 when there are no notices', () => {
    mount(NoticeStrip, { target: container, props: { notices: [] } });

    // The section is always present…
    expect(container.querySelector('.notice-strip')).not.toBeNull();
    // …carries count 0…
    expect(container.querySelector('.notice-strip__count')?.textContent?.trim()).toBe('×0');
    // …and starts collapsed: no grid, no cells, no placeholder.
    const button = disclosure(container);
    expect(button).not.toBeNull();
    expect(button!.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.notice-strip__grid')).toBeNull();
    expect(cells(container)).toHaveLength(0);
    expect(container.querySelector('.notice-strip__placeholder')).toBeNull();
  });

  it('is expanded on first render when notices exist', () => {
    mount(NoticeStrip, { target: container, props: { notices: [SENTINEL_DISENGAGE] } });

    expect(disclosure(container)?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.notice-strip__grid')).not.toBeNull();
    expect(cells(container)).toHaveLength(1);
  });

  it('manual collapse survives a notice arriving — count drives collapse on first render only', () => {
    const harness = mount(NoticeStripHarness, {
      target: container,
      props: { initial: [SENTINEL_DISENGAGE] }
    });
    flushSync();

    // Non-zero on first render: expanded.
    expect(disclosure(container)?.getAttribute('aria-expanded')).toBe('true');

    // The player collapses the section by hand…
    disclosure(container)!.click();
    flushSync();
    expect(disclosure(container)?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.notice-strip__grid')).toBeNull();

    // …and a notice arriving later must not re-expand it, even though the
    // count (which drove the first render) changed.
    harness.addNotice(SEARING_BURNING);
    flushSync();

    expect(disclosure(container)?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.notice-strip__grid')).toBeNull();
    expect(container.querySelector('.notice-strip__count')?.textContent?.trim()).toBe('×2');
  });

  it('notices arriving after a zero-notices mount expand the section — count drives it until first toggle', () => {
    // The wired play screen mounts the strip while the store still awaits its
    // first engine output (the effects fetch precedes performEvaluation), so
    // notices=[] at mount and the real ones land a beat later. Locking
    // "collapsed" in at that first render would hide every notice behind a
    // tap on every load — the count must keep driving the section until the
    // player has actually expressed a preference.
    const harness = mount(NoticeStripHarness, {
      target: container,
      props: { initial: [] }
    });
    flushSync();

    // Zero on first render: collapsed, count 0.
    expect(disclosure(container)?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('.notice-strip__count')?.textContent?.trim()).toBe('×0');

    // The engine's first output arrives with Sentinel assigned…
    harness.addNotice(SENTINEL_DISENGAGE);
    flushSync();

    // …and the section shows itself: no player preference exists to override.
    expect(disclosure(container)?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.notice-strip__grid')).not.toBeNull();
    expect(cells(container)).toHaveLength(1);
    expect(container.querySelector('.notice-strip__count')?.textContent?.trim()).toBe('×1');
  });

  it('disclosure is a button whose aria-expanded tracks the section, controlling a real region', () => {
    mount(NoticeStrip, { target: container, props: { notices: [SENTINEL_DISENGAGE] } });

    const button = disclosure(container);
    expect(button).not.toBeNull();
    expect(button!.tagName).toBe('BUTTON');
    expect(button!.getAttribute('type')).toBe('button');

    // Expanded: it advertises the collapse action and controls the region
    // holding the grid.
    expect(button!.getAttribute('aria-expanded')).toBe('true');
    const regionId = button!.getAttribute('aria-controls');
    expect(regionId).toBeTruthy();
    const region = regionId ? document.getElementById(regionId) : null;
    expect(region).not.toBeNull();
    expect(region?.querySelector('.notice-strip__grid')).not.toBeNull();

    // Toggling flips the region's visibility, not its existence: the element
    // stays mounted so the aria-controls IDREF never dangles, hiding via the
    // hidden attribute on a display-less wrapper (the grid itself keeps
    // display:grid precisely because a display rule on the hidden element
    // would beat the attribute).
    button!.click();
    flushSync();
    expect(button!.getAttribute('aria-expanded')).toBe('false');
    const collapsed = regionId ? document.getElementById(regionId) : null;
    expect(collapsed).toBe(region);
    expect(collapsed?.hasAttribute('hidden')).toBe(true);
    expect(collapsed?.querySelector('.notice-strip__grid')).toBeNull();

    button!.click();
    flushSync();
    expect(button!.getAttribute('aria-expanded')).toBe('true');
    expect(regionId ? document.getElementById(regionId) : null).toBe(region);
    expect(region?.hasAttribute('hidden')).toBe(false);
  });

  it('keeps the aria-controls region mounted while collapsed — the IDREF never dangles', () => {
    // The play screen mounts the strip on a zero-notices render (the effects
    // fetch precedes performEvaluation), so collapsed is every session's
    // first state: the disclosure must point at a real element, not an id
    // that only exists once the section is open.
    mount(NoticeStrip, { target: container, props: { notices: [] } });

    const button = disclosure(container);
    const regionId = button!.getAttribute('aria-controls');
    expect(regionId).toBeTruthy();

    // Collapsed: the controlled element is in the DOM and effectively
    // hidden — the hidden attribute, on a wrapper with no display rule of
    // its own (an author display value would override the UA's
    // [hidden] { display: none }).
    const region = document.getElementById(regionId!);
    expect(region).not.toBeNull();
    expect(region!.hasAttribute('hidden')).toBe(true);

    // Expanded: the same element, visible, now holding the placeholder.
    button!.click();
    flushSync();
    const expandedRegion = document.getElementById(regionId!);
    expect(expandedRegion).toBe(region);
    expect(expandedRegion!.hasAttribute('hidden')).toBe(false);
    expect(expandedRegion!.querySelector('.notice-strip__placeholder')).not.toBeNull();

    // CSS guard: no rule targeting the wrapper may declare display, or the
    // hidden attribute stops hiding it (the repo's display-beats-hidden
    // trap). Svelte injects the strip's styles into the document head.
    const css = Array.from(document.querySelectorAll('style'))
      .map((element) => element.textContent ?? '')
      .join('\n');
    const wrapperRules = css.match(/\.notice-strip__collapsible[^{]*\{[^}]*\}/g) ?? [];
    for (const rule of wrapperRules) {
      expect(rule).not.toContain('display');
    }
  });

  it('shows the placeholder when the player expands an empty section', () => {
    mount(NoticeStrip, { target: container, props: { notices: [] } });

    const button = disclosure(container);
    expect(button).not.toBeNull();
    button!.click();
    flushSync();

    expect(disclosure(container)?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.notice-strip__placeholder')?.textContent).toContain(
      'play.notices.placeholder'
    );
    expect(container.querySelector('.notice-strip__grid')).toBeNull();
  });

  it('renders the full body — no clamping, no truncating class or attribute', () => {
    mount(NoticeStrip, { target: container, props: { notices: [SEARING_BURNING] } });

    const body = container.querySelector<HTMLElement>('.notice-strip__body');
    expect(body).not.toBeNull();

    // The entire sentence, DC included, is in the document.
    const fullBody =
      "At the start of each burning target's turn: roll its fire dice, then it makes a DC 13 CON save to end the spell.";
    expect(body!.textContent).toBe(fullBody);

    // No truncating modifier class, no tooltip stand-in, no hidden.
    for (const className of Array.from(body!.classList)) {
      expect(className).not.toMatch(/clamp|truncat|ellipsis|nowrap|clip/);
    }
    expect(body!.hasAttribute('title')).toBe(false);
    expect(body!.hasAttribute('hidden')).toBe(false);

    // And the component's own CSS declares no line clamp (Svelte injects the
    // strip's styles into the document head; nothing else is mounted here).
    const css = Array.from(document.querySelectorAll('style'))
      .map((element) => element.textContent ?? '')
      .join('\n');
    expect(css).not.toContain('line-clamp');
    expect(css).not.toContain('-webkit-box');
  });

  it('interpolates body values with double-brace params', () => {
    mount(NoticeStrip, { target: container, props: { notices: [SEARING_BURNING] } });

    // `values.dc` folded into the template by $t — single-brace interpolation
    // would leave the {{dc}} placeholder visible.
    expect(stripText(container)).toContain('DC 13 CON save');
    expect(stripText(container)).not.toContain('{{dc}}');
  });

  it('resolves every chrome string through $t — no hardcoded text', () => {
    mount(NoticeStrip, {
      target: container,
      props: { notices: [SENTINEL_DISENGAGE] }
    });

    // Title and disclosure labels arrive as raw keys from the mock.
    expect(container.querySelector('.notice-strip__title')?.textContent).toContain(
      'play.notices.title'
    );
    expect(disclosure(container)?.getAttribute('aria-label')).toBe('play.notices.collapse');

    disclosure(container)!.click();
    flushSync();
    expect(disclosure(container)?.getAttribute('aria-label')).toBe('play.notices.expand');

    // A hardcoded English chrome string would show up capitalised; the keys
    // are all lower-case, so none of these words may appear as-is.
    expect(stripText(container)).not.toContain('Notices');
    expect(stripText(container)).not.toContain('Expand');
    expect(stripText(container)).not.toContain('Collapse');
  });

  it('renders a die chip inside the cell of a notice carrying a roll', () => {
    mount(NoticeStrip, {
      target: container,
      props: { notices: [SENTINEL_DISENGAGE, SEARING_BURNING_ROLL] }
    });

    const rendered = cells(container);
    // The rolling notice's cell — and only it — owns a die chip button,
    // showing the unrolled expression as its text.
    expect(rendered[0].querySelector('.panel-renderer__die-chip')).toBeNull();
    const chip = rendered[1].querySelector<HTMLButtonElement>('button.panel-renderer__die-chip');
    expect(chip).not.toBeNull();
    expect(chip!.textContent?.trim()).toBe('2d6');

    // The chip's accessible name comes from PanelDiceLine's purpose-derived
    // machinery; the i18n mock renders the raw roll-type key.
    expect(chip!.getAttribute('aria-label')).toContain('play.toast.rollType.damage');

    // A burn can never be crit-doubled, so no options trigger may appear.
    expect(rendered[1].querySelector('.panel-renderer__options-trigger')).toBeNull();
  });

  it('rolling a notice die updates the chip and toasts through the shared helper', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.4); // each d6 → 3
    try {
      mount(NoticeStrip, {
        target: container,
        props: { notices: [SEARING_BURNING_ROLL] }
      });
      // Settle the mount before tapping: PanelDiceLine's initial effect
      // batch (roll-result seeding) is still pending right after mount(), and
      // a click that lands first would be wiped when that batch flushes.
      flushSync();

      const chip = container.querySelector<HTMLButtonElement>('button.panel-renderer__die-chip');
      expect(chip).not.toBeNull();
      chip!.click();
      flushSync();

      // floor(0.4 * 6) + 1 = 3 per die; two dice → the chip shows the total.
      expect(chip!.textContent?.trim()).toBe('6');

      // The toast is the shared helper, titled by the notice's translated
      // source (the mock falls back to the raw key), with no rider labels.
      expect(showDiceRollToast).toHaveBeenCalledTimes(1);
      const call = vi.mocked(showDiceRollToast).mock.calls[0];
      expect(call[0]).toBe('rule.spells.searing-smite.name');
      expect(call[1].total).toBe(6);
      expect(call[1].sides).toBe(6);
      expect(call[1].count).toBe(2);
      expect(call[1].damageType).toBe('fire');
      expect(call.length).toBe(2);
    } finally {
      random.mockRestore();
    }
  });
});
