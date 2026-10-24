import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import IntentTopBar from '$lib/components/play/IntentTopBar.svelte';
import Ledger from '$lib/components/play/Ledger.svelte';
import type { Character } from '$lib/character/types';
import type { UiEntry } from '$lib/play/extractTopBar';
import type { Facts } from '$lib/rules-view';

/**
 * Long-label overflow: subject seg-buttons ("Tormentor (Damage Control)") and
 * the stat/resource labels that come with vehicles are wider than the top bar
 * and the resources ledger comfortably fit. The settled contract is per-chip
 * clamping — `max-width` plus a horizontally scrollable interior — never
 * ellipsis and never wrapping, with the full name still reachable by assistive
 * tech and hover (title / aria-label).
 *
 * jsdom cannot prove the scroll itself: it does no layout, so `scrollWidth`
 * and `clientWidth` are both 0, and it applies no component `<style>` cascade
 * so `getComputedStyle` cannot see the declarations either. These tests
 * therefore pin the same contract the way the contrast suite does — by
 * asserting the declarations in the component `<style>` blocks that a real
 * browser turns into "clamped but scrollable" — plus mounted-DOM tests for the
 * accessibility half, which jsdom does handle (attributes and text).
 */

const ROOT = process.cwd();

const TOP_BAR = 'src/lib/components/play/IntentTopBar.svelte';
const LEDGER = 'src/lib/components/play/Ledger.svelte';

/** Flatten a .svelte file's <style> block into {selector → declarations}. */
function cssRules(componentPath: string): Array<{ selector: string; decls: string }> {
  const source = readFileSync(join(ROOT, componentPath), 'utf8');
  const style = source.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? '';
  const rules: Array<{ selector: string; decls: string }> = [];
  // Component styles here are flat (no nesting, no @media), so brace pairs
  // delimit every rule. Comments are stripped first — a `;` inside one must
  // not read as a declaration separator.
  for (const m of style.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selector: m[1].trim(), decls: m[2] });
  }
  return rules;
}

/** The single rule whose selector is exactly `selector`. */
function rule(componentPath: string, selector: string): { selector: string; decls: string } {
  const found = cssRules(componentPath).find((r) => r.selector === selector);
  expect(found, `${componentPath} has a ${selector} rule`).toBeTruthy();
  return found!;
}

/** The `overflow-x` value of a rule, or null when the rule sets none. */
function overflowX(componentPath: string, selector: string): string | null {
  return (
    rule(componentPath, selector)
      .decls.match(/(?:^|;)\s*overflow-x:\s*([^;]+)/)?.[1]
      ?.trim() ?? null
  );
}

/**
 * A scrollable overflow value. `auto` and `scroll` are the two the user can
 * actually scroll (wheel, touch, keyboard); `hidden` needs scripting, `clip`
 * and `visible` cannot scroll at all.
 */
function userScrollable(value: string | null): boolean {
  return value === 'auto' || value === 'scroll';
}

/** The `max-width` of a rule in rem, or null when it is not a rem literal. */
function maxWidthRem(componentPath: string, selector: string): number | null {
  const value = rule(componentPath, selector).decls.match(/(?:^|;)\s*max-width:\s*([^;]+)/)?.[1];
  const rem = value?.trim().match(/^([\d.]+)rem$/);
  return rem ? Number(rem[1]) : null;
}

/** The `min-width` of a rule in rem, asserted to be a rem literal. */
function minWidthRem(componentPath: string, selector: string): number {
  const value = rule(componentPath, selector).decls.match(/(?:^|;)\s*min-width:\s*([^;]+)/)?.[1];
  const rem = value?.trim().match(/^([\d.]+)rem$/);
  expect(rem, `${selector} declares a rem min-width`).toBeTruthy();
  return Number(rem![1]);
}

