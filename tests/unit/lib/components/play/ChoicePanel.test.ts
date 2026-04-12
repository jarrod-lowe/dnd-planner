import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ChoicePanel from '$lib/components/play/ChoicePanel.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

const createMockEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: { id: 'test-rule', description: 'Test Rule', activities: [] },
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

const createMockAttackEntry = (overrides?: {
  range?: number;
  hitBonus?: number;
  damageDie?: number;
  damageBonus?: number;
}): AvailableRuleEntry => ({
  rule: {
    id: 'unarmed-strike',
    description: 'Unarmed Strike',
    activities: [],
    ui: {
      model: 'attack',
      section: 'action-other',
      name: 'rule.dnd-5e-2024.attacks.unarmed-strike.name'
    },
    vars: {
      ranges: { default: { array: [{ distance: overrides?.range ?? 5, type: 'melee' }] } },
      hitBonus: { capture: true, default: { number: overrides?.hitBonus ?? 5 } },
      damageDie: { default: { number: overrides?.damageDie ?? 0 } },
      damageBonus: { capture: true, default: { number: overrides?.damageBonus ?? 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

const createMockMoveEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: {
    id: 'move',
    description: 'Move',
    activities: [],
    ui: {
      model: 'move',
      section: 'move',
      name: 'rule.dnd-5e-2024.movement.move-walk.name'
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

describe('ChoicePanel', () => {
  it('renders the rule description', () => {
    const entry = createMockEntry({
      rule: { id: 'attack', description: 'Attack with sword', activities: [] }
    });

    const { getByText } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    expect(getByText('Attack with sword')).toBeTruthy();
  });

  it('calls onTap when clicked', async () => {
    const entry = createMockEntry();
    const onTap = vi.fn();

    const { container } = render(ChoicePanel, {
      props: { entry, onTap }
    });

    const button = container.querySelector('button');
    button?.click();

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('shows warning indicator for illegal choice', () => {
    const entry = createMockEntry({ legal: false });

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    expect(container.querySelector('.warning-indicator--illegal')).toBeTruthy();
  });

  it('shows warning indicator for inapplicable choice', () => {
    const entry = createMockEntry({ applicable: false });

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    expect(container.querySelector('.warning-indicator--inapplicable')).toBeTruthy();
  });

  it('does not show warning for legal and applicable choice', () => {
    const entry = createMockEntry({ legal: true, applicable: true });

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    expect(container.querySelector('.warning-indicator')).toBeFalsy();
  });

  it('has accessible button with aria-label', () => {
    const entry = createMockEntry({
      rule: { id: 'attack', description: 'Attack', activities: [] }
    });

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-label')).toContain('Attack');
  });

  // === Editable mode tests ===

  it('renders section header from ui.section via i18n', () => {
    const entry = createMockMoveEntry();

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    const typeLabel = container.querySelector('.choice-panel__type');
    // The test environment returns the i18n key itself as fallback
    expect(typeLabel?.textContent).toBe('play.choices.sections.move');
  });

  it('renders title from ui.name (i18n key)', () => {
    const entry = createMockMoveEntry();

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    const title = container.querySelector('.choice-panel__title');
    // i18n key is rule.dnd-5e-2024.movement.move-walk.name
    expect(title).toBeTruthy();
  });

  it('renders move model with disabled slider when editable is false', () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn(), editable: false, facts }
    });

    const slider = container.querySelector('input[type="range"]');
    expect(slider).toBeTruthy();
    expect((slider as HTMLInputElement)?.disabled).toBe(true);
  });

  it('renders move model with enabled slider when editable is true', () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts }
    });

    const slider = container.querySelector('input[type="range"]');
    expect(slider).toBeTruthy();
    expect((slider as HTMLInputElement)?.disabled).toBe(false);
  });

  it('calls onSelectionChange when slider value changes in editable mode', async () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };
    const onSelectionChange = vi.fn();

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts, onSelectionChange }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '15';
    await fireEvent.input(slider);

    expect(onSelectionChange).toHaveBeenCalledWith({ distance: 15 });
  });

  it('calls onSelectionChange with distance even when slider is at max', async () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };
    const onSelectionChange = vi.fn();

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts, onSelectionChange }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '30'; // max distance
    await fireEvent.input(slider);

    expect(onSelectionChange).toHaveBeenCalledWith({ distance: 30 });
  });

  // === Header/Body layout tests ===

  it('renders header section with section label above content', () => {
    const entry = createMockMoveEntry();

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    // Header container should exist with type label inside
    const header = container.querySelector('.choice-panel__header');
    expect(header).toBeTruthy();

    const typeLabel = header?.querySelector('.choice-panel__type');
    expect(typeLabel?.textContent).toBe('play.choices.sections.move');
  });

  it('renders body section below header with title', () => {
    const entry = createMockMoveEntry();

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    // Body container should exist
    const body = container.querySelector('.choice-panel__body');
    expect(body).toBeTruthy();

    // Title should be inside body
    const title = body?.querySelector('.choice-panel__title');
    expect(title).toBeTruthy();
  });

  it('renders move slider inside body section', () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts }
    });

    const body = container.querySelector('.choice-panel__body');
    const slider = container.querySelector('input[type="range"]');

    // Slider should be inside body
    expect(slider).toBeTruthy();
    expect(body?.contains(slider)).toBe(true);
  });

  it('header has visual separator from body', () => {
    const entry = createMockMoveEntry();

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn() }
    });

    const header = container.querySelector('.choice-panel__header');
    expect(header).toBeTruthy();

    // Check computed style has border-bottom
    const headerStyle = window.getComputedStyle(header as Element);
    expect(headerStyle.borderBottomWidth).not.toBe('0px');
    expect(headerStyle.borderBottomStyle).not.toBe('none');
  });

  // === Control buttons tests ===

  it('does not render control buttons by default', () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts }
    });

    expect(container.querySelector('.choice-panel__actions')).toBeFalsy();
  });

  it('renders control buttons when showControls is true', () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };

    const { container } = render(ChoicePanel, {
      props: {
        entry,
        editable: true,
        facts,
        showControls: true,
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onRemove: vi.fn()
      }
    });

    const actions = container.querySelector('.choice-panel__actions');
    expect(actions).toBeTruthy();
  });

  it('renders three control buttons: move up, move down, remove', () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };

    const { container } = render(ChoicePanel, {
      props: {
        entry,
        editable: true,
        facts,
        showControls: true,
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onRemove: vi.fn()
      }
    });

    const buttons = container.querySelectorAll('.choice-panel__button');
    expect(buttons.length).toBe(3);
  });

  it('calls onMoveUp when move up button is clicked', async () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };
    const onMoveUp = vi.fn();

    const { container } = render(ChoicePanel, {
      props: {
        entry,
        editable: true,
        facts,
        showControls: true,
        onMoveUp,
        onMoveDown: vi.fn(),
        onRemove: vi.fn()
      }
    });

    const moveUpButton = container.querySelector(
      '.choice-panel__button--move-up'
    ) as HTMLButtonElement;
    moveUpButton?.click();

    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it('calls onMoveDown when move down button is clicked', async () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };
    const onMoveDown = vi.fn();

    const { container } = render(ChoicePanel, {
      props: {
        entry,
        editable: true,
        facts,
        showControls: true,
        onMoveUp: vi.fn(),
        onMoveDown,
        onRemove: vi.fn()
      }
    });

    const moveDownButton = container.querySelector(
      '.choice-panel__button--move-down'
    ) as HTMLButtonElement;
    moveDownButton?.click();

    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove when remove button is clicked', async () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };
    const onRemove = vi.fn();

    const { container } = render(ChoicePanel, {
      props: {
        entry,
        editable: true,
        facts,
        showControls: true,
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onRemove
      }
    });

    const removeButton = container.querySelector(
      '.choice-panel__button--remove'
    ) as HTMLButtonElement;
    removeButton?.click();

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables move up button when canMoveUp is false', () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };

    const { container } = render(ChoicePanel, {
      props: {
        entry,
        editable: true,
        facts,
        showControls: true,
        canMoveUp: false,
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onRemove: vi.fn()
      }
    });

    const moveUpButton = container.querySelector(
      '.choice-panel__button--move-up'
    ) as HTMLButtonElement;
    expect(moveUpButton?.disabled).toBe(true);
  });

  it('disables move down button when canMoveDown is false', () => {
    const entry = createMockMoveEntry();
    const facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };

    const { container } = render(ChoicePanel, {
      props: {
        entry,
        editable: true,
        facts,
        showControls: true,
        canMoveDown: false,
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onRemove: vi.fn()
      }
    });

    const moveDownButton = container.querySelector(
      '.choice-panel__button--move-down'
    ) as HTMLButtonElement;
    expect(moveDownButton?.disabled).toBe(true);
  });

  // === Captured selections tests ===

  it('uses captured maxDistance from selections for slider max', () => {
    // Simulates a planned rough terrain rule with captured values
    // maxDistance is based on half_total (constant), distance is based on half_remaining (captured)
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'move-rough-terrain',
        activities: [],
        ui: {
          model: 'move',
          section: 'move',
          name: 'rule.dnd-5e-2024.movement.move-rough-terrain.name'
        },
        vars: {
          distance: { default: { fact: 'character.movement.half_remaining' }, capture: true },
          maxDistance: { default: { fact: 'character.movement.half_total' }, capture: true }
        },
        selections: {
          distance: 10,
          maxDistance: 15 // captured value (half of 30 total), different from what facts would resolve to
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };

    // Facts show different values than selections (e.g., after movement was consumed)
    const facts = {
      'character.movement.remaining': 5,
      'character.movement.half_remaining': 2.5, // remaining is now less
      'character.movement.half_total': 15 // total is constant
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    // Slider max should use captured maxDistance (15), not re-resolved fact
    expect(slider.max).toBe('15');
    // Slider value should use captured distance (10)
    expect(slider.value).toBe('10');
  });

  it('uses captured distance from selections for slider value', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'move-walk',
        activities: [],
        ui: {
          model: 'move',
          section: 'move',
          name: 'rule.dnd-5e-2024.movement.move-walk.name'
        },
        vars: {
          distance: { default: { fact: 'character.movement.remaining' }, capture: true },
          maxDistance: { default: { fact: 'character.movement.total' } }
        },
        selections: {
          distance: 20 // captured distance, different from current fact
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };

    const facts = {
      'character.movement.remaining': 5, // different from captured distance
      'character.movement.total': 30
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    // Slider value should use captured distance (20), not fact value (5)
    expect(slider.value).toBe('20');
  });

  // === Ability score model tests ===

  it('renders ability-score model with disabled slider in read-only mode', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'set-strength',
        activities: [],
        ui: {
          model: 'ability-score',
          section: 'configuration',
          name: 'rule.dnd-5e-2024.ability-scores.set-strength.name'
        },
        vars: {
          score: { capture: true, default: { number: 10 } },
          maxValue: { default: { number: 30 } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };

    const { container } = render(ChoicePanel, {
      props: { entry, onTap: vi.fn(), editable: false }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.disabled).toBe(true);
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('30');
    expect(slider.step).toBe('1');
    expect(slider.value).toBe('10');
  });

  it('renders ability-score model with enabled slider in editable mode', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'set-strength',
        activities: [],
        ui: {
          model: 'ability-score',
          section: 'configuration',
          name: 'rule.dnd-5e-2024.ability-scores.set-strength.name'
        },
        vars: {
          score: { capture: true, default: { number: 10 } },
          maxValue: { default: { number: 30 } }
        },
        selections: { score: 15 }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.disabled).toBe(false);
    expect(slider.value).toBe('15');
  });

  it('calls onSelectionChange with score when ability-score slider changes', async () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'set-strength',
        activities: [],
        ui: {
          model: 'ability-score',
          section: 'configuration',
          name: 'rule.dnd-5e-2024.ability-scores.set-strength.name'
        },
        vars: {
          score: { capture: true, default: { number: 10 } },
          maxValue: { default: { number: 30 } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const onSelectionChange = vi.fn();

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, onSelectionChange }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '18';
    await fireEvent.input(slider);

    expect(onSelectionChange).toHaveBeenCalledWith({ score: 18 });
  });

  it('shows ability score value without ft suffix', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'set-strength',
        activities: [],
        ui: {
          model: 'ability-score',
          section: 'configuration',
          name: 'rule.dnd-5e-2024.ability-scores.set-strength.name'
        },
        vars: {
          score: { capture: true, default: { number: 10 } },
          maxValue: { default: { number: 30 } }
        },
        selections: { score: 16 }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true }
    });

    const valueSpan = container.querySelector('.ability-score-value');
    expect(valueSpan?.textContent).toBe('16');
  });

  it('uses ui.sliderMin and ui.sliderMax for ability-score slider range', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'set-hp-modifier-max',
        activities: [],
        ui: {
          model: 'ability-score',
          section: 'health',
          name: 'rule.dnd-5e-2024.hp.set-hp-modifier-max.name',
          sliderMin: -10,
          sliderMax: 30
        },
        vars: {
          modifier: { capture: true, default: { number: 0 } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.min).toBe('-10');
    expect(slider.max).toBe('30');
    expect(slider.value).toBe('0');
  });

  it('does not render slider when maxValue var and sliderMax are both missing', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'broken-rule',
        activities: [],
        ui: {
          model: 'ability-score',
          section: 'configuration',
          name: 'broken'
        },
        vars: {
          score: { capture: true, default: { number: 10 } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true }
    });

    const slider = container.querySelector('input[type="range"]');
    expect(slider).toBeFalsy();
  });

  it('uses maxValue var as slider max when defined', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'loh-heal',
        activities: [],
        ui: {
          model: 'ability-score',
          section: 'action-other',
          name: 'rule.class-paladin-lay-on-hands.loh-heal.name',
          sliderMin: 1
        },
        vars: {
          amount: { capture: true, default: { fact: 'layOnHands.pool.remaining' } },
          maxValue: { default: { fact: 'layOnHands.pool.remaining' } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const facts = { 'layOnHands.pool.remaining': 5 };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, facts }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.min).toBe('1');
    expect(slider.max).toBe('5');
    expect(slider.value).toBe('5');
  });

  it('resolves slider value from non-score var name', () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'set-hp-modifier-max',
        activities: [],
        ui: {
          model: 'ability-score',
          section: 'health',
          name: 'rule.dnd-5e-2024.hp.set-hp-modifier-max.name',
          sliderMin: -10,
          sliderMax: 30
        },
        vars: {
          modifier: { capture: true, default: { number: 0 } }
        },
        selections: { modifier: 5 }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe('5');
  });

  it('emits correct selection key for non-score var name', async () => {
    const entry: AvailableRuleEntry = {
      rule: {
        id: 'set-hp-modifier-max',
        activities: [],
        ui: {
          model: 'ability-score',
          section: 'health',
          name: 'rule.dnd-5e-2024.hp.set-hp-modifier-max.name',
          sliderMin: -10,
          sliderMax: 30
        },
        vars: {
          modifier: { capture: true, default: { number: 0 } }
        }
      } as Rule,
      legal: true,
      applicable: true,
      diagnostics: []
    };
    const onSelectionChange = vi.fn();

    const { container } = render(ChoicePanel, {
      props: { entry, editable: true, onSelectionChange }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '18';
    await fireEvent.input(slider);

    expect(onSelectionChange).toHaveBeenCalledWith({ modifier: 18 });
  });

  // === Attack model tests ===

  describe('Attack model', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('renders range as plain text, not as a chip', () => {
      const entry = createMockAttackEntry();

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const range = container.querySelector('.attack-range');
      expect(range).toBeTruthy();
      expect(range?.textContent).toBe('5 ft');
      // Should NOT have attack-chip class
      expect(range?.classList.contains('attack-chip')).toBe(false);
    });

    it('renders range as plain text in read-only mode', () => {
      const entry = createMockAttackEntry();

      const { container } = render(ChoicePanel, {
        props: { entry, editable: false }
      });

      const range = container.querySelector('.attack-range');
      expect(range).toBeTruthy();
      expect(range?.textContent).toBe('5 ft');
      expect(range?.classList.contains('attack-chip')).toBe(false);
    });

    it('shows hit formula before rolling', () => {
      const entry = createMockAttackEntry();

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const hitButton = buttons[0] as HTMLButtonElement;
      expect(hitButton.textContent).toBe('d20+5');
    });

    it('replaces hit formula with total after rolling', async () => {
      const entry = createMockAttackEntry();
      // random 0.6 → floor(0.6 * 20) + 1 = 13, total = 13 + 5 = 18
      vi.spyOn(Math, 'random').mockReturnValue(0.6);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const hitButton = buttons[0] as HTMLButtonElement;
      await fireEvent.click(hitButton);

      expect(hitButton.textContent).toBe('18');
    });

    it('shows nat-20 indicator with star and crit styling', async () => {
      const entry = createMockAttackEntry();
      // random 0.95 → floor(0.95 * 20) + 1 = 20, total = 20 + 5 = 25
      vi.spyOn(Math, 'random').mockReturnValue(0.95);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const hitButton = buttons[0] as HTMLButtonElement;
      await fireEvent.click(hitButton);

      // Should contain check and total
      expect(hitButton.textContent).toContain('✔');
      expect(hitButton.textContent).toContain('25');
      // Should have crit class
      expect(hitButton.classList.contains('attack-chip--crit')).toBe(true);
    });

    it('shows nat-1 indicator with X and fumble styling', async () => {
      const entry = createMockAttackEntry();
      // random 0.0 → floor(0.0 * 20) + 1 = 1, total = 1 + 5 = 6
      vi.spyOn(Math, 'random').mockReturnValue(0.0);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const hitButton = buttons[0] as HTMLButtonElement;
      await fireEvent.click(hitButton);

      // Should contain bold X and total
      expect(hitButton.textContent).toContain('✘');
      expect(hitButton.textContent).toContain('6');
      // Should have fumble class
      expect(hitButton.classList.contains('attack-chip--fumble')).toBe(true);
    });

    it('re-rolls and replaces previous result', async () => {
      const entry = createMockAttackEntry();
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const hitButton = buttons[0] as HTMLButtonElement;

      // First roll: 0.6 → 13 natural, total 18
      randomMock.mockReturnValue(0.6);
      await fireEvent.click(hitButton);
      expect(hitButton.textContent).toBe('18');

      // Second roll: 0.0 → 1 natural, total 6
      randomMock.mockReturnValue(0.0);
      await fireEvent.click(hitButton);
      expect(hitButton.textContent).toContain('6');
      expect(hitButton.textContent).toContain('✘');
    });

    it('replaces damage formula with total after rolling', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      // random 0.5 → floor(0.5 * 8) + 1 = 5, total = 5 + 3 = 8
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const damageButton = buttons[1] as HTMLButtonElement;
      await fireEvent.click(damageButton);

      expect(damageButton.textContent).toBe('8');
    });

    it('has no attack-result spans after rolling', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      await fireEvent.click(buttons[0] as HTMLButtonElement);
      await fireEvent.click(buttons[1] as HTMLButtonElement);

      expect(container.querySelector('.attack-result')).toBeFalsy();
    });

    it('disables damage button when damageDie is 0', () => {
      const entry = createMockAttackEntry({ damageDie: 0, damageBonus: 3 });

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const damageButton = buttons[1] as HTMLButtonElement;
      expect(damageButton.disabled).toBe(true);
    });

    it('renders separators between range, hit, and damage', () => {
      const entry = createMockAttackEntry();

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const separators = container.querySelectorAll('.attack-sep');
      expect(separators.length).toBe(2);
    });

    it('shows doubled damage formula after crit hit roll', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      // Roll a nat 20: random 0.95 → floor(0.95 * 20) + 1 = 20
      vi.spyOn(Math, 'random').mockReturnValue(0.95);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const hitButton = buttons[0];
      await fireEvent.click(hitButton);

      const damageButton = buttons[1] as HTMLButtonElement;
      // Should show "2d8+3" instead of "d8+3"
      expect(damageButton.textContent).toBe('2d8+3');
    });

    it('rolls doubled damage dice on crit', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');

      // Roll nat 20 on hit: 0.95 → 20
      randomMock.mockReturnValue(0.95);
      await fireEvent.click(buttons[0]);

      // Roll damage: two calls → 0.5 → floor(0.5*8)+1 = 5, 0.25 → floor(0.25*8)+1 = 3
      randomMock.mockReturnValueOnce(0.5);
      randomMock.mockReturnValueOnce(0.25);
      await fireEvent.click(buttons[1]);

      // 5 + 3 + 3(bonus) = 11
      expect(buttons[1].textContent).toBe('11');
    });

    it('rolls normal damage on non-crit hit', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');

      // Roll normal hit: 0.6 → 13
      randomMock.mockReturnValue(0.6);
      await fireEvent.click(buttons[0]);

      // Roll damage: 0.5 → floor(0.5*8)+1 = 5
      randomMock.mockReturnValue(0.5);
      await fireEvent.click(buttons[1]);

      // 5 + 3 = 8
      expect(buttons[1].textContent).toBe('8');
    });

    it('reverts damage label when hit is re-rolled as non-crit', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const hitButton = buttons[0];
      const damageButton = buttons[1] as HTMLButtonElement;

      // Roll nat 20
      randomMock.mockReturnValue(0.95);
      await fireEvent.click(hitButton);
      expect(damageButton.textContent).toBe('2d8+3');

      // Re-roll as non-crit
      randomMock.mockReturnValue(0.6);
      await fireEvent.click(hitButton);
      expect(damageButton.textContent).toBe('d8+3');
    });

    it('applies crit styling to damage button after rolling crit damage', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');

      // Roll nat 20 on hit
      randomMock.mockReturnValue(0.95);
      await fireEvent.click(buttons[0]);

      // Roll damage
      randomMock.mockReturnValue(0.5);
      await fireEvent.click(buttons[1]);

      expect(buttons[1].classList.contains('attack-chip--crit')).toBe(true);
    });

    it('includes doubled dice in damage button aria-label after crit hit', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');

      // Roll nat 20
      randomMock.mockReturnValue(0.95);
      await fireEvent.click(buttons[0]);

      const ariaLabel = (buttons[1] as HTMLButtonElement).getAttribute('aria-label');
      expect(ariaLabel).toContain('2d8');
    });

    it('resets damage to formula when hit is re-rolled', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');

      // Roll nat 20 on hit
      randomMock.mockReturnValue(0.95);
      await fireEvent.click(buttons[0]);

      // Roll damage
      randomMock.mockReturnValue(0.5);
      await fireEvent.click(buttons[1]);
      // Damage shows a total
      expect(buttons[1].textContent).not.toBe('d8+3');

      // Re-roll hit as non-crit
      randomMock.mockReturnValue(0.6);
      await fireEvent.click(buttons[0]);

      // Damage should reset to formula
      expect(buttons[1].textContent).toBe('d8+3');
    });
  });

  // === Advantage/Disadvantage tests ===

  const createMockInitiativeEntry = (overrides?: { rollBonus?: number }): AvailableRuleEntry => ({
    rule: {
      id: 'roll-initiative',
      description: 'Roll Initiative',
      activities: [],
      ui: {
        model: 'd20-roll',
        section: 'other',
        name: 'rule.dnd-5e-2024.initiative.roll-initiative.name'
      },
      vars: {
        rollBonus: {
          default: { number: overrides?.rollBonus ?? 2 }
        }
      }
    } as Rule,
    legal: true,
    applicable: true,
    diagnostics: []
  });

  const createMockSkillCheckEntry = (overrides?: {
    skillName?: string;
    rollBonus?: number;
  }): AvailableRuleEntry => ({
    rule: {
      id: `roll-skill-${overrides?.skillName ?? 'acrobatics'}`,
      description: `Roll ${overrides?.skillName ?? 'Acrobatics'}`,
      activities: [],
      ui: {
        model: 'd20-roll',
        section: 'free',
        name: `play.stats.skills.${overrides?.skillName ?? 'acrobatics'}`
      },
      vars: {
        rollBonus: {
          default: { number: overrides?.rollBonus ?? 3 }
        }
      }
    } as Rule,
    legal: true,
    applicable: true,
    diagnostics: []
  });

  describe('Advantage/Disadvantage', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    // --- Popover trigger tests ---

    it('opens popover on long press of hit chip', async () => {
      const entry = createMockAttackEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const menu = container.querySelector('[role="menu"]');
      expect(menu).toBeTruthy();
    });

    it('does not open popover on short press of hit chip', async () => {
      const entry = createMockAttackEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      vi.advanceTimersByTime(200);
      await fireEvent.pointerUp(hitButton);
      vi.advanceTimersByTime(100);

      const menu = container.querySelector('[role="menu"]');
      expect(menu).toBeFalsy();
    });

    it('opens popover on Shift+Enter on hit chip', async () => {
      const entry = createMockAttackEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.keyDown(hitButton, { key: 'Enter', shiftKey: true });

      const menu = container.querySelector('[role="menu"]');
      expect(menu).toBeTruthy();
    });

    it('opens popover on long press of initiative chip', async () => {
      const entry = createMockInitiativeEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const initButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(initButton);
      await vi.advanceTimersByTimeAsync(300);

      const menu = container.querySelector('[role="menu"]');
      expect(menu).toBeTruthy();
    });

    it('dismisses popover on click outside', async () => {
      const entry = createMockAttackEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      expect(container.querySelector('[role="menu"]')).toBeTruthy();

      await fireEvent.click(document.body);

      expect(container.querySelector('[role="menu"]')).toBeFalsy();
    });

    // --- Roll mechanics tests ---

    it('advantage roll takes higher of two d20s', async () => {
      const entry = createMockAttackEntry();
      // 0.1 → d20=3, 0.5 → d20=11. Advantage takes 11. Total = 11 + 5 = 16
      const randomMock = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      // Open popover
      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      // Click "Advantage" (first menuitem)
      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[0]);

      // Should have called random twice (two d20 rolls)
      expect(randomMock).toHaveBeenCalledTimes(2);
      // Result should be 11 (higher) + 5 bonus = 16
      expect(hitButton.textContent).toContain('16');
    });

    it('disadvantage roll takes lower of two d20s', async () => {
      const entry = createMockAttackEntry();
      // 0.1 → d20=3, 0.5 → d20=11. Disadvantage takes 3. Total = 3 + 5 = 8
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      // Click "Disadvantage" (third menuitem)
      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[2]);

      // Result should be 3 (lower) + 5 bonus = 8
      expect(hitButton.textContent).toContain('8');
    });

    it('normal roll from popover uses single d20', async () => {
      const entry = createMockAttackEntry();
      // 0.6 → d20=13. Total = 13 + 5 = 18
      const randomMock = vi.spyOn(Math, 'random').mockReturnValue(0.6);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      // Click "Normal" (second menuitem)
      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[1]);

      expect(randomMock).toHaveBeenCalledTimes(1);
      expect(hitButton.textContent).toContain('18');
    });

    it('re-rolling hit with advantage resets damage result', async () => {
      const entry = createMockAttackEntry({ damageDie: 8, damageBonus: 3 });
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const buttons = container.querySelectorAll('.attack-chip--rollable');
      const hitButton = buttons[0] as HTMLButtonElement;
      const damageButton = buttons[1] as HTMLButtonElement;

      // Roll normal hit: 0.6 → 13
      randomMock.mockReturnValue(0.6);
      await fireEvent.click(hitButton);

      // Roll damage: 0.5 → floor(0.5*8)+1 = 5, total = 8
      randomMock.mockReturnValue(0.5);
      await fireEvent.click(damageButton);
      expect(damageButton.textContent).toBe('8');

      // Re-roll with advantage via popover
      randomMock.mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);
      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[0]); // Advantage

      // Damage should reset to formula
      expect(damageButton.textContent).toBe('d8+3');
    });

    it('advantage works for initiative roll', async () => {
      const entry = createMockInitiativeEntry({ rollBonus: 2 });
      // 0.1 → d20=3, 0.5 → d20=11. Advantage takes 11. Total = 11 + 2 = 13
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const initButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(initButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[0]); // Advantage

      expect(initButton.textContent).toContain('13');
    });

    it('disadvantage works for initiative roll', async () => {
      const entry = createMockInitiativeEntry({ rollBonus: 2 });
      // 0.1 → d20=3, 0.5 → d20=11. Disadvantage takes 3. Total = 3 + 2 = 5
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const initButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(initButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[2]); // Disadvantage

      expect(initButton.textContent).toContain('5');
    });

    // --- Result display tests ---

    it('shows advantage arrow SVG before result', async () => {
      const entry = createMockAttackEntry();
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[0]); // Advantage

      const arrow = hitButton.querySelector('.roll-mode-icon--advantage');
      expect(arrow).toBeTruthy();
      expect(arrow?.getAttribute('aria-label')).toBe('play.choices.attack.advantageResult');
    });

    it('shows disadvantage arrow SVG before result', async () => {
      const entry = createMockAttackEntry();
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[2]); // Disadvantage

      const arrow = hitButton.querySelector('.roll-mode-icon--disadvantage');
      expect(arrow).toBeTruthy();
      expect(arrow?.getAttribute('aria-label')).toBe('play.choices.attack.disadvantageResult');
    });

    it('normal roll shows no arrow SVG', async () => {
      const entry = createMockAttackEntry();
      vi.spyOn(Math, 'random').mockReturnValue(0.6);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.click(hitButton);

      expect(hitButton.querySelector('.roll-mode-icon')).toBeFalsy();
    });

    it('advantage arrow uses upward pointing SVG path', async () => {
      const entry = createMockAttackEntry();
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[0]); // Advantage

      const path = hitButton.querySelector('.roll-mode-icon--advantage path') as SVGPathElement;
      // Upward chevron path (points up)
      expect(path?.getAttribute('d')).toBe('M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z');
    });

    it('disadvantage arrow uses downward pointing SVG path', async () => {
      const entry = createMockAttackEntry();
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[2]); // Disadvantage

      const path = hitButton.querySelector('.roll-mode-icon--disadvantage path') as SVGPathElement;
      // Downward chevron path (points down)
      expect(path?.getAttribute('d')).toBe('M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z');
    });

    // --- Accessibility tests ---

    it('hit chip has aria-haspopup on trigger', () => {
      const entry = createMockAttackEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      expect(hitButton?.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('initiative chip has aria-haspopup on trigger', () => {
      const entry = createMockInitiativeEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const initButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      expect(initButton?.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('popover menu items have role menuitem', async () => {
      const entry = createMockAttackEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items.length).toBe(3);
    });

    it('closes popover on Escape key', async () => {
      const entry = createMockAttackEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const menu = container.querySelector('[role="menu"]');
      expect(menu).toBeTruthy();

      if (menu) {
        await fireEvent.keyDown(menu, { key: 'Escape' });
      }

      expect(container.querySelector('[role="menu"]')).toBeFalsy();
    });

    it('advantage result aria-label includes advantage mode', async () => {
      const entry = createMockAttackEntry();
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items.length).toBeGreaterThanOrEqual(1);
      if (items.length > 0) {
        await fireEvent.click(items[0]); // Advantage
      }

      const ariaLabel = hitButton.getAttribute('aria-label');
      expect(ariaLabel).toContain('play.choices.attack.advantageResult');
    });

    it('disadvantage result aria-label includes disadvantage mode', async () => {
      const entry = createMockAttackEntry();
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items.length).toBeGreaterThanOrEqual(3);
      if (items.length >= 3) {
        await fireEvent.click(items[2]); // Disadvantage
      }

      const ariaLabel = hitButton.getAttribute('aria-label');
      expect(ariaLabel).toContain('play.choices.attack.disadvantageResult');
    });

    it('roll buttons have min-height style class', () => {
      const entry = createMockAttackEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      // The CSS rule .attack-chip--rollable { min-height: 2.75rem } is defined in the component
      // jsdom doesn't resolve CSS, so we verify the class is present (the CSS is tested in browser)
      expect(hitButton.classList.contains('attack-chip--rollable')).toBe(true);
    });

    it('popover shows three options: Advantage, Normal, Disadvantage', async () => {
      const entry = createMockAttackEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const hitButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(hitButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      expect(items.length).toBe(3);
      if (items.length >= 3) {
        expect(items[0].textContent).toContain('play.choices.attack.advantage');
        expect(items[1].textContent).toContain('play.choices.attack.normal');
        expect(items[2].textContent).toContain('play.choices.attack.disadvantage');
      }
    });
  });

  // === Cleave attack-line followup tests ===

  const createMockGreataxeMasteryEntry = (overrides?: {
    damageBonus?: number;
  }): AvailableRuleEntry => ({
    rule: {
      id: 'greataxe-use-action',
      description: 'Greataxe',
      activities: [],
      ui: {
        model: 'attack',
        section: 'action-attack',
        name: 'rule.dnd-5e-2024.attacks.greataxe.name',
        followups: [
          {
            type: 'attack-line',
            condition: { fact: 'attack.greataxe.mastery', operator: 'equals', value: 1 },
            button: 'rule.dnd-5e-2024.attacks.greataxe-cleave.button'
          }
        ]
      },
      vars: {
        ranges: { default: { array: [{ distance: 5, type: 'melee' }] } },
        hitBonus: { capture: true, default: { number: 5 } },
        damageDie: { default: { number: 12 } },
        damageBonus: { capture: true, default: { number: overrides?.damageBonus ?? 3 } }
      }
    } as Rule,
    legal: true,
    applicable: true,
    diagnostics: []
  });

  describe('Cleave attack-line followup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('shows Cleave followup button when mastery condition is met', () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = { 'attack.greataxe.mastery': 1 };

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      const followupButton = container.querySelector('.choice-panel__followup-button');
      expect(followupButton).toBeTruthy();
      // In test environment, i18n returns the key itself as fallback
      expect(followupButton?.textContent).toContain(
        'rule.dnd-5e-2024.attacks.greataxe-cleave.button'
      );
    });

    it('hides Cleave followup button when mastery condition is not met', () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = {};

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      const followupButton = container.querySelector('.choice-panel__followup-button');
      expect(followupButton).toBeFalsy();
    });

    it('clicking Cleave button hides button and shows second attack row', async () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = { 'attack.greataxe.mastery': 1 };

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Before click: one attack row, followup button visible
      const attackRows = container.querySelectorAll('.choice-panel__attack');
      expect(attackRows.length).toBe(1);
      expect(container.querySelector('.choice-panel__followup-button')).toBeTruthy();

      // Click the Cleave button
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      // After click: two attack rows, followup button hidden
      const attackRowsAfter = container.querySelectorAll('.choice-panel__attack');
      expect(attackRowsAfter.length).toBe(2);
      expect(container.querySelector('.choice-panel__followup-button')).toBeFalsy();
    });

    it('second attack row shows same range as parent', async () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = { 'attack.greataxe.mastery': 1 };

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Click Cleave button
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      // Second row should show same range
      const attackRows = container.querySelectorAll('.choice-panel__attack');
      const cleaveRow = attackRows[1];
      const cleaveRange = cleaveRow?.querySelector('.attack-range');
      expect(cleaveRange?.textContent).toBe('5 ft');
    });

    it('second attack row shows same hit bonus as parent', async () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = { 'attack.greataxe.mastery': 1 };

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Click Cleave button
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      // Second row's d20 chip should show same hit bonus
      const attackRows = container.querySelectorAll('.choice-panel__attack');
      const cleaveRow = attackRows[1];
      const cleaveHitChips = cleaveRow?.querySelectorAll('.attack-chip--rollable');
      expect(cleaveHitChips?.[0]?.textContent).toBe('d20+5');
    });

    it('second attack row shows damage without positive ability modifier', async () => {
      const entry = createMockGreataxeMasteryEntry({ damageBonus: 3 });
      const facts = { 'attack.greataxe.mastery': 1 };

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Click Cleave button
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      // Cleave damage shows d12 without the +3 ability modifier bonus.
      // The bonus is Math.min(0, 3) = 0, formatted as "+0" by formatBonus.
      const attackRows = container.querySelectorAll('.choice-panel__attack');
      const cleaveRow = attackRows[1];
      const cleaveHitChips = cleaveRow?.querySelectorAll('.attack-chip--rollable');
      expect(cleaveHitChips?.[1]?.textContent).toBe('d12+0');
    });

    it('second attack row shows negative ability modifier in damage', async () => {
      const entry = createMockGreataxeMasteryEntry({ damageBonus: -2 });
      const facts = { 'attack.greataxe.mastery': 1 };

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Click Cleave button
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      // Second row's damage chip should show d12-2 (negative modifier included)
      const attackRows = container.querySelectorAll('.choice-panel__attack');
      const cleaveRow = attackRows[1];
      const cleaveHitChips = cleaveRow?.querySelectorAll('.attack-chip--rollable');
      expect(cleaveHitChips?.[1]?.textContent).toBe('d12-2');
    });

    it('second attack row rolls d20 independently from parent', async () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = { 'attack.greataxe.mastery': 1 };
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Click Cleave button
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      const attackRows = container.querySelectorAll('.choice-panel__attack');
      const parentRow = attackRows[0];
      const cleaveRow = attackRows[1];

      // Roll parent hit: 0.6 → 13, total = 18
      randomMock.mockReturnValue(0.6);
      const parentHitChip = parentRow?.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.click(parentHitChip);
      expect(parentHitChip.textContent).toBe('18');

      // Roll cleave hit: 0.4 → 9, total = 14
      randomMock.mockReturnValue(0.4);
      const cleaveHitChips = cleaveRow?.querySelectorAll('.attack-chip--rollable');
      const cleaveHitChip = cleaveHitChips?.[0] as HTMLButtonElement;
      await fireEvent.click(cleaveHitChip);
      expect(cleaveHitChip.textContent).toBe('14');

      // Parent should still show 18
      expect(parentHitChip.textContent).toBe('18');
    });

    it('second attack row rolls damage independently from parent', async () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = { 'attack.greataxe.mastery': 1 };
      const randomMock = vi.spyOn(Math, 'random');

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Click Cleave button
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      const attackRows = container.querySelectorAll('.choice-panel__attack');
      const parentRow = attackRows[0];
      const cleaveRow = attackRows[1];

      // Roll parent hit
      randomMock.mockReturnValue(0.6);
      const parentChips = parentRow?.querySelectorAll('.attack-chip--rollable');
      await fireEvent.click(parentChips?.[0] as HTMLButtonElement);

      // Roll parent damage: 0.5 → floor(0.5*12)+1 = 7, total = 7+3 = 10
      randomMock.mockReturnValue(0.5);
      await fireEvent.click(parentChips?.[1] as HTMLButtonElement);
      expect(parentChips?.[1]?.textContent).toBe('10');

      // Roll cleave hit
      randomMock.mockReturnValue(0.4);
      const cleaveChips = cleaveRow?.querySelectorAll('.attack-chip--rollable');
      await fireEvent.click(cleaveChips?.[0] as HTMLButtonElement);

      // Roll cleave damage: 0.3 → floor(0.3*12)+1 = 4, total = 4+0 = 4 (no bonus)
      randomMock.mockReturnValue(0.3);
      await fireEvent.click(cleaveChips?.[1] as HTMLButtonElement);
      expect(cleaveChips?.[1]?.textContent).toBe('4');

      // Parent should still show 10
      expect(parentChips?.[1]?.textContent).toBe('10');
    });

    it('opens popover on long press of Cleave hit chip', async () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = { 'attack.greataxe.mastery': 1 };

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Activate Cleave row
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      const attackRows = container.querySelectorAll('.choice-panel__attack');
      const cleaveRow = attackRows[1];
      const cleaveHitChip = cleaveRow?.querySelector('.attack-chip--rollable') as HTMLButtonElement;

      // Long-press the Cleave hit chip
      await fireEvent.pointerDown(cleaveHitChip);
      await vi.advanceTimersByTimeAsync(300);

      // Popover should appear inside the Cleave row
      const cleaveMenu = cleaveRow?.querySelector('[role="menu"]');
      expect(cleaveMenu).toBeTruthy();
    });

    it('Cleave popover advantage roll targets Cleave hit, not parent', async () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = { 'attack.greataxe.mastery': 1 };
      // 0.1 → d20=3, 0.5 → d20=11. Advantage takes 11. Cleave total = 11 + 5 = 16
      const randomMock = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Activate Cleave row
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      const attackRows = container.querySelectorAll('.choice-panel__attack');
      const parentRow = attackRows[0];
      const cleaveRow = attackRows[1];
      const parentHitChip = parentRow?.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      const cleaveHitChip = cleaveRow?.querySelector('.attack-chip--rollable') as HTMLButtonElement;

      // Long-press Cleave hit chip and select Advantage
      await fireEvent.pointerDown(cleaveHitChip);
      await vi.advanceTimersByTimeAsync(300);

      const items = cleaveRow?.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items?.[0] as HTMLElement); // Advantage

      // Cleave hit chip should show advantage result: 11 + 5 = 16
      expect(randomMock).toHaveBeenCalledTimes(2);
      expect(cleaveHitChip.textContent).toContain('16');
      // Parent hit chip should remain unrolled
      expect(parentHitChip.textContent).not.toContain('16');
      expect(parentHitChip.textContent).toBe('d20+5');
    });

    it('Cleave popover disadvantage roll targets Cleave hit, not parent', async () => {
      const entry = createMockGreataxeMasteryEntry();
      const facts = { 'attack.greataxe.mastery': 1 };
      // 0.1 → d20=3, 0.5 → d20=11. Disadvantage takes 3. Cleave total = 3 + 5 = 8
      const randomMock = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true, facts }
      });

      // Activate Cleave row
      const followupButton = container.querySelector(
        '.choice-panel__followup-button'
      ) as HTMLButtonElement;
      await fireEvent.click(followupButton);

      const attackRows = container.querySelectorAll('.choice-panel__attack');
      const parentRow = attackRows[0];
      const cleaveRow = attackRows[1];
      const parentHitChip = parentRow?.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      const cleaveHitChip = cleaveRow?.querySelector('.attack-chip--rollable') as HTMLButtonElement;

      // Long-press Cleave hit chip and select Disadvantage
      await fireEvent.pointerDown(cleaveHitChip);
      await vi.advanceTimersByTimeAsync(300);

      const items = cleaveRow?.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items?.[2] as HTMLElement); // Disadvantage

      // Cleave hit chip should show disadvantage result: 3 + 5 = 8
      expect(randomMock).toHaveBeenCalledTimes(2);
      expect(cleaveHitChip.textContent).toContain('8');
      // Parent hit chip should remain unrolled
      expect(parentHitChip.textContent).toBe('d20+5');
    });
  });

  // === Skill Check d20-roll tests ===

  describe('Skill Check roller (d20-roll model)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it('renders skill check with d20+bonus display', () => {
      const entry = createMockSkillCheckEntry({ rollBonus: 3 });
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const rollButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      expect(rollButton).toBeTruthy();
      expect(rollButton.textContent).toBe('d20+3');
    });

    it('rolls skill check on tap', async () => {
      const entry = createMockSkillCheckEntry({ rollBonus: 3 });
      // 0.6 → d20=13. Total = 13 + 3 = 16
      vi.spyOn(Math, 'random').mockReturnValue(0.6);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const rollButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.click(rollButton);

      expect(rollButton.textContent).toContain('16');
    });

    it('opens popover on long press of skill check chip', async () => {
      const entry = createMockSkillCheckEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const rollButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(rollButton);
      await vi.advanceTimersByTimeAsync(300);

      const menu = container.querySelector('[role="menu"]');
      expect(menu).toBeTruthy();
    });

    it('advantage works for skill check roll', async () => {
      const entry = createMockSkillCheckEntry({ rollBonus: 3 });
      // 0.1 → d20=3, 0.5 → d20=11. Advantage takes 11. Total = 11 + 3 = 14
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const rollButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(rollButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[0]); // Advantage

      expect(rollButton.textContent).toContain('14');
    });

    it('disadvantage works for skill check roll', async () => {
      const entry = createMockSkillCheckEntry({ rollBonus: 3 });
      // 0.1 → d20=3, 0.5 → d20=11. Disadvantage takes 3. Total = 3 + 3 = 6
      vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.5);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const rollButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.pointerDown(rollButton);
      await vi.advanceTimersByTimeAsync(300);

      const items = container.querySelectorAll('[role="menuitem"]');
      await fireEvent.click(items[2]); // Disadvantage

      expect(rollButton.textContent).toContain('6');
    });

    it('skill check chip has aria-haspopup on trigger', () => {
      const entry = createMockSkillCheckEntry();
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const rollButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      expect(rollButton?.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('handles negative skill bonus', () => {
      const entry = createMockSkillCheckEntry({ rollBonus: -2 });
      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const rollButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      expect(rollButton.textContent).toBe('d20-2');
    });

    it('skill check nat20 aria-label says Natural 20, not Critical hit', async () => {
      const entry = createMockSkillCheckEntry({ rollBonus: 3 });
      // 0.95 → d20=20
      vi.spyOn(Math, 'random').mockReturnValue(0.95);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const rollButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.click(rollButton);

      const ariaLabel = rollButton.getAttribute('aria-label') ?? '';
      expect(ariaLabel).toContain('play.choices.initiative.nat20');
      expect(ariaLabel).not.toContain('play.choices.attack.nat20');
    });

    it('skill check nat1 aria-label says Natural 1, not Critical miss', async () => {
      const entry = createMockSkillCheckEntry({ rollBonus: 3 });
      // 0.0 → d20=1
      vi.spyOn(Math, 'random').mockReturnValue(0);

      const { container } = render(ChoicePanel, {
        props: { entry, editable: true }
      });

      const rollButton = container.querySelector('.attack-chip--rollable') as HTMLButtonElement;
      await fireEvent.click(rollButton);

      const ariaLabel = rollButton.getAttribute('aria-label') ?? '';
      expect(ariaLabel).toContain('play.choices.initiative.nat1');
      expect(ariaLabel).not.toContain('play.choices.attack.nat1');
    });
  });
});
