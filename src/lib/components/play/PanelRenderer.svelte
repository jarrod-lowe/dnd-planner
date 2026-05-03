<script lang="ts">
  import { t } from '$lib/i18n';
  import WarningIndicator from './WarningIndicator.svelte';
  import { extractPanelDescriptor } from './panel-renderer/extractPanelDescriptor';
  import { resolveValueSource } from './panel-renderer/resolveValueSource';
  import PanelSlider from './panel-renderer/PanelSlider.svelte';
  import PanelDiceLine from './panel-renderer/PanelDiceLine.svelte';
  import PanelSelect from './panel-renderer/PanelSelect.svelte';
  import type { AvailableRuleEntry, Facts, Annotation } from '$lib/rules-engine';
  import type { TextInformation } from './panel-renderer/types';

  interface Props {
    entry: AvailableRuleEntry;
    editable?: boolean;
    onTap?: () => void;
    facts?: Facts;
    selections?: Record<string, unknown>;
    activeAnnotations?: Annotation[];
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    onRemove?: () => void;
  }

  let {
    entry,
    editable = false,
    onTap,
    facts = {},
    selections = {},
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

  const vars = $derived(entry.rule.vars ?? {});

  const primarySlider = $derived(
    descriptor.primaryControl?.type === 'slider' ? descriptor.primaryControl : undefined
  );
  const primaryDiceLine = $derived(
    descriptor.primaryControl?.type === 'dice-line' ? descriptor.primaryControl : undefined
  );
  const primarySelect = $derived(
    descriptor.primaryControl?.type === 'select' ? descriptor.primaryControl : undefined
  );
  const secondarySlider = $derived(
    descriptor.secondaryControl?.type === 'slider' ? descriptor.secondaryControl : undefined
  );

  const textInfos = $derived(
    (descriptor.information?.filter((info): info is TextInformation => info.type === 'text') ?? []).map(
      (info) => {
        let text = $t(info.label);
        if (info.labelValues) {
          const resolvedValues: string[] = [];
          for (const [key, source] of Object.entries(info.labelValues)) {
            const resolved = resolveValueSource(source, facts, vars, selections);
            if (resolved !== undefined) {
              const placeholder = `{{${key}}}`;
              const value = String(resolved);
              if (text.includes(placeholder)) {
                text = text.replace(placeholder, value);
              } else {
                resolvedValues.push(value);
              }
            }
          }
          if (resolvedValues.length > 0) {
            text = text + ' ' + resolvedValues.join(' ');
          }
        }
        return text;
      }
    )
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
    {#if primarySlider}
      <div class="panel-renderer__control">
        <PanelSlider
          control={primarySlider}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
        />
      </div>
    {/if}
    {#if primaryDiceLine}
      <div class="panel-renderer__control">
        <PanelDiceLine
          control={primaryDiceLine}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
        />
      </div>
    {/if}
    {#if primarySelect}
      <div class="panel-renderer__control">
        <PanelSelect
          control={primarySelect}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
        />
      </div>
    {/if}
    {#if secondarySlider}
      <div class="panel-renderer__control panel-renderer__control--secondary">
        <PanelSlider
          control={secondarySlider}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
        />
      </div>
    {/if}
    {#each textInfos as text}
      <div class="panel-renderer__information panel-renderer__information--text">{text}</div>
    {/each}
  </div>
{:else}
  <button class="panel-renderer" onclick={onTap} type="button">
    <div class="panel-renderer__header">
      <span class="panel-renderer__title">{displayName}</span>
      {#if hasWarning && warningType}
        <WarningIndicator type={warningType} />
      {/if}
    </div>
    {#if primarySlider}
      <div class="panel-renderer__control">
        <PanelSlider
          control={primarySlider}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
        />
      </div>
    {/if}
    {#if primaryDiceLine}
      <div class="panel-renderer__control">
        <PanelDiceLine
          control={primaryDiceLine}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
        />
      </div>
    {/if}
    {#if primarySelect}
      <div class="panel-renderer__control">
        <PanelSelect
          control={primarySelect}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
        />
      </div>
    {/if}
    {#if secondarySlider}
      <div class="panel-renderer__control panel-renderer__control--secondary">
        <PanelSlider
          control={secondarySlider}
          {editable}
          {facts}
          {vars}
          {selections}
          {onSelectionChange}
        />
      </div>
    {/if}
    {#each textInfos as text}
      <div class="panel-renderer__information panel-renderer__information--text">{text}</div>
    {/each}
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

  .panel-renderer__control {
    padding-top: var(--spacing-xs);
  }

  .panel-renderer__control--secondary {
    border-top: 1px solid var(--md-sys-color-outline-variant);
    margin-top: var(--spacing-xs);
    padding-top: var(--spacing-sm);
  }
</style>
