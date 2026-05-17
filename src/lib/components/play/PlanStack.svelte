<script lang="ts">
  import { t } from '$lib/i18n';
</script>

<section class="plan-stack" aria-label={$t('play.planStack.title')}>
  <h2 class="plan-stack__header">{$t('play.planStack.title')}</h2>
  <p class="plan-stack__placeholder">{$t('play.planStack.placeholder')}</p>
</section>

<style>
  .plan-stack {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
  }

  .plan-stack__header {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    margin: 0;
    letter-spacing: var(--letter-spacing-wide);
  }

  .plan-stack__placeholder {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-outline);
    margin: 0;
    font-style: italic;
    text-align: center;
    padding: var(--spacing-xl);
  }
</style>
