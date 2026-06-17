import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import QuickSearch from '$lib/components/play/QuickSearch.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';

// The i18n mock (tests/setup.ts) returns the key itself for unknown keys, so an
// entry whose ui.name is a friendly string surfaces that string as its display
// name (and as its search haystack). Keyword keys are absent from the mock, so
// they resolve to the key and are treated as "no keywords" by the component.
function makeEntry(
  id: string,
  name: string,
  verb = 'ATTACK',
  opts: { legal?: boolean; diagnostics?: { code: string }[] } = {}
): AvailableRuleEntry {
  return {
    rule: { id, ui: { name, intents: { [verb]: 'default' } } },
    legal: opts.legal ?? true,
    applicable: true,
    diagnostics: opts.diagnostics ?? []
  } as unknown as AvailableRuleEntry;
}

const sample = [
  makeEntry('greataxe', 'Greataxe'),
  makeEntry('dagger', 'Dagger'),
  makeEntry('fireball', 'Fireball', 'CAST')
];

const key = (c: HTMLElement, letter: string) =>
  c.querySelector<HTMLButtonElement>(`button[data-key="${letter}"]`);
const results = (c: HTMLElement) => c.querySelectorAll('.quick-search__result');

describe('QuickSearch', () => {
  it('renders the query field, results well, and QWERTY pad of native buttons', () => {
    const { container } = render(QuickSearch, {
      props: { entries: sample, onPick: vi.fn() }
    });
    expect(container.querySelector('.quick-search__query')).toBeTruthy();
    expect(container.querySelector('.quick-search__well')).toBeTruthy();
    const letters = container.querySelectorAll('button[data-key]');
    expect(letters).toHaveLength(26);
    letters.forEach((el) => expect(el).toBeInstanceOf(HTMLButtonElement));
    expect(container.querySelector('button[data-action="backspace"]')).toBeInstanceOf(
      HTMLButtonElement
    );
    expect(container.querySelector('button[data-action="clear"]')).toBeInstanceOf(
      HTMLButtonElement
    );
  });

  it('shows helper text and no results for an empty query', () => {
    const { container } = render(QuickSearch, {
      props: { entries: sample, onPick: vi.fn() }
    });
    expect(container.querySelector('[data-state="empty"]')).toBeTruthy();
    expect(results(container)).toHaveLength(0);
  });

  it('filters results as letters are tapped on the pad', async () => {
    const { container } = render(QuickSearch, {
      props: { entries: sample, onPick: vi.fn() }
    });
    await fireEvent.click(key(container, 'd')!);
    await tick();
    expect(results(container)).toHaveLength(1);
    expect(results(container)[0].textContent).toContain('Dagger');
  });

  it('announces the match count in an aria-live=polite region', async () => {
    const { container } = render(QuickSearch, {
      props: { entries: sample, onPick: vi.fn() }
    });
    const count = container.querySelector('[aria-live="polite"]');
    expect(count).toBeTruthy();
    await fireEvent.click(key(container, 'g')!); // matches Greataxe + Dagger (not Fireball)
    await tick();
    expect(count!.textContent).toContain('2');
  });

  it('disables a dead key via the real disabled attribute', async () => {
    const { container } = render(QuickSearch, {
      props: { entries: sample, onPick: vi.fn() }
    });
    await fireEvent.click(key(container, 'd')!); // query "d" -> Dagger
    await tick();
    expect(key(container, 'z')!.disabled).toBe(true);
    expect(key(container, 'a')!.disabled).toBe(false);
  });

  it('backspace and clear edit the query', async () => {
    const { container } = render(QuickSearch, {
      props: { entries: sample, onPick: vi.fn() }
    });
    await fireEvent.click(key(container, 'd')!);
    await fireEvent.click(key(container, 'a')!);
    await tick();
    expect(results(container)).toHaveLength(1); // "da" -> Dagger
    await fireEvent.click(container.querySelector('button[data-action="clear"]')!);
    await tick();
    expect(container.querySelector('[data-state="empty"]')).toBeTruthy();
  });

  it('shows a no-match state when nothing matches', async () => {
    const { container } = render(QuickSearch, {
      props: { entries: [makeEntry('greataxe', 'Greataxe')], onPick: vi.fn() }
    });
    await fireEvent.click(key(container, 'q')!); // "q" not in Greataxe
    await tick();
    expect(container.querySelector('[data-state="no-match"]')).toBeTruthy();
  });

  it('caps the well at 9 results and shows a +N more footer on overflow', async () => {
    const many = Array.from({ length: 12 }, (_, i) => makeEntry(`axe-${i}`, `Axe ${i}`));
    const { container } = render(QuickSearch, {
      props: { entries: many, onPick: vi.fn() }
    });
    await fireEvent.click(key(container, 'a')!); // all 12 match "a"
    await tick();
    expect(results(container)).toHaveLength(9);
    expect(container.querySelector('.quick-search__more')?.textContent).toContain('3');
  });

  it('calls onPick with the entry when a result is tapped', async () => {
    const onPick = vi.fn();
    const { container } = render(QuickSearch, {
      props: { entries: sample, onPick }
    });
    await fireEvent.click(key(container, 'd')!);
    await tick();
    await fireEvent.click(results(container)[0] as HTMLElement);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0][0].rule.id).toBe('dagger');
  });

  it('marks an illegal result with the illegal class and icon, legal results without', async () => {
    const entries = [
      makeEntry('greataxe', 'Greataxe'),
      makeEntry('dagger', 'Dagger', 'ATTACK', {
        legal: false,
        diagnostics: [{ code: 'Not enough actions' }]
      })
    ];
    const { container } = render(QuickSearch, {
      props: { entries, onPick: vi.fn() }
    });
    await fireEvent.click(key(container, 'a')!); // matches both
    await tick();
    const cells = results(container);
    const greataxeCell = Array.from(cells).find((c) => c.textContent?.includes('Greataxe'))!;
    const daggerCell = Array.from(cells).find((c) => c.textContent?.includes('Dagger'))!;
    expect(daggerCell.classList.contains('quick-search__result--illegal')).toBe(true);
    expect(daggerCell.querySelector('.quick-search__result-illegal-tag')).toBeTruthy();
    expect(greataxeCell.classList.contains('quick-search__result--illegal')).toBe(false);
    expect(greataxeCell.querySelector('.quick-search__result-illegal-tag')).toBeNull();
  });

  it('puts the diagnostic reason in the illegal result aria-label', async () => {
    const entries = [
      makeEntry('dagger', 'Dagger', 'ATTACK', {
        legal: false,
        diagnostics: [{ code: 'Not enough actions' }]
      })
    ];
    const { container } = render(QuickSearch, {
      props: { entries, onPick: vi.fn() }
    });
    await fireEvent.click(key(container, 'd')!);
    await tick();
    expect(results(container)[0].getAttribute('aria-label')).toContain('Not enough actions');
  });

  it('shows the reason tooltip on icon click without picking; body click still picks', async () => {
    const onPick = vi.fn();
    const entries = [
      makeEntry('dagger', 'Dagger', 'ATTACK', {
        legal: false,
        diagnostics: [{ code: 'Not enough actions' }]
      })
    ];
    const { container } = render(QuickSearch, {
      props: { entries, onPick }
    });
    await fireEvent.click(key(container, 'd')!);
    await tick();
    const tag = container.querySelector('.quick-search__result-illegal-tag') as HTMLElement;
    await fireEvent.click(tag);
    await tick();
    expect(container.querySelector('.quick-search__result-tooltip')?.textContent).toContain(
      'Not enough actions'
    );
    expect(onPick).not.toHaveBeenCalled();

    await fireEvent.click(results(container)[0] as HTMLElement);
    expect(onPick).toHaveBeenCalledTimes(1);
  });
});
