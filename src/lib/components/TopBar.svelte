<script lang="ts">
  /**
   * TopBar component - the main navigation bar for authenticated users.
   * Left shows mode title or character info, right has user dropdown.
   */
  import { t } from '$lib/i18n';
  import UserDropdown from './UserDropdown.svelte';
  import type { Character } from '$lib/character/types';

  interface Props {
    email: string | null;
    onLogout: () => void;
    version?: string;
    selectedCharacter?: Character | null;
    onBack?: () => void;
    onManageRules?: () => void;
    showManageRules?: boolean;
    onViewFacts?: () => void;
    showViewFacts?: boolean;
    onDownloadCharacter?: () => void;
    showDownloadCharacter?: boolean;
    showLayoutToggle?: boolean;
    currentLayout?: 'classic' | 'intent';
    onSwitchLayout?: (layout: 'classic' | 'intent') => void;
  }

  let {
    email,
    onLogout,
    version = 'v0.0.0',
    selectedCharacter,
    onBack,
    onManageRules,
    showManageRules = false,
    onViewFacts,
    showViewFacts = false,
    onDownloadCharacter,
    showDownloadCharacter = false,
    showLayoutToggle = false,
    currentLayout = 'classic',
    onSwitchLayout
  }: Props = $props();
</script>

<header class="top-bar">
  <div class="top-bar__left">
    {#if selectedCharacter}
      <div class="top-bar__character">
        {#if onBack}
          <button
            type="button"
            class="top-bar__back"
            aria-label={$t('play.backToSelection')}
            onclick={onBack}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M19 12H5m7-7l-7 7 7 7" />
            </svg>
          </button>
        {/if}
        <div class="top-bar__info">
          <span class="top-bar__name">{selectedCharacter.name}</span>
          <span class="top-bar__species">{$t(`species.${selectedCharacter.species}`)}</span>
        </div>
      </div>
    {:else}
      <div class="top-bar__info">
        <span class="top-bar__title">{$t('character.selectTitle')}</span>
        <span class="top-bar__subtitle">{$t('character.selectSubtitle')}</span>
      </div>
    {/if}
  </div>

  <div class="top-bar__center">
    <!-- Future breadcrumb/title area -->
  </div>

  <nav class="top-bar__right" aria-label={$t('auth.userMenu')}>
    <UserDropdown
      {email}
      {onLogout}
      {version}
      {onManageRules}
      {showManageRules}
      {onViewFacts}
      {showViewFacts}
      {onDownloadCharacter}
      {showDownloadCharacter}
      {showLayoutToggle}
      {currentLayout}
      {onSwitchLayout}
    />
  </nav>
</header>

<style>
  .top-bar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: var(--spacing-md) var(--spacing-xl);
    background: var(--md-sys-color-surface);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    box-shadow: var(--shadow-sm);
    position: sticky;
    top: 0;
    z-index: var(--z-dropdown);
    min-height: 4rem;
  }

  .top-bar__left {
    justify-self: start;
  }

  .top-bar__character {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .top-bar__back {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: var(--spacing-xs);
    border-radius: var(--radius-md);
    transition: background-color var(--transition-fast);
  }

  .top-bar__back:hover {
    background: var(--md-sys-color-surface-container);
  }

  .top-bar__back:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .top-bar__back svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .top-bar__info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .top-bar__name,
  .top-bar__title {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    color: var(--md-sys-color-on-surface);
    letter-spacing: var(--letter-spacing-wide);
  }

  .top-bar__species,
  .top-bar__subtitle {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
  }

  .top-bar__center {
    justify-self: center;
  }

  .top-bar__right {
    justify-self: end;
  }
</style>
