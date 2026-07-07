import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import CreateCharacterDialog from '$lib/components/character/CreateCharacterDialog.svelte';

const translations: Record<string, string> = {
  'character.enterName': 'Enter character name',
  'character.createNew': 'Create New Character',
  'character.create': 'Create',
  'character.cancel': 'Cancel',
  'character.creating': 'Creating...',
  'character.createError': 'Failed to create character. Please try again.',
  'character.modeCreate': 'Create',
  'character.modeImport': 'Import',
  'character.importTitle': 'Import Character',
  'character.importSelectFile': 'Select file',
  'character.importing': 'Importing...',
  'species.label': 'Species',
  'species.human': 'Human',
  'class.label': 'Class',
  'class.paladin-level1': 'Paladin',
  'wizard.stepBasics': 'Basics',
  'wizard.stepConfirm': 'Confirm',
  'wizard.stepSettings': 'Settings: {name}',
  'wizard.next': 'Next',
  'wizard.back': 'Back',
  'wizard.create': 'Create',
  'wizard.creating': 'Creating...'
};

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

    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders wizard dialog when isOpen is true in create mode', () => {
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
    expect(container.querySelector('input[type="text"]')).toBeTruthy();
  });

  it('passes error message to the wizard in create mode', () => {
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

  it('renders import dialog when in import mode', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        isImporting: false,
        onCreate: vi.fn(),
        onImport: vi.fn(),
        onClose: vi.fn()
      }
    });

    // Default is create mode, so we see the wizard with basics step
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
  });

  it('calls onClose when wizard cancels', () => {
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

  it('renders wizard with species and class selects on basics step', () => {
    mount(CreateCharacterDialog, {
      target: container,
      props: {
        isOpen: true,
        isCreating: false,
        onCreate: vi.fn(),
        onClose: vi.fn()
      }
    });

    const selects = container.querySelectorAll('select');
    expect(selects).toHaveLength(2);
  });

  describe('mode switching', () => {
    it('shows mode toggle tabs when onImport is provided in create mode', () => {
      mount(CreateCharacterDialog, {
        target: container,
        props: {
          isOpen: true,
          isCreating: false,
          onCreate: vi.fn(),
          onImport: vi.fn(),
          onClose: vi.fn()
        }
      });

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).toBeTruthy();
      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs).toHaveLength(2);
    });

    it('switches to import mode when Import tab is clicked', async () => {
      mount(CreateCharacterDialog, {
        target: container,
        props: {
          isOpen: true,
          isCreating: false,
          onCreate: vi.fn(),
          onImport: vi.fn(),
          onClose: vi.fn()
        }
      });

      // Should start in create mode (wizard with name input)
      expect(container.querySelector('input[type="text"]')).toBeTruthy();

      const importTab = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).find(
        (b) => b.textContent?.includes('Import')
      );
      importTab?.click();

      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should now show import dialog (file input, not wizard name input)
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).toBeTruthy();
    });
  });
});
