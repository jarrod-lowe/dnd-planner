<script lang="ts">
  const title = 'D&D Planner';
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<main>
  <h1>Hello, D&D Planner!</h1>
  <p>
    A tablet-optimized web application for tracking D&D character resources and planning combat
    turns.
  </p>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1 {
    color: #8b0000;
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  p {
    color: #333;
    font-size: 1.2rem;
    line-height: 1.6;
  }
</style>
