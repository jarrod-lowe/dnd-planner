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
  it('renders three radio inputs', () => {
    const { container } = render(PanelSegmented, { props: baseProps });
    const inputs = container.querySelectorAll('input[type="radio"]');
    expect(inputs).toHaveLength(3);
  });

  it('renders labels with i18n keys', () => {
    const { container } = render(PanelSegmented, { props: baseProps });
    const labels = container.querySelectorAll('label');
    // Mock i18n returns the key as value
    expect(labels[0].textContent).toBe('planner.record.outcome.none');
    expect(labels[1].textContent).toBe('planner.record.passed');
    expect(labels[2].textContent).toBe('planner.record.failed');
  });

  it('has radiogroup via native fieldset', () => {
    const { container } = render(PanelSegmented, { props: baseProps });
    const fieldset = container.querySelector('fieldset');
    expect(fieldset).toBeTruthy();
  });

  it('calls onSelectionChange with -1 when none option clicked', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, onSelectionChange }
    });
    const inputs = container.querySelectorAll('input[type="radio"]');
    await fireEvent.click(inputs[0]);
    expect(onSelectionChange).toHaveBeenCalledWith({ passed: -1 });
  });

  it('calls onSelectionChange with 1 when passed option clicked', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, onSelectionChange }
    });
    const inputs = container.querySelectorAll('input[type="radio"]');
    await fireEvent.click(inputs[1]);
    expect(onSelectionChange).toHaveBeenCalledWith({ passed: 1 });
  });

  it('calls onSelectionChange with 0 when failed option clicked', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, onSelectionChange }
    });
    const inputs = container.querySelectorAll('input[type="radio"]');
    await fireEvent.click(inputs[2]);
    expect(onSelectionChange).toHaveBeenCalledWith({ passed: 0 });
  });

  it('renders spans instead of inputs in non-editable mode', () => {
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, editable: false }
    });
    const inputs = container.querySelectorAll('input');
    const spans = container.querySelectorAll('span.panel-renderer__segment--readonly');
    expect(inputs).toHaveLength(0);
    expect(spans).toHaveLength(3);
  });

  it('checks the active radio input', () => {
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, selections: { passed: 1 } }
    });
    const inputs = container.querySelectorAll('input[type="radio"]');
    expect(inputs[0].checked).toBe(false);
    expect(inputs[1].checked).toBe(true);
    expect(inputs[2].checked).toBe(false);
  });
});
