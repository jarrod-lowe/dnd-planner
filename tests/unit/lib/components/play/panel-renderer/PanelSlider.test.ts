import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

const createSliderEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: {
    id: 'move',
    description: 'Move',
    activities: [],
    ui: {
      section: 'move',
      name: 'rule.dnd-5e-2024.movement.move-walk.name',
      primaryControl: {
        type: 'slider',
        var: 'distance',
        max: { var: 'maxDistance' }
      }
    },
    vars: {
      distance: { default: { fact: 'character.movement.remaining' } },
      maxDistance: { default: { fact: 'character.movement.total' } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

describe('PanelRenderer - slider control', () => {
  it('renders a slider when primaryControl type is slider', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    expect(container.querySelector('input[type="range"]')).toBeTruthy();
  });

  it('sets slider max from resolved value', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.max).toBe('30');
  });

  it('renders a disabled slider when read-only', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: false, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.disabled).toBe(true);
    expect(slider.value).toBe('20');
    expect(slider.max).toBe('30');
  });

  it('fires onSelectionChange when slider value changes', async () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, onSelectionChange }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '15';
    await fireEvent.input(slider);
    expect(onSelectionChange).toHaveBeenCalledWith({ distance: 15 });
  });

  it('sets slider min from resolved value when provided', () => {
    const entry = createSliderEntry({
      rule: {
        ...createSliderEntry().rule,
        ui: {
          ...createSliderEntry().rule.ui,
          primaryControl: {
            type: 'slider',
            var: 'distance',
            min: { number: 5 },
            max: { var: 'maxDistance' }
          }
        }
      } as Rule
    });
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.min).toBe('5');
  });

  it('defaults slider min to 0 when not provided', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.min).toBe('0');
  });

  it('renders slider for secondaryControl when type is slider', () => {
    const entry = createSliderEntry({
      rule: {
        ...createSliderEntry().rule,
        ui: {
          ...createSliderEntry().rule.ui,
          secondaryControl: {
            type: 'slider',
            var: 'secondaryDistance',
            max: { var: 'maxDistance' }
          }
        },
        vars: {
          ...createSliderEntry().rule.vars,
          secondaryDistance: { default: { fact: 'character.movement.remaining' } }
        }
      } as Rule
    });
    const facts = { 'character.movement.remaining': 10, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const sliders = container.querySelectorAll('input[type="range"]');
    expect(sliders.length).toBe(2);
    expect(sliders[1].closest('.panel-renderer__control--secondary')).toBeTruthy();
  });

  it('uses selection value over var default for current value', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const selections = { distance: 12 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, selections }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe('12');
  });

  it('has panel-renderer__slider class on the slider container', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    expect(container.querySelector('.panel-renderer__slider')).toBeTruthy();
  });

  it('updates displayed value immediately during drag (local state)', async () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    const valueSpan = container.querySelector('.panel-renderer__slider-value') as HTMLSpanElement;

    // Simulate dragging to 10
    slider.value = '10';
    await fireEvent.input(slider);

    // The displayed text should immediately show 10
    expect(valueSpan.textContent).toContain('10');
  });

  const createSpellLevelSliderEntry = (): AvailableRuleEntry => {
    const base = createSliderEntry();
    return {
      ...base,
      rule: {
        ...base.rule,
        ui: {
          ...base.rule.ui,
          primaryControl: {
            type: 'slider',
            var: 'distance',
            min: { number: 0 },
            max: { number: 5 },
            valueFormat: 'spellLevel'
          }
        }
      } as Rule
    };
  };

  // NOTE: the test harness mocks i18n so $t(key) returns the key itself
  // (see tests/setup.ts). These assert that valueFormat selects the correct
  // translation key per value; the rendered text is the key, not the label.
  it('uses the free-use translation key for value 0 when valueFormat is spellLevel', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { distance: 0 } }
    });
    const valueSpan = container.querySelector('.panel-renderer__slider-value') as HTMLSpanElement;
    expect(valueSpan.textContent?.trim()).toBe('play.slider.freeUse');
  });

  it('uses the level translation key for value N>=1 when valueFormat is spellLevel', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { distance: 2 } }
    });
    const valueSpan = container.querySelector('.panel-renderer__slider-value') as HTMLSpanElement;
    expect(valueSpan.textContent?.trim()).toBe('play.slider.level');
  });

  it('shows the raw number when no valueFormat is set', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const valueSpan = container.querySelector('.panel-renderer__slider-value') as HTMLSpanElement;
    expect(valueSpan.textContent?.trim()).toBe('20');
  });

  it('exposes the formatted spell-level value to assistive tech via aria-valuetext', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { distance: 0 } }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.getAttribute('aria-valuetext')).toBe('play.slider.freeUse');
  });

  it('updates aria-valuetext to the level label for N>=1', () => {
    const entry = createSpellLevelSliderEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, selections: { distance: 2 } }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.getAttribute('aria-valuetext')).toBe('play.slider.level');
  });

  it('sets aria-valuetext to the numeric display when no valueFormat is set', () => {
    const entry = createSliderEntry();
    const facts = { 'character.movement.remaining': 20, 'character.movement.total': 30 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.getAttribute('aria-valuetext')).toBe('20');
  });

  it('keeps each slider independent when multiple exist', () => {
    // Two sliders: walk (distance) and secondary slider
    const entry = createSliderEntry({
      rule: {
        ...createSliderEntry().rule,
        ui: {
          ...createSliderEntry().rule.ui,
          secondaryControl: {
            type: 'slider',
            var: 'secondaryDistance',
            max: { var: 'maxDistance' }
          }
        },
        vars: {
          ...createSliderEntry().rule.vars,
          secondaryDistance: { default: { fact: 'character.movement.remaining' } }
        }
      } as Rule
    });
    // Primary slider has selection=5, secondary has no selection (defaults to fact=10)
    const facts = { 'character.movement.remaining': 10, 'character.movement.total': 30 };
    const selections = { distance: 5 };
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, selections }
    });
    const sliders = container.querySelectorAll<HTMLInputElement>('input[type="range"]');
    // Primary slider should show 5 (from selections)
    expect(sliders[0].value).toBe('5');
    // Secondary slider should show 10 (from facts, no selection)
    expect(sliders[1].value).toBe('10');
  });

  describe('notch-based slider selection sync', () => {
    const createNotchSliderEntry = (): AvailableRuleEntry => ({
      rule: {
        id: 'cast-aid',
        description: 'Aid',
        activities: [],
        ui: {
          section: 'action-spell',
          name: 'rule.spell-aid.offer-aid.name',
          primaryControl: {
            type: 'slider',
            var: 'slotLevel',
            notches: [
              { value: 2, enabled: { fact: 'spellcasting.slots.level2.total' } },
              { value: 3, enabled: { fact: 'spellcasting.slots.level3.total' } },
              { value: 4, enabled: { fact: 'spellcasting.slots.level4.total' } },
              { value: 5, enabled: { fact: 'spellcasting.slots.level5.total' } }
            ],
            valueFormat: 'spellLevel'
          }
        },
        vars: {
          slotLevel: {
            capture: true,
            default: { fact: 'aid.lowestAvailableSlotLevel' }
          }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    });

    it('syncs selection to first active notch when selection value does not match any notch', () => {
      const entry = createNotchSliderEntry();
      // Facts make all notches active, but aid.lowestAvailableSlotLevel is absent
      const facts = {
        'spellcasting.slots.level2.total': 3,
        'spellcasting.slots.level3.total': 2,
        'spellcasting.slots.level4.total': 1,
        'spellcasting.slots.level5.total': 1
      };
      // slotLevel=0 from resolveInitialSelections defaulting missing fact to 0
      const selections = { slotLevel: 0 };
      const onSelectionChange = vi.fn();
      render(PanelRenderer, {
        props: { entry, editable: true, facts, selections, onSelectionChange }
      });
      // The slider should sync selections to the first active notch value (2)
      expect(onSelectionChange).toHaveBeenCalledWith({ slotLevel: 2 });
    });
  });

  // === Gated notches (spell-slot upcast sliders, e.g. Prayer of Healing) ===
  // A notch only renders when its `enabled` fact is truthy. With no value-0
  // notch the slider never shows "Free Use", opens at L2, and grows as the
  // character gains higher slots.

  const createSlotNotchSliderEntry = (): AvailableRuleEntry => ({
    rule: {
      id: 'cast-prayer-of-healing',
      description: 'Prayer of Healing',
      activities: [],
      ui: {
        section: 'action-spell',
        name: 'Prayer of Healing',
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          notches: [
            { value: 2, enabled: { fact: 'spellcasting.slots.level2.total' } },
            { value: 3, enabled: { fact: 'spellcasting.slots.level3.total' } },
            { value: 4, enabled: { fact: 'spellcasting.slots.level4.total' } }
          ],
          valueFormat: 'spellLevel'
        }
      },
      vars: {
        slotLevel: { default: { fact: 'prayerOfHealing.lowestAvailableSlotLevel' } }
      }
    } as Rule,
    legal: true,
    applicable: true,
    diagnostics: []
  });

  it('shows L2 (not Free Use) when the character only has L2 slots', () => {
    const entry = createSlotNotchSliderEntry();
    const facts = {
      'spellcasting.slots.level2.total': 1,
      'prayerOfHealing.lowestAvailableSlotLevel': 2
    };
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts } });
    const valueSpan = container.querySelector('.panel-renderer__slider-value') as HTMLSpanElement;
    // i18n mock returns the key; spellLevel value >= 1 uses the "level" key
    expect(valueSpan.textContent?.trim()).toBe('play.slider.level');
    expect(valueSpan.textContent?.trim()).not.toBe('play.slider.freeUse');
  });

  it('collapses to a single active notch when only one slot level is owned', () => {
    const entry = createSlotNotchSliderEntry();
    const facts = {
      'spellcasting.slots.level2.total': 1,
      'prayerOfHealing.lowestAvailableSlotLevel': 2
    };
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts } });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    // Notch sliders index 0..(activeNotches.length - 1); one active notch => max 0
    expect(slider.min).toBe('0');
    expect(slider.max).toBe('0');
  });

  it('expands the notch range as higher slot levels are gained', () => {
    const entry = createSlotNotchSliderEntry();
    const facts = {
      'spellcasting.slots.level2.total': 1,
      'spellcasting.slots.level3.total': 1,
      'prayerOfHealing.lowestAvailableSlotLevel': 2
    };
    const { container } = render(PanelRenderer, { props: { entry, editable: true, facts } });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    // Two active notches (L2, L3) => index range 0..1
    expect(slider.max).toBe('1');
  });

  it('selecting the second notch reports its slot-level value (L3), not its index', async () => {
    const entry = createSlotNotchSliderEntry();
    const facts = {
      'spellcasting.slots.level2.total': 1,
      'spellcasting.slots.level3.total': 1,
      'prayerOfHealing.lowestAvailableSlotLevel': 2
    };
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts, onSelectionChange }
    });
    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '1'; // second active notch
    await fireEvent.input(slider);
    expect(onSelectionChange).toHaveBeenCalledWith({ slotLevel: 3 });
  });

  // === Notch label row (tick + short label under the track) ===
  // The i18n mock renders the short keys as 'FREE' / 'LVL{{level}}' —
  // deliberately unlike the real English 'Free' / 'L{{level}}', mirroring the
  // units convention in tests/setup.ts — so a label that bypasses $t and
  // hardcodes English fails these assertions.
  describe('notch label row', () => {
    const createSequentialSpellLevelEntry = (
      min: number,
      max: number,
      step?: number
    ): AvailableRuleEntry => {
      const base = createSliderEntry();
      return {
        ...base,
        rule: {
          ...base.rule,
          ui: {
            ...base.rule.ui,
            primaryControl: {
              type: 'slider',
              var: 'distance',
              min: { number: min },
              max: { number: max },
              ...(step !== undefined ? { step } : {}),
              valueFormat: 'spellLevel'
            }
          }
        } as Rule
      };
    };

    it('renders L1..L5 labels for a sequential 1..5 spell-level slider', () => {
      const entry = createSequentialSpellLevelEntry(1, 5);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, selections: { distance: 1 } }
      });
      const labels = Array.from(
        container.querySelectorAll('.panel-renderer__slider-notch-label')
      ).map((el) => el.textContent?.trim());
      expect(labels).toEqual(['LVL1', 'LVL2', 'LVL3', 'LVL4', 'LVL5']);
    });

    it('renders the Free label for value 0', () => {
      const entry = createSequentialSpellLevelEntry(0, 5);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, selections: { distance: 0 } }
      });
      const labels = Array.from(
        container.querySelectorAll('.panel-renderer__slider-notch-label')
      ).map((el) => el.textContent?.trim());
      expect(labels).toEqual(['FREE', 'LVL1', 'LVL2', 'LVL3', 'LVL4', 'LVL5']);
    });

    const createExplicitNotchEntry = (values: number[]): AvailableRuleEntry => ({
      rule: {
        id: 'cast-find-steed',
        description: 'Find Steed',
        activities: [],
        ui: {
          section: 'action-spell',
          name: 'Find Steed',
          primaryControl: {
            type: 'slider',
            var: 'slotLevel',
            notches: values.map((value) => ({ value })),
            valueFormat: 'spellLevel'
          }
        },
        vars: { slotLevel: { default: { number: 0 } } }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    });

    it('labels explicit notches by their own values, so gaps do not collapse', () => {
      // find-steed's notches are 0,2,3,4,5 — no L1. Reduced to 0,2,3 here.
      const entry = createExplicitNotchEntry([0, 2, 3]);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, selections: { slotLevel: 0 } }
      });
      const labels = Array.from(
        container.querySelectorAll('.panel-renderer__slider-notch-label')
      ).map((el) => el.textContent?.trim());
      expect(labels).toEqual(['FREE', 'LVL2', 'LVL3']);
    });

    it('renders no notch row when there are more than 10 positions', () => {
      const entry = createSequentialSpellLevelEntry(0, 10); // 11 positions
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, selections: { distance: 0 } }
      });
      expect(container.querySelector('.panel-renderer__slider-notches')).toBeNull();
    });

    it('renders no notch row when positions are not integer-spaced', () => {
      // 5 positions, but step 0.5 makes the values non-integers
      const entry = createSequentialSpellLevelEntry(0, 2, 0.5);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, selections: { distance: 0 } }
      });
      expect(container.querySelector('.panel-renderer__slider-notches')).toBeNull();
    });

    it("emphasises the current value's tick and label", () => {
      const entry = createSequentialSpellLevelEntry(0, 5);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, selections: { distance: 2 } }
      });
      const current = container.querySelectorAll('.panel-renderer__slider-notch--current');
      expect(current.length).toBe(1);
      expect(
        current[0].querySelector('.panel-renderer__slider-notch-label')?.textContent?.trim()
      ).toBe('LVL2');
    });

    const findMarkByLabel = (container: HTMLElement, label: string): Element => {
      const mark = Array.from(container.querySelectorAll('.panel-renderer__slider-notch')).find(
        (el) =>
          el.querySelector('.panel-renderer__slider-notch-label')?.textContent?.trim() === label
      );
      if (!mark) throw new Error(`no notch labelled ${label}`);
      return mark;
    };

    it('fires onSelectionChange with the value when a sequential label is clicked', async () => {
      const entry = createSequentialSpellLevelEntry(0, 5);
      const onSelectionChange = vi.fn();
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, selections: { distance: 2 }, onSelectionChange }
      });
      await fireEvent.click(findMarkByLabel(container, 'LVL3'));
      expect(onSelectionChange).toHaveBeenLastCalledWith({ distance: 3 });
    });

    it('reports the notch value (not its index) when an explicit label is clicked', async () => {
      // Notches 0,2,3: the L3 mark sits at index 2, so an index-mapped click
      // would wrongly report 2.
      const entry = createExplicitNotchEntry([0, 2, 3]);
      const onSelectionChange = vi.fn();
      const { container } = render(PanelRenderer, {
        props: {
          entry,
          editable: true,
          facts: {},
          selections: { slotLevel: 0 },
          onSelectionChange
        }
      });
      await fireEvent.click(findMarkByLabel(container, 'LVL3'));
      expect(onSelectionChange).toHaveBeenLastCalledWith({ slotLevel: 3 });
    });

    it('hides the notch label row from assistive tech', () => {
      // The native range input stays the sole accessible control; the label
      // row is a decorative pointer shortcut.
      const entry = createSequentialSpellLevelEntry(0, 5);
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, selections: { distance: 0 } }
      });
      const row = container.querySelector('.panel-renderer__slider-notches') as HTMLElement;
      expect(row.getAttribute('aria-hidden')).toBe('true');
    });

    // Non-spell sliders (movement distance, lay-on-hands hp, ability scores)
    // are integer sequential sliders under the position cap — without a
    // valueFormat gate they would render "Free/L5/L10…" nonsense labels.
    const createSequentialUnitEntry = (
      min: number,
      max: number,
      step: number,
      unit: string
    ): AvailableRuleEntry => {
      const base = createSliderEntry();
      return {
        ...base,
        rule: {
          ...base.rule,
          ui: {
            ...base.rule.ui,
            primaryControl: {
              type: 'slider',
              var: 'distance',
              min: { number: min },
              max: { number: max },
              step,
              unit
            }
          }
        } as Rule
      };
    };

    it('renders no notch row for a non-spell slider (no valueFormat)', () => {
      // movement-style: distance 0..30 step 5, unit ft — 7 integer positions
      const entry = createSequentialUnitEntry(0, 30, 5, 'ft');
      const { container } = render(PanelRenderer, {
        props: {
          entry,
          editable: true,
          facts: { 'character.movement.remaining': 10, 'character.movement.total': 30 },
          selections: { distance: 10 }
        }
      });
      expect(container.querySelector('.panel-renderer__slider-notches')).toBeNull();
    });

    it('renders no notch row for a small non-spell slider either (hp-style)', () => {
      // 7 positions — proves the 10-position cap is not what suppresses it
      const entry = createSequentialUnitEntry(0, 6, 1, 'hp');
      const { container } = render(PanelRenderer, {
        props: { entry, editable: true, facts: {}, selections: { distance: 2 } }
      });
      expect(container.querySelector('.panel-renderer__slider-notches')).toBeNull();
    });
  });
});
