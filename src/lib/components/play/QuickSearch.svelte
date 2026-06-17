<script lang="ts">
  import { t } from '$lib/i18n';
  import { SEARCH_PATH } from '$lib/icons';
  import { extractPanelDescriptor } from './panel-renderer/extractPanelDescriptor';
  import { deriveVerbFromRule } from '$lib/play/stepUtils';
  import { verbLabelKey } from '$lib/play/groupChoicesByVerb';
  import {
    isMatch,
    splitShown,
    keyEnabled,
    whyBadge,
    type SearchOption
  } from '$lib/play/quickSearch';
  import { closeActiveTooltip, registerTooltipClose } from './tooltipSingleton';
  import type { AvailableRuleEntry } from '$lib/rules-engine';

  interface Props {
    entries: AvailableRuleEntry[];
    onPick: (entry: AvailableRuleEntry) => void;
  }

  let { entries, onPick }: Props = $props();

  let query = $state('');
  let wellEl: HTMLDivElement | undefined = $state();
  let openTooltipId: string | null = $state(null);
  let tooltipStyle = $state('');

  const PAD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].map((row) => row.split(''));

  interface SearchItem {
    entry: AvailableRuleEntry;
    option: SearchOption;
    verbLabel: string;
  }

  /** Resolve the localised keyword string for an entry via the i18n sibling key
   *  convention: `…name` → `…keywords`. Missing/unconventional keys → no keywords. */
  function resolveKeywords(nameKey: string | undefined): string {
    if (!nameKey || !nameKey.endsWith('.name')) return '';
    const keywordKey = nameKey.replace(/\.name$/, '.keywords');
    const resolved = $t(keywordKey);
    return resolved === keywordKey ? '' : resolved;
  }

  const items = $derived.by<SearchItem[]>(() =>
    entries.map((entry) => {
      const descriptor = extractPanelDescriptor(entry.rule);
      const name = descriptor.name ? $t(descriptor.name) : entry.rule.id;
      const verb = deriveVerbFromRule(entry.rule);
      return {
        entry,
        option: { id: entry.rule.id, name, keywords: resolveKeywords(descriptor.name) },
        verbLabel: $t(verbLabelKey(verb))
      };
    })
  );

  const options = $derived(items.map((item) => item.option));
  const matches = $derived(items.filter((item) => isMatch(query, item.option)));
  const shownSplit = $derived(splitShown(matches));
  const shown = $derived(shownSplit.shown);
  const overflowCount = $derived(shownSplit.overflowCount);

  const wellState = $derived(
    query === '' ? 'empty' : matches.length === 0 ? 'no-match' : 'results'
  );

  function appendKey(letter: string) {
    query += letter;
  }
  function backspace() {
    query = query.slice(0, -1);
  }
  function clear() {
    query = '';
  }

  function badgeFor(item: SearchItem): string | null {
    return whyBadge(query, item.option);
  }

  function illegalMessage(item: SearchItem): string {
    return item.entry.diagnostics.map((d) => $t(d.code)).join('\n');
  }

  function resultAriaLabel(item: SearchItem): string {
    const badge = badgeFor(item);
    const base = badge
      ? `${item.option.name} — ${item.verbLabel} — ${badge}`
      : `${item.option.name} — ${item.verbLabel}`;
    if (item.entry.legal) return base;
    return `${base} — ${illegalMessage(item) || $t('play.quickSearch.illegal')}`;
  }

  function closeLocalTooltip() {
    openTooltipId = null;
    tooltipStyle = '';
    registerTooltipClose(null);
  }

  function toggleTooltip(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (openTooltipId === id) {
      closeLocalTooltip();
    } else {
      closeActiveTooltip();
      openTooltipId = id;
      registerTooltipClose(closeLocalTooltip);
      const icon = e.currentTarget as HTMLElement;
      if (wellEl && icon) {
        const iconRect = icon.getBoundingClientRect();
        const containerRect = wellEl.getBoundingClientRect();
        const left = iconRect.left + iconRect.width / 2 - containerRect.left;
        const top = iconRect.bottom - containerRect.top + 4;
        tooltipStyle = `left:${left}px;top:${top}px;transform:translateX(-50%)`;
      }
    }
  }

  function handleWindowClick() {
    if (openTooltipId) {
      closeLocalTooltip();
    }
  }

  const openTooltipMessage = $derived.by(() => {
    if (!openTooltipId) return '';
    const item = shown.find((i) => i.entry.rule.id === openTooltipId);
    return item ? illegalMessage(item) : '';
  });
