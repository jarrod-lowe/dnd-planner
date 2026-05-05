import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import TopBar from '$lib/components/TopBar.svelte';
import type { Character } from '$lib/character/types';

// i18n mock - returns key as text
const translations: Record<string, string> = {
  'auth.userMenu': 'User menu',
  'auth.logout': 'Logout',
  'auth.version': 'Version',
  'play.backToSelection': 'Back to Character Selection',
  'species.human': 'Human',
  'character.selectTitle': 'Select Character',
  'character.selectSubtitle': 'Choose a character to play'
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

vi.mock('$lib/components/UserDropdown.svelte', () => ({
  default: vi.fn()
}));

const mockCharacter: Character = {
  characterId: 'char-123',
  userId: 'user-1',
  name: 'Aragorn',
  species: 'human',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('TopBar', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  describe('back arrow', () => {
    it('renders back arrow when onBack provided and character selected', () => {
      mount(TopBar, {
        target: container,
        props: {
          email: 'test@example.com',
          onLogout: vi.fn(),
          selectedCharacter: mockCharacter,
          onBack: vi.fn()
        }
      });

      const backButton = container.querySelector('.top-bar__back');
      expect(backButton).toBeTruthy();
      expect(backButton?.getAttribute('aria-label')).toBe('Back to Character Selection');
    });

    it('does not render back arrow when no onBack provided', () => {
      mount(TopBar, {
        target: container,
        props: {
          email: 'test@example.com',
          onLogout: vi.fn(),
          selectedCharacter: mockCharacter
        }
      });

      const backButton = container.querySelector('.top-bar__back');
      expect(backButton).toBeNull();
    });

    it('does not render back arrow when no character selected', () => {
      mount(TopBar, {
        target: container,
        props: {
          email: 'test@example.com',
          onLogout: vi.fn(),
          selectedCharacter: null,
          onBack: vi.fn()
        }
      });

      const backButton = container.querySelector('.top-bar__back');
      expect(backButton).toBeNull();
    });

    it('calls onBack when back arrow is clicked', () => {
      const onBack = vi.fn();

      mount(TopBar, {
        target: container,
        props: {
          email: 'test@example.com',
          onLogout: vi.fn(),
          selectedCharacter: mockCharacter,
          onBack
        }
      });

      const backButton = container.querySelector('.top-bar__back') as HTMLButtonElement;
      backButton?.click();

      expect(onBack).toHaveBeenCalledOnce();
    });

    it('back arrow has tap target styling class', () => {
      mount(TopBar, {
        target: container,
        props: {
          email: 'test@example.com',
          onLogout: vi.fn(),
          selectedCharacter: mockCharacter,
          onBack: vi.fn()
        }
      });

      const backButton = container.querySelector('.top-bar__back') as HTMLButtonElement;
      // Verify the button element and class exist (CSS provides 2.75rem min-width/height = 44px)
      expect(backButton).toBeTruthy();
      expect(backButton.tagName).toBe('BUTTON');
    });
  });

  describe('download character props', () => {
    it('mounts without error when download props are provided', () => {
      expect(() => {
        mount(TopBar, {
          target: container,
          props: {
            email: 'test@example.com',
            onLogout: vi.fn(),
            selectedCharacter: mockCharacter,
            showDownloadCharacter: true,
            onDownloadCharacter: vi.fn()
          }
        });
      }).not.toThrow();
    });

    it('mounts without error when download props are omitted', () => {
      expect(() => {
        mount(TopBar, {
          target: container,
          props: {
            email: 'test@example.com',
            onLogout: vi.fn()
          }
        });
      }).not.toThrow();
    });
  });
});
