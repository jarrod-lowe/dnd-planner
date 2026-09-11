import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Mock Element.animate for JSDOM (PanelDiceLine animates the chip on roll).
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

// Mock detail service — a detail is available, so the flip button renders
// (it's one of the left-column controls a collapsed strip must NOT count as
// "focusable content inside the strip").
vi.mock('$lib/details/index', () => ({
  peekDetail: vi.fn(() => ({ source: 'srd52', body: [{ text: ['test'] }] })),
  getDetail: vi.fn(async () => null),
  prefetchDetail: vi.fn()
}));

// One informational-rider annotation, so PlanRow's own mod-chip row has
// something to show when expanded (and to hide when collapsed).
vi.mock('$lib/play/annotations', () => ({
  getMatchingAnnotations: vi.fn(() => [
    { key: 'test.annotation', rider: { label: 'test.annotation.label' } }
  ])
}));

// Real descriptor with a simple d20+3 dice-line primary control, so the
// panel's control short form has something concrete to assert on.
vi.mock('$lib/components/play/panel-renderer/extractPanelDescriptor', () => ({
  extractPanelDescriptor: vi.fn(() => ({
    name: 'test.spell.name',
    annotationLabels: [],
    primaryControl: {
      type: 'dice-line',
      dice: [{ sides: 20, bonus: { var: 'bonus' } }]
    }
  }))
}));

vi.mock('$lib/play/groupChoicesByVerb', () => ({
  getSubBucket: vi.fn(() => 'default'),
  subBucketLabelKey: vi.fn(() => 'play.verbs.ATTACK')
}));

vi.mock('$lib/components/play/tooltipSingleton', () => ({
  closeActiveTooltip: vi.fn(),
  registerTooltipClose: vi.fn()
}));

import PlanRow from '$lib/components/play/PlanRow.svelte';
import type { PlannedItem } from '$lib/play/types';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

function makeItem(): PlannedItem {
  return {
    instanceId: 'inst-1',
    rule: {
      id: 'roll-initiative',
      activities: [],
      ui: { actionCost: ['action'], detailKey: 'spell/sleep' }
    },
    order: 0,
    verb: 'AID'
  };
}

