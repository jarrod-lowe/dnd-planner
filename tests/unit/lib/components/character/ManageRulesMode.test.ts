import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import ManageRulesMode from '$lib/components/character/ManageRulesMode.svelte';
import type { Character } from '$lib/character/types';

// Mock $lib/api/client
const mockApiGet = vi.fn();
vi.mock('$lib/api/client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args)
}));

// i18n mock
const translations: Record<string, string> = {
  'rules.manageTitle': 'Manage Rules',
  'rules.searchPlaceholder': 'Search rule groups...',
  'rules.backToPlay': 'Back to Play',
  'rules.searching': 'Searching...',
  'rules.searchError': 'Search failed. Please try again.',
  'rules.noResults': 'No results found.'
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

const mockCharacter: Character = {
  characterId: 'char-1',
  userId: 'test-user',
  name: 'Gandalf',
  species: 'human',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('ManageRulesMode', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.useFakeTimers();
    mockApiGet.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders back button', () => {
    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const backButton = container.querySelector('button');
    expect(backButton).toBeTruthy();
    expect(backButton?.getAttribute('aria-label')).toContain('Back to Play');
  });

  it('renders title', () => {
    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const heading = container.querySelector('h1');
    expect(heading?.textContent).toContain('Manage Rules');
  });

  it('renders search input', () => {
    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]');
    expect(input).toBeTruthy();
    expect(input?.getAttribute('placeholder')).toContain('Search rule groups');
  });

  it('calls onBack when back button clicked', () => {
    const onBack = vi.fn();

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack
      }
    });

    const backButton = container.querySelector('button');
    backButton?.click();

    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not call API when search term is shorter than 3 standardized chars', () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: [] })
    });

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'ab';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);

    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('calls API with standardized search term after debounce', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: ['fireball'] })
    });

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Fire-Ball!';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    expect(mockApiGet).toHaveBeenCalledOnce();
    const callUrl = mockApiGet.mock.calls[0][0] as string;
    expect(callUrl).toContain('/api/rule-groups?q=fireball');
    expect(callUrl).toContain('lang=en');
  });

  it('displays search results', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: ['fireball', 'lightning-bolt'] })
    });

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'fir';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    const items = container.querySelectorAll('.manage-rules__result-item');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain('fireball');
    expect(items[1]?.textContent).toContain('lightning-bolt');
  });

  it('shows no results message when search returns empty', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: [] })
    });

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'xyz';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    expect(container.textContent).toContain('No results found');
  });

  it('shows error message when API fails', async () => {
    mockApiGet.mockResolvedValue({
      ok: false,
      status: 500
    });

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'fir';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    const errorEl = container.querySelector('.manage-rules__status--error');
    expect(errorEl?.textContent).toContain('Search failed');
  });

  it('strips diacritics from search term', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: [] })
    });

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'Élève';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    const callUrl = mockApiGet.mock.calls[0][0] as string;
    expect(callUrl).toContain('q=eleve');
  });

  it('shows loading state while searching', async () => {
    let resolvePromise: (value: unknown) => void;
    mockApiGet.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'fir';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    // Allow microtasks to flush once
    await Promise.resolve();

    expect(container.textContent).toContain('Searching...');

    // Resolve the promise to clean up
    resolvePromise!({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: [] })
    });
    await vi.runAllTimersAsync();
  });
});
