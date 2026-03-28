import { describe, it, expect, vi } from 'vitest';
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

const createMockMoveEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: {
    id: 'move',
    description: 'Move',
    activities: [],
    ui: {
      model: 'move',
      section: 'move',
      name: 'rule.dnd-5e-2024.base.move.name'
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
    // i18n key is rule.dnd-5e-2024.base.move.name
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
          name: 'rule.dnd-5e-2024.base.move-rough-terrain.name'
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
          name: 'rule.dnd-5e-2024.base.move-walk.name'
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
});
