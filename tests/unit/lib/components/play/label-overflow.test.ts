import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import IntentTopBar from '$lib/components/play/IntentTopBar.svelte';
import Ledger from '$lib/components/play/Ledger.svelte';
import { ticker } from '$lib/components/play/ticker';
import type { Character } from '$lib/character/types';
import type { UiEntry } from '$lib/play/extractTopBar';
import type { Facts } from '$lib/rules-view';

/**
 * Long-label overflow, revised after tablet hands-on testing of PR #471: every
 * clamp sits at 8rem (14rem/12rem read as "wider than the information"), and a
 * label that overflows its clamp becomes a ticker tape — a seamless looping
 * marquee that pauses while pressed/hovered/focused and never runs under
 * prefers-reduced-motion (static clamp + manual swipe instead). The full name
 * stays reachable everywhere it already was: title, aria-label, and the text
 * content itself. The abilities chip stays exempt — unclamped and untickered.
 * In the ledger, round 2 removed the exemptions the tablet re-test caught
 * escaping at full width: the subject line in the pane title and the
 * slot/action cells now clamp and tape like every other line. The tray cells
 * keep exactly one special case — they must not become scroll containers,
 * because the tray they anchor is absolutely positioned and would clip.
 *
 * jsdom cannot prove any of the motion: it does no layout (scrollWidth and
 * clientWidth are both 0, so the measurement in the action never fires), and
 * it applies no cascade from either component <style> blocks or the global
 * stylesheet. These tests therefore pin the contract the way the contrast
 * suite does — by asserting the declarations the browser turns into "clamped
 * tape with a paused/reduced-motion escape hatch" — plus mounted-DOM tests
 * for the accessibility half (aria-hidden duplicates, full text, exemptions),
 * and direct tests of the action against stubbed metrics.
 */

const ROOT = process.cwd();

const TOP_BAR = 'src/lib/components/play/IntentTopBar.svelte';
const LEDGER = 'src/lib/components/play/Ledger.svelte';
const BASE_CSS = 'src/lib/styles/base.css';

const REDUCED_MOTION = 'prefers-reduced-motion: reduce';

interface CssRule {
  selector: string;
  decls: string;
  media: string | null;
}

/** Split a selector list on top-level commas (`:is(:hover, …)` stays whole). */
function splitSelectors(head: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of head) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Brace-aware CSS walk. Component styles are flat, but base.css nests @media
 * (reduced motion) and @keyframes (the tape), so the flat regex the first
 * revision used cannot see inside them. Rules inside @media keep their
 * condition; at-rules like @keyframes are kept whole (their bodies are not
 * rule-shaped).
 */
function parseRules(css: string, media: string | null, out: CssRule[]): void {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) return;
    const head = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (head.startsWith('@media')) {
      parseRules(body, head.replace(/^@media\s+/, '').replace(/^\((.*)\)$/, '$1'), out);
    } else if (head.startsWith('@')) {
      out.push({ selector: head, decls: body, media });
    } else {
      for (const selector of splitSelectors(head)) {
        out.push({ selector, decls: body, media });
      }
    }
    i = j;
  }
}

