<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    topBar: Snippet;
    activeStrip: Snippet;
    planStack: Snippet;
    ledger: Snippet;
  }

  let { topBar, activeStrip, planStack, ledger }: Props = $props();
</script>

<div class="intent-stack-layout">
  <div class="intent-stack-layout__top-bar">
    {@render topBar()}
  </div>

  <div class="intent-stack-layout__active-strip">
    {@render activeStrip()}
  </div>

  <div class="intent-stack-layout__plan-stack">
    {@render planStack()}
  </div>

  <div class="intent-stack-layout__ledger">
    {@render ledger()}
  </div>
</div>

<style>
  .intent-stack-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    width: 100%;
  }

  .intent-stack-layout__top-bar {
    flex-shrink: 0;
  }

  .intent-stack-layout__active-strip {
    flex-shrink: 0;
    max-height: 8.5rem;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .intent-stack-layout__plan-stack {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .intent-stack-layout__ledger {
    flex-shrink: 0;
  }
</style>
