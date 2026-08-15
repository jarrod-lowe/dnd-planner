<script lang="ts">
  import { t } from '$lib/i18n';
  import type {
    UiEntry,
    UiEntryUsedMax,
    UiEntryHitDie,
    UiEntrySlotLevels,
    UiEntryActionPools
  } from '$lib/play/extractTopBar';
  import {
    isEntryVisible,
    resolveEntryValue,
    resourceShortLabelKey
  } from '$lib/play/extractTopBar';
  import { deriveSlotLevels, type SlotLevel } from '$lib/play/slotLevels';
  import { deriveActionPools, type ActionPool } from '$lib/play/actionPools';
  import SlotTray from './SlotTray.svelte';
  import type { EffectInstance } from '$lib/rules-engine';
  import type { Facts, Status } from '$lib/rules-view';

  interface Props {
    resourceEntries: UiEntry[];
    facts: Facts;
    status?: Status;
    viewLabel?: string;
    activeSubject?: string;
    /**
     * This turn's advertised (uncommitted) effects — raw `EffectInstance[]`
     * from `playStore.state.advertised`. Only the slot cell needs them: the
     * projected facts alone cannot say which spends belong to the current plan.
     *
     * Do NOT re-wire this to `engineOutput.effects`: that list is bridged to
     * the display `Rule` shape, which has no `state` map, so every spend count
     * would silently read 0 in the real app while tests injecting real
     * `EffectInstance`s stayed green.
     */
    effects?: EffectInstance[];
  }

  let { resourceEntries, facts, status, viewLabel, activeSubject, effects = [] }: Props = $props();

  type LedgerEntry = UiEntryUsedMax | UiEntryHitDie | UiEntrySlotLevels | UiEntryActionPools;

  const visibleEntries = $derived(
    resourceEntries
      .filter((e) => e.subject === activeSubject)
      .filter(
        (e): e is LedgerEntry =>
          (e.type === 'usedMax' ||
            e.type === 'hitDie' ||
            e.type === 'slotLevels' ||
            e.type === 'actionPools') &&
          isEntryVisible(e, facts)
      )
  );

  const isOverBudget = $derived(status !== undefined && status.legal === false);

  /**
   * Keyed-each identity. The total fact path is a pooled resource's identity —
   * distinct per pool, unlike the hit-die label shared by every die size — but
   * a slotLevels or actionPools entry has no `total`, so it keys on its label
   * plus subject (there may be a player actionPools and a steed actionPools).
   */
  function entryKey(entry: LedgerEntry): string {
    if (entry.type === 'slotLevels' || entry.type === 'actionPools') {
      return entry.label + ':' + (entry.subject ?? '');
    }
    return entry.total;
  }

  function labelFor(entry: UiEntry): string {
    if (entry.nameParams && Object.keys(entry.nameParams).length > 0) {
      return $t(entry.label, entry.nameParams);
    }
    return $t(entry.label);
  }

  // Compact label for the resources panel. Falls back to the full label when no
  // short form exists. The full label is still exposed via aria-label/title.
  function shortLabelFor(entry: UiEntry): string {
    const shortKey = resourceShortLabelKey(entry.label);
    if (!shortKey) return labelFor(entry);
    if (entry.nameParams && Object.keys(entry.nameParams).length > 0) {
      return $t(shortKey, entry.nameParams);
    }
    return $t(shortKey);
  }

  // Screen-reader text for a cell. The label itself carries any
  // disambiguating params — hit-die rows interpolate {{dieSize}} (see
  // derivePanels), so a multiclass character's "Hit Die d10" / "Hit Die d6"
  // stay distinguishable without per-type surgery here. The whole
  // "label: N of M" composition goes through i18n so the scaffolding
  // translates too.
  function ariaLabelFor(
    entry: UiEntryUsedMax | UiEntryHitDie,
    remaining: number,
    total: number
  ): string {
    return $t('play.stats.valueLabel', {
      label: labelFor(entry),
      remaining,
      total
    });
  }

  // ── Spell slot & Action economy cells ──

  /** Visual state of one tile; mirrors the tray's pip states. */
  type TileState = 'open' | 'this-turn' | 'spent';

  /** Only one tray open at a time across all cells. */
  let trayOpenKey: string | null = $state(null);
  let toggleEls: Record<string, HTMLButtonElement | undefined> = {};
  let cellEls: Record<string, HTMLDivElement | undefined> = {};

  function slotLevelsFor(entry: UiEntrySlotLevels): SlotLevel[] {
    return deriveSlotLevels(facts, effects).filter((level) => entry.levels.includes(level.level));
  }

  function slotTrayRowsFor(levels: SlotLevel[]) {
    return levels.map((level) => ({
      tile: $t('play.slots.levelTile', { level: level.level }),
      name: $t('play.slots.levelName', { level: level.level }),
      order: level.level,
      open: level.open,
      thisTurn: level.thisTurn,
      spent: level.spent,
      total: level.total
    }));
  }

  /**
   * One tile per LEVEL (for slots) or per POOL (for actions). The ledger answers
   * a single question — "can I use this right now?" — so the three states are a
   * precedence, not a tally; the per-unit breakdown belongs to the tray.
   *
   * - `open` while any unit remains, whatever else the plan has spent.
   * - `this turn` once nothing is open but the current plan is what closed it:
   *   removing a plan row gets it back.
   * - `spent` when nothing is open and nothing in the plan can restore it.
   */
  function tileState(unit: SlotLevel | ActionPool): TileState {
    if (unit.open > 0) return 'open';
    if (unit.thisTurn > 0) return 'this-turn';
    return 'spent';
  }

  /**
   * The tile run is one image to a screen reader: individual tiles are
   * decorative, and this label carries what is castable right now.
   */
  function slotTilesLabel(levels: SlotLevel[]): string {
    const open = levels
      .filter((level) => level.open > 0)
      .map((level) => $t('play.slots.levelSummary', { open: level.open, level: level.level }));
    const summary =
      open.length > 0 ? open.join($t('play.slots.summarySeparator')) : $t('play.slots.noneOpen');
    return $t('play.slots.tilesLabel', { summary });
  }

  /**
   * The tile run is one image to a screen reader: individual tiles are
   * decorative, and this label carries what is available right now.
   */
  function economyTilesLabel(pools: ActionPool[], entry: UiEntryActionPools): string {
    const open = pools.map((pool) => {
      const poolDef = entry.pools.find((p) => p.key === pool.key);
      return $t('play.economy.poolOpen', {
        name: $t(poolDef?.label ?? pool.key),
        open: pool.open
      });
    });
    // Only fall back to noneOpen if ALL pools are at 0 open
    const hasAnyOpen = pools.some((pool) => pool.open > 0);
    const summary = hasAnyOpen
      ? open.join($t('play.economy.summarySeparator'))
      : $t('play.economy.noneOpen');
    return $t('play.economy.tilesLabel', { summary });
  }

  function economyTrayRowsFor(pools: ActionPool[], entry: UiEntryActionPools) {
    return pools.map((pool, index) => {
      const poolDef = entry.pools.find((p) => p.key === pool.key);
      return {
        tile: $t(poolDef?.shortLabel ?? pool.key),
        name: $t(poolDef?.label ?? pool.key),
        order: index,
        open: pool.open,
        thisTurn: pool.thisTurn,
        spent: pool.spent,
        total: pool.total
      };
    });
  }

  function toggleSlots(key: string) {
    trayOpenKey = trayOpenKey === key ? null : key;
  }

  /**
   * @param returnFocus Move focus back to the toggle. Wanted when the keyboard
   *   closed the tray, unwanted on an outside click — the click has already
   *   moved focus, and yanking it back would fight the user.
   */
  function closeTray(returnFocus: boolean) {
    if (!trayOpenKey) return;
    const key = trayOpenKey;
    trayOpenKey = null;
    if (returnFocus) toggleEls[key]?.focus();
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeTray(true);
  }

  /**
   * Outside-click close. The containment test runs against the cell wrapper,
   * which is never swapped by an `{#if}` — AddRowPicker's documented trap is
   * that a node detached mid-event fails `contains()` and closes the popover
   * spuriously. The toggle and its tiles live inside this wrapper and survive
   * the toggle, so the click that opens the tray never closes it again.
   */
  function handleWindowClick(event: MouseEvent) {
    if (!trayOpenKey) return;
    const target = event.target;
    if (target instanceof Node && cellEls[trayOpenKey]?.contains(target)) return;
    closeTray(false);
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} onclick={handleWindowClick} />