/** All rules of a stylesheet (.svelte files contribute their <style> block). */
function cssRules(componentPath: string): CssRule[] {
  const source = readFileSync(join(ROOT, componentPath), 'utf8');
  const style = source.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? source;
  const out: CssRule[] = [];
  parseRules(style.replace(/\/\*[\s\S]*?\*\//g, ''), null, out);
  return out;
}

/** The single rule whose selector is exactly `selector` (within `media`). */
function rule(componentPath: string, selector: string, media: string | null = null): CssRule {
  const found = cssRules(componentPath).find((r) => r.selector === selector && r.media === media);
  expect(
    found,
    `${componentPath} has a ${selector} rule${media ? ` inside @media ${media}` : ''}`
  ).toBeTruthy();
  return found!;
}

/** One declaration of a rule (`animation`, `max-width`, …), or null. */
function decl(
  componentPath: string,
  selector: string,
  property: string,
  media: string | null = null
): string | null {
  return (
    rule(componentPath, selector, media)
      .decls.match(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`))?.[1]
      ?.trim() ?? null
  );
}

/** The `max-width` of a rule in rem, or null when it is not a rem literal. */
function maxWidthRem(componentPath: string, selector: string): number | null {
  const rem = decl(componentPath, selector, 'max-width')?.match(/^([\d.]+)rem$/);
  return rem ? Number(rem[1]) : null;
}

/** The `min-width` of a rule in rem, asserted to be a rem literal. */
function minWidthRem(componentPath: string, selector: string): number {
  const rem = decl(componentPath, selector, 'min-width')?.match(/^([\d.]+)rem$/);
  expect(rem, `${selector} declares a rem min-width`).toBeTruthy();
  return Number(rem![1]);
}

describe('label overflow — every clamp sits at 8rem', () => {
  it('clamps the top-bar chip, the seg-button, and the ledger cell at 8rem', () => {
    // Tablet feedback: the first revision's 14rem (top bar) / 12rem (ledger)
    // clamps were too wide to read as clamps. 8rem still clears the widths the
    // components already floor — the HP chip's 5rem min-width, the ledger
    // cell's 3.5rem min-width — so today's short labels keep fitting; anything
    // longer becomes a tape rather than a wider chip.
    expect(maxWidthRem(TOP_BAR, '.intent-top-bar__chip')).toBe(8);
    expect(maxWidthRem(TOP_BAR, '.intent-top-bar__seg-btn')).toBe(8);
    expect(maxWidthRem(LEDGER, '.ledger__cell')).toBe(8);
    // Round 2: the subject line in the pane title and the tray-hosting cells
    // were the exemptions, and a long subject name rendered at full width
    // (492px for the temp-label steed name in the tablet build) — the whole
    // resources pane now clamps at the same 8rem.
    expect(maxWidthRem(LEDGER, '.ledger__title')).toBe(8);
    expect(maxWidthRem(LEDGER, '.ledger__cell--slots')).toBe(8);
    // The toggle's own 8rem cap is what makes the clamp reachable: the label
    // line caps itself at 100% of its row, and a percentage against a
    // fit-content ancestor never resolves — without this definite rem cap the
    // row measured the full unwrapped label (601px in the probe) and the tape
    // never engaged. The row then takes its 100% from the definite toggle.
    expect(maxWidthRem(LEDGER, '.ledger__slot-toggle')).toBe(8);
    expect(decl(LEDGER, '.ledger__slot-row', 'max-width')).toBe('100%');
  });

  it('keeps the clamp above the floors the components already declare', () => {
    expect(maxWidthRem(TOP_BAR, '.intent-top-bar__chip')).toBeGreaterThan(
      minWidthRem(TOP_BAR, '.intent-top-bar__chip--hp')
    );
    expect(maxWidthRem(LEDGER, '.ledger__cell')).toBeGreaterThan(
      minWidthRem(LEDGER, '.ledger__cell')
    );
  });
});

describe('ticker utility — the tape lives in base.css, gated on measurement', () => {
  it('makes the line itself the scroll viewport, so the clamp is manually swipeable', () => {
    // Each label/value line is a .ticker viewport capped at 100% of its chip:
    // `overflow-x: auto` is what carries the reduced-motion fallback (and the
    // pre-measurement state), and a flex item with non-visible overflow may
    // shrink below its content, which is what lets the line take the clamp.
    expect(decl(BASE_CSS, '.ticker', 'max-width')).toBe('100%');
    expect(decl(BASE_CSS, '.ticker', 'overflow-x')).toSatisfy(
      (v: string | null) => v === 'auto' || v === 'scroll'
    );
    expect(decl(BASE_CSS, '.ticker__copy', 'flex-shrink')).toBe('0');
    expect(decl(BASE_CSS, '.ticker__copy', 'white-space')).toBe('nowrap');
  });

  it('keeps the duplicate copy out of the layout until the tape runs', () => {
    // The duplicate is the seamless-loop device: until the action measures an
    // overflow it must not exist visually (and on the paused/reduced paths it
    // must return to hidden).
    expect(decl(BASE_CSS, '.ticker__copy--dup', 'display')).toBe('none');
    expect(decl(BASE_CSS, '.ticker[data-ticker] .ticker__copy--dup', 'display')).toBe('block');
    expect(decl(BASE_CSS, '.ticker[data-ticker]', 'overflow')).toBe('hidden');
  });

  it('animates only under [data-ticker], the action’s overflow verdict', () => {
    const animation = decl(BASE_CSS, '.ticker[data-ticker] .ticker__copy', 'animation');
    expect(animation).toMatch(/^ticker-scroll\s+var\(--ticker-duration/);
    expect(animation).toMatch(/linear/);
    expect(animation).toMatch(/infinite$/);
  });

  it('declares no other animation outside the [data-ticker] gate', () => {
    // The tape must never run for a label that fits, and the only switch is
    // the action's measured attribute — so every `animation:` declaration in
    // the three stylesheets this contract covers sits on a [data-ticker]
    // selector. (`animation-play-state` is exempt: pausing is not running.)
    for (const source of [TOP_BAR, LEDGER, BASE_CSS]) {
      for (const r of cssRules(source)) {
        if (/(?:^|;)\s*animation:/.test(r.decls)) {
          expect(
            r.selector.includes('[data-ticker]'),
            `${source} animates only via [data-ticker], found in "${r.selector}"`
          ).toBe(true);
        }
      }
    }
  });

  it('loops seamlessly: one copy plus one gap per translation', () => {
    // Both copies travel exactly their own width plus the container gap, so
    // the duplicate lands precisely where the original started — no jump at
    // the wrap point. The gap must be the same variable the container uses
    // between its copies.
    expect(decl(BASE_CSS, '.ticker', 'gap')).toBe('var(--ticker-gap)');
    const keyframes = rule(BASE_CSS, '@keyframes ticker-scroll');
    expect(keyframes.decls).toMatch(
      /transform:\s*translateX\(calc\(-100% - var\(--ticker-gap\)\)\)/
    );
  });

  it('pauses the tape on press, hover, and focus in both components', () => {
    // The pause keys off the clamped container (chip / button / cell), not the
    // individual line: the whole container is the reading unit, and a touch
    // anywhere on it should stop the tape.
    const pauseHosts: Array<[string, string]> = [
      [TOP_BAR, '.intent-top-bar__chip'],
      [TOP_BAR, '.intent-top-bar__seg-btn'],
      [LEDGER, '.ledger__cell'],
      [LEDGER, '.ledger__title']
    ];
    for (const [source, container] of pauseHosts) {
      const found = cssRules(source).find(
        (r) =>
          r.media === null &&
          /animation-play-state:\s*paused/.test(r.decls) &&
          r.selector.includes(container) &&
          r.selector.includes(':hover') &&
          r.selector.includes(':focus') &&
          r.selector.includes(':active') &&
          r.selector.includes('.ticker__copy')
      );
      expect(found, `${source} pauses ${container}'s tape on hover/focus/press`).toBeTruthy();
    }
  });

  it('runs nothing under prefers-reduced-motion: static clamp, manual swipe', () => {
    // Vestibular safety. The action still sets [data-ticker] (it cannot see
    // media queries), so the stylesheet must neutralise it: no animation, the
    // duplicate gone (manual swipe reaches all of the single copy), and the
    // viewport's scrollability restored against the tape's overflow: hidden.
    // …and the media query is where these live, not on the unconditional rule.
    expect(
      cssRules(BASE_CSS).find(
        (r) => r.selector === '.ticker[data-ticker] .ticker__copy' && r.media === REDUCED_MOTION
      )
    ).toBeTruthy();
    expect(decl(BASE_CSS, '.ticker[data-ticker] .ticker__copy', 'animation', REDUCED_MOTION)).toBe(
      'none'
    );
    expect(
      decl(BASE_CSS, '.ticker[data-ticker] .ticker__copy--dup', 'display', REDUCED_MOTION)
    ).toBe('none');
    expect(decl(BASE_CSS, '.ticker[data-ticker]', 'overflow-x', REDUCED_MOTION)).toMatch(
      /^(auto|scroll)$/
    );
  });

  it('does not ellipsise anything the clamp covers', () => {
    // Ellipsis deletes the name from the visible chip with no way back; the
    // tape (or the manual swipe) must be the only overflow behaviour.
    for (const [source, selector] of [
      [TOP_BAR, '.intent-top-bar__chip'],
      [TOP_BAR, '.intent-top-bar__seg-btn'],
      [LEDGER, '.ledger__cell'],
      [BASE_CSS, '.ticker']
    ] as const) {
      expect(rule(source, selector).decls, `${selector} has no text-overflow`).not.toMatch(
        /(?:^|;)\s*text-overflow:/
      );
    }
    // The containers keep their single-line strips; the copies join them.
    expect(decl(TOP_BAR, '.intent-top-bar__chip', 'white-space')).toBe('nowrap');
    expect(decl(TOP_BAR, '.intent-top-bar__seg-btn', 'white-space')).toBe('nowrap');
    expect(decl(LEDGER, '.ledger__cell', 'white-space')).toBe('nowrap');
  });

  it('exempts the six-column abilities chip; tray cells only escape scrolling', () => {
    // The abilities chip lays out six fixed columns (STR…CHA); clamping it
    // would scroll a chip that fits every screen it fits on today. The
    // declared `max-width: none` must stay — without it the chip would inherit
    // the 8rem clamp.
    expect(rule(TOP_BAR, '.intent-top-bar__chip--abilities').decls).toMatch(
      /(?:^|;)\s*max-width:\s*none/
    );
    // The slot/action cells clamp and tape like every other ledger line now,
    // but SlotTray positions itself absolutely against them: a scroll
    // container cell would clip the tray it hosts to the 8rem clamp. The
    // declared visible overflow is the load-bearing half of that contract.
    const slots = rule(LEDGER, '.ledger__cell--slots').decls;
    expect(slots).toMatch(/(?:^|;)\s*overflow:\s*visible/);
    expect(slots).not.toMatch(/(?:^|;)\s*overflow(-x)?:\s*(auto|scroll|hidden)/);
  });
});

