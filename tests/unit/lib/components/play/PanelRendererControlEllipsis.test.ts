import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Codex P2 finding: `.panel-renderer--summary .panel-renderer__control` sets
// `display: inline-flex; max-width: 100%; overflow: hidden;` with no
// `text-overflow: ellipsis`. A single overflowing control (a long loadout
// label, say) is the ONLY child of `.panel-renderer__body`; because its own
// `max-width: 100%` caps it at exactly the body's width, it never overflows
// the body box, so the ancestor `.panel-renderer__body`'s
// `text-overflow: ellipsis` (see PlanRowWarningTooltipClip.test.ts) never
// fires — the wrapper itself hard-clips its own overflowing content with no
// "…". Multiple controls must still separate with `·` and stay on one line;
// only the "one control, too long" case was silently swallowed.
//
// This is a CSS-ownership property, not something jsdom lays boxes out for
// (see the other Codex-P2 CSS-shape tests in this repo for the same
// rationale), so the honest test reads the component's own stylesheet.
// `text-overflow` does not apply to a flex container's own overflowing flex
// items the way it does to a block container's own inline content — so the
// fix must move `.panel-renderer__control` off `display: inline-flex` in
// summary mode (never re-add it here), not just add `text-overflow` beside
// it. The rendered behaviour is proven in a real browser, see the task
// report; this test only pins the CSS shape the browser check depends on.

const panelRendererSource = readFileSync(
  join(process.cwd(), 'src/lib/components/play/PanelRenderer.svelte'),
  'utf8'
);

function ruleBody(source: string, selectorText: string): string {
  const start = source.indexOf(selectorText);
  if (start === -1) throw new Error(`selector not found in source: ${selectorText}`);
  const braceOpen = source.indexOf('{', start);
  const braceClose = source.indexOf('}', braceOpen);
  if (braceOpen === -1 || braceClose === -1) {
    throw new Error(`could not find rule body for selector: ${selectorText}`);
  }
  return source.slice(braceOpen + 1, braceClose);
}

describe('collapsed-row single-control ellipsis (Codex P2)', () => {
  it('ellipsizes a single overflowing control instead of swallowing the overflow silently', () => {
    const body = ruleBody(
      panelRendererSource,
      '.panel-renderer--summary .panel-renderer__control {'
    );
    expect(body).toMatch(/overflow\s*:\s*hidden/);
    expect(body).toMatch(/white-space\s*:\s*nowrap/);
    expect(body).toMatch(/text-overflow\s*:\s*ellipsis/);
  });

  it('does not rely on display: inline-flex, which cannot ellipsize its own overflowing content', () => {
    const body = ruleBody(
      panelRendererSource,
      '.panel-renderer--summary .panel-renderer__control {'
    );
    expect(body).not.toMatch(/display\s*:\s*inline-flex/);
  });
});
