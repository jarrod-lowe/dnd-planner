<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { getHelloWorld } from '$lib/rules-engine';
  import { checkApiHealth } from '$lib/api/health';
  import { cognitoConfig } from '$lib/config/cognito';
  import { authStore } from '$lib/auth/authStore.svelte';
  import AuthStatus from '$lib/components/AuthStatus.svelte';

  let healthStatus = $state<'loading' | 'connected' | 'error'>('loading');
  let errorMessage = $state('');

  onMount(async () => {
    // Wait for auth to finish initializing
    while (authStore.state.isLoading) {
      await new Promise((r) => setTimeout(r, 50));
    }

    // Only check health if authenticated
    if (authStore.state.isAuthenticated) {
      const result = await checkApiHealth();
      if (result.success) {
        healthStatus = 'connected';
      } else {
        healthStatus = 'error';
        errorMessage = result.error ?? 'Unknown error';
      }
    } else {
      healthStatus = 'error';
      errorMessage = $t('status.notAuthenticated');
    }
  });

  const title = $derived($t('app.title'));
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<main id="main-content">
  <h1>{$t('app.title')}</h1>

  <AuthStatus
    isLoading={authStore.state.isLoading}
    isAuthenticated={authStore.state.isAuthenticated}
    userId={authStore.state.userId}
    onLogin={() => authStore.login()}
    onLogout={() => authStore.logout()}
  />

  <p>{$t(getHelloWorld())}</p>
  <p>{$t('app.description')}</p>

  {#if healthStatus === 'loading'}
    <p class="status-loading"><span aria-hidden="true">⋯</span> {$t('status.checking')}</p>
  {:else if healthStatus === 'connected'}
    <p class="status-ok"><span aria-hidden="true">✓</span> {$t('status.connected')}</p>
  {:else}
    <p class="status-error"><span aria-hidden="true">✗</span> {$t('status.unavailable')}: {errorMessage}</p>
  {/if}

  <p class="status-ok"><span aria-hidden="true">✓</span> {$t('cognito.label')} {cognitoConfig.loginDomain}</p>
</main>

<style>
  main {
    max-width: 50rem;
    margin: 0 auto;
    padding: var(--spacing-xl);
  }

  h1 {
    color: var(--md-sys-color-primary);
    font-size: var(--font-size-2xl);
    margin-bottom: var(--spacing-md);
  }

  p {
    color: var(--md-sys-color-on-surface);
    font-size: var(--font-size-lg);
    line-height: 1.6;
  }

  .status-ok {
    color: var(--md-sys-color-primary);
  }

  .status-error {
    color: var(--md-sys-color-error);
  }
</style>
