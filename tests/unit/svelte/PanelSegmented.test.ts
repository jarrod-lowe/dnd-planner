import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelSegmented from '$lib/components/play/panel-renderer/PanelSegmented.svelte';
import type { SegmentedControl } from '$lib/components/play/panel-renderer/types';

const baseControl: SegmentedControl = {
  type: 'segmented',
  var: 'passed',
  options: [
    { value: -1, label: 'planner.record.outcome.none' },
    { value: 1, label: 'planner.record.passed' },
    { value: 0, label: 'planner.record.failed' }
  ]
};

const baseProps = {
  control: baseControl,
  editable: true,
  facts: {},
  vars: {},
  selections: {}
};

describe('PanelSegmented', () => {
  it('renders three segments', () => {
    const { container } = render(PanelSegmented, { props: baseProps });
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(3);
  });

  it('renders segment labels via i18n keys', () => {
    const { container } = render(PanelSegmented, { props: baseProps });
    const buttons = container.querySelectorAll('button');
    // Mock i18n returns the key as value
    expect(buttons[0].textContent).toBe('planner.record.outcome.none');
    expect(buttons[1].textContent).toBe('planner.record.passed');
    expect(buttons[2].textContent).toBe('planner.record.failed');
  });

  it('has radiogroup role', () => {
    const { container } = render(PanelSegmented, { props: baseProps });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).toBeTruthy();
  });

  it('calls onSelectionChange with -1 when none option clicked', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, onSelectionChange }
    });
    const buttons = container.querySelectorAll('button');
    await fireEvent.click(buttons[0]);
    expect(onSelectionChange).toHaveBeenCalledWith({ passed: -1 });
  });

  it('calls onSelectionChange with 1 when passed option clicked', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, onSelectionChange }
    });
    const buttons = container.querySelectorAll('button');
    await fireEvent.click(buttons[1]);
    expect(onSelectionChange).toHaveBeenCalledWith({ passed: 1 });
  });

  it('calls onSelectionChange with 0 when failed option clicked', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, onSelectionChange }
    });
    const buttons = container.querySelectorAll('button');
    await fireEvent.click(buttons[2]);
    expect(onSelectionChange).toHaveBeenCalledWith({ passed: 0 });
  });

  it('renders spans instead of buttons in non-editable mode', () => {
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, editable: false }
    });
    const buttons = container.querySelectorAll('button');
    const spans = container.querySelectorAll('span[role="radio"]');
    expect(buttons).toHaveLength(0);
    expect(spans).toHaveLength(3);
  });

  it('sets aria-checked on active segment', () => {
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, selections: { passed: 1 } }
    });
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-checked')).toBe('false');
    expect(buttons[1].getAttribute('aria-checked')).toBe('true');
    expect(buttons[2].getAttribute('aria-checked')).toBe('false');
  });
});
