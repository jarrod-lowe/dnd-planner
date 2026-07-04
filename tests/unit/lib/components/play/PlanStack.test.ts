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
  'play.addRow.steedSublabel': 'Steed',
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

function makeEntry(
  id: string,
  section: string,
  verb: string = 'ATTACK',
  subject?: string
): AvailableRuleEntry {
  const ui: Record<string, unknown> = { section, name: id, intents: { [verb]: 'default' } };
  if (subject) ui.subject = subject;
  return {
    rule: {
      id,
      phase: 'normal',
      verb: verb as never,
      ui,
      activities: []
    },
    legal: true
  };
}

function makeItem(
  ruleId: string,
  section: string,
  verb: string = 'ATTACK',
  subject?: string
): PlannedItem {
  const ui: Record<string, unknown> = { section, name: ruleId };
  if (subject) ui.subject = subject;
  return {
    instanceId: `inst-${ruleId}`,
    rule: {
      id: ruleId,
      phase: 'normal',
      verb: verb as never,
      ui,
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

  it('does not duplicate steed items in plan rows', () => {
    const playerItem = makeItem('attack-sword', 'action', 'ATTACK');
    const steedItem = makeItem('steed-attack', 'action', 'ATTACK', 'steed');

    const playerEntry = makeEntry('attack-sword', 'action', 'ATTACK');
    const steedEntry = makeEntry('steed-attack', 'action', 'ATTACK', 'steed');

    mount(PlanStack, {
      target: container,
      props: {
        items: [playerItem, steedItem],
        entries: [playerEntry, steedEntry],
        facts: {} as Facts,
        activeAnnotations: [] as Annotation[],
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

  it('creates separate +ADD pickers per subject', () => {
    const playerEntry = makeEntry('attack-sword', 'action', 'ATTACK');
    const steedEntry = makeEntry('steed-attack', 'action', 'ATTACK', 'steed');

    mount(PlanStack, {
      target: container,
      props: {
        items: [],
        entries: [playerEntry, steedEntry],
        facts: {} as Facts,
        activeAnnotations: [] as Annotation[],
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

  it('shows only one picker when all entries are player entries', () => {
    const playerEntry = makeEntry('attack-sword', 'action', 'ATTACK');

    mount(PlanStack, {
      target: container,
      props: {
        items: [],
        entries: [playerEntry],
        facts: {} as Facts,
        activeAnnotations: [] as Annotation[],
        onAddToPlan: noop,
        onRemoveFromPlan: noop,
        onMovePlanItem: noop,
        onSelectionChange: noop,
        onSwapPlanItemRule: noop,
        onEndTurn: noop
      }
    });

    const pickers = container.querySelectorAll('.add-row-picker');
    expect(pickers.length).toBe(1);
  });

  it('filters alternatives by subject', () => {
    const playerItem = makeItem('attack-sword', 'action', 'ATTACK');
    const playerEntry = makeEntry('attack-sword', 'action', 'ATTACK');
    const playerAlt = makeEntry('attack-bow', 'action', 'ATTACK');
    const steedEntry = makeEntry('steed-attack', 'action', 'ATTACK', 'steed');

    mount(PlanStack, {
      target: container,
      props: {
        items: [playerItem],
        entries: [playerEntry, playerAlt, steedEntry],
        facts: {} as Facts,
        activeAnnotations: [] as Annotation[],
        onAddToPlan: noop,
        onRemoveFromPlan: noop,
        onMovePlanItem: noop,
        onSelectionChange: noop,
        onSwapPlanItemRule: noop,
        onEndTurn: noop
      }
    });

    // The player's alternatives should only include player entries, not steed
    const altButtons = container.querySelectorAll('.plan-row__alt-btn');
    const altTexts = Array.from(altButtons).map((el) => el.textContent?.trim());
    expect(altTexts).toContain('attack-bow');
    expect(altTexts).not.toContain('steed-attack');
  });

  it('passes onFollowup through so followup buttons appear for rules with met conditions', () => {
    const item = makeItem('attack-javelin', 'action', 'ATTACK');
    const entryWithFollowup: AvailableRuleEntry = {
      rule: {
        id: 'attack-javelin',
        phase: 'normal',
        verb: 'ATTACK' as never,
        activities: [],
        ui: {
          section: 'action',
          name: 'attack-javelin',
          intents: { ATTACK: 'default' },
          followups: [
            {
              type: 'effect',
              condition: { fact: 'attack.javelin.mastery', operator: 'equals', value: 1 },
              button: 'rule.dnd-5e-2024.attacks.javelin-slow.button',
              addRule: {
                target: 'effect',
                effect: { id: 'effect-javelin-slow', expiry: { kind: 'turns', remaining: 1 } }
              }
            }
          ]
        }
      },
      legal: true
    };
    const onFollowup = vi.fn();

    mount(PlanStack, {
      target: container,
      props: {
        items: [item],
        entries: [entryWithFollowup],
        facts: { 'attack.javelin.mastery': 1 } as unknown as Facts,
        activeAnnotations: [],
        onAddToPlan: noop,
        onRemoveFromPlan: noop,
        onMovePlanItem: noop,
        onSelectionChange: noop,
        onSwapPlanItemRule: noop,
        onEndTurn: noop,
        onFollowup
      }
    });

    const followupButton = container.querySelector('.panel-renderer__followup-button');
    expect(followupButton).toBeTruthy();
  });
});
