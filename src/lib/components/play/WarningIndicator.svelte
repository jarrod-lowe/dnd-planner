<script module lang="ts">
  let activeClose: (() => void) | null = null;
</script>

<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    type: 'illegal' | 'inapplicable';
    message?: string;
  }

  let { type, message }: Props = $props();

  let tooltipOpen = $state(false);

  function closeSelf() {
    tooltipOpen = false;
    if (activeClose === closeSelf) {
      activeClose = null;
    }
  }

  function handleClick(e: MouseEvent) {
    if (!message) return;
    e.stopPropagation();

    if (activeClose && activeClose !== closeSelf) {
      activeClose();
    }

    tooltipOpen = !tooltipOpen;
    activeClose = tooltipOpen ? closeSelf : null;
  }

  function handleWindowClick() {
    if (tooltipOpen) {
      closeSelf();
    }
  }

  const fallbackLabel = $derived(
    type === 'illegal' ? $t('play.choices.illegal') : $t('play.choices.inapplicable')
  );

  const label = $derived(message ?? fallbackLabel);
</script>

<svelte:window onclick={handleWindowClick} />

<button
  type="button"
  class="warning-indicator warning-indicator--{type}"
  aria-label={label}
  onclick={handleClick}
>
  <svg class="warning-indicator__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
    />
  </svg>
  {#if message && tooltipOpen}
    <span class="warning-tooltip warning-tooltip--{type}" aria-hidden="true">{message}</span>
  {/if}
</button>

<style>
  .warning-indicator {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    position: relative;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .warning-indicator__icon {
    width: 100%;
    height: 100%;
  }

  .warning-indicator--illegal .warning-indicator__icon {
    color: var(--md-sys-color-error);
  }

  .warning-indicator--inapplicable .warning-indicator__icon {
    color: var(--md-sys-color-on-surface-variant);
  }

  .warning-tooltip {
    position: absolute;
    top: calc(100% + var(--spacing-xs));
    left: 0;
    white-space: pre;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    border: 1px solid var(--md-sys-color-outline);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-md);
    z-index: var(--z-dropdown);
    pointer-events: none;
  }

  .warning-tooltip--illegal {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
  }

  .warning-tooltip--inapplicable {
    background: var(--md-sys-color-surface-container-highest);
    color: var(--md-sys-color-on-surface);
  }
</style>
