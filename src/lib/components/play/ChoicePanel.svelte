<script lang="ts">
  import { t } from '$lib/i18n';
  import WarningIndicator from './WarningIndicator.svelte';
  import type { AvailableRuleEntry } from '$lib/rules-engine';

  interface Props {
    entry: AvailableRuleEntry;
    onTap: () => void;
  }

  let { entry, onTap }: Props = $props();

  const hasWarning = $derived(!entry.legal || !entry.applicable);
  const warningType = $derived(
    !entry.legal ? 'illegal' : !entry.applicable ? 'inapplicable' : null
  );

  const warningLabel = $derived(() => {
    if (!hasWarning || !warningType) return '';
    const key = warningType === 'illegal' ? 'play.choices.illegal' : 'play.choices.inapplicable';
    return ` (${$t(key)})`;
  });

  const ariaLabel = $derived(
    `${entry.rule.description || entry.rule.id}${warningLabel()}`
  );
</script>

<button
  type="button"
  class="choice-panel"
  class:choice-panel--warning={hasWarning}
  onclick={onTap}
  aria-label={ariaLabel}
>
  <span class="choice-panel__description">
    {entry.rule.description || entry.rule.id}
  </span>
  {#if hasWarning && warningType}
    <WarningIndicator type={warningType} />
  {/if}
</button>

<style>
  .choice-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
  }

  .choice-panel:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .choice-panel:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .choice-panel:active {
    background: var(--md-sys-color-surface-container-highest);
    transform: scale(0.98);
  }

  .choice-panel--warning {
    border-color: var(--md-sys-color-error-container);
  }

  .choice-panel__description {
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    color: var(--md-sys-color-on-surface);
    flex: 1;
  }
</style>
