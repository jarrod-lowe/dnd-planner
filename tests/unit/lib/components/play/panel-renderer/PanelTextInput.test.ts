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

describe('PanelTextInput', () => {
  it('renders text input when editable', () => {
    const { container } = render(PanelTextInput, { props: defaultProps() });
    expect(container.querySelector('input[type="text"]')).toBeTruthy();
  });

  it('renders textarea when multiline', () => {
    const { container } = render(PanelTextInput, { props: defaultProps({ multiline: true }) });
    expect(container.querySelector('textarea')).toBeTruthy();
    expect(container.querySelector('input')).toBeNull();
  });

  it('renders read-only span when not editable', () => {
    const { container } = render(PanelTextInput, {
      props: { ...defaultProps(), editable: false }
    });
    expect(container.querySelector('input')).toBeNull();
    expect(container.querySelector('.panel-renderer__text-value')).toBeTruthy();
  });

  it('fires onSelectionChange on input', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelTextInput, {
      props: { ...defaultProps(), onSelectionChange }
    });
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'hello' } });
    expect(onSelectionChange).toHaveBeenCalledWith({ note: 'hello' });
  });

  it('shows resolved value from selections', () => {
    const { container } = render(PanelTextInput, {
      props: { ...defaultProps(), selections: { note: 'existing' } }
    });
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.value).toBe('existing');
  });

  it('has aria-label from var name', () => {
    const { container } = render(PanelTextInput, { props: defaultProps() });
    const input = container.querySelector('input[type="text"]');
    expect(input?.getAttribute('aria-label')).toBe('note');
  });
});
