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
