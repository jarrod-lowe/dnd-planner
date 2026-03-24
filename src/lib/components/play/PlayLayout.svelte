<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Snippet } from 'svelte';

  interface Props {
    stats: Snippet;
    choices: Snippet;
    plan: Snippet;
    journal: Snippet;
  }

  let { stats, choices, plan, journal }: Props = $props();

  const statsId = 'stats-column';
  const choicesId = 'choices-column';
  const planId = 'plan-column';
  const journalId = 'journal-column';
</script>

<div class="play-layout">
  <section
    class="play-layout__column play-layout__stats"
    aria-labelledby={statsId}
  >
    <h2 id={statsId} class="play-layout__header">{$t('play.stats.title')}</h2>
    {@render stats()}
  </section>

  <section
    class="play-layout__column play-layout__choices"
    aria-labelledby={choicesId}
  >
    <h2 id={choicesId} class="play-layout__header">{$t('play.choices.title')}</h2>
    {@render choices()}
  </section>

  <section
    class="play-layout__column play-layout__plan"
    aria-labelledby={planId}
  >
    <h2 id={planId} class="play-layout__header">{$t('play.plan.title')}</h2>
    {@render plan()}
  </section>

  <section
    class="play-layout__column play-layout__journal"
    aria-labelledby={journalId}
  >
    <h2 id={journalId} class="play-layout__header">{$t('play.journal.title')}</h2>
    {@render journal()}
  </section>
</div>

<style>
  .play-layout {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(280px, 2fr) minmax(280px, 2fr) minmax(180px, 1fr);
    gap: var(--spacing-md);
    height: calc(100vh - 4rem);
    padding: var(--spacing-md);
  }

  .play-layout__column {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-lg);
    padding: var(--spacing-md);
    overflow-y: auto;
    min-height: 0;
  }

  .play-layout__header {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    margin: 0;
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    flex-shrink: 0;
  }

  /* Responsive: 2x2 grid on medium screens */
  @media (max-width: 1024px) {
    .play-layout {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: auto auto;
    }

    .play-layout__stats {
      grid-column: 1;
      grid-row: 1;
    }

    .play-layout__choices {
      grid-column: 1;
      grid-row: 2;
    }

    .play-layout__plan {
      grid-column: 2;
      grid-row: 2;
    }

    .play-layout__journal {
      grid-column: 2;
      grid-row: 1;
    }
  }

  /* Responsive: single column on small screens */
  @media (max-width: 640px) {
    .play-layout {
      grid-template-columns: 1fr;
      grid-template-rows: repeat(4, auto);
      height: auto;
    }

    .play-layout__stats {
      grid-column: 1;
      grid-row: 1;
    }

    .play-layout__choices {
      grid-column: 1;
      grid-row: 2;
    }

    .play-layout__plan {
      grid-column: 1;
      grid-row: 3;
    }

    .play-layout__journal {
      grid-column: 1;
      grid-row: 4;
    }
  }
</style>
