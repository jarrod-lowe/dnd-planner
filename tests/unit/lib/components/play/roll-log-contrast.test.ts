import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * WCAG AA contrast regression tests for the roll log's replaced-entry styling.
 *
 * The replaced cue re-chromes the shared DiceRollToast card (dotted border +
 * a different container surface) via the `--replaced` wrapper variant. The
 * toast's own text tokens stay untouched, so the pin is: the variant must
 * never mute with `opacity` (the composite-towards-background trap that sank
 * the depleted ledger cells), the chrome it paints must be theme tokens, and
 * every text colour DiceRollToast can paint on that surface must clear 4.5:1
 * in BOTH themes (the text is 12–14px, never large-scale).
 *
 * jsdom cannot compute this (no var() resolution, no layout), so the colours
 * are resolved against the real theme files here — see depleted-contrast.test.ts
 * for the pattern this follows.
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

const PANEL = 'src/lib/components/play/RollLogPanel.svelte';
const TOAST = 'src/lib/components/play/panel-renderer/DiceRollToast.svelte';

/** The `background:` declaration the replaced variant paints on the card. */
function replacedBackground(): string {
  const rule = rulesFor(PANEL, '.roll-log__entry--replaced')[0];
  expect(rule, 'the replaced wrapper restyles its toast card').toBeTruthy();
  const bg = rule!.decls.match(/(?:^|;)\s*background:[^;]+/)?.[0];
  expect(bg, 'the replaced variant sets a background').toBeTruthy();
  return bg!;
}

describe('RollLogPanel replaced-entry contrast', () => {
  it('mutes with token colours, never opacity', () => {
    for (const rule of rulesFor(PANEL, '.roll-log__entry--replaced')) {
      expect(rule.decls, `${rule.selector} must not use opacity`).not.toMatch(/(?:^|;)\s*opacity:/);
    }
  });

  it('re-chromes the card structurally: dotted border on a different token surface', () => {
    const rule = rulesFor(PANEL, '.roll-log__entry--replaced')[0];
    expect(rule, 'the replaced wrapper restyles its toast card').toBeTruthy();
    expect(rule!.decls, 'the border goes dotted — the structural cue').toMatch(
      /border-style:\s*dotted/
    );
    // A different surface from the toast's own card, else the cue vanishes.
    const toastBg = cssRules(TOAST)
      .find((r) => r.selector === '.dice-toast')!
      .decls.match(/(?:^|;)\s*background:[^;]+/)![0];
    expect(replacedBackground().trim()).not.toBe(toastBg.trim());
  });

  for (const [themeName, theme] of Object.entries(themes)) {
    it(`keeps every toast text colour ≥4.5:1 on the replaced background in ${themeName}`, () => {
      const bg = resolveToken(replacedBackground(), theme);
      // The colours DiceRollToast can paint on its card: title, detail line
      // (also separator/roll-type/bonus/equals/paren — the same token), the
      // total, and the modifiers footnote.
      const decls = [
        colorDecl(TOAST, '.dice-toast__title'),
        colorDecl(TOAST, '.dice-toast__detail'),
        colorDecl(TOAST, '.dice-toast__total'),
        colorDecl(TOAST, '.dice-toast__modifiers')
      ];
      for (const decl of decls) {
        const fg = resolveToken(decl, theme);
        const ratio = contrastRatio(fg, bg);
        expect(
          ratio,
          `${themeName}: ${decl.trim()} on ${replacedBackground().trim()}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