// ── The action: overflow measurement gates the tape ──

/**
 * A ResizeObserver the tests can fire by hand. jsdom has none (the suite-wide
 * stub in tests/setup.ts is a no-op), and the action re-measures on resize so
 * locale switches and font loads re-time the tape — behaviour worth driving.
 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly callback: ResizeObserverCallback;
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

vi.stubGlobal('ResizeObserver', FakeResizeObserver);

/** A .ticker line as Ticker.svelte renders it, outside any component. */
function tickerHost(text: string): HTMLElement {
  const host = document.createElement('span');
  host.className = 'ticker';
  const copy = document.createElement('span');
  copy.className = 'ticker__copy';
  copy.textContent = text;
  const dup = document.createElement('span');
  dup.className = 'ticker__copy ticker__copy--dup';
  dup.setAttribute('aria-hidden', 'true');
  dup.textContent = text;
  host.append(copy, dup);
  document.body.appendChild(host);
  return host;
}

/** jsdom does no layout; the action's inputs are stubbed per test. */
function stubMetrics(el: HTMLElement, scrollWidth: number, clientWidth: number): void {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => clientWidth });
}

function durationOf(el: HTMLElement): number {
  return Number(el.style.getPropertyValue('--ticker-duration').replace('s', ''));
}

describe('ticker action — measurement, timing, teardown', () => {
  beforeEach(() => {
    FakeResizeObserver.instances.length = 0;
  });

  it('engages the tape only when the label overflows its clamp', () => {
    const overflowing = tickerHost('Tormentor (Damage Control)');
    stubMetrics(overflowing, 240, 96);
    ticker(overflowing);
    expect(overflowing.hasAttribute('data-ticker')).toBe(true);

    const fitting = tickerHost('Steed');
    stubMetrics(fitting, 80, 96);
    ticker(fitting);
    expect(fitting.hasAttribute('data-ticker')).toBe(false);
    expect(fitting.style.getPropertyValue('--ticker-duration')).toBe('');
  });

  it('scales the loop duration to the content length (constant px/s)', () => {
    // A fixed duration would make a long label race while a short one crawls;
    // the tape must read at one pace. 240px → 8s and 480px → 16s pins the
    // proportionality (30px/s — round 2 halved the 60px/s pace: "slow the
    // scroll by half") without pinning the formatting.
    const short = tickerHost('Cargo Capacity (500 lb.)');
    stubMetrics(short, 240, 96);
    ticker(short);
    expect(durationOf(short)).toBeCloseTo(8, 1);

    const long = tickerHost('Tormentor (Damage Control) — pseudo-seat for generic actions');
    stubMetrics(long, 480, 96);
    ticker(long);
    expect(durationOf(long)).toBeCloseTo(16, 1);
  });

  it('re-measures when the content resizes, and stands down when it now fits', () => {
    const host = tickerHost('Tormentor (Damage Control)');
    stubMetrics(host, 240, 96);
    ticker(host);
    expect(host.hasAttribute('data-ticker')).toBe(true);

    // Locale switch or shorter label: the copy resizes, the observer fires.
    stubMetrics(host, 80, 96);
    const observer = FakeResizeObserver.instances.at(-1)!;
    observer.callback([], observer as unknown as ResizeObserver);
    expect(host.hasAttribute('data-ticker')).toBe(false);
    expect(host.style.getPropertyValue('--ticker-duration')).toBe('');
  });

  it('disconnects its observer on destroy', () => {
    const host = tickerHost('Tormentor (Damage Control)');
    stubMetrics(host, 240, 96);
    const action = ticker(host);
    action?.destroy?.();
    expect(FakeResizeObserver.instances.at(-1)!.disconnected).toBe(true);
  });
});

