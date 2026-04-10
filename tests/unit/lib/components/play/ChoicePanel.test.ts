import { describe, it, expect, vi, afterEach } from 'vitest';
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
      range: { default: { number: overrides?.range ?? 5 } },
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
  });
});
