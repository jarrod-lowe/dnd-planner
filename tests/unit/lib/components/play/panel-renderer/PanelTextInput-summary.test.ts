import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelTextInput from '$lib/components/play/panel-renderer/PanelTextInput.svelte';
import type { TextInputControl } from '$lib/components/play/panel-renderer/types';

function createControl(overrides: Partial<TextInputControl> = {}): TextInputControl {
  return { type: 'text', var: 'note', ...overrides };
}

const defaultProps = (overrides: Partial<TextInputControl> = {}) => ({
  control: createControl(overrides),
  editable: true,
  facts: {},
  vars: {},
  selections: {},
  onSelectionChange: vi.fn()
});

const interactiveSelector =
  'input, textarea, button, [role="radiogroup"], [role="radio"], [tabindex]';

describe('PanelTextInput summary short form', () => {
  it('renders the entered text as plain text when summary is true', () => {
    const { container } = render(PanelTextInput, {
      props: { ...defaultProps(), selections: { note: 'hello world' }, summary: true }
    });
    expect(container.textContent?.trim()).toBe('hello world');
  });

  it('renders nothing when the value is empty in summary mode', () => {
    const { container } = render(PanelTextInput, {
      props: { ...defaultProps(), selections: {}, summary: true }
    });
    expect(container.textContent?.trim()).toBe('');
  });

  it('renders no focusable/interactive elements in summary mode', () => {
    const { container } = render(PanelTextInput, {
      props: { ...defaultProps(), selections: { note: 'hello world' }, summary: true }
    });
    expect(container.querySelectorAll(interactiveSelector)).toHaveLength(0);
  });

  it('keeps a half-typed note across a summary toggle', async () => {
    const { container, rerender } = render(PanelTextInput, {
      props: { ...defaultProps(), summary: false }
    });
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'draft note' } });

    await rerender({ ...defaultProps(), summary: true });
    expect(container.textContent?.trim()).toBe('draft note');

    await rerender({ ...defaultProps(), summary: false });
    const inputAgain = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(inputAgain.value).toBe('draft note');
  });

  it('uses an ellipsizing single-line class for the summary text', () => {
    const { container } = render(PanelTextInput, {
      props: { ...defaultProps(), selections: { note: 'hello world' }, summary: true }
    });
    const el = container.querySelector('.panel-renderer__text-summary');
    expect(el).toBeTruthy();
    expect(el?.textContent).toBe('hello world');
  });
});
