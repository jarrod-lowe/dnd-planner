import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import PlanItem from '$lib/components/play/PlanItem.svelte';
import type { PlannedItem } from '$lib/play/types';
import type { Rule } from '$lib/rules-engine';

const createMockPlanItem = (ruleId: string, description?: string): PlannedItem => ({
  instanceId: `instance-${ruleId}`,
  rule: { id: ruleId, description: description || `Rule ${ruleId}`, activities: [] } as Rule,
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

  it('has move up button with accessible label', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const upButton = container.querySelector('.plan-item__move-up');
    expect(upButton?.getAttribute('aria-label')).toContain('play.plan.moveUp');
  });

  it('has move down button with accessible label', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const downButton = container.querySelector('.plan-item__move-down');
    expect(downButton?.getAttribute('aria-label')).toContain('play.plan.moveDown');
  });

  it('has remove button with accessible label', () => {
    const item = createMockPlanItem('attack', 'Attack');

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const removeButton = container.querySelector('.plan-item__remove');
    expect(removeButton?.getAttribute('aria-label')).toContain('play.plan.remove');
  });

  it('calls onMoveUp when move up button is clicked', async () => {
    const item = createMockPlanItem('attack');
    const onMoveUp = vi.fn();

    const { container } = render(PlanItem, {
      props: { item, onMoveUp, onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const upButton = container.querySelector('.plan-item__move-up') as HTMLButtonElement;
    upButton?.click();

    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it('calls onMoveDown when move down button is clicked', async () => {
    const item = createMockPlanItem('attack');
    const onMoveDown = vi.fn();

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown, onRemove: vi.fn() }
    });

    const downButton = container.querySelector('.plan-item__move-down') as HTMLButtonElement;
    downButton?.click();

    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove when remove button is clicked', async () => {
    const item = createMockPlanItem('attack');
    const onRemove = vi.fn();

    const { container } = render(PlanItem, {
      props: { item, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove }
    });

    const removeButton = container.querySelector('.plan-item__remove') as HTMLButtonElement;
    removeButton?.click();

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('disables move up button when canMoveUp is false', () => {
    const item = createMockPlanItem('attack');

    const { container } = render(PlanItem, {
      props: { item, canMoveUp: false, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const upButton = container.querySelector('.plan-item__move-up') as HTMLButtonElement;
    expect(upButton?.disabled).toBe(true);
  });

  it('disables move down button when canMoveDown is false', () => {
    const item = createMockPlanItem('attack');

    const { container } = render(PlanItem, {
      props: { item, canMoveDown: false, onMoveUp: vi.fn(), onMoveDown: vi.fn(), onRemove: vi.fn() }
    });

    const downButton = container.querySelector('.plan-item__move-down') as HTMLButtonElement;
    expect(downButton?.disabled).toBe(true);
  });
});
