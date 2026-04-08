import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import DeleteCharacterDialog from '$lib/components/character/DeleteCharacterDialog.svelte';

// English translations for testing
const translations: Record<string, string> = {
  'character.delete': 'Delete',
  'character.deleteConfirm': 'Are you sure you want to delete {name}?',
  'character.deleteWarning': 'This action cannot be undone.',
  'character.deleting': 'Deleting...',
  'character.cancel': 'Cancel',
  'character.deleteError': 'Failed to delete character. Please try again.'
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

describe('DeleteCharacterDialog', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders nothing when isOpen is false', () => {
    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: false,
        isDeleting: false,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders dialog when isOpen is true', () => {
    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: false,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    });

    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    expect(container.textContent).toContain('Gandalf');
  });

  it('has proper ARIA attributes', () => {
    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: false,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('dialog-title');
  });

  it('shows warning text', () => {
    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: false,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    });

    expect(container.textContent).toContain('This action cannot be undone');
  });

  it('has Delete and Cancel buttons', () => {
    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: false,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    });

    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b) => b.textContent);

    expect(buttonTexts.some((t) => t?.includes('Delete'))).toBe(true);
    expect(buttonTexts.some((t) => t?.includes('Cancel'))).toBe(true);
  });

  it('calls onConfirm when Delete is clicked', () => {
    const onConfirm = vi.fn();

    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: false,
        characterName: 'Gandalf',
        onConfirm,
        onClose: vi.fn()
      }
    });

    const deleteButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete')
    );
    deleteButton?.click();

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();

    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: false,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose
      }
    });

    const cancelButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cancel')
    );
    cancelButton?.click();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows loading state when isDeleting is true', () => {
    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: true,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    });

    const buttons = container.querySelectorAll('button');
    const buttonTexts = Array.from(buttons).map((b) => b.textContent);

    expect(buttonTexts.some((t) => t?.includes('Deleting'))).toBe(true);
  });

  it('disables buttons when deleting', () => {
    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: true,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose: vi.fn()
      }
    });

    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      expect(btn.disabled).toBe(true);
    });
  });

  it('displays error message when errorMessage prop is provided', () => {
    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: false,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose: vi.fn(),
        errorMessage: 'Failed to delete character. Please try again.'
      }
    });

    expect(container.textContent).toContain('Failed to delete character');
  });

  it('error message has proper ARIA attributes for accessibility', () => {
    mount(DeleteCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isDeleting: false,
        characterName: 'Gandalf',
        onConfirm: vi.fn(),
        onClose: vi.fn(),
        errorMessage: 'Failed to delete character. Please try again.'
      }
    });

    const errorElement = container.querySelector('[role="alert"]');
    expect(errorElement).toBeTruthy();
    expect(errorElement?.getAttribute('aria-live')).toBe('polite');
  });
});
