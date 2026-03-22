<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { getHelloWorld } from '$lib/rules-engine';
  import { checkApiHealth } from '$lib/api/health';
  import { checkApiTest } from '$lib/api/test';
  import { apiGet } from '$lib/api/client';
  import { cognitoConfig } from '$lib/config/cognito';
  import { authStore } from '$lib/auth/authStore.svelte';
  import AuthStatus from '$lib/components/AuthStatus.svelte';

  let healthStatus = $state<'loading' | 'connected' | 'error'>('loading');
  let testStatus = $state<'loading' | 'connected' | 'error'>('loading');
  let userStatus = $state<'loading' | 'connected' | 'error'>('loading');
  let errorMessage = $state('');
  let testError = $state('');
  let userError = $state('');
  let userData = $state<string>('');

  onMount(async () => {
    // Wait for auth to finish initializing
    while (authStore.state.isLoading) {
      await new Promise((r) => setTimeout(r, 50));
    }

    // Only check health if authenticated
    if (authStore.state.isAuthenticated) {
      const [healthResult, testResult, userResponse] = await Promise.all([
        checkApiHealth(),
        checkApiTest(),
        apiGet('/api/user')
      ]);

      if (healthResult.success) {
        healthStatus = 'connected';
      } else {
        healthStatus = 'error';
        errorMessage = healthResult.error ?? 'Unknown error';
      }

      if (testResult.success) {
        testStatus = 'connected';
      } else {
        testStatus = 'error';
        testError = testResult.error ?? 'Unknown error';
      }

      if (userResponse.ok) {
        const data = await userResponse.json();
        userData = JSON.stringify(data, null, 2);
        userStatus = 'connected';
      } else {
        userStatus = 'error';
        userError = `HTTP ${userResponse.status}`;
      }
    } else {
      healthStatus = 'error';
      testStatus = 'error';
      userStatus = 'error';
      errorMessage = $t('status.notAuthenticated');
      testError = $t('status.notAuthenticated');
      userError = $t('status.notAuthenticated');
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
    <p class="status-error">
      <span aria-hidden="true">✗</span>
      {$t('status.unavailable')}: {errorMessage}
    </p>
  {/if}

  {#if testStatus === 'loading'}
    <p class="status-loading"><span aria-hidden="true">⋯</span> API Test: checking...</p>
  {:else if testStatus === 'connected'}
    <p class="status-ok"><span aria-hidden="true">✓</span> API Test: connected</p>
  {:else}
    <p class="status-error">
      <span aria-hidden="true">✗</span>
      API Test: {testError}
    </p>
  {/if}

  {#if userStatus === 'loading'}
    <p class="status-loading"><span aria-hidden="true">⋯</span> API User: checking...</p>
  {:else if userStatus === 'connected'}
    <p class="status-ok"><span aria-hidden="true">✓</span> API User: connected</p>
    <pre class="user-data">{userData}</pre>
  {:else}
    <p class="status-error">
      <span aria-hidden="true">✗</span>
      API User: {userError}
    </p>
  {/if}

  <p class="status-ok">
    <span aria-hidden="true">✓</span>
    {$t('cognito.label')}
    {cognitoConfig.loginDomain}
  </p>
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

  .user-data {
    background: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-on-surface);
    padding: var(--spacing-md);
    border-radius: var(--radius-md);
    overflow-x: auto;
    font-size: var(--font-size-sm);
    margin-top: var(--spacing-sm);
  }
</style>
