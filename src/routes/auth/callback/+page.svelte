<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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

    // Listen for signIn event (fires after token exchange completes)
    hubListener = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signIn') {
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

<div class="callback-container">
  <p>Completing sign in...</p>
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
