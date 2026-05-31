import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// Mock Element.animate for JSDOM
beforeAll(() => {
  Element.prototype.animate = vi.fn();
});

// Mock i18n
vi.mock('$lib/i18n', () => ({
  t: {
    subscribe: (cb: (v: (k: string) => string) => void) => {
      cb((k: string) => k);
      return { unsubscribe: () => {} };
    }
  },
  locale: {
    subscribe: (cb: (v: string) => void) => {
      cb('en');
      return { unsubscribe: () => {} };
    },
    get: () => 'en'
  }
}));

// Mock detail service
vi.mock('$lib/details/index', () => ({
  peekDetail: vi.fn(() => undefined),
  getDetail: vi.fn(async () => ({
    source: 'srd52',
    meta: 'Level 1 Enchantment',
    fields: [
      { labelKey: 'rules.field.castingTime', value: 'Action' },
      { labelKey: 'rules.field.range', value: '60 feet' }
    ],
    body: [{ text: ['Rules text for testing.'] }]
  })),
  prefetchDetail: vi.fn()
}));

// Mock annotations
vi.mock('$lib/play/annotations', () => ({
  getMatchingAnnotations: vi.fn(() => [])
}));

// Mock panel descriptor
vi.mock('$lib/components/play/panel-renderer/extractPanelDescriptor', () => ({
  extractPanelDescriptor: vi.fn(() => ({
    name: 'test.spell.name',
    annotationLabels: []
  }))
}));

// Mock group choices
vi.mock('$lib/play/groupChoicesByVerb', () => ({
  getSubBucket: vi.fn(() => 'default'),
  subBucketLabelKey: vi.fn(() => 'play.verbs.ATTACK')
}));

// Mock tooltip singleton
vi.mock('$lib/components/play/tooltipSingleton', () => ({
  closeActiveTooltip: vi.fn(),
  registerTooltipClose: vi.fn()
}));

import PlanRow from '$lib/components/play/PlanRow.svelte';
import { peekDetail, getDetail } from '$lib/details/index';
import type { PlannedItem } from '$lib/play/types';
import type { Rule } from '$lib/rules-engine';

const mockedPeekDetail = vi.mocked(peekDetail);
const mockedGetDetail = vi.mocked(getDetail);

function makeItem(overrides?: Partial<Rule>): PlannedItem {
  return {
    instanceId: 'inst-1',
    rule: {
      id: 'spell-sleep',
      activities: [],
      ui: { actionCost: ['action'], detailKey: 'spell/sleep', ...overrides?.ui },
      ...overrides
    },
    order: 0,
    verb: 'AID'
  };
}

const mockEntry = {
  rule: { id: 'spell-sleep', activities: [] } as Rule,
  legal: true,
  diagnostics: []
};

const mockFacts = {} as import('$lib/rules-engine').Facts;

