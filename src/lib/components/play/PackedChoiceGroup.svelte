<script lang="ts">
  import { slide } from 'svelte/transition';
  import { t } from '$lib/i18n';
  import ChoicePanel from './ChoicePanel.svelte';
  import EffectPanel from './EffectPanel.svelte';
  import WarningIndicator from './WarningIndicator.svelte';
  import type { AvailableRuleEntry, Facts } from '$lib/rules-engine';

  interface Props {
    leader: AvailableRuleEntry;
    followers: AvailableRuleEntry[];
    facts?: Facts;
    onAddToPlan: (entry: AvailableRuleEntry) => void;
    readOnly?: boolean;
  }

  let { leader, followers, facts = {}, onAddToPlan, readOnly = false }: Props = $props();

  let expanded = $state(false);

  // Get display names for followers
  const followerNames = $derived(
    followers
      .map((f) => {
        const uiName = f.rule.ui?.name as string | undefined;
        return uiName ? $t(uiName) : f.rule.description || f.rule.id;
      })
      .join(', ')
  );

  // Truncate if too long
  const truncatedNames = $derived(
    followerNames.length > 25 ? followerNames.substring(0, 25) + '...' : followerNames
  );

  function toggleExpanded() {
    expanded = !expanded;
  }

  function handleFollowerTap(entry: AvailableRuleEntry) {
    onAddToPlan(entry);
    // Don't collapse - user might want to add multiple
  }

  // Helper to resolve a var's default value from facts (same as ChoicePanel)
  function resolveVarDefault(entry: AvailableRuleEntry, varName: string): number | undefined {
    if (entry.rule.selections?.[varName] !== undefined) {
      return entry.rule.selections[varName] as number;
    }

    const varDef = entry.rule.vars?.[varName];
    if (!varDef) return undefined;

    const defaultSource = varDef.default;
    if (defaultSource.number !== undefined) {
      return defaultSource.number;
    }
    if (defaultSource.fact !== undefined) {
      return facts[defaultSource.fact] as number | undefined;
    }
    return undefined;
  }

  // Get warning state for an entry
  function getWarningInfo(entry: AvailableRuleEntry): {
    hasWarning: boolean;
    type: 'illegal' | 'inapplicable' | null;
    message: string | undefined;
  } {
    const hasWarning = !entry.legal || !entry.applicable;
    const type = !entry.legal ? 'illegal' : !entry.applicable ? 'inapplicable' : null;

    let message: string | undefined;
    if (hasWarning && entry.diagnostics.length > 0) {
      message = entry.diagnostics.map((d) => $t(d.code)).join('\n');
    }

    return { hasWarning, type, message };
  }
</script>

