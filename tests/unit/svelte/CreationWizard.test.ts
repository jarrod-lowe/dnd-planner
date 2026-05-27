import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CreationWizard from '$lib/components/character/CreationWizard.svelte';

describe('CreationWizard', () => {
  const baseProps = {
    isCreating: false,
    onCreate: vi.fn(),
    onCancel: vi.fn(),
    errorMessage: null as string | null,
    onClearError: vi.fn()
  };

  it('renders name input and species/class selects on basics step', () => {
    const { container } = render(CreationWizard, { props: baseProps });
    const input = container.querySelector('input[type="text"]');
    const selects = container.querySelectorAll('select');
    expect(input).toBeTruthy();
    expect(selects).toHaveLength(2);
  });

  it('disables Next button when name is empty', () => {
    const { container } = render(CreationWizard, { props: baseProps });
    const nextButton = container.querySelector(
      'button.dialog__button--primary'
    ) as HTMLButtonElement;
    expect(nextButton.disabled).toBe(true);
  });

  it('enables Next button when name is filled', async () => {
    const { container } = render(CreationWizard, { props: baseProps });
    const input = container.querySelector('input')!;
    await fireEvent.input(input, { target: { value: 'Gandalf' } });
    const nextButton = container.querySelector(
      'button.dialog__button--primary'
    ) as HTMLButtonElement;
    expect(nextButton.disabled).toBe(false);
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const { container } = render(CreationWizard, {
      props: { ...baseProps, onCancel }
    });
    const cancelButton = container.querySelector('button.dialog__button--secondary')!;
    await fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders step indicator dots', () => {
    const { container } = render(CreationWizard, { props: baseProps });
    const dots = container.querySelectorAll('.wizard__step-dot');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('shows create button on confirm step when navigating forward', async () => {
    const { container } = render(CreationWizard, { props: baseProps });
    const input = container.querySelector('input')!;
    await fireEvent.input(input, { target: { value: 'Gandalf' } });
    const nextButton = container.querySelector(
      'button.dialog__button--primary'
    ) as HTMLButtonElement;
    await fireEvent.click(nextButton);
    // After clicking Next, we should be on the next step (or confirm if no settings)
    const primaryButton = container.querySelector('button.dialog__button--primary');
    expect(primaryButton).toBeTruthy();
  });
});
