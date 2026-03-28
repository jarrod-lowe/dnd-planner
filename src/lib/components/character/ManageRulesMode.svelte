<script lang="ts">
  /**
   * ManageRulesMode - search and manage rule groups assigned to a character.
   */
  import { t } from '$lib/i18n';
  import type { Character } from '$lib/character/types';

  interface Props {
    character: Character;
    onBack: () => void;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let { character, onBack }: Props = $props();

  let searchQuery = $state('');
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
      oninput={(e) => {
        searchQuery = (e.target as HTMLInputElement).value;
      }}
      value={searchQuery}
    />
  </div>

  <div class="manage-rules__results">
    <!-- Search results will appear here -->
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
</style>
