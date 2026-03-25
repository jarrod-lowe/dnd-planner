import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
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

    expect(getByText(/Rule attack/)).toBeTruthy();
    expect(getByText(/Rule move/)).toBeTruthy();
  });

  it('calls onMoveUp with correct instanceId', async () => {
    const items = [createMockPlanItem('inst-1', 'attack', 0)];
    const onMoveUp = vi.fn();

    const { container } = render(PlanColumn, {
      props: { items, onMoveUp, onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const upButtons = container.querySelectorAll('.choice-panel__button--move-up');
    await fireEvent.click(upButtons[0]!);

    expect(onMoveUp).toHaveBeenCalledWith('inst-1');
  });

  it('calls onMoveDown with correct instanceId', async () => {
    const items = [createMockPlanItem('inst-1', 'attack', 0)];
    const onMoveDown = vi.fn();

    const { container } = render(PlanColumn, {
      props: { items, onMoveUp: vi.fn(), onMoveDown, onRemove: vi.fn() }
    });
    const downButtons = container.querySelectorAll('.choice-panel__button--move-down');
    await fireEvent.click(downButtons[0]!);

    expect(onMoveDown).toHaveBeenCalledWith('inst-1');
  });

  it('calls onRemove with correct instanceId', async () => {
    const items = [createMockPlanItem('inst-1', 'attack', 0)];
    const onRemove = vi.fn();

    const { container } = render(PlanColumn, {
      props: { items, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove }
    });
    const removeButtons = container.querySelectorAll('.choice-panel__button--remove');
    await fireEvent.click(removeButtons[0]!);

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
    const upButtons = container.querySelectorAll('.choice-panel__button--move-up');
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
    const downButtons = container.querySelectorAll('.choice-panel__button--move-down');
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