<div class="ledger" role="region" aria-label={$t('play.ledger.title')}>
  <div class="ledger__title">
    <span class="ledger__header">{$t('play.ledger.title')}</span>
    {#if viewLabel}
      <span class="ledger__view-label">{$t(viewLabel)}</span>
    {/if}
  </div>

  {#if isOverBudget}
    <span class="ledger__warn-badge" role="alert">
      {$t('play.ledger.overBudget')}
    </span>
  {/if}

  <div class="ledger__cells">
    {#each visibleEntries as entry (entryKey(entry))}
      {#if entry.type === 'slotLevels'}
        {@const key = entryKey(entry)}
        {@const levels = slotLevelsFor(entry)}
        {@const isOpen = trayOpenKey === key}
        <!-- position: relative — SlotTray self-anchors with position: absolute. -->
        <div class="ledger__cell ledger__cell--slots" bind:this={cellEls[key]}>
          <button
            type="button"
            class="ledger__slot-toggle"
            aria-expanded={isOpen}
            aria-controls={'ledger-tray-' + key}
            title={$t('play.slots.toggle')}
            onclick={() => toggleSlots(key)}
            bind:this={toggleEls[key]}
          >
            <span class="ledger__cell-label">{shortLabelFor(entry)}</span>
            <span class="ledger__slot-row">
              <span class="ledger__slot-tiles" role="img" aria-label={slotTilesLabel(levels)}>
                {#each levels as level (level.level)}
                  <span
                    class="ledger__slot-tile ledger__slot-tile--{tileState(level)}"
                    aria-hidden="true">{$t('play.slots.levelTile', { level: level.level })}</span
                  >
                {/each}
              </span>
              <!-- Disclosure affordance only. aria-expanded on the button
                   already states the tray's state, so this must add no
                   screen-reader noise. Points up because the tray opens
                   upward; flips on expand. -->
              <svg
                class="ledger__slot-caret"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M6 15l6-6 6 6" />
              </svg>
            </span>
          </button>
          {#if isOpen}
            <SlotTray
              id={'ledger-tray-' + key}
              rows={slotTrayRowsFor(levels)}
              titleKey="play.slots.title"
            />
          {/if}
        </div>
      {:else if entry.type === 'actionPools'}
        {@const key = entryKey(entry)}
        {@const pools = deriveActionPools(
          facts,
          effects,
          entry.factPrefix,
          entry.pools.map((p) => p.key)
        )}
        {@const isOpen = trayOpenKey === key}
        <!-- position: relative — SlotTray self-anchors with position: absolute. -->
        <div class="ledger__cell ledger__cell--slots" bind:this={cellEls[key]}>
          <button
            type="button"
            class="ledger__slot-toggle"
            aria-expanded={isOpen}
            aria-controls={'ledger-tray-' + key}
            title={$t('play.economy.toggle')}
            onclick={() => toggleSlots(key)}
            bind:this={toggleEls[key]}
          >
            <span class="ledger__cell-label">{shortLabelFor(entry)}</span>
            <span class="ledger__slot-row">
              <span
                class="ledger__slot-tiles"
                role="img"
                aria-label={economyTilesLabel(pools, entry)}
              >
                {#each entry.pools as poolDef (poolDef.key)}
                  {@const pool = pools.find((p) => p.key === poolDef.key)}
                  {#if pool}
                    <span
                      class="ledger__slot-tile ledger__slot-tile--{tileState(pool)}"
                      aria-hidden="true">{$t(poolDef.shortLabel)}</span
                    >
                  {/if}
                {/each}
              </span>
              <svg
                class="ledger__slot-caret"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M6 15l6-6 6 6" />
              </svg>
            </span>
          </button>
          {#if isOpen}
            <SlotTray
              id={'ledger-tray-' + key}
              rows={economyTrayRowsFor(pools, entry)}
              titleKey={entry.label}
            />
          {/if}
        </div>
      {:else}
        {@const total =
          entry.type === 'hitDie'
            ? Number(facts[entry.total] ?? 0)
            : Number(facts[(entry as UiEntryUsedMax).total] ?? 0)}
        {@const remaining =
          entry.type === 'hitDie'
            ? Number(facts[entry.remaining] ?? 0)
            : Number(facts[(entry as UiEntryUsedMax).remaining] ?? 0)}
        <div
          class="ledger__cell"
          class:ledger__cell--muted={remaining <= 0 && !isOverBudget}
          class:ledger__cell--warn={isOverBudget && remaining < 0}
          aria-label={ariaLabelFor(entry, remaining, total)}
          title={ariaLabelFor(entry, remaining, total)}
        >
          <span class="ledger__cell-label">{shortLabelFor(entry)}</span>
          <span class="ledger__cell-value">{resolveEntryValue(entry, facts)}</span>
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .ledger {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-surface-container);
    border-top: 1px solid var(--md-sys-color-outline-variant);
    flex-wrap: wrap;
  }

  .ledger__title {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .ledger__header {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--md-sys-color-on-surface-variant);
    flex-shrink: 0;
  }

  .ledger__view-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 700;
    color: var(--md-sys-color-primary);
    letter-spacing: 0.04em;
  }

  .ledger__warn-badge {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--md-sys-color-on-error-container);
    background: var(--md-sys-color-error-container);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .ledger__cells {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .ledger__cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 3.5rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-md);
  }

  .ledger__cell--muted {
    opacity: 0.4;
  }

  .ledger__cell--warn {
    background: var(--md-sys-color-error-container);
  }

  .ledger__cell--warn .ledger__cell-label,
  .ledger__cell--warn .ledger__cell-value {
    color: var(--md-sys-color-on-error-container);
  }

  .ledger__cell-label {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--md-sys-color-on-surface-variant);
  }

  .ledger__cell-value {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  /* Anchor for the tray, which positions itself absolutely against this cell. */
  .ledger__cell--slots {
    position: relative;
    padding: 0;
  }

  /* Disclosure trigger: shaped like a cell, so the row reads as one strip. */
  .ledger__slot-toggle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-height: 2.75rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
  }

  .ledger__slot-toggle:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .ledger__slot-toggle:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .ledger__slot-toggle[aria-expanded='true'] {
    background: var(--md-sys-color-surface-container-high);
    border-color: var(--md-sys-color-outline-variant);
  }

  /* Tiles and the disclosure caret share one row under the label. */
  .ledger__slot-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .ledger__slot-tiles {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 4px;
  }

  /* Same chevron idiom as UserDropdown / PackedChoiceGroup: an inline stroked
     SVG that rotates 180deg on expand. Decorative — aria-expanded carries the
     state for assistive tech. */
  .ledger__slot-caret {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
    color: var(--md-sys-color-on-surface-variant);
    transition: transform var(--transition-fast);
  }

  .ledger__slot-toggle[aria-expanded='true'] .ledger__slot-caret {
    transform: rotate(180deg);
  }

  /* One tile per level, digit = that level. States repeat the tray's pip
     coding (solid / hatched / outlined) so the two readings agree, but here
     they are a precedence over the level as a whole, not a per-slot tally. */
  .ledger__slot-tile {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    min-width: 18px;
    height: 18px;
    border: 1.5px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--md-sys-color-outline);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    line-height: 1;
  }

  /* Open: solid. */
  .ledger__slot-tile--open {
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary);
  }

  /* This turn: hatched, same -45deg idiom as .effect-chip--expiring, over the
     tertiary container so the digit stays readable between the stripes. */
  .ledger__slot-tile--this-turn {
    background:
      repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 2px,
        color-mix(in srgb, var(--md-sys-color-tertiary) 55%, transparent) 2px,
        color-mix(in srgb, var(--md-sys-color-tertiary) 55%, transparent) 4px
      ),
      var(--md-sys-color-tertiary-container);
    border-color: var(--md-sys-color-tertiary);
    color: var(--md-sys-color-on-tertiary-container);
  }

  /* Spent: outline only. */
  .ledger__slot-tile--spent {
    background: transparent;
    border-color: var(--md-sys-color-outline-variant);
    color: var(--md-sys-color-outline);
  }
</style>