const mockEntry: AvailableRuleEntry = {
  rule: {
    id: 'roll-initiative',
    activities: [],
    vars: { bonus: { default: { number: 3 } } }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
};

const mockAlternative: AvailableRuleEntry = {
  rule: { id: 'alt-1', activities: [] } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
};

// An upcast: authored L1, cast at slot level 2, no slot-level slider — see
// resolveCostTags in $lib/play/costTags.ts.
function makeUpcastItem(): PlannedItem {
  return {
    instanceId: 'inst-upcast',
    rule: {
      id: 'burning-hands',
      activities: [],
      ui: { actionCost: ['L1'], detailKey: 'spell/burning-hands' },
      selections: { slotLevel: 2 }
    },
    order: 0,
    verb: 'ATTACK'
  };
}

const mockUpcastEntry: AvailableRuleEntry = {
  rule: {
    id: 'burning-hands',
    activities: [],
    ui: { actionCost: ['L1'] },
    selections: { slotLevel: 2 }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
};

const mockFacts = {} as import('$lib/rules-view').Facts;

async function collapse(container: HTMLElement) {
  const chevron = container.querySelector(
    '[aria-label="play.planRow.collapseAria"], [aria-label="play.planRow.expandAria"]'
  ) as HTMLElement;
  await fireEvent.click(chevron);
}

describe('PlanRow collapsed summary strip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cost pills and the name when collapsed', async () => {
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: [],
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onRemove: vi.fn()
      }
    });

    await collapse(container);

    const pills = container.querySelectorAll('.plan-row__cost-tag');
    expect(pills.length).toBeGreaterThan(0);
    // The name comes from PanelRenderer's own header — the SAME markup the
    // expanded row uses, not a separate PlanRow-owned copy (see docs/plans/
    // ideas/better-summary-panels.md "Correction (2026-09-10)").
    const name = container.querySelector('.plan-row__content .panel-renderer__title');
    expect(name).toBeTruthy();
    expect(name?.textContent).toContain('test.spell.name');
  });

  it("renders the panel's control short form as non-interactive when collapsed", async () => {
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });

    await collapse(container);

    const chip = container.querySelector('.plan-row__right .panel-renderer__die-chip');
    expect(chip).toBeTruthy();
    // Non-interactive short form is a <span>, never a <button> — this is what
    // distinguishes a genuine summary render from the old display:none hide,
    // which left the fully-interactive (button) markup in the DOM.
    expect(chip?.tagName).toBe('SPAN');
    expect(chip?.textContent).toContain('d20');
    expect(chip?.textContent).toContain('+3');
  });

  it('contains no focusable elements inside the strip when collapsed', async () => {
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: [],
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onRemove: vi.fn()
      }
    });

    await collapse(container);

    const strip = container.querySelector('.plan-row__right') as HTMLElement;
    expect(strip).toBeTruthy();
    const interactive = strip.querySelectorAll('button, input, select, [tabindex]');
    expect(interactive.length).toBe(0);

    // Sanity: the left column's controls (move up/down, chevron, undo, flip)
    // are untouched and still present/interactive outside the strip.
    const leftButtons = container.querySelectorAll('.plan-row__left button');
    expect(leftButtons.length).toBeGreaterThan(0);
  });

  it('restores full interactive controls when expanded again', async () => {
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });

    await collapse(container);
    expect(container.querySelector('.plan-row__right .panel-renderer__die-chip')?.tagName).toBe(
      'SPAN'
    );

    await collapse(container); // toggle back to expanded

    const chip = container.querySelector('.plan-row__right .panel-renderer__die-chip');
    expect(chip?.tagName).toBe('BUTTON');
  });

  it('keeps a rolled value visible after collapsing (mount preserved)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8); // floor(0.8*20)+1 = 17, +3 = 20
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });

    const chipButton = container.querySelector(
      '.plan-row__right .panel-renderer__die-chip'
    ) as HTMLElement;
    expect(chipButton.tagName).toBe('BUTTON');
    await fireEvent.click(chipButton);

    await collapse(container);

    const summaryChip = container.querySelector('.plan-row__right .panel-renderer__die-chip');
    expect(summaryChip?.tagName).toBe('SPAN');
    expect(summaryChip?.textContent).toContain('20');
    expect(summaryChip?.textContent).not.toContain('d20');
  });

  it('the warning indicator is the ONE allowed focusable element inside the strip when collapsed', async () => {
    // Explicit, deliberate override of the earlier "nothing focusable inside
    // the collapsed strip" rule: the human found the `(!)` on a collapsed row
    // unreadable because it was rendered as an inert, non-clickable copy. The
    // warning button is now allowed — and required — to stay focusable and
    // clickable when collapsed; everything else in the strip stays inert, and
    // the chevron remains the only expander. See docs/plans/ideas/
    // better-summary-panels.md "Correction (2026-09-10)".
    const illegalEntry: AvailableRuleEntry = {
      ...mockEntry,
      legal: false,
      diagnostics: [{ code: 'play.diagnostics.someError', severity: 'error' }]
    };
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: illegalEntry,
        facts: mockFacts,
        activeAnnotations: [],
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onRemove: vi.fn()
      }
    });

    await collapse(container);

    const strip = container.querySelector('.plan-row__right') as HTMLElement;
    const warning = strip.querySelector('.warning-indicator');
    expect(warning).toBeTruthy();
    expect(warning?.tagName).toBe('BUTTON');

    const interactive = Array.from(strip.querySelectorAll('button, input, select, [tabindex]'));
    expect(interactive).toEqual([warning]);
  });

  it('renders the pills, name and panel short form as three stacked lines', async () => {
    // Corrected architecture (docs/plans/ideas/better-summary-panels.md
    // "Correction (2026-09-10)"): PlanRow owns only line 1 (cost pills) as
    // its own direct child. Lines 2 and 3 (name+warning header, then the
    // control short-form strip) both come from the SAME `PanelRenderer`
    // instance, mounted once inside `.plan-row__content` — not a second,
    // PlanRow-owned copy of the name.
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });

    await collapse(container);

    const strip = container.querySelector('.plan-row__right') as HTMLElement;
    const pillsLine = strip.querySelector(':scope > .plan-row__cost-chips');
    const content = strip.querySelector(':scope > .plan-row__content');

    // Two direct children of the strip: pills, then the mounted panel.
    expect(pillsLine).toBeTruthy();
    expect(content).toBeTruthy();
    const children = Array.from(strip.children);
    expect(children.indexOf(pillsLine as Element)).toBeLessThan(
      children.indexOf(content as Element)
    );

    // Inside the panel: header (name line) and body (short-form line) are
    // two distinct sibling elements, in that order, neither containing the
    // other's content.
    const header = content?.querySelector('.panel-renderer__header');
    const body = content?.querySelector('.panel-renderer__body');
    expect(header).toBeTruthy();
    expect(body).toBeTruthy();
    expect(header?.querySelector('.panel-renderer__title')).toBeTruthy();
    expect(body?.querySelector('.panel-renderer__title')).toBeNull();
    expect(body?.querySelector('.panel-renderer__die-chip')).toBeTruthy();
    expect(header?.querySelector('.panel-renderer__die-chip')).toBeNull();
  });

  it("renders exactly one warning indicator, inside PanelRenderer's own header, when collapsed", async () => {
    const illegalEntry: AvailableRuleEntry = {
      ...mockEntry,
      legal: false,
      diagnostics: [{ code: 'play.diagnostics.someError', severity: 'error' }]
    };
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: illegalEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });

    await collapse(container);

    const strip = container.querySelector('.plan-row__right') as HTMLElement;
    const warnings = strip.querySelectorAll('.warning-indicator');
    // Not duplicated: PlanRow no longer renders any copy of its own — the
    // ONE warning comes from PanelRenderer's header, the same code path used
    // in the expanded row.
    expect(warnings.length).toBe(1);

    const content = strip.querySelector(':scope > .plan-row__content') as HTMLElement;
    // The warning is a sibling of the header inside `.panel-renderer`, not
    // nested inside it — it's absolutely positioned to overlay the title
    // (see `.panel-renderer :global(.warning-indicator)`), matching
    // PanelRenderer-positioning.test.ts's "does not show warning indicator
    // inside header area".
    expect(content.querySelector('.warning-indicator')).toBeTruthy();
    expect(content.querySelector('.panel-renderer__header .warning-indicator')).toBeNull();

    // Interactive: a real button, not a static role="img" span — clickable
    // and focusable, exactly as in the expanded row.
    const warning = content.querySelector('.warning-indicator') as HTMLElement;
    expect(warning.tagName).toBe('BUTTON');
    expect(warning.hasAttribute('aria-label')).toBe(true);
  });

  it('reveals the warning message when the indicator is clicked while collapsed', async () => {
    const illegalEntry: AvailableRuleEntry = {
      ...mockEntry,
      legal: false,
      diagnostics: [{ code: 'play.diagnostics.someError', severity: 'error' }]
    };
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: illegalEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });

    await collapse(container);

    const warning = container.querySelector('.plan-row__content .warning-indicator') as HTMLElement;
    expect(container.querySelector('.warning-tooltip')).toBeNull();

    await fireEvent.click(warning);

    const tooltip = container.querySelector('.warning-tooltip');
    expect(tooltip).toBeTruthy();
    expect(tooltip?.textContent).toContain('play.diagnostics.someError');
  });

  it('does not render mod chips or alternatives when collapsed', async () => {
    const { container } = render(PlanRow, {
      props: {
        item: makeItem(),
        entry: mockEntry,
        facts: mockFacts,
        activeAnnotations: [],
        alternatives: [mockAlternative]
      }
    });

    // Expanded: both are present.
    expect(container.querySelector('.plan-row__mod-chips')).toBeTruthy();
    expect(container.querySelector('.plan-row__alternatives')).toBeTruthy();

    await collapse(container);

    expect(container.querySelector('.plan-row__mod-chips')).toBeNull();
    expect(container.querySelector('.plan-row__alternatives')).toBeNull();
  });
});

