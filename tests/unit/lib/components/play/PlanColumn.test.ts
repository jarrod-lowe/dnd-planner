import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import PlanColumn from '$lib/components/play/PlanColumn.svelte';
import type { PlannedItem } from '$lib/play/types';
import type { Rule } from '$lib/rules-engine';

const createMockPlanItem = (instanceId: string, ruleId: string, order: number): PlannedItem => ({
  instanceId,
  rule: { id: ruleId, description: `Rule ${ruleId}`, activities: [] } as Rule,
  order
});

describe('PlanColumn', () => {
  it('renders list of planned items', () => {
    const items = [
      createMockPlanItem('inst-1', 'attack', 0),
      createMockPlanItem('inst-2', 'move', 1)
    ];

    const { getByText } = render(PlanColumn, {
      props: { items, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    expect(getByText('Rule attack')).toBeTruthy();
    expect(getByText('Rule move')).toBeTruthy();
  });

  it('shows empty state when no items', () => {
    const { getByText } = render(PlanColumn, {
      props: { items: [], onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    expect(getByText('play.plan.empty')).toBeTruthy();
  });

  it('calls onMoveUp with correct instanceId', async () => {
    // Need at least 2 items for move up to work on second item
    const items = [
      createMockPlanItem('inst-1', 'attack', 0),
      createMockPlanItem('inst-2', 'move', 1)
    ];
    const onMoveUp = vi.fn();

    const { container } = render(PlanColumn, {
      props: { items, onMoveUp, onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    // Click move up on second item (which can move up)
    const upButtons = container.querySelectorAll('.plan-item__move-up');
    (upButtons[1] as HTMLButtonElement)?.click();

    expect(onMoveUp).toHaveBeenCalledWith('inst-2');
  });

  it('calls onMoveDown with correct instanceId', async () => {
    // Need at least 2 items for move down to work on first item
    const items = [
      createMockPlanItem('inst-1', 'attack', 0),
      createMockPlanItem('inst-2', 'move', 1)
    ];
    const onMoveDown = vi.fn();

    const { container } = render(PlanColumn, {
      props: { items, onMoveUp: vi.fn(), onMoveDown, onRemove: vi.fn() }
    });

    // Click move down on first item (which can move down)
    const downButtons = container.querySelectorAll('.plan-item__move-down');
    (downButtons[0] as HTMLButtonElement)?.click();

    expect(onMoveDown).toHaveBeenCalledWith('inst-1');
  });

  it('calls onRemove with correct instanceId', async () => {
    const items = [createMockPlanItem('inst-1', 'attack', 0)];
    const onRemove = vi.fn();

    const { container } = render(PlanColumn, {
      props: { items, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove }
    });

    const removeButton = container.querySelector('.plan-item__remove') as HTMLButtonElement;
    removeButton?.click();

    expect(onRemove).toHaveBeenCalledWith('inst-1');
  });

  it('disables move up for first item', () => {
    const items = [
      createMockPlanItem('inst-1', 'attack', 0),
      createMockPlanItem('inst-2', 'move', 1)
    ];

    const { container } = render(PlanColumn, {
      props: { items, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const upButtons = container.querySelectorAll('.plan-item__move-up');
    expect((upButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((upButtons[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables move down for last item', () => {
    const items = [
      createMockPlanItem('inst-1', 'attack', 0),
      createMockPlanItem('inst-2', 'move', 1)
    ];

    const { container } = render(PlanColumn, {
      props: { items, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const downButtons = container.querySelectorAll('.plan-item__move-down');
    expect((downButtons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((downButtons[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it('has aria-live for accessibility', () => {
    const items = [createMockPlanItem('inst-1', 'attack', 0)];

    const { container } = render(PlanColumn, {
      props: { items, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const list = container.querySelector('[aria-live="polite"]');
    expect(list).toBeTruthy();
  });
});
