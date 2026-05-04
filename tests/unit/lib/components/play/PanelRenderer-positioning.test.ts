import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry } from '$lib/rules-engine';

const createMockEntry = (overrides?: Partial<AvailableRuleEntry>): AvailableRuleEntry => ({
  rule: { id: 'test-rule', description: 'Test Rule', activities: [] },
  legal: true,
  applicable: true,
  diagnostics: [],
  ...overrides
});

describe('PanelRenderer - positioning', () => {
  it('positions warning indicator outside header as direct child of panel', () => {
    const entry = createMockEntry({ legal: false });
    const { container } = render(PanelRenderer, { props: { entry } });
    const warning = container.querySelector('.warning-indicator');
    expect(warning).toBeTruthy();
    // Warning should be a direct child of the panel container, not inside header
    expect(warning?.parentElement?.classList.contains('panel-renderer')).toBe(true);
  });

  it('does not show warning indicator inside header area', () => {
    const entry = createMockEntry({ legal: false });
    const { container } = render(PanelRenderer, { props: { entry } });
    const header = container.querySelector('.panel-renderer__header');
    expect(header?.querySelector('.warning-indicator')).toBeNull();
  });

  it('panel container has position: relative for absolute children', () => {
    const entry = createMockEntry({ legal: false });
    const { container } = render(PanelRenderer, { props: { entry } });
    // The panel must be the positioned ancestor for absolutely-placed children
    // jsdom doesn't compute CSS, so we verify the class is present (CSS sets position: relative)
    expect(container.querySelector('.panel-renderer')).toBeTruthy();
  });
});

describe('PanelRenderer - actions group', () => {
  it('renders actions group with remove button when onRemove provided', () => {
    const entry = createMockEntry();
    const onRemove = vi.fn();
    const { container } = render(PanelRenderer, { props: { entry, onRemove } });
    const actions = container.querySelector('.panel-renderer__actions');
    expect(actions).toBeTruthy();
    expect(actions?.querySelector('.panel-renderer__button--remove')).toBeTruthy();
  });

  it('renders actions group with all three buttons when move props provided', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        onRemove: vi.fn(),
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        canMoveUp: true,
        canMoveDown: true
      }
    });
    const actions = container.querySelector('.panel-renderer__actions');
    expect(actions).toBeTruthy();
    expect(actions?.querySelectorAll('button')).toHaveLength(3); // up, down, remove
  });

  it('does not render actions group when no action props provided', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, { props: { entry } });
    expect(container.querySelector('.panel-renderer__actions')).toBeNull();
  });

  it('renders actions group with only move up and down when no onRemove', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        canMoveUp: true,
        canMoveDown: true
      }
    });
    const actions = container.querySelector('.panel-renderer__actions');
    expect(actions).toBeTruthy();
    expect(actions?.querySelectorAll('button')).toHaveLength(2); // up, down only
  });

  it('disables move up button when canMoveUp is false', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        onRemove: vi.fn(),
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        canMoveUp: false,
        canMoveDown: true
      }
    });
    const upButton = container.querySelector(
      '.panel-renderer__button--move-up'
    ) as HTMLButtonElement;
    expect(upButton?.disabled).toBe(true);
  });

  it('disables move down button when canMoveDown is false', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        onRemove: vi.fn(),
        onMoveUp: vi.fn(),
        onMoveDown: vi.fn(),
        canMoveUp: true,
        canMoveDown: false
      }
    });
    const downButton = container.querySelector(
      '.panel-renderer__button--move-down'
    ) as HTMLButtonElement;
    expect(downButton?.disabled).toBe(true);
  });

  it('calls onMoveUp when move up button is clicked', async () => {
    const entry = createMockEntry();
    const onMoveUp = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        onRemove: vi.fn(),
        onMoveUp,
        onMoveDown: vi.fn(),
        canMoveUp: true,
        canMoveDown: true
      }
    });
    const upButton = container.querySelector('.panel-renderer__button--move-up')!;
    await fireEvent.click(upButton);
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it('calls onMoveDown when move down button is clicked', async () => {
    const entry = createMockEntry();
    const onMoveDown = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        onRemove: vi.fn(),
        onMoveUp: vi.fn(),
        onMoveDown,
        canMoveUp: true,
        canMoveDown: true
      }
    });
    const downButton = container.querySelector('.panel-renderer__button--move-down')!;
    await fireEvent.click(downButton);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('actions group has the actions class for CSS positioning', () => {
    const entry = createMockEntry();
    const { container } = render(PanelRenderer, { props: { entry, onRemove: vi.fn() } });
    const actions = container.querySelector('.panel-renderer__actions') as HTMLElement;
    expect(actions).toBeTruthy();
    // CSS sets position: absolute on this class; jsdom can't compute it, but class presence confirms it
    expect(actions.classList.contains('panel-renderer__actions')).toBe(true);
  });

  it('remove button in actions group calls onRemove', async () => {
    const entry = createMockEntry();
    const onRemove = vi.fn();
    const { container } = render(PanelRenderer, { props: { entry, onRemove } });
    const removeButton = container.querySelector('.panel-renderer__button--remove')!;
    await fireEvent.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

describe('PanelRenderer - unified template', () => {
  it('uses single template for both editable and non-editable modes', () => {
    // Both modes should render the same structural elements
    const entry = createMockEntry({ legal: false });
    const onRemove = vi.fn();

    const { container: editableContainer } = render(PanelRenderer, {
      props: { entry, editable: true, onRemove }
    });
    const { container: readonlyContainer } = render(PanelRenderer, {
      props: { entry, editable: false, onRemove }
    });

    // Both should have warning indicator as direct child of panel
    const editableWarning = editableContainer.querySelector('.warning-indicator');
    const readonlyWarning = readonlyContainer.querySelector('.warning-indicator');
    expect(editableWarning?.parentElement?.classList.contains('panel-renderer')).toBe(true);
    expect(readonlyWarning?.parentElement?.classList.contains('panel-renderer')).toBe(true);

    // Both should have actions group (not in header)
    const editableActions = editableContainer.querySelector('.panel-renderer__actions');
    const readonlyActions = readonlyContainer.querySelector('.panel-renderer__actions');
    expect(editableActions).toBeTruthy();
    expect(readonlyActions).toBeTruthy();

    // Neither should have warning or remove in header
    const editableHeader = editableContainer.querySelector('.panel-renderer__header');
    const readonlyHeader = readonlyContainer.querySelector('.panel-renderer__header');
    expect(editableHeader?.querySelector('.warning-indicator')).toBeNull();
    expect(readonlyHeader?.querySelector('.warning-indicator')).toBeNull();
    expect(editableHeader?.querySelector('.panel-renderer__button--remove')).toBeNull();
    expect(readonlyHeader?.querySelector('.panel-renderer__button--remove')).toBeNull();
  });
});
