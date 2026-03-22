<script lang="ts">
  /**
   * TopBar component - the main navigation bar for authenticated users.
   * Left/center is empty (future navigation), right has user dropdown.
   */
  import { t } from '$lib/i18n';
  import UserDropdown from './UserDropdown.svelte';

  interface Props {
    email: string | null;
    onLogout: () => void;
    version?: string;
  }

  let { email, onLogout, version = 'v0.0.0' }: Props = $props();
</script>

<header class="top-bar">
  <div class="top-bar__left">
    <!-- Future navigation items will go here -->
  </div>

  <div class="top-bar__center">
    <!-- Future breadcrumb/title area -->
  </div>

  <nav class="top-bar__right" aria-label={$t('auth.userMenu')}>
    <UserDropdown {email} {onLogout} {version} />
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

  .top-bar__center {
    justify-self: center;
  }

  .top-bar__right {
    justify-self: end;
  }
</style>
