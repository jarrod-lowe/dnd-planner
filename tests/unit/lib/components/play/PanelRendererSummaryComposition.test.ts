import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

// Primary (dice-line) + secondary (slider, unconditional) + a text info + a
// countdown info, so composition order and the information-line short forms
// can be asserted together on one entry.
const createEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'sanctuary',
    description: 'Sanctuary',
    activities: [],
    ui: {
      name: 'rule.spells.sanctuary.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      },
      secondaryControl: {
        type: 'slider',
        var: 'level',
        min: { number: 0 },
        max: { number: 3 }
      },
      information: [
        { type: 'text', label: 'test.info.label' },
        { type: 'countdown', filled: { number: 3 }, total: { number: 4 } }
      ]
    },
    vars: {
      hitBonus: { default: { number: 5 } },
      level: { default: { number: 2 } }
    }
  } as unknown as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

describe('PanelRenderer - summary composition', () => {
  it('orders primary control, secondary control, then information lines', () => {
    const entry = createEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    const items = Array.from(
      container.querySelectorAll('.panel-renderer__body > .panel-renderer__control')
    );
    expect(items.length).toBe(4);
    expect(items[0].querySelector('.panel-renderer__dice-line')).toBeTruthy();
    expect(items[1].querySelector('.panel-renderer__slider-summary')).toBeTruthy();
    expect(items[2].textContent).toContain('test.info.label');
    expect(items[3].classList.contains('panel-renderer__markers-summary')).toBe(true);
  });

  it('renders a countdown as filled/total text, not marker dots', () => {
    const entry = createEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    expect(container.querySelector('.panel-renderer__markers')).toBeNull();
    expect(container.querySelector('.panel-renderer__marker--filled')).toBeNull();
    const countdown = container.querySelector('.panel-renderer__markers-summary');
    expect(countdown?.textContent?.trim()).toBe('3/4');
  });

  it('never emits the separator as a text node', () => {
    const entry = createEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    // The separator is CSS-generated content (::before), so no element's own
    // text content may contain the '·' glyph.
    const items = container.querySelectorAll('.panel-renderer__control');
    for (const item of items) {
      for (const node of item.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          expect(node.textContent).not.toContain('·');
        }
      }
    }
  });

  it('applies the same-line wrapper class to every summary item, secondary included', () => {
    const entry = createEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, summary: true }
    });
    // The secondary control keeps its `--secondary` divider class in full
    // mode; in summary it must still carry the plain `__control` class the
    // separator CSS targets, so it participates in the single line.
    const secondary = container
      .querySelector('.panel-renderer__slider-summary')
      ?.closest('.panel-renderer__control');
    expect(secondary).toBeTruthy();
  });

  // A control that renders nothing in summary mode (an empty text input, an
  // unselected loadout, a select with no matching option) must not leave
  // behind a `.panel-renderer__control` wrapper — that wrapper is exactly
  // what the `::before` separator CSS targets (every `.panel-renderer__control`
  // but the first), so an empty-but-present wrapper paints a separator with
  // nothing beside it: dangling leading/trailing, or doubled between two
  // empties. Asserting on wrapper *count*, never on text content, because the
  // separator itself is CSS-generated content jsdom cannot compute
  // (`getComputedStyle` does not support pseudo-elements) — the wrapper is
  // the one piece of this bug that IS inspectable from the DOM.
  describe('empty summary items emit no wrapper (no dangling/doubled separator)', () => {
    const emptyTextControl = (): Rule =>
      ({
        id: 'empty-text-first',
        description: 'Empty text first',
        activities: [],
        ui: {
          name: 'rule.test.emptyTextFirst.name',
          primaryControl: { type: 'text', var: 'note' },
          secondaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
          }
        },
        vars: { hitBonus: { default: { number: 7 } } }
      }) as unknown as Rule;

    const emptySelectControl = (): Rule =>
      ({
        id: 'empty-select-last',
        description: 'Empty select last',
        activities: [],
        ui: {
          name: 'rule.test.emptySelectLast.name',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
          },
          secondaryControl: {
            type: 'select',
            var: 'unsetChoice',
            options: [{ value: 1, label: 'test.option.one' }]
          }
        },
        vars: { hitBonus: { default: { number: 7 } } }
      }) as unknown as Rule;

    const emptyMiddleControl = (): Rule =>
      ({
        id: 'empty-text-middle',
        description: 'Empty text middle',
        activities: [],
        ui: {
          name: 'rule.test.emptyTextMiddle.name',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
          },
          secondaryControl: { type: 'text', var: 'note' },
          information: [{ type: 'text', label: 'test.info.label' }]
        },
        vars: { hitBonus: { default: { number: 7 } } }
      }) as unknown as Rule;

    const multipleEmptiesControl = (): Rule =>
      ({
        id: 'multiple-empties',
        description: 'Multiple empties',
        activities: [],
        ui: {
          name: 'rule.test.multipleEmpties.name',
          primaryControl: { type: 'text', var: 'note' },
          secondaryControl: {
            type: 'select',
            var: 'unsetChoice',
            options: [{ value: 1, label: 'test.option.one' }]
          },
          information: [{ type: 'text', label: 'test.info.label' }]
        },
        vars: {}
      }) as unknown as Rule;

    function makeEntry(rule: Rule): AvailableRuleEntry {
      return { rule, legal: true, applicable: true, diagnostics: [] };
    }

    it('empty first item: primary text (empty) + secondary dice-line (real) renders one wrapper', () => {
      const entry = makeEntry(emptyTextControl());
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const items = container.querySelectorAll('.panel-renderer__body > .panel-renderer__control');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.panel-renderer__dice-line')).toBeTruthy();
      expect(container.querySelector('.panel-renderer__text-summary')).toBeNull();
    });

    it('empty last item: primary dice-line (real) + secondary select (empty) renders one wrapper', () => {
      const entry = makeEntry(emptySelectControl());
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const items = container.querySelectorAll('.panel-renderer__body > .panel-renderer__control');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.panel-renderer__dice-line')).toBeTruthy();
      expect(container.querySelector('.panel-renderer__select-summary')).toBeNull();
    });

    it('empty middle item: dice-line, empty text, info text renders two wrappers (skipping the middle)', () => {
      const entry = makeEntry(emptyMiddleControl());
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const items = container.querySelectorAll('.panel-renderer__body > .panel-renderer__control');
      expect(items.length).toBe(2);
      expect(items[0].querySelector('.panel-renderer__dice-line')).toBeTruthy();
      expect(items[1].textContent).toContain('test.info.label');
      expect(container.querySelector('.panel-renderer__text-summary')).toBeNull();
    });

    it('several empties in a row: empty text + empty select + info text renders one wrapper', () => {
      const entry = makeEntry(multipleEmptiesControl());
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const items = container.querySelectorAll('.panel-renderer__body > .panel-renderer__control');
      expect(items.length).toBe(1);
      expect(items[0].textContent).toContain('test.info.label');
      expect(container.querySelector('.panel-renderer__text-summary')).toBeNull();
      expect(container.querySelector('.panel-renderer__select-summary')).toBeNull();
    });

    // Same treatment for PanelSegmented (no option matches the current value)
    // and PanelHitDice (every pool's total resolves to 0) — flagged as a
    // follow-up in the original plan and folded in here alongside the header
    // unification, since both emit nothing in summary mode while their
    // sibling controls still expect a clean, undoubled/undangling `·`
    // separator around them.
    const emptySegmentedControl = (): Rule =>
      ({
        id: 'empty-segmented-last',
        description: 'Empty segmented last',
        activities: [],
        ui: {
          name: 'rule.test.emptySegmentedLast.name',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
          },
          secondaryControl: {
            type: 'segmented',
            var: 'passed',
            options: [{ value: 1, label: 'test.option.passed' }]
          }
        },
        vars: { hitBonus: { default: { number: 7 } }, passed: { default: { number: -1 } } }
      }) as unknown as Rule;

    const emptyHitDiceControl = (): Rule =>
      ({
        id: 'empty-hit-dice-first',
        description: 'Empty hit dice first',
        activities: [],
        ui: {
          name: 'rule.test.emptyHitDiceFirst.name',
          primaryControl: {
            type: 'hit-dice',
            unit: 'hp',
            pools: [
              {
                sides: 10,
                total: { fact: 'hitDie.d10.total' },
                remaining: { fact: 'hitDie.d10.remaining' }
              }
            ]
          },
          secondaryControl: {
            type: 'dice-line',
            enabled: { condition: { fact: 'always.true' } },
            dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
          }
        },
        vars: { hitBonus: { default: { number: 7 } } }
      }) as unknown as Rule;

    it('empty segmented (no option matches value): primary dice-line (real) renders one wrapper', () => {
      const entry = makeEntry(emptySegmentedControl());
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const items = container.querySelectorAll('.panel-renderer__body > .panel-renderer__control');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.panel-renderer__dice-line')).toBeTruthy();
      expect(container.querySelector('.panel-renderer__segmented-summary')).toBeNull();
    });

    it('empty hit dice (every pool total resolves to 0): secondary dice-line (real) renders one wrapper', () => {
      const entry = makeEntry(emptyHitDiceControl());
      const { container } = render(PanelRenderer, {
        props: {
          entry,
          editable: true,
          facts: { 'always.true': true, 'hitDie.d10.total': 0 },
          summary: true
        }
      });
      const items = container.querySelectorAll('.panel-renderer__body > .panel-renderer__control');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.panel-renderer__dice-line')).toBeTruthy();
      expect(container.querySelector('.panel-renderer__hit-dice-summary')).toBeNull();
    });

    // A dice-line control never got the empty-wrapper treatment the other
    // five control types received — `parts` was assumed to always contain at
    // least one die, so the wrapper was always emitted unconditionally (see
    // both `{#if primaryDiceLine}` and `{#if secondaryShouldRender &&
    // secondaryDiceLine}` in PanelRenderer). A die whose `sides` is a
    // ValueSource that fails to resolve (no matching var/default) is a real
    // shape some weapon/attack rules can produce, and renders no visible die
    // chip text nor a label/range — exactly the same "wrapper survives with
    // nothing beside it" shape the other five controls already guard against.
    // This shape is DISTINCT from the reported "Roll Initiative" defect
    // (fixed separately as a CSS rendering issue — a dice-line control is
    // never actually empty in that rule), but the construction the plan calls
    // for — "impossible by construction" — means dice-line must get the same
    // treatment as its siblings regardless.
    const unresolvedDie = { sides: { var: 'missingSides' } };

    const emptyDiceLineFirst = (): Rule =>
      ({
        id: 'empty-dice-line-first',
        description: 'Empty dice-line first',
        activities: [],
        ui: {
          name: 'rule.test.emptyDiceLineFirst.name',
          primaryControl: { type: 'dice-line', dice: [unresolvedDie] },
          secondaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
          }
        },
        vars: { hitBonus: { default: { number: 7 } } }
      }) as unknown as Rule;

    const emptyDiceLineLast = (): Rule =>
      ({
        id: 'empty-dice-line-last',
        description: 'Empty dice-line last',
        activities: [],
        ui: {
          name: 'rule.test.emptyDiceLineLast.name',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
          },
          secondaryControl: { type: 'dice-line', dice: [unresolvedDie] }
        },
        vars: { hitBonus: { default: { number: 7 } } }
      }) as unknown as Rule;

    const emptyDiceLineMiddle = (): Rule =>
      ({
        id: 'empty-dice-line-middle',
        description: 'Empty dice-line middle',
        activities: [],
        ui: {
          name: 'rule.test.emptyDiceLineMiddle.name',
          primaryControl: {
            type: 'dice-line',
            dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
          },
          secondaryControl: { type: 'dice-line', dice: [unresolvedDie] },
          information: [{ type: 'text', label: 'test.info.label' }]
        },
        vars: { hitBonus: { default: { number: 7 } } }
      }) as unknown as Rule;

    it('empty first item: primary dice-line (empty) + secondary dice-line (real) renders one wrapper with no leading separator', () => {
      const entry = makeEntry(emptyDiceLineFirst());
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const items = container.querySelectorAll('.panel-renderer__body > .panel-renderer__control');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.panel-renderer__dice-line')).toBeTruthy();
      // The single remaining item is genuinely first-child (no dangling
      // wrapper ahead of it), so it never matches the separator selector.
      expect(
        items[0].matches('.panel-renderer--summary .panel-renderer__control:not(:first-child)')
      ).toBe(false);
    });

    it('empty last item: primary dice-line (real) + secondary dice-line (empty) renders one wrapper', () => {
      const entry = makeEntry(emptyDiceLineLast());
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const items = container.querySelectorAll('.panel-renderer__body > .panel-renderer__control');
      expect(items.length).toBe(1);
      expect(items[0].querySelector('.panel-renderer__dice-line')).toBeTruthy();
    });

    it('empty middle item: dice-line, empty dice-line, info text renders two wrappers (skipping the middle)', () => {
      const entry = makeEntry(emptyDiceLineMiddle());
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, summary: true }
      });
      const items = container.querySelectorAll('.panel-renderer__body > .panel-renderer__control');
      expect(items.length).toBe(2);
      expect(items[0].querySelector('.panel-renderer__dice-line')).toBeTruthy();
      expect(items[1].textContent).toContain('test.info.label');
    });
  });
});
