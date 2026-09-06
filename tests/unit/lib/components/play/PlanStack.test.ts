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
  'play.plan.endTurn': 'End Turn',
  'play.costTags.action': 'ACT',
  'play.costTags.L2': 'L2',
  'play.costTags.L4': 'L4',
  'play.costTags.free': 'FREE'
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
    // PlanStack hands the character's modules down to the loadout control.
    state: { modules: [] },
    getAlternativeEntries: vi.fn(() => []),
    getPlannedEntry: vi.fn(() => undefined)
  }
}));

import { playStore } from '$lib/play/playStore.svelte';
import PlanStack from '$lib/components/play/PlanStack.svelte';
import type { AvailableRuleEntry, Facts, Annotation } from '$lib/rules-view';
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
      ui,
      activities: []
    },
    legal: true,
    applicable: true,
    diagnostics: []
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
      ui,
      activities: []
    },
    verb: verb as never,
    order: 0,
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

  it('row legality comes from the per-instance planned entry, not the hypothetical catalog', () => {
    const entry = makeEntry('attack', 'action-attack');
    const first = makeItem('attack', 'action-attack');
    const second = { ...makeItem('attack', 'action-attack'), instanceId: 'inst-attack-2' };

    // The engine's per-instance verdicts: first copy legal, second over-spends.
    vi.mocked(playStore.getPlannedEntry).mockImplementation((id: string) => {
      if (id === first.instanceId) return { ...entry, legal: true, diagnostics: [] };
      if (id === second.instanceId)
        return { ...entry, legal: false, diagnostics: [{ code: 'no_action', severity: 'error' }] };
      return undefined;
    });
    // The hypothetical catalog (plan minus this row) says the offer is illegal for
    // BOTH rows — the old, wrong source of row legality. It must not win.
    vi.mocked(playStore.getAlternativeEntries).mockReturnValue([
      { ...entry, legal: false, diagnostics: [{ code: 'no_action', severity: 'error' }] }
    ]);

    mount(PlanStack, {
      target: container,
      props: {
        items: [first, second],
        entries: [entry],
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

    const rows = container.querySelectorAll('.plan-row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.warning-indicator--illegal')).toBeNull();
    expect(rows[1].querySelector('.warning-indicator--illegal')).toBeTruthy();
  });

  it('marks a skipped gated row inapplicable, not resolved from the reopened catalog', () => {
    // The instance was skipped at its `when` step (getPlannedEntry undefined), but
    // a later plan row reopened the offer, so it is back in the catalog `entries`.
    // The row must show inapplicable — NOT the catalog's legal/applicable — because
    // the fold advertised nothing for it (else End Turn commits a different plan).
    const item = makeItem('attack-sword', 'action-attack');
    const reopened = makeEntry('attack-sword', 'action-attack'); // legal + applicable
    vi.mocked(playStore.getPlannedEntry).mockReturnValue(undefined);

    mount(PlanStack, {
      target: container,
      props: {
        items: [item],
        entries: [reopened],
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

    const rows = container.querySelectorAll('.plan-row');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.warning-indicator--inapplicable')).toBeTruthy();
    expect(rows[0].querySelector('.warning-indicator--illegal')).toBeNull();
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

  describe('cost chips follow the slot-level selection', () => {
    // A cast with a slot-level slider (e.g. Find Steed): the authored tag is the
    // spell's base level, but the chip must show what the cast will actually
    // spend — the free use (0) or the selected (possibly upcast) slot.
    function makeSpellItem(slotLevel?: number): PlannedItem {
      const item = makeItem('cast-find-steed', 'action-spell');
      (item.rule.ui as Record<string, unknown>).actionCost = ['action', 'L2'];
      if (slotLevel !== undefined) item.rule.selections = { slotLevel };
      return item;
    }

    function mountWith(item: PlannedItem) {
      mount(PlanStack, {
        target: container,
        props: {
          items: [item],
          entries: [],
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
    }

    function chipTexts(): string[] {
      return Array.from(container.querySelectorAll('.plan-row__cost-tag')).map(
        (el) => el.textContent?.trim() ?? ''
      );
    }

    it('shows FREE when the free use (level 0) is selected', () => {
      mountWith(makeSpellItem(0));
      expect(chipTexts()).toContain('FREE');
      expect(chipTexts()).not.toContain('L2');
    });

    it('shows the upcast level when a higher slot is selected', () => {
      mountWith(makeSpellItem(4));
      expect(chipTexts()).toContain('L4');
      expect(chipTexts()).not.toContain('L2');
    });

    it('keeps the authored tag when there is no slot-level selection', () => {
      mountWith(makeSpellItem());
      expect(chipTexts()).toContain('L2');
    });
  });

  it('passes onFollowup through so followup buttons appear for rules with met conditions', () => {
    const item = makeItem('attack-javelin', 'action', 'ATTACK');
    const entryWithFollowup: AvailableRuleEntry = {
      rule: {
        id: 'attack-javelin',
        phase: 'normal',
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
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const onFollowup = vi.fn();
    // A planned item that ran resolves from its per-instance entry (which carries
    // the followups), not the catalog fallback.
    vi.mocked(playStore.getPlannedEntry).mockReturnValue(entryWithFollowup);

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
