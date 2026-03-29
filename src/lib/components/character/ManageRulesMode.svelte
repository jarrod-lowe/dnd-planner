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
  import { ensureCached, type RuleGroupMeta } from '$lib/rules/ruleGroupCache.svelte';

  interface Props {
    character: Character;
    assignedRuleGroupIds?: string[];
    lockedRuleGroups?: Map<string, string[]>;
    onToggle: (ruleGroupId: string, isAssigned: boolean) => Promise<void>;
    onBack: () => void;
    onEditCustomRules?: () => void;
  }
  let {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    character: _character,
    assignedRuleGroupIds = [],
    lockedRuleGroups = new Map<string, string[]>(),
    onToggle,
    onBack,
    onEditCustomRules
  }: Props = $props();
  let assignedSet = $derived(new Set(assignedRuleGroupIds));
  let lockedSet = $derived(new Set(lockedRuleGroups.keys()));
  let searchQuery = $state('');
  let searchResults = $state<string[]>([]);
  let resultMeta = $state<Map<string, RuleGroupMeta>>(new Map());
  let isSearching = $state(false);
  let searchError = $state<string | null>(null);
  let togglingIds = $state<Set<string>>(new Set());
  let toggleErrorId = $state<string | null>(null);
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
      resultMeta = new Map();
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
      resultMeta = await ensureCached(searchResults, currentLocale);
    } catch {
      searchError = 'searchError';
      searchResults = [];
      resultMeta = new Map();
    } finally {
      isSearching = false;
    }
  }
  const debouncedSearch = debounce((query: string) => performSearch(query), DEBOUNCE_MS);
  function handleInput(e: Event): void {
    searchQuery = (e.target as HTMLInputElement).value;
    debouncedSearch(searchQuery);
  }
  async function handleToggle(ruleGroupId: string, isAssigned: boolean): Promise<void> {
    // Block removal of locked rule groups
    if (isAssigned && lockedSet.has(ruleGroupId)) return;
    togglingIds = new Set([...togglingIds, ruleGroupId]);
    toggleErrorId = null;
    try {
      await onToggle(ruleGroupId, isAssigned);
    } catch {
      toggleErrorId = ruleGroupId;
    } finally {
      togglingIds = new Set([...togglingIds].filter((id) => id !== ruleGroupId));
    }
  }
  function handleIndicatorKeydown(
    e: KeyboardEvent,
    ruleGroupId: string,
    isAssigned: boolean
  ): void {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle(ruleGroupId, isAssigned);
    }
  }
</script>

<div class="manage-rules">
  <button class="manage-rules__back" onclick={() => onBack()} aria-label={$t('rules.backToPlay')}>
    {$t('rules.backToPlay')}
  </button>
  <h1 class="manage-rules__title">{$t('rules.manageTitle')}</h1>
  {#if onEditCustomRules}
    <button class="manage-rules__edit-custom-btn" onclick={onEditCustomRules}>
      {$t('rules.editCustomRules')}
    </button>
  {/if}
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
      <div class="manage-rules__result-list">
        {#each searchResults as id (id)}
          {@const meta = resultMeta.get(id)}
          {@const isAssigned = assignedSet.has(id)}
          {@const isLocked = isAssigned && lockedSet.has(id)}
          {@const dependents = lockedRuleGroups.get(id) ?? []}
          <div class="manage-rules__panel" role="article">
            <div class="manage-rules__panel-row">
              <span
                class="manage-rules__indicator"
                class:manage-rules__indicator--checked={isAssigned}
                class:manage-rules__indicator--disabled={togglingIds.has(id)}
                class:manage-rules__indicator--locked={isLocked}
                role="checkbox"
                aria-checked={isAssigned}
                aria-busy={togglingIds.has(id)}
                aria-disabled={isLocked || undefined}
                aria-label={isAssigned
                  ? $t('rules.ruleGroupAssigned', { name: meta?.name ?? id })
                  : $t('rules.ruleGroupUnassigned', { name: meta?.name ?? id })}
                title={isLocked
                  ? $t('rules.requiredBy', { names: dependents.join(', ') })
                  : undefined}
                tabindex="0"
                onclick={() => handleToggle(id, isAssigned)}
                onkeydown={(e) => handleIndicatorKeydown(e, id, isAssigned)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  class="manage-rules__indicator-icon"
                >
                  {#if isAssigned}
                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                    <path
                      class="manage-rules__indicator-check"
                      d="M9 12l2 2 4-4"
                      stroke-width="2"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  {:else}
                    <circle
                      cx="12"
                      cy="12"
                      r="9.5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      fill="none"
                    />
                  {/if}
                </svg>
              </span>
              <div class="manage-rules__panel-content">
                <span class="manage-rules__panel-name">{meta?.name ?? id}</span>
                {#if meta?.description}
                  <span class="manage-rules__panel-desc">{meta.description}</span>
                {/if}
                {#if toggleErrorId === id}
                  <span class="manage-rules__toggle-error" role="alert">
                    {$t('rules.toggleError')}
                  </span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
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
  .manage-rules__edit-custom-btn {
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
  .manage-rules__edit-custom-btn:hover {
    background: var(--md-sys-color-surface-container);
  }
  .manage-rules__edit-custom-btn:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
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
    min-height: 0;
    overflow-y: auto;
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
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .manage-rules__panel {
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
  }
  .manage-rules__panel-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--spacing-md);
  }
  .manage-rules__indicator {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0.25rem;
    color: var(--md-sys-color-outline-variant);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: opacity var(--transition-fast);
  }
  .manage-rules__indicator--checked {
    color: var(--md-sys-color-primary);
  }
  .manage-rules__indicator--disabled {
    opacity: 0.5;
    cursor: wait;
    pointer-events: none;
  }
  .manage-rules__indicator--locked {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .manage-rules__indicator:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }
  .manage-rules__indicator-check {
    stroke: var(--md-sys-color-on-primary);
  }
  .manage-rules__indicator-icon {
    width: 100%;
    height: 100%;
  }
  .manage-rules__panel-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    min-width: 0;
  }
  .manage-rules__panel-name {
    font-family: var(--font-display);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
  }
  .manage-rules__panel-desc {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
  }
  .manage-rules__toggle-error {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-error);
  }
</style>