describe('upcast cost pill affordance (Codex P2: collapsed span advertises a click it cannot do)', () => {
  // The expanded upcast pill is a real, clickable <button> with a tooltip
  // trigger. The collapsed strip is inert by design (see PlanRowSummary's
  // "contains no focusable elements" test above) so the SAME pill renders as
  // a non-interactive <span> there — but it kept the interactive styling
  // (cursor: pointer, hover colour change) because both elements shared the
  // single `.plan-row__cost-tag--upcast` class. That class must still mark
  // the pill as "an upcast" (border/colour) in both renders; only the
  // affordance that says "you can click this" belongs on the button.
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the upcast pill as a <span> when collapsed and a <button> when expanded', async () => {
    const { container } = render(PlanRow, {
      props: {
        item: makeUpcastItem(),
        entry: mockUpcastEntry,
        facts: mockFacts,
        activeAnnotations: []
      }
    });

    const expandedPill = container.querySelector('.plan-row__cost-tag--upcast');
    expect(expandedPill).toBeTruthy();
    expect(expandedPill?.tagName).toBe('BUTTON');

    const chevron = container.querySelector(
      '[aria-label="play.planRow.collapseAria"], [aria-label="play.planRow.expandAria"]'
    ) as HTMLElement;
    await fireEvent.click(chevron);

    const collapsedPill = container.querySelector('.plan-row__cost-tag--upcast');
    expect(collapsedPill).toBeTruthy();
    expect(collapsedPill?.tagName).toBe('SPAN');
  });

  // jsdom applies no component <style> cascade (getComputedStyle would be a
  // false green here — see PlanRowWarningTooltipClip.test.ts and DieChip.test.ts
  // for the same limitation). This reads PlanRow's own stylesheet instead: the
  // interactive-only rules (cursor, hover, focus-visible, the hover
  // transition) must be scoped to `button.plan-row__cost-tag--upcast`, never
  // to the bare `.plan-row__cost-tag--upcast` class the collapsed <span>
  // still carries.
  const planRowSource = readFileSync(
    join(process.cwd(), 'src/lib/components/play/PlanRow.svelte'),
    'utf8'
  );

  function styleBlock(source: string): string {
    const start = source.indexOf('<style>');
    const end = source.indexOf('</style>');
    if (start === -1 || end === -1) throw new Error('no <style> block found');
    return source.slice(start, end);
  }

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

  it('keeps the visual identity (border/colour) on the bare shared class, without the click affordance', () => {
    const css = styleBlock(planRowSource);
    const bareRule = ruleBody(css, '.plan-row__cost-tag--upcast {');
    expect(bareRule).toMatch(/border:\s*1px solid var\(--md-sys-color-error\)/);
    expect(bareRule).toMatch(/color:\s*var\(--md-sys-color-error\)/);
    // The bare, element-unscoped rule must not carry the affordance that
    // tells the (possibly non-interactive) element it's clickable.
    expect(bareRule).not.toMatch(/cursor\s*:\s*pointer/);
  });

  it('scopes cursor:pointer and the hover transition to the real button only', () => {
    const css = styleBlock(planRowSource);
    expect(css).toMatch(/button\.plan-row__cost-tag--upcast\s*\{[^}]*cursor:\s*pointer[^}]*\}/);
  });

  it('scopes :hover and :focus-visible colour changes to the button, not the bare class', () => {
    const css = styleBlock(planRowSource);
    // Every :hover / :focus-visible rule naming the upcast pill must be
    // element-scoped to `button`, never applied to the bare class (which the
    // collapsed, non-interactive <span> also carries).
    const affordanceLines = css
      .split('\n')
      .filter((line) => /plan-row__cost-tag--upcast\s*:\s*(hover|focus-visible)/.test(line));
    expect(affordanceLines.length).toBeGreaterThan(0);
    for (const line of affordanceLines) {
      expect(line.trim()).toMatch(/^button\.plan-row__cost-tag--upcast:(hover|focus-visible)/);
    }
  });
});
