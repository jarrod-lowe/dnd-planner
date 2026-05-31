import { describe, it, expect, vi, beforeAll } from 'vitest';
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
  peekDetail: vi.fn(() => ({
    source: 'srd52',
    body: [{ text: ['Rules text.'] }]
  })),
  getDetail: vi.fn(async () => ({
    source: 'srd52',
    body: [{ text: ['Rules text.'] }]
  })),
  prefetchDetail: vi.fn()
}));

// Mock effect utils
vi.mock('$lib/play/effectUtils', () => ({
  getChipState: vi.fn(() => 'normal'),
  isConcentrationEffect: vi.fn(() => false),
  isHiddenEffect: vi.fn(() => false),
  getEffectKind: vi.fn(() => 'ONGOING'),
  getDurationState: vi.fn(() => null),
  getEffectDisplayValue: vi.fn(() => null),
  getEffectLevel: vi.fn(() => null)
}));

import ActiveStateStrip from '$lib/components/play/ActiveStateStrip.svelte';
import type { Rule } from '$lib/rules-engine';
import type { Facts } from '$lib/rules-engine';

const mockFacts = {} as Facts;

function makeEffect(id: string, detailKey?: string): Rule {
  return {
    id,
    activities: [],
    ui: {
      name: `rule.${id}.name`,
      ...(detailKey ? { detailKey } : {})
    }
  };
}

describe('ActiveStateStrip Rules mode', () => {
  it('enters rules mode when an effect chip is clicked', async () => {
    const effect = makeEffect('spell-bless', 'spell/bless');
    const { container } = render(ActiveStateStrip, {
      props: {
        effects: [effect],
        facts: mockFacts,
        committedEffectIds: []
      }
    });
    // Click the flip target button to trigger rules mode
    const flipTarget = container.querySelector('.effect-chip__flip-target');
    expect(flipTarget).toBeTruthy();
    await fireEvent.click(flipTarget!);
    // Should now show the RulesPane
    expect(container.querySelector('.rules-shell')).toBeTruthy();
  });

  it('renders clickable effect chip with native flip button', () => {
    const effect = makeEffect('spell-bless', 'spell/bless');
    const { container } = render(ActiveStateStrip, {
      props: {
        effects: [effect],
        facts: mockFacts,
        committedEffectIds: []
      }
    });
    const flipTarget = container.querySelector('.effect-chip__flip-target');
    expect(flipTarget?.tagName).toBe('BUTTON');
  });

  it('shows return label Effects in rules mode', async () => {
    const effect = makeEffect('spell-bless', 'spell/bless');
    const { container } = render(ActiveStateStrip, {
      props: {
        effects: [effect],
        facts: mockFacts,
        committedEffectIds: []
      }
    });
    const chip = container.querySelector('.effect-chip__flip-target');
    await fireEvent.click(chip!);
    // The return chip should show the localized flip label
    const returnChip = container.querySelector('.rules-rail__return');
    expect(returnChip?.textContent).toContain('play.planRow.flipReturn');
  });

  it('returns to chip view when rules rail is clicked', async () => {
    const effect = makeEffect('spell-bless', 'spell/bless');
    const { container } = render(ActiveStateStrip, {
      props: {
        effects: [effect],
        facts: mockFacts,
        committedEffectIds: []
      }
    });
    const chip = container.querySelector('.effect-chip__flip-target');
    await fireEvent.click(chip!);
    expect(container.querySelector('.rules-shell')).toBeTruthy();

    // Click the rail to return
    const rail = container.querySelector('.rules-rail');
    await fireEvent.click(rail!);
    expect(container.querySelector('.rules-shell')).toBeNull();
    expect(container.querySelector('.effect-chip')).toBeTruthy();
  });

  it('preserves listitem role on flippable chips inside role=list', () => {
    const effect = makeEffect('spell-bless', 'spell/bless');
    const { container } = render(ActiveStateStrip, {
      props: {
        effects: [effect],
        facts: mockFacts,
        committedEffectIds: []
      }
    });
    // The chips container should be a list
    const list = container.querySelector('[role="list"]');
    expect(list).toBeTruthy();
    // Direct children should be listitem, even when the chip has a detail (canFlip=true)
    const listItems = list!.querySelectorAll(':scope > [role="listitem"]');
    expect(listItems.length).toBe(1);
    // No child should have role="group" — that breaks list semantics
    expect(list!.querySelector('[role="group"]')).toBeNull();
  });

  it('does not enter rules mode for effects without detailKey', async () => {
    const { peekDetail } = await import('$lib/details/index');
    (peekDetail as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const effect = makeEffect('no-detail');
    const { container } = render(ActiveStateStrip, {
      props: {
        effects: [effect],
        facts: mockFacts,
        committedEffectIds: []
      }
    });
    const chip = container.querySelector('.effect-chip');
    await fireEvent.click(chip!);
    // Should NOT enter rules mode
    expect(container.querySelector('.rules-shell')).toBeNull();
  });

  it('exits rules mode when the viewed effect is removed from effects', async () => {
    const { peekDetail } = await import('$lib/details/index');
    (peekDetail as ReturnType<typeof vi.fn>).mockReturnValue({
      source: 'srd52',
      body: [{ text: ['Rules text.'] }]
    });

    const effectA = makeEffect('spell-bless', 'spell/bless');
    const effectB = makeEffect('spell-shield');
    const { container, rerender } = render(ActiveStateStrip, {
      props: {
        effects: [effectA, effectB],
        facts: mockFacts,
        committedEffectIds: []
      }
    });

    // Enter rules mode for effectA
    const flipTarget = container.querySelector('.effect-chip__flip-target');
    await fireEvent.click(flipTarget!);
    expect(container.querySelector('.rules-shell')).toBeTruthy();

    // Effect A disappears (e.g. countdown expired on End Turn)
    await rerender({ effects: [effectB], facts: mockFacts, committedEffectIds: [] });

    // Should exit rules mode — no stale rules pane
    expect(container.querySelector('.rules-shell')).toBeNull();
    // Should show the header again (it's hidden while in rules mode)
    expect(container.querySelector('.active-state-strip__header')).toBeTruthy();
  });

  it('shows rail button while detail is loading so user can escape', async () => {
    const { peekDetail, getDetail } = await import('$lib/details/index');
    // peekDetail returns undefined = not cached, not known-absent → enters loading path
    (peekDetail as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    // getDetail hangs so we stay in loading state
    (getDetail as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const effect = makeEffect('spell-slow', 'spell/slow');
    const { container } = render(ActiveStateStrip, {
      props: {
        effects: [effect],
        facts: mockFacts,
        committedEffectIds: []
      }
    });

    // Click the chip to enter rules mode
    const flipTarget = container.querySelector('.effect-chip__flip-target');
    expect(flipTarget).toBeTruthy();
    await fireEvent.click(flipTarget!);

    // While loading, the rail button must be visible so the user can go back
    const rail = container.querySelector('.rules-rail');
    expect(rail).toBeTruthy();

    // Loading message should say "loading details", not "no reference text"
    const loadingEl = container.querySelector('.active-state-strip__rules-loading');
    expect(loadingEl?.textContent).toContain('rules.loadingDetails');

    // Cleanup: restore mocks for subsequent tests
    (peekDetail as ReturnType<typeof vi.fn>).mockReturnValue({
      source: 'srd52',
      body: [{ text: ['Rules text.'] }]
    });
    (getDetail as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      source: 'srd52',
      body: [{ text: ['Rules text.'] }]
    }));
  });
});
