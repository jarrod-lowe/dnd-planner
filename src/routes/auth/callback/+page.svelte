<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '$lib/i18n';
  import { Hub } from 'aws-amplify/utils';
  import { authStore } from '$lib/auth/authStore.svelte';

  let redirectTimeout: ReturnType<typeof setTimeout>;
  let hubListener: (() => void) | undefined;

  function redirectToHome() {
    window.location.href = '/';
  }

  onMount(async () => {
    // Timeout fallback (10s max wait)
    redirectTimeout = setTimeout(() => {
      console.warn('Auth callback timeout, redirecting anyway');
      redirectToHome();
    }, 10000);

    // Redirect once the OAuth token exchange completes. Amplify v6 emits
    // 'signInWithRedirect' when the redirect flow finishes and 'signedIn' when
    // the session is established (the pre-v6 'signIn' event no longer exists).
    hubListener = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn' || payload.event === 'signInWithRedirect') {
        clearTimeout(redirectTimeout);
        redirectToHome();
      }
    });

    // Initialize auth store
    await authStore.initialize();

    // If already authenticated, redirect immediately
    if (authStore.state.isAuthenticated) {
      clearTimeout(redirectTimeout);
      if (hubListener) hubListener();
      redirectToHome();
    }
  });

  onDestroy(() => {
    if (redirectTimeout) clearTimeout(redirectTimeout);
  });
</script>

<div id="main-content" class="callback-container">
  <p>{$t('auth.completingSignIn')}</p>
</div>

<style>
  .callback-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 50vh;
  }

  p {
    color: var(--md-sys-color-on-surface);
    font-size: var(--font-size-lg);
  }
</style>