describe('label overflow — clamped, scrolled, never ellipsised (CSS contract)', () => {
  it('clamps the top-bar chip and makes its interior horizontally scrollable', () => {
    expect(
      maxWidthRem(TOP_BAR, '.intent-top-bar__chip'),
      'chip max-width is a rem literal'
    ).toBeGreaterThan(0);
    expect(overflowX(TOP_BAR, '.intent-top-bar__chip')).toSatisfy(userScrollable);
  });

  it('clamps the subject seg-button and makes its interior horizontally scrollable', () => {
    expect(
      maxWidthRem(TOP_BAR, '.intent-top-bar__seg-btn'),
      'seg-button max-width is a rem literal'
    ).toBeGreaterThan(0);
    expect(overflowX(TOP_BAR, '.intent-top-bar__seg-btn')).toSatisfy(userScrollable);
  });

  it('clamps the ledger cell and makes its interior horizontally scrollable', () => {
    expect(maxWidthRem(LEDGER, '.ledger__cell'), 'cell max-width is a rem literal').toBeGreaterThan(
      0
    );
    expect(overflowX(LEDGER, '.ledger__cell')).toSatisfy(userScrollable);
  });

  it('keeps the clamp wide enough that today’s short chips never hit it', () => {
    // The clamp must be a no-op for current labels (You / Steed / HP / AC /
    // Speed), so it has to clear the widths the components already declare:
    // the HP chip's 5rem min-width floors the chip, the ledger cell's 3.5rem
    // min-width floors the cell, and the seg-buttons render "PLAYER"/"STEED"
    // at xs uppercase (~4rem). Anything tighter clips labels that fit today.
    expect(maxWidthRem(TOP_BAR, '.intent-top-bar__chip')).toBeGreaterThan(
      minWidthRem(TOP_BAR, '.intent-top-bar__chip--hp')
    );
    expect(maxWidthRem(LEDGER, '.ledger__cell')).toBeGreaterThan(
      minWidthRem(LEDGER, '.ledger__cell')
    );
    expect(maxWidthRem(TOP_BAR, '.intent-top-bar__seg-btn')).toBeGreaterThanOrEqual(6);
  });

  it('does not ellipsise or wrap the clamped content', () => {
    // Ellipsis deletes the name from the visible chip with no way back, and
    // wrapping would stretch the single-line strips vertically. The scroll
    // must be the only overflow behaviour.
    const clamped = [
      [TOP_BAR, '.intent-top-bar__chip'],
      [TOP_BAR, '.intent-top-bar__seg-btn'],
      [LEDGER, '.ledger__cell']
    ] as const;
    for (const [path, selector] of clamped) {
      const decls = rule(path, selector).decls;
      expect(decls, `${selector} has no text-overflow`).not.toMatch(/(?:^|;)\s*text-overflow:/);
    }
    // Chips already refuse to wrap; the seg-button and the ledger cell must
    // join them, or the clamp would trade width for height instead of scrolling.
    expect(rule(TOP_BAR, '.intent-top-bar__seg-btn').decls).toMatch(
      /(?:^|;)\s*white-space:\s*nowrap/
    );
    expect(rule(TOP_BAR, '.intent-top-bar__chip').decls).toMatch(/(?:^|;)\s*white-space:\s*nowrap/);
    expect(rule(LEDGER, '.ledger__cell').decls).toMatch(/(?:^|;)\s*white-space:\s*nowrap/);
  });

  it('starts a clamped line at the leading edge, so the scroll can reach all of it', () => {
    // A centered line wider than its clamped box overflows both sides — and
    // the leading side is unreachable, because scroll offsets never go
    // negative in LTR. `safe` alignment falls back to start exactly when that
    // overflow would happen, so centered layout survives for fitting labels
    // while clamped ones scroll from their first character.
    expect(rule(TOP_BAR, '.intent-top-bar__chip--stack').decls).toMatch(
      /align-items:\s*safe center/
    );
    expect(rule(TOP_BAR, '.intent-top-bar__seg-btn').decls).toMatch(
      /justify-content:\s*safe center/
    );
    expect(rule(LEDGER, '.ledger__cell').decls).toMatch(/align-items:\s*safe center/);
  });

  it('exempts the six-column abilities chip, whose width is structural', () => {
    // The abilities chip lays out six fixed columns (STR…CHA); clamping it
    // would scroll a chip that fits every screen it fits on today. The
    // exemption must be a declared `max-width: none`, not a mere absence in
    // this rule — without the declaration the chip would silently inherit the
    // base clamp two rules up.
    expect(rule(TOP_BAR, '.intent-top-bar__chip--abilities').decls).toMatch(
      /(?:^|;)\s*max-width:\s*none/
    );
  });

  it('exempts the slots cell, which anchors the tray popup', () => {
    // SlotTray positions itself absolutely against .ledger__cell--slots;
    // making that cell a scroll container would clip the tray it hosts.
    const decls = rule(LEDGER, '.ledger__cell--slots').decls;
    expect(decls).not.toMatch(/(?:^|;)\s*overflow-x:\s*(auto|scroll)/);
    expect(decls).not.toMatch(/(?:^|;)\s*max-width:\s*[\d.]+rem/);
  });
});

// ── Mounted DOM: the full name survives the clamp for AT and hover ──

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
  'play.stats.valueLabel': '{{label}} => {{remaining}} / {{total}}'
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

// Mock Element.prototype.animate for JSDOM
if (!Element.prototype.animate) {
  Element.prototype.animate = vi.fn().mockReturnValue({
    finished: Promise.resolve(),
    cancel: vi.fn()
  });
}

const mockCharacter: Character = {
  characterId: 'char-123',
  userId: 'user-1',
  name: 'Aragorn',
  species: 'human',
  class: 'paladin',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('label overflow — IntentTopBar keeps the full name accessible', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('keeps a long stat label whole in the chip and names it for hover and AT', () => {
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
    // The scroll clips the paint, never the DOM: the whole label stays in the
    // text content, so the content-derived name and the label agree.
    expect(chip?.textContent).toContain('Cargo Capacity (500 lb.)');
    expect(chip?.getAttribute('title')).toBe('Cargo Capacity (500 lb.) 500 lb.');
    expect(chip?.getAttribute('aria-label')).toBe(chip?.getAttribute('title'));
  });

  it('keeps a long subject name whole in the seg-button and names it for hover', () => {
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
    // Full text in the button (scroll, not truncation)…
    expect(long.textContent).toBe('Tormentor (Damage Control)');
    // …plus a title so hover reveals the name without scrolling.
    expect(long.getAttribute('title')).toBe('Tormentor (Damage Control)');
  });
});

describe('label overflow — Ledger keeps the full name accessible', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('carries a long resource label whole, in the cell and in its accessible name', () => {
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
    // The clamp may hide the tail of the visible label; the title and
    // aria-label must still carry the full composed name.
    expect(cell?.textContent).toContain('Creature Capacity (4 Medium creatures)');
    expect(cell?.getAttribute('title')).toBe('Creature Capacity (4 Medium creatures) => 1 / 4');
    expect(cell?.getAttribute('aria-label')).toBe(cell?.getAttribute('title'));
  });
});
