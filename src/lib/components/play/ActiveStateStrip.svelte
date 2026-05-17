<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    effectCount?: number;
  }

  let { effectCount = 0 }: Props = $props();
</script>

<section class="active-state-strip" aria-label={$t('play.activeState.title')}>
  <h2 class="active-state-strip__header">
    {$t('play.activeState.title')}
    {#if effectCount > 0}
      <span class="active-state-strip__count">{effectCount}</span>
    {/if}
  </h2>
  {#if effectCount === 0}
    <p class="active-state-strip__placeholder">{$t('play.activeState.placeholder')}</p>
  {/if}
</section>

<style>
  .active-state-strip {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
    min-height: 3rem;
  }

  .active-state-strip__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--md-sys-color-on-surface-variant);
    margin: 0;
  }

  .active-state-strip__count {
    background: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
    font-size: var(--font-size-xs);
    font-weight: 600;
    padding: 0 var(--spacing-sm);
    border-radius: var(--radius-full);
    min-width: 1.25rem;
    text-align: center;
  }

  .active-state-strip__placeholder {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-outline);
    margin: 0;
    font-style: italic;
  }
</style>
