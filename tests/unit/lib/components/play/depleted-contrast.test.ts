import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * WCAG AA contrast regression tests for the depleted ("muted") resource
 * styling and the plan row's "or instead" label.
 *
 * jsdom cannot compute this (no var() resolution, no layout), so these tests
 * re-derive what the browser computes: the colour tokens each rule names are
 * resolved against the real theme files, and the WCAG relative-luminance
 * formula — from the spec, not from the code under test — turns each
 * foreground/background pair into a ratio. The pairs must clear 4.5:1 in BOTH
 * themes; the text is 12–14px, never large-scale, so no 3:1 relaxation
 * applies.
 *
 * History: the depleted cells used `opacity: 0.4`, which composites to roughly
 * 2:1 in both themes, and the "or instead" label used --md-sys-color-outline
 * (≈3.6:1 on the plan row) — the pair axe flagged as color-contrast failures.
 */

const ROOT = process.cwd();

type Rgb = [number, number, number];

/** Parse `--md-sys-color-*: rgb(r g b);` tokens out of a theme file. */
function themeTokens(file: string): Record<string, Rgb> {
  const css = readFileSync(join(ROOT, 'src/lib/styles/themes', file), 'utf8');
  const tokens: Record<string, Rgb> = {};
  for (const m of css.matchAll(/(--md-sys-color-[a-z-]+):\s*rgb\((\d+) (\d+) (\d+)\)/g)) {
    tokens[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return tokens;
}

const themes = {
  light: themeTokens('light.css'),
  dark: themeTokens('dark.css')
};

/** WCAG 2.x relative luminance. */
function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.x contrast ratio between two colours. */
function contrastRatio(fg: Rgb, bg: Rgb): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/** Resolve one `var(--md-sys-color-…)` reference in a declaration. */
function resolveToken(declaration: string, theme: Record<string, Rgb>): Rgb {
  const m = declaration.match(/var\((--md-sys-color-[a-z-]+)\)/);
  expect(m, `declaration references a theme token: ${declaration}`).toBeTruthy();
  const rgb = theme[m![1]];
  expect(rgb, `${m![1]} exists in this theme`).toBeDefined();
  return rgb!;
}

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

/** Declarations of every rule whose selector contains `needle`. */
function rulesFor(
  componentPath: string,
  needle: string
): Array<{ selector: string; decls: string }> {
  return cssRules(componentPath).filter((r) => r.selector.includes(needle));
}

/** The `color:` declaration of the first matching rule. */
function colorDecl(componentPath: string, selectorNeedle: string): string {
  const rule = rulesFor(componentPath, selectorNeedle)[0];
  expect(rule, `${componentPath} has a ${selectorNeedle} rule`).toBeTruthy();
  const color = rule!.decls.match(/(?:^|;)\s*color:[^;]+/)?.[0];
  expect(color, `${selectorNeedle} sets a colour`).toBeTruthy();
  return color!;
}

const LEDGER = 'src/lib/components/play/Ledger.svelte';
const PLAN_ROW = 'src/lib/components/play/PlanRow.svelte';

describe('Ledger depleted-cell contrast (axe color-contrast)', () => {
  it('mutes with token colours, never opacity', () => {
    // opacity composites towards the background and has no theme-awareness;
    // it is what sank the depleted cells to ~2:1.
    for (const rule of rulesFor(LEDGER, '.ledger__cell--muted')) {
      expect(rule.decls, `${rule.selector} must not use opacity`).not.toMatch(/(?:^|;)\s*opacity:/);
    }
  });

  it('overrides the text colour inside a depleted cell', () => {
    // Deleting the muted styling would also "fix" contrast; the depleted read
    // must survive as an explicit token colour.
    const overrides = rulesFor(LEDGER, '.ledger__cell--muted').filter((r) =>
      /(?:^|;)\s*color:/.test(r.decls)
    );
    expect(overrides.length).toBeGreaterThan(0);
  });

  it('carries a structural cue beyond colour: the hollow spent-tile border', () => {
    // Colour alone cannot signal depletion. on-surface → on-surface-variant is
    // the only AA-safe neutral step, and at the same weight and size it reads
    // as a rounding error, not a state change — the 0.4-opacity ghost it
    // replaced was LOUD. The depleted read therefore needs a second axis on a
    // different channel than text colour. The strip already has one: spent
    // slot tiles are hollow boxes (transparent bg, outline-variant border).
    // The numeric cells borrow that same vocabulary.
    const muted = rulesFor(LEDGER, '.ledger__cell--muted');
    const borders = muted.flatMap((r) =>
      [...r.decls.matchAll(/(?:^|;)\s*border:[^;]+/g)].map((m) => m[0])
    );
    expect(borders.length, 'a --muted rule sets a border').toBeGreaterThan(0);
    const spentTileBorder = cssRules(LEDGER)
      .find((r) => r.selector === '.ledger__slot-tile--spent')!
      .decls.match(/border-color:[^;]+/)![0];
    for (const border of borders) {
      expect(border, 'border uses the spent-tile outline token').toContain(
        spentTileBorder.match(/var\((--md-sys-color-[a-z-]+)\)/)![1]
      );
    }
  });

  it('drops the depleted value below the positive value in weight', () => {
    // The second half of the compound cue: lighter colour AND lighter weight,
    // so a depleted cell cannot masquerade as a positive one.
    const weightOf = (selector: string): number => {
      const rule = cssRules(LEDGER).find((r) => r.selector === selector);
      expect(rule, `${selector} exists`).toBeTruthy();
      expect(rule!.decls, `${selector} sets a numeric font-weight`).toMatch(/font-weight:\s*\d+/);
      return Number(rule!.decls.match(/font-weight:\s*(\d+)/)![1]);
    };
    expect(weightOf('.ledger__cell--muted .ledger__cell-value')).toBeLessThan(
      weightOf('.ledger__cell-value')
    );
  });

  const ledgerBgDecl = cssRules(LEDGER)
    .find((r) => r.selector === '.ledger')!
    .decls.match(/background:[^;]+/)![0];

  for (const [themeName, theme] of Object.entries(themes)) {
    it(`keeps every depleted-cell text colour ≥4.5:1 in ${themeName}`, () => {
      const bg = resolveToken(ledgerBgDecl, theme);
      // The colours that can paint text in a depleted cell: the muted
      // overrides plus the base label/value colours they fall back to.
      const decls = [
        colorDecl(LEDGER, '.ledger__cell--muted'),
        colorDecl(LEDGER, '.ledger__cell-label'),
        colorDecl(LEDGER, '.ledger__cell-value')
      ];
      for (const decl of decls) {
        const fg = resolveToken(decl, theme);
        const ratio = contrastRatio(fg, bg);
        expect(
          ratio,
          `${themeName}: ${decl.trim()} on ${ledgerBgDecl.trim()}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe('PlanRow "or instead" label contrast (axe color-contrast)', () => {
  const rowBgDecl = cssRules(PLAN_ROW)
    .find((r) => r.selector === '.plan-row')!
    .decls.match(/background:[^;]+/)![0];

  for (const [themeName, theme] of Object.entries(themes)) {
    it(`keeps the alternatives label ≥4.5:1 in ${themeName}`, () => {
      const bg = resolveToken(rowBgDecl, theme);
      const fg = resolveToken(colorDecl(PLAN_ROW, '.plan-row__alternatives-label'), theme);
      const ratio = contrastRatio(fg, bg);
      expect(ratio, `${themeName}: on ${rowBgDecl.trim()}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
