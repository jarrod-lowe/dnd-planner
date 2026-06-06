import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';

const translations: Record<string, string> = {
  'play.planStack.title': 'This Turn I Want To...',
  'play.addRow.title': 'Add row',
  'play.addRow.label': '+ ADD',
  'play.addRow.planGroup': 'plan →',
  'play.addRow.recordGroup': 'record →',
  'play.addRow.buildGroup': 'build →',
  'play.plan.endTurn': 'End Turn'
};

vi.mock('$lib/i18n', () => ({
  t: readable((key: string) => translations[key] ?? key),
  locale: readable('en'),
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en']
}));

vi.mock('$lib/play/playStore.svelte', () => ({
  playStore: {
    getAlternativeEntries: vi.fn(() => [])
  }
}));

vi.mock('$lib/play/correctedEntry', () => ({
  correctEntryForPlanItem: vi.fn((entry) => entry)
}));

import PlanStack from '$lib/components/play/PlanStack.svelte';
import type { AvailableRuleEntry, Facts, Annotation } from '$lib/rules-engine';
import type { PlannedItem } from '$lib/play/types';

function makeEntry(id: string, section: string, verb: string = 'ATTACK'): AvailableRuleEntry {
  return {
    rule: {
      id,
      phase: 'normal',
      verb: verb as never,
      ui: { section, name: id },
      activities: []
    },
    legal: true
  };
}

function makeItem(ruleId: string, section: string, verb: string = 'ATTACK'): PlannedItem {
  return {
    instanceId: `inst-${ruleId}`,
    rule: {
      id: ruleId,
      phase: 'normal',
      verb: verb as never,
      ui: { section, name: ruleId },
      activities: []
    },
    verb: verb as never,
    originalRuleId: ruleId
  };
}

describe('PlanStack', () => {
  let container: HTMLElement;
  const noop = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  it('does not duplicate steed items when hasSteed is true', () => {
    const playerItem = makeItem('attack-sword', 'action', 'ATTACK');
    const steedItem = makeItem('steed-attack', 'steed-action', 'ATTACK');

    const playerEntry = makeEntry('attack-sword', 'action', 'ATTACK');
    const steedEntry = makeEntry('steed-attack', 'steed-action', 'ATTACK');

    mount(PlanStack, {
      target: container,
      props: {
        items: [playerItem, steedItem],
        entries: [playerEntry, steedEntry],
        facts: {} as Facts,
        activeAnnotations: [] as Annotation[],
        hasSteed: true,
        steedEntries: [steedEntry],
        onAddToPlan: noop,
        onRemoveFromPlan: noop,
        onMovePlanItem: noop,
        onSelectionChange: noop,
        onSwapPlanItemRule: noop,
        onEndTurn: noop
      }
    });

    // The steed-attack item should appear exactly ONCE, not twice
    const planRows = container.querySelectorAll('[role="listitem"]');
    const rowTexts = Array.from(planRows).map((el) => el.textContent);
    const steedCount = rowTexts.filter((t) => t?.includes('steed-attack')).length;
    expect(steedCount).toBe(1);

    // Total should be 2 (one player, one steed), not 3
    expect(planRows.length).toBe(2);
  });

  it('does not duplicate steed entries in +ADD pickers', () => {
    const playerEntry = makeEntry('attack-sword', 'action', 'ATTACK');
    const steedEntry = makeEntry('steed-attack', 'steed-action', 'ATTACK');

    mount(PlanStack, {
      target: container,
      props: {
        items: [],
        entries: [playerEntry],
        facts: {} as Facts,
        activeAnnotations: [] as Annotation[],
        hasSteed: true,
        steedEntries: [steedEntry],
        onAddToPlan: noop,
        onRemoveFromPlan: noop,
        onMovePlanItem: noop,
        onSelectionChange: noop,
        onSwapPlanItemRule: noop,
        onEndTurn: noop
      }
    });

    // There should be exactly 2 AddRowPickers (player + steed)
    const pickers = container.querySelectorAll('.add-row-picker');
    expect(pickers.length).toBe(2);
  });
});
