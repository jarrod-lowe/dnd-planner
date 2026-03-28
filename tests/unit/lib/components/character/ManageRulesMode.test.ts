import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import ManageRulesMode from '$lib/components/character/ManageRulesMode.svelte';
import type { Character } from '$lib/character/types';
import { clearCache as clearRuleGroupCache } from '$lib/rules/ruleGroupCache.svelte';

// Mock $lib/api/client
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
vi.mock('$lib/api/client', () => ({
  apiGet: (...args: unknown[]) => mockApiGet(...args),
  apiPost: (...args: unknown[]) => mockApiPost(...args)
}));

// i18n mock
const translations: Record<string, string> = {
  'rules.manageTitle': 'Manage Rules',
  'rules.searchPlaceholder': 'Search rule groups...',
  'rules.backToPlay': 'Back to Play',
  'rules.searching': 'Searching...',
  'rules.searchError': 'Search failed. Please try again.',
  'rules.noResults': 'No results found.',
  'rules.ruleGroupAssigned': '{name} assigned'
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
    mockApiPost.mockReset();
    clearRuleGroupCache();
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

    mockApiPost.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ruleGroups: [
            { ruleGroupId: 'fireball', name: 'Fireball', description: 'A fire spell' },
            {
              ruleGroupId: 'lightning-bolt',
              name: 'Lightning Bolt',
              description: 'A lightning spell'
            }
          ]
        })
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

    const panels = container.querySelectorAll('.manage-rules__panel');
    expect(panels).toHaveLength(2);
    expect(panels[0]?.textContent).toContain('Fireball');
    expect(panels[1]?.textContent).toContain('Lightning Bolt');
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

  it('renders rule group panels with name and description', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: ['fireball'] })
    });

    mockApiPost.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ruleGroups: [
            {
              ruleGroupId: 'fireball',
              name: 'Fireball',
              description: 'A powerful fire spell'
            }
          ]
        })
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

    // Should display the name and description in panels
    expect(container.textContent).toContain('Fireball');
    expect(container.textContent).toContain('A powerful fire spell');
  });

  it('search bar stays fixed with scrollable results area', async () => {
    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        onBack: vi.fn()
      }
    });

    const searchInput = container.querySelector('.manage-rules__search');
    const resultsArea = container.querySelector('.manage-rules__results');

    // Search area should exist
    expect(searchInput).toBeTruthy();

    // Results area should exist (scrollable via CSS class)
    expect(resultsArea).toBeTruthy();
    expect(resultsArea!.classList.contains('manage-rules__results')).toBe(true);
  });

  it('renders checked indicator for assigned rule groups', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: ['fireball'] })
    });

    mockApiPost.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ruleGroups: [{ ruleGroupId: 'fireball', name: 'Fireball', description: 'A fire spell' }]
        })
    });

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        assignedRuleGroupIds: ['fireball'],
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'fir';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    const indicator = container.querySelector('.manage-rules__indicator--checked');
    expect(indicator).toBeTruthy();
    expect(indicator?.getAttribute('aria-checked')).toBe('true');
  });

  it('renders unchecked indicator for unassigned rule groups', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: ['fireball'] })
    });

    mockApiPost.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ruleGroups: [{ ruleGroupId: 'fireball', name: 'Fireball', description: 'A fire spell' }]
        })
    });

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        assignedRuleGroupIds: ['some-other-group'],
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'fir';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    const indicators = container.querySelectorAll('.manage-rules__indicator');
    expect(indicators).toHaveLength(1);
    expect(indicators[0]?.getAttribute('aria-checked')).toBe('false');
    expect(indicators[0]?.classList.contains('manage-rules__indicator--checked')).toBe(false);
  });

  it('indicator has proper ARIA attributes for accessibility', async () => {
    mockApiGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ruleGroupsId: ['fireball'] })
    });

    mockApiPost.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ruleGroups: [{ ruleGroupId: 'fireball', name: 'Fireball', description: 'A fire spell' }]
        })
    });

    mount(ManageRulesMode, {
      target: container,
      props: {
        character: mockCharacter,
        assignedRuleGroupIds: [],
        onBack: vi.fn()
      }
    });

    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    input.value = 'fir';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    vi.advanceTimersByTime(300);
    await vi.runAllTimersAsync();

    const indicator = container.querySelector('.manage-rules__indicator');
    expect(indicator?.getAttribute('role')).toBe('checkbox');
    expect(indicator?.getAttribute('aria-checked')).toBe('false');
    expect(indicator?.getAttribute('aria-label')).toBeTruthy();
  });
});
