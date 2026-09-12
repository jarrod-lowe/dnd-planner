import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushSync } from 'svelte';
import { readable } from 'svelte/store';

vi.mock('$lib/i18n', () => ({
  t: readable((key: string) => key),
  locale: readable('en'),
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en']
}));

vi.mock('$lib/play/playStore.svelte', () => ({
  playStore: {
    state: { modules: [] },
    getAlternativeEntries: vi.fn(() => []),
    getPlannedEntry: vi.fn(() => undefined)
  }
}));

// A row only offers its rules flip when a detail is cached for its detailKey.
vi.mock('$lib/details/index', () => ({
  peekDetail: vi.fn((key: string) =>
    key === 'spell/bless' ? { source: 'srd52', body: [{ text: ['Bless rules text.'] }] } : undefined
  ),
  getDetail: vi.fn(async () => undefined),
  prefetchDetail: vi.fn()
}));

import PlanStackCollapseHarness from './PlanStackCollapseHarness.svelte';
import type { PlannedItem } from '$lib/play/types';
import type { AvailableRuleEntry } from '$lib/rules-view';

function makeEntry(id: string): AvailableRuleEntry {
  return {
    rule: {
      id,
      phase: 'normal',
      ui: { section: 'action', name: id, intents: { ATTACK: 'default' } },
      activities: []
    },
    legal: true,
    applicable: true,
    diagnostics: []
  };
}

function makeItem(id: string): PlannedItem {
  return {
    instanceId: `inst-${id}`,
    rule: { id, phase: 'normal', ui: { section: 'action', name: id }, activities: [] },
    verb: 'ATTACK' as never,
    order: 0,
    originalRuleId: id
  };
}

/** The chevron of the row at `index` — its aria-label names the state it's in. */
function chevron(container: HTMLElement, index: number): HTMLButtonElement {
  const row = container.querySelectorAll('[role="listitem"]')[index];
  return row.querySelector<HTMLButtonElement>(
    '[aria-label="play.planRow.collapseAria"], [aria-label="play.planRow.expandAria"]'
  )!;
}

function isCollapsed(container: HTMLElement, index: number): boolean {
  return chevron(container, index).getAttribute('aria-label') === 'play.planRow.expandAria';
}

describe('PlanStack auto-collapse', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('collapses the rows already in the plan when a new row is added', () => {
    const harness = mount(PlanStackCollapseHarness, {
      target: container,
      props: { entries: [makeEntry('first')] }
    });
    harness.addItem(makeItem('first'));
    flushSync();
    expect(isCollapsed(container, 0)).toBe(false);

    harness.addItem(makeItem('second'));
    flushSync();

    expect(isCollapsed(container, 0)).toBe(true);
    expect(isCollapsed(container, 1)).toBe(false);
  });

  it('leaves a row the player expanded by hand expanded when a new row is added', () => {
    const harness = mount(PlanStackCollapseHarness, {
      target: container,
      props: { entries: [makeEntry('first')] }
    });
    harness.addItem(makeItem('first'));
    flushSync();

    chevron(container, 0).click(); // collapse by hand
    flushSync();
    chevron(container, 0).click(); // expand by hand
    flushSync();
    expect(isCollapsed(container, 0)).toBe(false);

    harness.addItem(makeItem('second'));
    flushSync();

    expect(isCollapsed(container, 0)).toBe(false);
  });
});

describe('PlanStack auto-collapse and rules mode', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('closes the rules pane of a row it collapses', () => {
    const harness = mount(PlanStackCollapseHarness, {
      target: container,
      props: { entries: [makeEntry('bless')] }
    });
    const withRules = makeItem('bless');
    (withRules.rule.ui as Record<string, unknown>).detailKey = 'spell/bless';
    harness.addItem(withRules);
    flushSync();

    // The player flips the row to read its rules text, then adds another row.
    container.querySelector<HTMLButtonElement>('[data-rules-toggle]')!.click();
    flushSync();
    expect(container.querySelector('.rules-shell')).toBeTruthy();

    harness.addItem(makeItem('second'));
    flushSync();

    expect(isCollapsed(container, 0)).toBe(true);
    expect(container.querySelector('.rules-shell')).toBeNull();
  });
});
