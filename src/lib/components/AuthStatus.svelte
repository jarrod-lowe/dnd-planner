<script lang="ts">
  /**
   * AuthStatus component - displays login/logout UI based on auth state.
   * Shows loading, login button, or user info + logout button.
   */

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
    <span class="loading">Loading...</span>
  {:else if isAuthenticated}
    <span class="user-id">{userId}</span>
    <button onclick={onLogout}>Logout</button>
  {:else}
    <button onclick={onLogin}>Login</button>
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
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--spacing-xs);
    cursor: pointer;
    font-size: var(--font-size-md);
  }

  button:hover {
    background-color: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }
</style>
