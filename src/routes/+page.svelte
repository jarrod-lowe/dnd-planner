<script lang="ts">
  import { getHelloWorld } from '$lib/rules-engine';

  const title = 'D&D Planner';
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<main>
  <h1>Hello, D&D Planner!</h1>
  <p>{getHelloWorld()}</p>
  <p>
    A tablet-optimized web application for tracking D&D character resources and planning combat
    turns.
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
</style>
