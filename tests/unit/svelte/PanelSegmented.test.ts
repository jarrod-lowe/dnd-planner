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

// A segmented control with an optional prefix label (e.g. Grapple's "Target:"
// outcome marker, where the save belongs to the target, not the player).
const prefixedControl: SegmentedControl = {
  ...baseControl,
  prefix: 'play.choices.grapple.target'
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

  it('renders the prefix label before the segments when control has prefix', () => {
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, control: prefixedControl }
    });
    const prefix = container.querySelector('.panel-renderer__segmented-prefix');
    // Mock i18n returns the key as the rendered text.
    expect(prefix?.textContent).toBe('play.choices.grapple.target');
  });

  it('uses the prefix as the fieldset accessible name', () => {
    const { container } = render(PanelSegmented, {
      props: { ...baseProps, control: prefixedControl }
    });
    const fieldset = container.querySelector('fieldset');
    const prefix = container.querySelector('.panel-renderer__segmented-prefix');
    // The prefix span's id and the fieldset's aria-labelledby must agree so the
    // group is announced under the prefix label.
    const labelledby = fieldset?.getAttribute('aria-labelledby');
    expect(labelledby).toBeTruthy();
    expect(prefix?.id).toBe(labelledby);
  });

  it('uses unique element ids and radio names across instances sharing the same var', () => {
    // Grapple and a save record both use var "passed"; their input/label ids and
    // radio names must not collide, or label[for] associations cross up and the
    // two groups behave as one native radio group (picking one deselects the
    // other). Each instance must own a distinct id and name.
    const { container: a } = render(PanelSegmented, { props: baseProps });
    const { container: b } = render(PanelSegmented, { props: baseProps });
    const aInput = a.querySelector('input[type="radio"]')!;
    const bInput = b.querySelector('input[type="radio"]')!;
    expect(aInput.id).not.toBe(bInput.id);
    expect(aInput.name).not.toBe(bInput.name);
  });

  it('renders no prefix and no aria-labelledby when prefix is absent', () => {
    // Guards the save-record and find-steed uses, which pass no prefix.
    const { container } = render(PanelSegmented, { props: baseProps });
    expect(container.querySelector('.panel-renderer__segmented-prefix')).toBeNull();
    const fieldset = container.querySelector('fieldset');
    expect(fieldset?.getAttribute('aria-labelledby')).toBeNull();
  });
});
