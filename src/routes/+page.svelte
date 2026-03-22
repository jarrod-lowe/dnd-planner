<script lang="ts">
  import { authStore } from '$lib/auth/authStore.svelte';
  import LandingPage from '$lib/components/LandingPage.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import { t } from '$lib/i18n';

  const title = $derived($t('app.title'));
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

{#if authStore.state.isLoading}
  <div id="main-content" class="loading-screen" aria-live="polite" aria-busy="true">
    <div class="loading-spinner" aria-hidden="true"></div>
    <span>{$t('layout.loading')}</span>
  </div>
{:else if !authStore.state.isAuthenticated}
  <LandingPage onLogin={() => authStore.login()} />
{:else}
  <div class="app-layout">
    <TopBar email={authStore.state.email} onLogout={() => authStore.logout()} version="v0.0.0" />
    <main id="main-content" class="app-layout__body">
      <p class="welcome-message">{$t('app.welcomeBack')}</p>
      <p class="todo-placeholder">TODO</p>
    </main>
  </div>
{/if}

<style>
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: var(--spacing-lg);
    color: var(--md-sys-color-on-surface);
    font-family: var(--font-body);
  }

  .loading-spinner {
    width: 3rem;
    height: 3rem;
    border: 3px solid var(--md-sys-color-outline-variant);
    border-top-color: var(--md-sys-color-primary);
    border-radius: var(--radius-full);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .app-layout {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .app-layout__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-xl);
    background: var(--md-sys-color-background);
  }

  .welcome-message {
    font-family: var(--font-display);
    font-size: var(--font-size-2xl);
    color: var(--md-sys-color-primary);
    margin-bottom: var(--spacing-lg);
  }

  .todo-placeholder {
    font-family: var(--font-display);
    font-size: var(--font-size-4xl);
    font-weight: 700;
    color: var(--md-sys-color-outline);
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
</style>
