<script lang="ts">
  /**
   * AuthStatus component - displays login/logout UI based on auth state.
   * Shows loading, login button, or user info + logout button.
   */
  import { t } from '$lib/i18n';

  interface Props {
    isLoading?: boolean;
    isAuthenticated?: boolean;
    userId?: string | null;
    onLogin?: () => void;
    onLogout?: () => void;
  }

  let {
    isLoading = false,
    isAuthenticated = false,
    userId = null,
    onLogin = () => {},
    onLogout = () => {}
  }: Props = $props();
</script>

<div class="auth-status">
  {#if isLoading}
    <span class="loading">{$t('auth.loading')}</span>
  {:else if isAuthenticated}
    <span class="user-id">{userId}</span>
    <button onclick={onLogout}>{$t('auth.logout')}</button>
  {:else}
    <button onclick={onLogin}>{$t('auth.login')}</button>
  {/if}
</div>

<style>
  .auth-status {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }

  .loading {
    color: var(--md-sys-color-on-surface-variant);
  }

  .user-id {
    font-family: monospace;
    color: var(--md-sys-color-on-surface);
  }

  button {
    background-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    border: none;
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--spacing-xs);
    cursor: pointer;
    font-size: var(--font-size-md);
    min-height: 2.75rem;
  }

  button:hover {
    background-color: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  button:focus-visible {
    outline: 2px solid var(--md-sys-color-outline);
    outline-offset: var(--spacing-xs);
  }
</style>