// ── Mounted DOM: the full name survives the clamp, the duplicate is silent ──

const translations: Record<string, string> = {
  'auth.userMenu': 'User menu',
  'play.backToSelection': 'Back',
  'species.human': 'Human',
  'play.topBar.viewPlayer': 'Player',
  'play.companion.steed': 'Steed',
  // The long subject name PR 3 will render.
  'play.companion.tormentor-damage-control': 'Tormentor (Damage Control)',
  // A long stat label of the kind vehicles bring (label + value in one chip).
  'play.stats.tormentor.cargo': 'Cargo Capacity (500 lb.)',
  'play.stats.tormentor.capacity': 'Creature Capacity (4 Medium creatures)',
  'play.ledger.title': 'Resources',
  'play.stats.valueLabel': '{{label}} => {{remaining}} / {{total}}',
  // Abilities chip (the exemption mount test).
  'play.topBar.abilities': 'Abilities',
  'play.stats.str': 'STR',
  'play.stats.dex': 'DEX',
  // Spell-slot cell (the exemption mount test).
  'play.stats.spellSlots': 'Spell Slots',
  'play.ledger.short.spellSlots': 'Cast',
  'play.slots.toggle': 'Show spell slot breakdown',
  'play.slots.tilesLabel': 'Spell slots => {{summary}}',
  'play.slots.levelSummary': '{{open}} open at L{{level}}',
  'play.slots.summarySeparator': ' | ',
  'play.slots.noneOpen': 'nothing open',
  'play.slots.levelTile': '{{level}}'
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

vi.mock('$lib/components/UserDropdown.svelte', () => ({
  default: vi.fn()
}));

const mockCharacter: Character = {
  characterId: 'char-123',
  userId: 'user-1',
  name: 'Aragorn',
  species: 'human',
  class: 'paladin',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

/**
 * Every .ticker line carries the text twice — the original, and a duplicate
 * that must be aria-hidden so screen readers do not announce the label twice.
 */
function assertSingleAnnounceableCopy(line: HTMLElement, text: string): void {
  const copies = line.querySelectorAll('.ticker__copy');
  expect(copies.length, 'exactly two copies: original + seamless-loop duplicate').toBe(2);
  expect(copies[0].textContent).toBe(text);
  expect(copies[0].getAttribute('aria-hidden')).toBeNull();
  expect(copies[1].textContent).toBe(text);
  expect(copies[1].getAttribute('aria-hidden')).toBe('true');
}

describe('label overflow — IntentTopBar keeps the full name accessible', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('tickers the chip’s label and value lines without doubling the announcement', () => {
    mount(IntentTopBar, {
      target: container,
      props: {
        character: mockCharacter,
        topBarEntries: [
          { type: 'value', label: 'play.stats.tormentor.cargo', fact: 'cargo.limit' }
        ] satisfies UiEntry[],
        facts: { 'cargo.limit': '500 lb.' } as Facts,
        email: 'test@example.com',
        onLogout: vi.fn()
      }
    });
    const chip = container.querySelector('.intent-top-bar__chip');
    expect(chip).toBeTruthy();
    // The label line and the value line are each a tape viewport.
    const lines = chip!.querySelectorAll<HTMLElement>('.ticker');
    expect(lines.length).toBe(2);
    assertSingleAnnounceableCopy(lines[0], 'Cargo Capacity (500 lb.)');
    assertSingleAnnounceableCopy(lines[1], '500 lb.');
    // The whole label stays in the text content, so the content-derived name
    // and the explicit one agree.
    expect(chip?.textContent).toContain('Cargo Capacity (500 lb.)');
    expect(chip?.getAttribute('title')).toBe('Cargo Capacity (500 lb.) 500 lb.');
    expect(chip?.getAttribute('aria-label')).toBe(chip?.getAttribute('title'));
    // jsdom measures nothing (scrollWidth === clientWidth === 0), so nothing
    // in this render may carry the action's overflow verdict: the tape
    // engages only on measured overflow, never by default.
    expect(container.querySelector('[data-ticker]')).toBeNull();
  });

  it('tickers a long subject name in the seg-button, announced once', () => {
    mount(IntentTopBar, {
      target: container,
      props: {
        character: mockCharacter,
        topBarEntries: [],
        facts: {} as Facts,
        email: 'test@example.com',
        onLogout: vi.fn(),
        availableSubjects: ['steed', 'tormentor-damage-control'],
        onSwitchSubject: vi.fn()
      }
    });
    const buttons = container.querySelectorAll('.intent-top-bar__seg-btn');
    expect(buttons.length).toBe(3);
    const long = buttons[2];
    const line = long.querySelector('.ticker');
    expect(line).toBeTruthy();
    assertSingleAnnounceableCopy(line as HTMLElement, 'Tormentor (Damage Control)');
    // Hover still reveals the name without waiting for the tape.
    expect(long.getAttribute('title')).toBe('Tormentor (Damage Control)');
  });

  it('leaves the abilities chip without a tape — its width is structural', () => {
    mount(IntentTopBar, {
      target: container,
      props: {
        character: mockCharacter,
        topBarEntries: [
          {
            type: 'ability',
            label: 'play.topBar.abilities',
            abilities: [
              { name: 'play.stats.str', fact: 'str.modifier' },
              { name: 'play.stats.dex', fact: 'dex.modifier' }
            ]
          } satisfies UiEntry
        ],
        facts: { 'str.modifier': 3, 'dex.modifier': 2 } as Facts,
        email: 'test@example.com',
        onLogout: vi.fn()
      }
    });
    const abilities = container.querySelector('.intent-top-bar__chip--abilities');
    expect(abilities).toBeTruthy();
    expect(abilities?.querySelector('.ticker')).toBeNull();
  });
});

describe('label overflow — Ledger keeps the full name accessible', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('tickers a long resource label whole, in the cell and in its accessible name', () => {
    mount(Ledger, {
      target: container,
      props: {
        resourceEntries: [
          {
            type: 'usedMax',
            label: 'play.stats.tormentor.capacity',
            total: 'capacity.max',
            remaining: 'capacity.current'
          } satisfies UiEntry
        ],
        facts: { 'capacity.max': 4, 'capacity.current': 1 } as Facts
      }
    });
    const cell = container.querySelector('.ledger__cell');
    expect(cell).toBeTruthy();
    const lines = cell!.querySelectorAll<HTMLElement>('.ticker');
    expect(lines.length).toBe(2);
    assertSingleAnnounceableCopy(lines[0], 'Creature Capacity (4 Medium creatures)');
    // The clamp may hide the tail of the visible label; the title and
    // aria-label must still carry the full composed name.
    expect(cell?.getAttribute('title')).toBe('Creature Capacity (4 Medium creatures) => 1 / 4');
    expect(cell?.getAttribute('aria-label')).toBe(cell?.getAttribute('title'));
  });

  it('tickers the subject name in the pane title, announced once', () => {
    // Round 2: the pane's own subject line sat next to the clamped cells with
    // no clamp of its own, so it was the one line still rendering at full
    // width. It is the same tape as everywhere else, and the title block is
    // its clamp host and pause host.
    mount(Ledger, {
      target: container,
      props: {
        resourceEntries: [],
        facts: {} as Facts,
        viewLabel: 'play.companion.tormentor-damage-control',
        activeSubject: 'tormentor-damage-control'
      }
    });
    const line = container.querySelector<HTMLElement>('.ledger__view-label');
    expect(line).toBeTruthy();
    expect(line?.classList.contains('ticker')).toBe(true);
    assertSingleAnnounceableCopy(line!, 'Tormentor (Damage Control)');
    // Hover still reveals the name without waiting for the tape.
    expect(line?.getAttribute('title')).toBe('Tormentor (Damage Control)');
  });

  it('tickers the tray cells’ label line without making the cell scroll', () => {
    // Round 2 removed the tray cells' clamp exemption: a slot/economy label
    // without a short form rendered at full width (the temp-label probe
    // measured the cell at 601px). The label line is a tape now; what the
    // cell must never become is a scroll container — the tray it anchors is
    // absolutely positioned and would clip (pinned in the CSS tests above).
    mount(Ledger, {
      target: container,
      props: {
        resourceEntries: [
          { type: 'slotLevels', label: 'play.stats.spellSlots', levels: [1] },
          {
            type: 'usedMax',
            label: 'play.stats.tormentor.capacity',
            total: 'capacity.max',
            remaining: 'capacity.current'
          } satisfies UiEntry
        ],
        facts: {
          'spellcasting.slots.level1.total': 2,
          'spellcasting.slots.level1.spent': 1,
          'capacity.max': 4,
          'capacity.current': 1
        } as Facts
      }
    });
    const slots = container.querySelector('.ledger__cell--slots');
    expect(slots).toBeTruthy();
    // The label line inside the toggle is the tape — one line, not the tiles.
    const lines = slots!.querySelectorAll<HTMLElement>('.ticker');
    expect(lines.length).toBe(1);
    assertSingleAnnounceableCopy(lines[0], 'Cast');
    // The clamped cell next to it carries its two tapes as before.
    const cells = container.querySelectorAll('.ledger__cell');
    expect(cells.length).toBe(2);
    expect(cells[1].querySelectorAll('.ticker').length).toBe(2);
  });
});