</script>

<svelte:window onclick={handleWindowClick} />

<div class="quick-search" role="group" aria-label={$t('play.quickSearch.title')}>
  <!-- A. Query field -->
  <div class="quick-search__field">
    <span class="quick-search__glyph" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d={SEARCH_PATH} />
      </svg>
    </span>
    <output class="quick-search__query" aria-label={$t('play.quickSearch.field')}
      >{query}<span class="quick-search__caret" aria-hidden="true"></span></output
    >
    <span class="quick-search__count" aria-live="polite">
      {$t('play.quickSearch.matchCount', { count: String(matches.length) })}
    </span>
  </div>

  <!-- B. Results well (fixed height) -->
  <div
    class="quick-search__well"
    class:quick-search__well--tooltip-open={openTooltipId !== null}
    bind:this={wellEl}
  >
    {#if wellState === 'empty'}
      <p class="quick-search__hint" data-state="empty">{$t('play.quickSearch.helper')}</p>
    {:else if wellState === 'no-match'}
      <p class="quick-search__hint" data-state="no-match">{$t('play.quickSearch.noMatch')}</p>
    {:else}
      <div class="quick-search__results">
        {#each shown as item (item.entry.rule.id)}
          {@const badge = badgeFor(item)}
          <button
            type="button"
            class="quick-search__result"
            class:quick-search__result--illegal={!item.entry.legal}
            aria-label={resultAriaLabel(item)}
            onclick={() => onPick(item.entry)}
          >
            <span class="quick-search__result-name">
              {#if !item.entry.legal}
                <span
                  class="quick-search__result-illegal-tag"
                  aria-hidden="true"
                  onclick={(e) => toggleTooltip(item.entry.rule.id, e)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                    />
                  </svg>
                </span>
              {/if}
              {item.option.name}
            </span>
            <span class="quick-search__result-meta">
              <span class="quick-search__result-verb">{item.verbLabel}</span>
              {#if badge}
                <span class="quick-search__result-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
                  </svg>
                  {badge}
                </span>
              {/if}
            </span>
          </button>
        {/each}
      </div>
    {/if}
    <div class="quick-search__more-slot">
      {#if wellState === 'results' && overflowCount > 0}
        <p class="quick-search__more">
          {$t('play.quickSearch.more', { count: String(overflowCount) })}
        </p>
      {/if}
    </div>
    {#if openTooltipId && tooltipStyle && openTooltipMessage}
      <span class="quick-search__result-tooltip" style={tooltipStyle} aria-hidden="true"
        >{openTooltipMessage}</span
      >
    {/if}
  </div>

  <!-- C. QWERTY pad (fixed) -->
  <div class="quick-search__pad">
    {#each PAD_ROWS as row, rowIndex (rowIndex)}
      <div class="quick-search__pad-row">
        {#if rowIndex === 2}
          <button
            type="button"
            class="quick-search__key quick-search__key--util"
            data-action="backspace"
            aria-label={$t('play.quickSearch.backspaceKey')}
            disabled={query === ''}
            onclick={backspace}
          >
            ⌫
          </button>
        {/if}
        {#each row as letter (letter)}
          <button
            type="button"
            class="quick-search__key"
            data-key={letter}
            disabled={!keyEnabled(query, letter, options)}
            onclick={() => appendKey(letter)}
          >
            {letter}
          </button>
        {/each}
        {#if rowIndex === 2}
          <button
            type="button"
            class="quick-search__key quick-search__key--util"
            data-action="clear"
            aria-label={$t('play.quickSearch.clearKey')}
            disabled={query === ''}
            onclick={clear}
          >
            {$t('play.quickSearch.clearLabel')}
          </button>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .quick-search {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    min-width: 0;
    flex: 1;
  }

  /* In-place reveal cross-fade (skipped under reduced-motion). */
  @media (prefers-reduced-motion: no-preference) {
    .quick-search {
      animation: quick-search-reveal 220ms ease;
    }
  }

  @keyframes quick-search-reveal {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* A. Query field */
  .quick-search__field {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .quick-search__glyph {
    display: flex;
    align-items: center;
    color: var(--md-sys-color-on-surface-variant);
  }

  .quick-search__glyph svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .quick-search__query {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    min-height: 2.75rem;
    padding: 0 var(--spacing-sm);
    font-family: var(--font-body);
    font-size: var(--font-size-lg);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container-low);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    letter-spacing: 0.05em;
  }

  .quick-search__caret {
    display: inline-block;
    width: 2px;
    height: 1.2em;
    margin-left: 1px;
    background: var(--md-sys-color-primary);
    animation: quick-search-blink 1s step-end infinite;
  }

  @keyframes quick-search-blink {
    50% {
      opacity: 0;
    }
  }

  .quick-search__count {
    flex-shrink: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-on-surface-variant);
    white-space: nowrap;
  }

  /* B. Results well (fixed height) */
  /* Constant footprint: 3 result rows (2.75rem each) + gaps + the overflow line. */
  .quick-search__well {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 10.5rem;
  }

  .quick-search__well--tooltip-open {
    z-index: var(--z-dropdown);
  }

  .quick-search__results {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 2.75rem;
    align-content: start;
    gap: var(--spacing-xs);
    min-height: 0;
    overflow: hidden;
  }

  .quick-search__hint {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    text-align: center;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
  }

  .quick-search__result {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: stretch;
    gap: 1px;
    min-height: 2.5rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    overflow: hidden;
    text-align: left;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .quick-search__result:hover {
    background: var(--md-sys-color-surface-container-highest);
    border-color: var(--md-sys-color-outline);
  }

  .quick-search__result:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .quick-search__result--illegal {
    border-style: dashed;
  }

  .quick-search__result-illegal-tag {
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    display: inline-flex;
    pointer-events: auto;
  }

  .quick-search__result-illegal-tag svg {
    width: 1rem;
    height: 1rem;
    color: var(--md-sys-color-error);
  }

  .quick-search__result-tooltip {
    position: absolute;
    white-space: pre;
    max-width: 100%;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    border: 1px solid var(--md-sys-color-outline);
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    line-height: var(--line-height-md);
    z-index: var(--z-dropdown);
    pointer-events: none;
  }

  .quick-search__result-name {
    position: relative;
    font-weight: 600;
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Line 2: verb tag (left) and why-badge (right) share one row. */
  .quick-search__result-meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--spacing-xs);
    min-width: 0;
    line-height: 1.2;
  }

  .quick-search__result-verb {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--md-sys-color-on-surface-variant);
  }

  .quick-search__result-badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .quick-search__result-badge svg {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
  }

  .quick-search__more-slot {
    min-height: 1.5rem;
    display: flex;
    align-items: center;
  }

  .quick-search__more {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-primary);
  }

  /* C. QWERTY pad */
  .quick-search__pad {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .quick-search__pad-row {
    display: flex;
    justify-content: center;
    gap: var(--spacing-xs);
  }

  .quick-search__key {
    flex: 1;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 600;
    text-transform: uppercase;
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      opacity var(--transition-fast);
  }

  .quick-search__key:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-highest);
    border-color: var(--md-sys-color-outline);
  }

  .quick-search__key:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .quick-search__key:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .quick-search__key--util {
    flex: 0 0 auto;
    padding: 0 var(--spacing-sm);
    font-size: var(--font-size-xs);
    letter-spacing: 0.04em;
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