describe('PlanRow Rules mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows rules toggle on verb rail when detail is available', () => {
    mockedPeekDetail.mockReturnValue({
      source: 'srd52',
      body: [{ text: ['test'] }]
    });
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });
    const rail = container.querySelector('.plan-row__verb-label');
    expect(rail).toBeTruthy();
    // The verb rail should be clickable for rules toggle
    const toggle = container.querySelector('[data-rules-toggle]');
    expect(toggle).toBeTruthy();
  });

  it('hides rules toggle when no detail is available', () => {
    mockedPeekDetail.mockReturnValue(null);
    const { container } = render(PlanRow, {
      props: {
        item: makeItem({ ui: {} }),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });
    const toggle = container.querySelector('[data-rules-toggle]');
    expect(toggle).toBeNull();
  });

  it('switches to rules mode when verb rail is clicked', async () => {
    mockedPeekDetail.mockReturnValue({
      source: 'srd52',
      body: [{ text: ['test'] }]
    });
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });
    const toggle = container.querySelector('[data-rules-toggle]');
    await fireEvent.click(toggle!);
    // Should show RulesPane
    expect(container.querySelector('.rules-shell')).toBeTruthy();
    expect(container.querySelector('.rules-rail__label')?.textContent).toContain('test.spell.name');
  });

  it('returns to plan mode when return chip is clicked', async () => {
    mockedPeekDetail.mockReturnValue({
      source: 'srd52',
      body: [{ text: ['test'] }]
    });
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });
    // Enter rules mode
    const toggle = container.querySelector('[data-rules-toggle]');
    await fireEvent.click(toggle!);
    expect(container.querySelector('.rules-shell')).toBeTruthy();

    // Click return
    const rail = container.querySelector('.rules-rail');
    await fireEvent.click(rail!);
    // Should be back in plan mode
    expect(container.querySelector('.rules-shell')).toBeNull();
    expect(container.querySelector('.plan-row__content')).toBeTruthy();
  });

  it('falls back to getDetail when peek returns undefined', async () => {
    mockedPeekDetail.mockReturnValue(undefined);
    mockedGetDetail.mockResolvedValue({
      source: 'srd52',
      body: [{ text: ['Loaded from fetch.'] }]
    });
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });
    const toggle = container.querySelector('[data-rules-toggle]');
    await fireEvent.click(toggle!);
    // Should have called getDetail
    expect(mockedGetDetail).toHaveBeenCalledWith('spell/sleep');
  });

  it('shows illegal warning indicator in rules mode', async () => {
    mockedPeekDetail.mockReturnValue({
      source: 'srd52',
      body: [{ text: ['test'] }]
    });
    const illegalEntry = {
      rule: { id: 'spell-sleep', activities: [] } as Rule,
      legal: false,
      diagnostics: [{ code: 'play.diagnostics.alreadyConcentrating' }]
    };
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: illegalEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });
    // Enter rules mode
    const toggle = container.querySelector('[data-rules-toggle]');
    await fireEvent.click(toggle!);
    // Should show RulesPane
    expect(container.querySelector('.rules-shell')).toBeTruthy();
    // Should also show warning indicator for illegal entry
    const warning = container.querySelector('.warning-indicator--illegal');
    expect(warning).toBeTruthy();
  });

  it('ignores stale detail fetch when item has changed', async () => {
    mockedPeekDetail.mockReturnValue(undefined);

    const detailA = { source: 'srd52', body: [{ text: ['Sleep rules text.'] }] };

    let resolveA!: (d: typeof detailA) => void;
    const promiseA = new Promise<typeof detailA>((resolve) => {
      resolveA = resolve;
    });
    const promiseB = new Promise(() => {}); // intentionally never resolves

    mockedGetDetail.mockImplementation((key: string) => {
      if (key === 'spell/sleep') return promiseA;
      if (key === 'spell/heal') return promiseB;
      return Promise.resolve(null);
    });

    const itemA = makeItem(); // detailKey = 'spell/sleep'
    const itemB = makeItem({
      id: 'spell-heal',
      ui: { actionCost: ['action'], detailKey: 'spell/heal' }
    });

    const { container, rerender } = render(PlanRow, {
      props: {
        item: itemA,
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });

    // Toggle rules mode for item A → loading, fetch starts
    let toggle = container.querySelector('[data-rules-toggle]');
    await fireEvent.click(toggle!);
    expect(container.querySelector('.plan-row__rules-loading')).toBeTruthy();

    // Exit rules mode
    toggle = container.querySelector('[data-rules-toggle]');
    await fireEvent.click(toggle!);

    // Switch to item B (different detailKey)
    await rerender({ item: itemB, entry: mockEntry, facts: mockFacts, activeAnnotations: [] });

    // Enter rules mode for item B → new fetch starts
    toggle = container.querySelector('[data-rules-toggle]');
    await fireEvent.click(toggle!);
    expect(container.querySelector('.plan-row__rules-loading')).toBeTruthy();

    // Resolve A's stale promise
    resolveA(detailA);
    await promiseA;
    await new Promise((r) => setTimeout(r, 0));

    // A's detail should NOT appear — loading should continue for B
    expect(container.querySelector('.plan-row__rules-loading')).toBeTruthy();
  });

  it('shows loading details text while detail is fetching', async () => {
    mockedPeekDetail.mockReturnValue(undefined);
    // getDetail hangs so we stay in loading state
    mockedGetDetail.mockReturnValue(new Promise(() => {}));
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });
    const toggle = container.querySelector('[data-rules-toggle]');
    await fireEvent.click(toggle!);
    // Loading message should say "loading details", not "no reference text"
    const loadingEl = container.querySelector('.plan-row__rules-loading');
    expect(loadingEl?.textContent).toContain('rules.loadingDetails');
  });
});
