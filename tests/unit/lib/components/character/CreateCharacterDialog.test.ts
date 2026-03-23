import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import CreateCharacterDialog from '$lib/components/character/CreateCharacterDialog.svelte';

// English translations for testing
const translations: Record<string, string> = {
  'character.enterName': 'Enter character name',
  'character.create': 'Create',
  'character.cancel': 'Cancel',
  'character.creating': 'Creating...',
  'character.createError': 'Failed to create character. Please try again.',
  'species.label': 'Species',
  'species.human': 'Human'
};

// Mock $lib/i18n module for this test file
vi.mock('$lib/i18n', () => ({
  t: readable((key: string) => translations[key] ?? key),
  locale: {
    ...readable('en'),
    set: vi.fn()
  },
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en', 'en-x-tlh']
}));

describe('CreateCharacterDialog', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders nothing when isOpen is false', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: false,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn()
      }
    });

    // No dialog should be rendered
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders dialog when isOpen is true', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn()
      }
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).toContain('Enter character name');
  });

  it('has proper ARIA attributes', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn()
      }
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('dialog-title');
  });

  it('shows input field for character name', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input?.getAttribute('placeholder')).toContain('Enter character name');
  });

  it('has Create and Cancel buttons', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn()
      }
    });

    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b) => b.textContent);

    expect(buttonTexts.some((t) => t?.includes('Create'))).toBe(true);
    expect(buttonTexts.some((t) => t?.includes('Cancel'))).toBe(true);
  });

  it('calls onCreate with entered name when Create is clicked', async () => {
    const onCreate = vi.fn();

    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate,
        onClose: vi.fn()
      }
    });

    // Get the input and simulate user typing
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;

    // Simulate user input by triggering input events
    input.focus();
    input.value = 'Gandalf';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Force Svelte to process the binding
    await new Promise((resolve) => setTimeout(resolve, 0));

    const createButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Create')
    );
    createButton?.click();

    expect(onCreate).toHaveBeenCalledWith('Gandalf', 'human');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();

    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose
      }
    });

    const cancelButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancel')
    );
    cancelButton?.click();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables Create button when name is empty', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn()
      }
    });

    const createButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Create')
    );

    expect(createButton?.disabled).toBe(true);
  });

  it('shows loading state when isCreating is true', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: true,
        onCreate: vi.fn(),
        onClose: vi.fn()
      }
    });

    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b) => b.textContent);

    expect(buttonTexts.some((t) => t?.includes('Creating'))).toBe(true);
  });

  it('disables all interactive elements when creating', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: true,
        onCreate: vi.fn(),
        onClose: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]');
    expect(input?.disabled).toBe(true);

    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      expect(btn.disabled).toBe(true);
    });
  });

  it('displays error message when errorMessage prop is provided', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn(),
        errorMessage: 'Failed to create character. Please try again.',
        onClearError: vi.fn()
      }
    });

    expect(container.textContent).toContain('Failed to create character. Please try again.');
  });

  it('does not display error message when errorMessage is null', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn(),
        errorMessage: null,
        onClearError: vi.fn()
      }
    });

    expect(container.textContent).not.toContain('Failed to create');
  });

  it('error message has proper ARIA attributes for accessibility', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn(),
        errorMessage: 'Failed to create character. Please try again.',
        onClearError: vi.fn()
      }
    });

    const errorElement = container.querySelector('[role="alert"]');
    expect(errorElement).toBeTruthy();
    expect(errorElement?.getAttribute('aria-live')).toBe('polite');
  });

  it('calls onClearError when user types in the input field', async () => {
    const onClearError = vi.fn();

    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn(),
        errorMessage: 'Failed to create character. Please try again.',
        onClearError
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'G';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onClearError).toHaveBeenCalledOnce();
  });

  // Species Selection Tests
  describe('Species Selection', () => {
    it('renders a species dropdown', () => {
      mount(CreateCharacterDialog, {
        target: container,
        props: {
          isOpen: true,
          isCreating: false,
          onCreate: vi.fn(),
          onClose: vi.fn()
        }
      });

      const select = container.querySelector('select');
      expect(select).toBeTruthy();
    });

    it('includes Human as an option in the species dropdown', () => {
      mount(CreateCharacterDialog, {
        target: container,
        props: {
          isOpen: true,
          isCreating: false,
          onCreate: vi.fn(),
          onClose: vi.fn()
        }
      });

      const select = container.querySelector('select');
      const options = Array.from(select?.options ?? []);
      const humanOption = options.find((opt) => opt.value === 'human');

      expect(humanOption).toBeTruthy();
      expect(humanOption?.textContent).toBe('Human');
    });

    it('defaults species to human', () => {
      mount(CreateCharacterDialog, {
        target: container,
        props: {
          isOpen: true,
          isCreating: false,
          onCreate: vi.fn(),
          onClose: vi.fn()
        }
      });

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select?.value).toBe('human');
    });

    it('calls onCreate with name and species when Create is clicked', async () => {
      const onCreate = vi.fn();

      mount(CreateCharacterDialog, {
        target: container,
        props: {
          isOpen: true,
          isCreating: false,
          onCreate,
          onClose: vi.fn()
        }
      });

      // Fill in the name
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      input.focus();
      input.value = 'Legolas';
      input.dispatchEvent(new Event('input', { bubbles: true }));

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Click Create
      const createButton = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Create')
      );
      createButton?.click();

      expect(onCreate).toHaveBeenCalledWith('Legolas', 'human');
    });
  });
});
