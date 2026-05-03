import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PlanItem from '$lib/components/play/PlanItem.svelte';
import type { PlannedItem } from '$lib/play/types';
import type { Rule, Facts } from '$lib/rules-engine';

const createMockPlanItem = (ruleId: string, description?: string): PlannedItem => ({
  instanceId: `instance-${ruleId}`,
  rule: { id: ruleId, description: description || `Rule ${ruleId}`, activities: [] } as Rule,
  order: 0
});

const createMockMovePlanItem = (): PlannedItem => ({
  instanceId: 'instance-move',
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
  order: 0
});

describe('PlanItem', () => {
  it('renders the rule description', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { getByText } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    expect(getByText('Attack')).toBeTruthy();
  });

  // === Control buttons (via PlanItem wrapper) ===

  it('has move up button with accessible label', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const upButton = container.querySelector('.plan-item__button--move-up');
    expect(upButton?.getAttribute('aria-label')).toContain('play.plan.moveUp');
  });

  it('has move down button with accessible label', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const downButton = container.querySelector('.plan-item__button--move-down');
    expect(downButton?.getAttribute('aria-label')).toContain('play.plan.moveDown');
  });

  it('has remove button with accessible label', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const removeButton = container.querySelector('.panel-renderer__button--remove');
    expect(removeButton?.getAttribute('aria-label')).toContain('play.plan.remove');
  });

  it('calls onMoveUp when move up button is clicked', async () => {
    const item = createMockPlanItem('attack');
    const onMoveUp = vi.fn();

    const { container } = render(PlanItem, {
      props: { item, onMoveUp, onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const upButton = container.querySelector('.plan-item__button--move-up') as HTMLButtonElement;
    upButton?.click();

    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it('calls onMoveDown when move down button is clicked', async () => {
    const item = createMockPlanItem('attack');
    const onMoveDown = vi.fn();

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown, onRemove: vi.fn() }
    });

    const downButton = container.querySelector(
      '.plan-item__button--move-down'
    ) as HTMLButtonElement;
    downButton?.click();

    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove when remove button is clicked', async () => {
    const item = createMockPlanItem('attack');
    const onRemove = vi.fn();

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove }
    });

    const removeButton = container.querySelector(
      '.panel-renderer__button--remove'
    ) as HTMLButtonElement;
    removeButton?.click();

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables move up button when canMoveUp is false', () => {
    const item = createMockPlanItem('attack');

    const { container } = render(PlanItem, {
      props: { item, canMoveUp: false, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const upButton = container.querySelector('.plan-item__button--move-up') as HTMLButtonElement;
    expect(upButton?.disabled).toBe(true);
  });

  it('disables move down button when canMoveDown is false', () => {
    const item = createMockPlanItem('attack');

    const { container } = render(PlanItem, {
      props: { item, canMoveDown: false, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const downButton = container.querySelector(
      '.plan-item__button--move-down'
    ) as HTMLButtonElement;
    expect(downButton?.disabled).toBe(true);
  });

  // === PanelRenderer integration tests ===

  it('renders PanelRenderer with editable mode for move rules', () => {
    const item = createMockMovePlanItem();
    const facts: Facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };

    const { container } = render(PlanItem, {
      props: { item, facts, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    // Slider should be enabled in editable mode
    const slider = container.querySelector('input[type="range"]');
    expect(slider).toBeTruthy();
    expect((slider as HTMLInputElement)?.disabled).toBe(false);
  });

  it('calls onSelectionChange when PanelRenderer slider changes', async () => {
    const item = createMockMovePlanItem();
    const facts: Facts = {
      'character.movement.remaining': 25,
      'character.movement.total': 30
    };
    const onSelectionChange = vi.fn();

    const { container } = render(PlanItem, {
      props: {
        item,
        facts,
        onSelectionChange,
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        onRemove: vi.fn()
      }
    });

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    slider.value = '15';
    await fireEvent.input(slider);

    expect(onSelectionChange).toHaveBeenCalledWith({ distance: 15 });
  });

  // === No panel-in-panel tests ===

  it('does not display position number', () => {
    const item = createMockPlanItem('attack', 'Attack');
    item.order = 2; // Would normally show "3"

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    // Should NOT have order element
    const orderElement = container.querySelector('.plan-item__order');
    expect(orderElement).toBeFalsy();
  });

  it('has no extra container styling on plan-item wrapper', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const planItem = container.querySelector('.plan-item');
    // The wrapper should exist but not have its own visual container
    expect(planItem).toBeTruthy();
    // PanelRenderer provides the visual container
    expect(container.querySelector('.panel-renderer')).toBeTruthy();
  });

  it('controls are in actions group at top-left of panel', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const actions = container.querySelector('.plan-item__actions');
    expect(actions).toBeTruthy();
  });

  it('actions contain move up and move down buttons', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const actions = container.querySelector('.plan-item__actions');

    const upButton = actions?.querySelector('.plan-item__button--move-up');
    const downButton = actions?.querySelector('.plan-item__button--move-down');

    expect(upButton).toBeTruthy();
    expect(downButton).toBeTruthy();
  });

  it('remove button is inside panel-renderer', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const removeButton = container.querySelector('.panel-renderer__button--remove');
    expect(removeButton).toBeTruthy();
  });
});
