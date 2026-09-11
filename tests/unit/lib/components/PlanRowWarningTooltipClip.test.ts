import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Codex-flagged defect: `.plan-row--collapsed .plan-row__content` clips with
// `overflow: hidden`, giving the collapsed short-forms line its single-line
// ellipsis. But `WarningIndicator` (and its absolutely-positioned
// `.warning-tooltip`) is rendered by `PanelRenderer` as a sibling of the
// header, inside that same `.plan-row__content` subtree (see
// PlanRowSummary.test.ts's "reveals the warning message ... while
// collapsed" — the tooltip is a descendant of `.plan-row__content`). An
// `overflow: hidden` ancestor clips ANY descendant, positioned or not, so
// clicking `(!)` on a collapsed row could render its message invisible.
//
// This is a CSS-ownership property, not something jsdom can lay out (it
// doesn't compute box clipping), so the honest test reads the component's
// own stylesheet and asserts the clip has moved off the shared ancestor.
// The single-line ellipsis itself must remain intact — it now lives
// self-contained on `.panel-renderer__title` (name, line 2) and
// `.panel-renderer__body` (short forms, line 3) inside PanelRenderer.svelte,
// neither of which contains the warning indicator (a sibling of both).

const planRowSource = readFileSync(
  join(process.cwd(), 'src/lib/components/play/PlanRow.svelte'),
  'utf8'
);
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

describe('collapsed-row clipping ownership', () => {
  it('does not clip descendants of .plan-row__content when collapsed (the warning tooltip escapes)', () => {
    const body = ruleBody(planRowSource, '.plan-row--collapsed .plan-row__content');
    expect(body).not.toMatch(/overflow\s*:\s*hidden/);
    expect(body).not.toMatch(/text-overflow\s*:\s*ellipsis/);
    expect(body).not.toMatch(/white-space\s*:\s*nowrap/);
  });

  it('still ellipsizes the collapsed name line, self-contained on .panel-renderer__title', () => {
    const body = ruleBody(panelRendererSource, '.panel-renderer--summary .panel-renderer__title');
    expect(body).toMatch(/overflow\s*:\s*hidden/);
    expect(body).toMatch(/text-overflow\s*:\s*ellipsis/);
    expect(body).toMatch(/white-space\s*:\s*nowrap/);
  });

  it('still ellipsizes the collapsed short-forms line, self-contained on .panel-renderer__body', () => {
    const body = ruleBody(panelRendererSource, '.panel-renderer--summary .panel-renderer__body');
    expect(body).toMatch(/overflow\s*:\s*hidden/);
    expect(body).toMatch(/text-overflow\s*:\s*ellipsis/);
    expect(body).toMatch(/white-space\s*:\s*nowrap/);
  });
});
