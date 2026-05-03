<script lang="ts">
  import { t } from '$lib/i18n';
  import WarningIndicator from './WarningIndicator.svelte';
  import { extractPanelDescriptor } from './panel-renderer/extractPanelDescriptor';
  import type { AvailableRuleEntry, Facts, Annotation } from '$lib/rules-engine';

  interface Props {
    entry: AvailableRuleEntry;
    editable?: boolean;
    onTap?: () => void;
    facts?: Facts;
    activeAnnotations?: Annotation[];
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onRemove?: () => void;
  }

  let {
    entry,
    editable = false,
    onTap,
    facts = {},
    activeAnnotations = [],
    onSelectionChange,
    onRemove
  }: Props = $props();

  const descriptor = $derived(extractPanelDescriptor(entry.rule));

  const displayName = $derived(
    descriptor.name
      ? $t(descriptor.name)
      : entry.rule.description || entry.rule.id
  );

  const hasWarning = $derived(!entry.legal || !entry.applicable);
  const warningType = $derived(
    !entry.legal ? ('illegal' as const) : !entry.applicable ? ('inapplicable' as const) : null
  );
</script>

{#if editable}
  <div class="panel-renderer panel-renderer--editable">
    <div class="panel-renderer__header">
      <span class="panel-renderer__title">{displayName}</span>
      {#if hasWarning && warningType}
        <WarningIndicator type={warningType} />
      {/if}
    </div>
  </div>
{:else}
  <button class="panel-renderer" onclick={onTap} type="button">
    <div class="panel-renderer__header">
      <span class="panel-renderer__title">{displayName}</span>
      {#if hasWarning && warningType}
        <WarningIndicator type={warningType} />
      {/if}
    </div>
  </button>
{/if}

<style>
  .panel-renderer {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    padding: var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .panel-renderer:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .panel-renderer:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .panel-renderer--editable {
    cursor: default;
  }

  .panel-renderer--editable:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .panel-renderer__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .panel-renderer__title {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }
</style>
