<script lang="ts">
  import { t } from '$lib/i18n';
  import type { AvailableRuleEntry } from '$lib/rules-engine';

  interface Props {
    entry: AvailableRuleEntry;
  }

  let { entry }: Props = $props();

  const uiName = $derived(entry.rule.ui?.name as string | undefined);

  const displayName = $derived(uiName ? $t(uiName) : entry.rule.description || entry.rule.id);
</script>

<div class="effect-panel" role="status" aria-label={displayName}>
  <div class="effect-panel__body">
    <span class="effect-panel__title">{displayName}</span>
  </div>
</div>

<style>
  .effect-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    padding: var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
  }

  .effect-panel__body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .effect-panel__title {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }
</style>