<div class="packed-group">
  <!-- Leader panel -->
  {#if readOnly}
    <EffectPanel entry={leader} />
  {:else}
    <ChoicePanel entry={leader} {facts} onTap={() => onAddToPlan(leader)} />
  {/if}

  <!-- Compact row for followers -->
  <button
    type="button"
    class="packed-group__compact-row"
    class:packed-group__compact-row--expanded={expanded}
    onclick={toggleExpanded}
    aria-expanded={expanded}
    aria-label={expanded ? $t('play.choices.pack.collapse') : $t('play.choices.pack.expand')}
  >
    <span class="packed-group__compact-names">{truncatedNames}</span>
    <span class="packed-group__compact-chevron">
      {#if expanded}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      {/if}
    </span>
  </button>

  <!-- Expanded follower panels (slim) with animation -->
  {#if expanded}
    <div class="packed-group__followers" transition:slide={{ duration: 200 }}>
      {#each followers as entry (entry.rule.id)}
        {@const uiModel = entry.rule.ui?.model as string | undefined}
        {@const warningInfo = getWarningInfo(entry)}
        {@const displayName = entry.rule.ui?.name
          ? $t(entry.rule.ui.name as string)
          : entry.rule.description || entry.rule.id}
        {#if readOnly}
          <div class="packed-group__slim-panel" aria-label={displayName}>
            <div class="packed-group__slim-body">
              <span class="packed-group__slim-title">{displayName}</span>
            </div>
          </div>
        {:else}
          {@const moveMaxDistance =
            uiModel === 'move' ? resolveVarDefault(entry, 'maxDistance') : undefined}
          {@const moveCurrentDistance =
            uiModel === 'move' ? resolveVarDefault(entry, 'distance') : undefined}
          {@const sliderValue =
            entry.rule.selections?.distance !== undefined
              ? (entry.rule.selections.distance as number)
              : (moveCurrentDistance ?? moveMaxDistance ?? 1)}
          <button
            type="button"
            class="packed-group__slim-panel"
            class:packed-group__slim-panel--warning={warningInfo.hasWarning}
            onclick={() => handleFollowerTap(entry)}
            aria-label={entry.rule.ui?.name
              ? $t(entry.rule.ui.name as string)
              : entry.rule.description || entry.rule.id}
          >
            {#if warningInfo.hasWarning && warningInfo.type}
              <WarningIndicator type={warningInfo.type} message={warningInfo.message} />
            {/if}

            <div class="packed-group__slim-body">
              {#if entry.rule.ui?.name}
                <span class="packed-group__slim-title">{$t(entry.rule.ui.name as string)}</span>
              {:else}
                <span class="packed-group__slim-title"
                  >{entry.rule.description || entry.rule.id}</span
                >
              {/if}

              {#if uiModel === 'move' && moveMaxDistance !== undefined}
                <div class="packed-group__slim-model">
                  <input
                    type="range"
                    class="move-slider"
                    min="0"
                    max={moveMaxDistance}
                    step="5"
                    value={sliderValue}
                    disabled
                    aria-label={$t('play.choices.move.distance')}
                  />
                  <span class="move-value">{sliderValue} ft</span>
                </div>
              {/if}
            </div>
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .packed-group {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    /* Note: overflow intentionally NOT hidden to allow slide animation */
  }

  /* Leader panel: remove border, apply top corners to match parent */
  .packed-group > :global(.choice-panel:first-child) {
    border: none;
    border-radius: var(--radius-md) var(--radius-md) 0 0;
  }

  .packed-group__compact-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-surface-container);
    border: none;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    transition: background-color var(--transition-fast);
  }

  .packed-group__compact-row:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .packed-group__compact-row:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: -2px;
  }

  .packed-group__compact-row--expanded {
    background: var(--md-sys-color-surface-container-high);
    border-radius: 0;
  }

  .packed-group__compact-names {
    flex: 1;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .packed-group__compact-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
    color: var(--md-sys-color-on-surface-variant);
    transition: transform var(--transition-fast);
  }

  .packed-group__compact-row--expanded .packed-group__compact-chevron {
    transform: rotate(180deg);
  }

  .packed-group__compact-chevron svg {
    width: 1rem;
    height: 1rem;
  }

  /* Followers container */
  .packed-group__followers {
    display: flex;
    flex-direction: column;
  }

  .packed-group__slim-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-surface-container-high);
    border: none;
    border-top: 1px solid var(--md-sys-color-outline-variant);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    transition: background-color var(--transition-fast);
  }

  .packed-group__slim-panel:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .packed-group__slim-panel:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: -2px;
  }

  .packed-group__slim-panel--warning {
    border-color: var(--md-sys-color-error-container);
  }

  /* Last follower gets bottom corners to match parent */
  .packed-group__slim-panel:last-child {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }

  /* Warning indicator positioning */
  .packed-group__slim-panel :global(.warning-indicator) {
    position: absolute;
    top: var(--spacing-xs);
    left: var(--spacing-xs);
    z-index: 1;
  }

  .packed-group__slim-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .packed-group__slim-title {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }

  .packed-group__slim-model {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .packed-group__slim-model .move-slider {
    flex: 1;
    accent-color: var(--md-sys-color-primary);
  }

  .packed-group__slim-model .move-value {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    min-width: 3rem;
    text-align: right;
  }
</style>
