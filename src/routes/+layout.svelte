<script lang="ts">
  import { onMount } from 'svelte';
  import '$lib/styles/themes/light.css';
  import '$lib/styles/themes/dark.css';
  import '$lib/styles/base.css';
  import { configureAmplify } from '$lib/auth/cognito';
  import { authStore } from '$lib/auth/authStore.svelte';
  import { locale, isLoading, detectLocale, t } from '$lib/i18n';

  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  // Configure Amplify once on client-side mount
  onMount(() => {
    configureAmplify();
    authStore.initialize();

    // Set locale based on browser preference
    const detectedLocale = detectLocale();
    locale.set(detectedLocale);

    // Update the HTML lang attribute
    document.documentElement.lang = detectedLocale;
  });
</script>

<svelte:head>
  <style>
    .skip-link {
      position: absolute;
      top: -100%;
      left: 0;
      padding: var(--spacing-sm) var(--spacing-md);
      z-index: var(--z-modal);
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
      text-decoration: none;
      border-radius: 0 0 var(--spacing-xs) 0;
    }
    .skip-link:focus {
      top: 0;
    }
  </style>
</svelte:head>

{#if $isLoading}
  <div class="loading-screen" aria-live="polite" aria-busy="true">
    {$t('layout.loading')}
  </div>
{:else}
  <a href="#main-content" class="skip-link">{$t('nav.skipToContent')}</a>
  {@render children()}
{/if}

<style>
  .loading-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    color: var(--md-sys-color-on-surface);
  }
</style>
