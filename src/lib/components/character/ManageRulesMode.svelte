<script lang="ts">
  /**
   * ManageRulesMode - search and manage rule groups assigned to a character.
   */
  import { t } from '$lib/i18n';
  import { locale } from '$lib/i18n';
  import { get } from 'svelte/store';
  import type { Character } from '$lib/character/types';
  import { apiGet } from '$lib/api/client';
  import { debounce } from '$lib/play/debounce';

  interface Props {
    character: Character;
    onBack: () => void;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let { character, onBack }: Props = $props();

  let searchQuery = $state('');
  let searchResults = $state<string[]>([]);
  let isSearching = $state(false);
  let searchError = $state<string | null>(null);

  /**
   * Normalize text for search querying.
   * Must match the Python standardize_term() in sync_rule_groups.py exactly.
   */
  function standardizeTerm(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  const DEBOUNCE_MS = 300;

  async function performSearch(query: string): Promise<void> {
    const standardized = standardizeTerm(query);
    if (standardized.length < 3) {
      searchResults = [];
      isSearching = false;
      searchError = null;
      return;
    }

    isSearching = true;
    searchError = null;

    try {
      const currentLocale = get(locale);
      const response = await apiGet(
        `/api/rule-groups?q=${encodeURIComponent(standardized)}&lang=${currentLocale}`
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      searchResults = data.ruleGroupsId ?? [];
    } catch {
      searchError = 'searchError';
      searchResults = [];
    } finally {
      isSearching = false;
    }
  }

  const debouncedSearch = debounce((query: string) => performSearch(query), DEBOUNCE_MS);

  function handleInput(e: Event): void {
    searchQuery = (e.target as HTMLInputElement).value;
    debouncedSearch(searchQuery);
  }
</script>

<div class="manage-rules">
  <button class="manage-rules__back" onclick={() => onBack()} aria-label={$t('rules.backToPlay')}>
    {$t('rules.backToPlay')}
  </button>

  <h1 class="manage-rules__title">{$t('rules.manageTitle')}</h1>

  <div class="manage-rules__search">
    <input
      type="text"
      class="manage-rules__search-input"
      placeholder={$t('rules.searchPlaceholder')}
      aria-label={$t('rules.searchPlaceholder')}
      oninput={handleInput}
      value={searchQuery}
    />
  </div>

  <div class="manage-rules__results" role="region" aria-live="polite" aria-label="Search results">
    {#if isSearching}
      <p class="manage-rules__status">{$t('rules.searching')}</p>
    {:else if searchError}
      <p class="manage-rules__status manage-rules__status--error">{$t(`rules.${searchError}`)}</p>
    {:else if searchResults.length > 0}
      <ul class="manage-rules__result-list">
        {#each searchResults as id (id)}
          <li class="manage-rules__result-item">{id}</li>
        {/each}
      </ul>
    {:else if searchQuery && standardizeTerm(searchQuery).length >= 3}
      <p class="manage-rules__status">{$t('rules.noResults')}</p>
    {/if}
  </div>
</div>

<style>
  .manage-rules {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: var(--spacing-md);
  }

  .manage-rules__back {
    align-self: flex-start;
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-md);
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    min-height: 2.5rem;
    transition: background-color var(--transition-fast);
  }

  .manage-rules__back:hover {
    background: var(--md-sys-color-surface-container);
  }

  .manage-rules__back:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .manage-rules__title {
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    color: var(--md-sys-color-on-surface);
    letter-spacing: var(--letter-spacing-wide);
    margin: 0;
  }

  .manage-rules__search-input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-md);
    min-height: 2.75rem;
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .manage-rules__search-input::placeholder {
    color: var(--md-sys-color-on-surface-variant);
  }

  .manage-rules__search-input:focus {
    outline: none;
    border-color: var(--md-sys-color-primary);
    box-shadow: 0 0 0 1px var(--md-sys-color-primary);
  }

  .manage-rules__results {
    flex: 1;
  }

  .manage-rules__status {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface-variant);
    padding: var(--spacing-md) 0;
  }

  .manage-rules__status--error {
    color: var(--md-sys-color-error);
  }

  .manage-rules__result-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .manage-rules__result-item {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
  }
</style>
