<script lang="ts">
  /**
   * UserDropdown component - accessible dropdown menu with user info.
   * Uses native <details>/<summary> for built-in keyboard handling and AT support.
   * Shows Gravatar, email, logout button, and version.
   */
  import md5 from 'blueimp-md5';
  import { t } from '$lib/i18n';

  interface Props {
    email: string | null;
    onLogout: () => void;
    version?: string;
    onManageRules?: () => void;
    showManageRules?: boolean;
  }

  let {
    email,
    onLogout,
    version = 'v0.0.0',
    onManageRules,
    showManageRules = false
  }: Props = $props();

  // Generate Gravatar URL with MD5 hash of email
  const gravatarUrl = $derived(
    email
      ? `https://www.gravatar.com/avatar/${md5(email.toLowerCase().trim())}?s=40&d=identicon`
      : null
  );

  let detailsEl: HTMLDetailsElement | undefined = $state();

  function closeMenu() {
    if (detailsEl) {
      detailsEl.open = false;
    }
  }

  function handleLogout() {
    onLogout();
    closeMenu();
  }

  function handleManageRules() {
    onManageRules?.();
    closeMenu();
  }

  // Close menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (detailsEl?.open && !detailsEl.contains(event.target as Node)) {
      closeMenu();
    }
  }

  $effect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<details bind:this={detailsEl} class="user-dropdown">
  <summary class="user-dropdown__trigger">
    <span class="user-dropdown__avatar" aria-hidden="true">
      {#if gravatarUrl}
        <img src={gravatarUrl} alt="" class="user-dropdown__gravatar" />
      {:else}
        <div class="user-dropdown__placeholder">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
            />
          </svg>
        </div>
      {/if}
    </span>
    <svg
      class="user-dropdown__chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
    <span class="sr-only">{$t('auth.userMenu')}</span>
  </summary>

  <div class="user-dropdown__menu">
    <div class="user-dropdown__email">
      {email ?? 'Unknown'}
    </div>

    <div class="user-dropdown__divider" aria-hidden="true"></div>

    {#if showManageRules && onManageRules}
      <button type="button" class="user-dropdown__menu-item" onclick={handleManageRules}>
        <svg
          class="user-dropdown__menu-item-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {$t('rules.manageTitle')}
      </button>

      <div class="user-dropdown__divider" aria-hidden="true"></div>
    {/if}

    <button type="button" class="user-dropdown__logout" onclick={handleLogout}>
      <svg
        class="user-dropdown__logout-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14l5-5-5-5m5 5H9" />
      </svg>
      {$t('auth.logout')}
    </button>

    <div class="user-dropdown__divider" aria-hidden="true"></div>

    <div class="user-dropdown__version" aria-label="{$t('auth.version')} {version}">
      <span class="user-dropdown__version-label">{$t('auth.version')}</span>
      <span class="user-dropdown__version-number">{version}</span>
    </div>
  </div>
</details>

<style>
  .user-dropdown {
    position: relative;
  }

  .user-dropdown__trigger {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: transparent;
    border: 2px solid transparent;
    border-radius: var(--radius-full);
    padding: var(--spacing-xs);
    cursor: pointer;
    list-style: none;
    transition:
      border-color var(--transition-fast),
      background-color var(--transition-fast);
    min-height: 2.75rem;
  }

  .user-dropdown__trigger::-webkit-details-marker {
    display: none;
  }

  .user-dropdown__trigger:hover {
    background: var(--md-sys-color-surface-container-high);
    border-color: var(--md-sys-color-outline);
  }

  .user-dropdown__trigger:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .user-dropdown[open] .user-dropdown__trigger {
    background: var(--md-sys-color-surface-container-high);
    border-color: var(--md-sys-color-outline);
  }

  .user-dropdown[open] .user-dropdown__chevron {
    transform: rotate(180deg);
  }

  .user-dropdown__avatar {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-full);
    overflow: hidden;
    background: var(--md-sys-color-surface-container);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .user-dropdown__gravatar {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .user-dropdown__placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--md-sys-color-on-surface-variant);
  }

  .user-dropdown__placeholder svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .user-dropdown__chevron {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--md-sys-color-on-surface-variant);
    transition: transform var(--transition-fast);
  }

  .user-dropdown__menu {
    position: absolute;
    top: calc(100% + var(--spacing-sm));
    right: 0;
    min-width: 14rem;
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: var(--spacing-sm);
    z-index: var(--z-dropdown);
    animation: dropdownSlide 0.15s ease-out;
  }

  @keyframes dropdownSlide {
    from {
      opacity: 0;
      transform: translateY(-0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .user-dropdown__email {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-dropdown__divider {
    height: 1px;
    background: var(--md-sys-color-outline-variant);
    margin: var(--spacing-xs) var(--spacing-md);
  }

  .user-dropdown__logout,
  .user-dropdown__menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
    min-height: 2.5rem;
  }

  .user-dropdown__logout:hover,
  .user-dropdown__menu-item:hover {
    background: var(--md-sys-color-surface-container-highest);
    border-color: var(--md-sys-color-outline);
  }

  .user-dropdown__logout:focus-visible,
  .user-dropdown__menu-item:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: -2px;
  }

  .user-dropdown__logout-icon,
  .user-dropdown__menu-item-icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--md-sys-color-on-surface-variant);
  }

  .user-dropdown__version {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-xs) var(--spacing-md);
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-on-surface-variant);
  }

  .user-dropdown__version-label {
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .user-dropdown__version-number {
    font-family: monospace;
  }
</style>
