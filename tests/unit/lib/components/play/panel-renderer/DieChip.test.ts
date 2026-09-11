import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/svelte';
import DieChip from '$lib/components/play/panel-renderer/DieChip.svelte';

const dieChipSource = readFileSync(
  join(process.cwd(), 'src/lib/components/play/panel-renderer/DieChip.svelte'),
  'utf8'
);

function styleBlock(source: string): string {
  const start = source.indexOf('<style>');
  const end = source.indexOf('</style>');
  if (start === -1 || end === -1) throw new Error('no <style> block found');
  return source.slice(start, end);
}

describe('DieChip', () => {
  // Baseline: state classes are (and always were) applied to the read-only
  // <span> — the Codex P2 bug is a CSS cascade defect, not a missing class, so
  // these assertions are green both before and after the fix. They exist as a
  // regression guard for the class wiring, not as proof of the visual fix
  // (jsdom applies no <style> cascade — see the structural test below and the
  // task report for what the browser step actually proves).
  it('applies the crit state class to a read-only chip', () => {
    const { container } = render(DieChip, { props: { text: '20', editable: false, crit: true } });
    const span = container.querySelector('span.panel-renderer__die-chip');
    expect(span).not.toBeNull();
    expect(span?.classList.contains('panel-renderer__die-chip--crit')).toBe(true);
  });

  it('applies the fumble state class to a read-only chip', () => {
    const { container } = render(DieChip, {
      props: { text: '1', editable: false, fumble: true }
    });
    const span = container.querySelector('span.panel-renderer__die-chip');
    expect(span?.classList.contains('panel-renderer__die-chip--fumble')).toBe(true);
  });

  it('applies the crit-damage state class to a read-only chip', () => {
    const { container } = render(DieChip, {
      props: { text: '2d8', editable: false, critDamage: true }
    });
    const span = container.querySelector('span.panel-renderer__die-chip');
    expect(span?.classList.contains('panel-renderer__die-chip--crit-damage')).toBe(true);
  });

  it('carries no state class on a plain read-only chip (picker-panel usage, e.g. PanelLoadout)', () => {
    const { container } = render(DieChip, { props: { text: '1d8', editable: false } });
    const span = container.querySelector('span.panel-renderer__die-chip');
    expect(span?.classList.contains('panel-renderer__die-chip--crit')).toBe(false);
    expect(span?.classList.contains('panel-renderer__die-chip--fumble')).toBe(false);
    expect(span?.classList.contains('panel-renderer__die-chip--crit-damage')).toBe(false);
  });

  // Codex P2 finding: `span.panel-renderer__die-chip { background: transparent;
  // border: none; padding: 0; }` has specificity (0,1,1) — element + class —
  // which unconditionally beats the state rules' (0,1,0), regardless of source
  // order, so a natural-20/natural-1/critical-damage chip loses its fill and
  // border the moment the row collapses and the chip becomes a read-only
  // <span>. jsdom does not apply component <style> blocks through the cascade
  // for getComputedStyle (see PanelDiceLine-summary.test.ts's note on the same
  // limitation), so a computed-style assertion here would be worthless. This
  // instead asserts the fix is present in source — the plain-chip reset must
  // be scoped off the state classes so the state rules can win — while the
  // actual rendered colours are proven in the browser step (see task report).
  it("scopes the read-only plain-chip reset so it cannot blank a rolled chip's state fill", () => {
    const css = styleBlock(dieChipSource);
    const resetRule = css.match(
      /span\.panel-renderer__die-chip[^{]*\{[^}]*background:\s*transparent;[^}]*\}/
    );
    expect(resetRule).not.toBeNull();
    const selector = resetRule![0];
    expect(selector).toMatch(/:not\(\s*\.panel-renderer__die-chip--crit\s*\)/);
    expect(selector).toMatch(/:not\(\s*\.panel-renderer__die-chip--fumble\s*\)/);
    expect(selector).toMatch(/:not\(\s*\.panel-renderer__die-chip--crit-damage\s*\)/);
  });

  it('still forces a default (non-pointer) cursor on every read-only chip, stated or not', () => {
    const css = styleBlock(dieChipSource);
    const cursorRule = css.match(
      /span\.panel-renderer__die-chip[^{]*\{[^}]*cursor:\s*default;[^}]*\}/
    );
    expect(cursorRule).not.toBeNull();
  });

  // Codex P2 finding: `aria-label` on a bare `<span>` is prohibited ARIA — a
  // span has no role that supports naming, so screen readers may ignore the
  // author-supplied name and fall back to the chip's raw text content,
  // losing the purpose/range/critical context `dieAriaLabel()` builds. Same
  // defect, same fix, as `WarningIndicator`'s `.panel-renderer__markers`
  // (role="img" over a span of decorative content) elsewhere in this PR.
  describe('read-only chip naming (Codex P2: aria-label on a bare span)', () => {
    it('gets role="img" when an ariaLabel is supplied, so the name is actually exposed', () => {
      const { container } = render(DieChip, {
        props: {
          text: '18',
          editable: false,
          ariaLabel: 'd20 attack roll, natural 18, critical hit'
        }
      });
      const span = container.querySelector('span.panel-renderer__die-chip');
      expect(span?.getAttribute('role')).toBe('img');
      expect(span?.getAttribute('aria-label')).toBe('d20 attack roll, natural 18, critical hit');
    });

    it('stays a plain, role-less span when no ariaLabel is supplied (its text stands for itself)', () => {
      const { container } = render(DieChip, { props: { text: '1d8', editable: false } });
      const span = container.querySelector('span.panel-renderer__die-chip');
      expect(span?.hasAttribute('role')).toBe(false);
      expect(span?.hasAttribute('aria-label')).toBe(false);
    });

    it('does not add role="img" to the editable button branch, even with an ariaLabel', () => {
      const { container } = render(DieChip, {
        props: { text: '18', editable: true, ariaLabel: 'roll d20' }
      });
      const button = container.querySelector('button.panel-renderer__die-chip');
      expect(button).not.toBeNull();
      expect(button?.hasAttribute('role')).toBe(false);
      expect(button?.getAttribute('aria-label')).toBe('roll d20');
    });
  });
});
