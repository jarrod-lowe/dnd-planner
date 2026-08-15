<script lang="ts">
  /**
   * Per-level spell slot breakdown, shown as a disclosure tray anchored ABOVE
   * the ledger's slot cell - the ledger is pinned to the bottom of the
   * viewport, so a tray opening downwards would be off-screen.
   *
   * Presentation only: the caller passes the already-derived `SlotLevel[]`
   * (see `$lib/play/slotLevels`), so this component never touches the engine.
   *
   * States are distinguished by texture AND colour - solid / hatched / outlined
   * - because colour alone is not accessible. Nothing is left conveyed by
   * texture alone: the legend names all three states ("Open" / "This turn" /
   * "Spent") as real text, and every row carries an aria-label with all four
   * counts, so the pip run itself is decorative and hidden from the
   * accessibility tree.
   */
  import { t } from '$lib/i18n';
  import type { SlotLevel } from '$lib/play/slotLevels';

  interface Props {
    /** Levels to show, already filtered to `total > 0` by `deriveSlotLevels`. */
    levels: SlotLevel[];
    /** DOM id, so the disclosure button's `aria-controls` can point here. */
    id?: string;
  }

  let { levels, id }: Props = $props();

  /** CSS modifier suffix for each slot state. */
  type PipState = 'open' | 'this-turn' | 'spent';

  const LEGEND: { state: PipState; key: string }[] = [
    { state: 'open', key: 'play.slots.legend.open' },
    { state: 'this-turn', key: 'play.slots.legend.thisTurn' },
    { state: 'spent', key: 'play.slots.legend.spent' }
  ];

  function repeat(state: PipState, count: number): PipState[] {
    return Array.from({ length: Math.max(0, count) }, () => state);
  }

  /**
   * Open pips first, then this turn's, then the ones spent on earlier turns.
   * `spent` is the projected total and already includes `thisTurn`, so the
   * earlier count is the difference - counting both would double up.
   */
  function pipRun(level: SlotLevel): PipState[] {
    return [
      ...repeat('open', level.open),
      ...repeat('this-turn', level.thisTurn),
      ...repeat('spent', level.spent - level.thisTurn)
    ];
  }

  const rows = $derived(
    [...levels]
      .sort((a, b) => a.level - b.level)
      .map((level) => ({
        level,
        pips: pipRun(level),
        tile: $t('play.slots.levelTile', { level: level.level }),
        label: $t('play.slots.levelRow', {
          level: level.level,
          open: level.open,
          thisTurn: level.thisTurn,
          spent: level.spent,
          total: level.total
        })
      }))
  );
</script>

<div class="slot-tray" {id}>
  {#if rows.length > 0}
    <h3 class="slot-tray__title">{$t('play.slots.title')}</h3>

    <ul class="slot-tray__rows">
      {#each rows as row (row.level.level)}
        <li class="slot-tray__row" aria-label={row.label}>
          <span class="slot-tray__tile" aria-hidden="true">{row.tile}</span>
          <span class="slot-tray__pips" aria-hidden="true">
            {#each row.pips as pip, index (index)}
              <span class="slot-tray__pip slot-tray__pip--{pip}"></span>
            {/each}
          </span>
          <span class="slot-tray__count">{row.level.open}/{row.level.total}</span>
        </li>
      {/each}
    </ul>

    <div class="slot-tray__legend">
      <h4 class="slot-tray__legend-title">{$t('play.slots.legendTitle')}</h4>
      <ul class="slot-tray__legend-list">
        {#each LEGEND as item (item.state)}
          <li class="slot-tray__legend-item">
            <span class="slot-tray__pip slot-tray__pip--{item.state}" aria-hidden="true"></span>{$t(
              item.key
            )}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  /* Self-anchoring popover, per AddRowPicker's tooltip: the floating element
     owns `position: absolute` + `z-index`, so the caller only has to make the
     cell it hangs off `position: relative`.

     It opens UPWARDS (`bottom`, not `top`): the resources ledger is pinned to
     the bottom of the viewport, so a tray hanging below the cell would fall
     off-screen. There is no transform-origin or entry animation to flip with
     it. The shadow stays `--shadow-lg`: Material's light source is fixed
     overhead, so elevation shadows cast downwards whichever way a surface
     opens.

     It anchors on the RIGHT edge (`right`, not `left`): the slot cell sorts
     last in the ledger (`slotLevels` is the highest `UI_ENTRY_TYPE_ORDER` of
     the three types the Ledger renders), so it sits hard against the right of
     the strip and a left-anchored tray ran off-screen — 90px at 1080px wide,
     48px at the 1024x768 tablet viewport, unreachable because the page never
     grows a scrollbar for it. Extending leftwards is safe: any character with
     spell slots also has earlier cells (HP, actions, and — via
     class-paladin-level1's `requires` — the Lay on Hands pool), so the cell is
     never flush-left. */
  .slot-tray {
    position: absolute;
    bottom: calc(100% + var(--spacing-xs));
    right: 0;
    z-index: var(--z-dropdown);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    min-width: 12rem;
    padding: var(--spacing-sm);
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    font-family: var(--font-body);
  }

  .slot-tray__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
  }

  .slot-tray__rows,
  .slot-tray__legend-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .slot-tray__rows {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .slot-tray__row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  /* Level tile: the digit is duplicated by the row's aria-label. */
  .slot-tray__tile {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 1.125rem;
    height: 1.125rem;
    padding: 0 0.25rem;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    background: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-on-surface-variant);
    font-size: var(--font-size-xs);
    font-weight: 600;
    line-height: 1;
  }

  .slot-tray__pips {
    display: flex;
    flex: 1;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
  }

  /* Geometry mirrors .effect-chip__pip so pips read the same app-wide. */
  .slot-tray__pip {
    width: 0.5rem;
    height: 0.5rem;
    flex-shrink: 0;
    border: 1.5px solid var(--md-sys-color-outline-variant);
    border-radius: 50%;
    background: transparent;
  }

  /* Open: solid. */
  .slot-tray__pip--open {
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
  }

  /* This turn: hatched, using the same -45deg idiom as .effect-chip--expiring.
     Slightly larger than the other pips so the hatch stays legible. */
  .slot-tray__pip--this-turn {
    width: 9px;
    height: 9px;
    border-color: var(--md-sys-color-tertiary);
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 1.5px,
      var(--md-sys-color-tertiary) 1.5px,
      var(--md-sys-color-tertiary) 3px
    );
  }

  /* Spent: outline only. */
  .slot-tray__pip--spent {
    background: transparent;
    border-color: var(--md-sys-color-outline-variant);
  }

  .slot-tray__count {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    font-variant-numeric: tabular-nums;
    color: var(--md-sys-color-on-surface);
    white-space: nowrap;
  }

  .slot-tray__legend {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-xs);
    border-top: 1px solid var(--md-sys-color-outline-variant);
  }

  .slot-tray__legend-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--md-sys-color-on-surface-variant);
  }

  .slot-tray__legend-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }

  .slot-tray__legend-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    font-size: var(--font-size-xs);
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
