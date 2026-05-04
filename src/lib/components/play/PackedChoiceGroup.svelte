<script lang="ts">
  import { slide } from 'svelte/transition';
  import { t } from '$lib/i18n';
  import PanelRenderer from './PanelRenderer.svelte';
  import type { AvailableRuleEntry, Facts, Annotation } from '$lib/rules-engine';

  interface Props {
    leader: AvailableRuleEntry;
    followers: AvailableRuleEntry[];
    facts?: Facts;
    activeAnnotations?: Annotation[];
    onAddToPlan: (entry: AvailableRuleEntry) => void;
    readOnly?: boolean;
  }

  let {
    leader,
    followers,
    facts = {},
    activeAnnotations = [],
    onAddToPlan,
    readOnly = false
  }: Props = $props();

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
</script>

<div class="packed-group">
  <!-- Leader panel -->
  <PanelRenderer
    entry={leader}
    {facts}
    {activeAnnotations}
    onTap={readOnly ? undefined : () => onAddToPlan(leader)}
  />

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

  <!-- Expanded follower panels with animation -->
  {#if expanded}
    <div class="packed-group__followers" transition:slide={{ duration: 200 }}>
      {#each followers as entry (entry.rule.id)}
        <PanelRenderer
          {entry}
          {facts}
          {activeAnnotations}
          onTap={readOnly ? undefined : () => handleFollowerTap(entry)}
        />
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
  .packed-group > :global(.panel-renderer:first-child) {
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

  /* Last follower gets bottom corners to match parent */
  .packed-group__followers :global(.panel-renderer:last-child) {
    border-radius: 0 0 var(--radius-md) var(--radius-md);
  }
</style>
