<script lang="ts">
  import { t } from '$lib/i18n';

  /**
   * A single die chip of a panel roller — the tappable chip rendered by
   * PanelDiceLine for each die and by PanelHitDice for each hit-die slot.
   * Owns the chip markup and its roll-state styling so both roller kinds read
   * as one family; the surrounding line decides what the chip means (which
   * die, which slot, what bonus) and supplies the chip text.
   */
  interface Props {
    /** Chip text: the expression before rolling, the result after. */
    text: string;
    editable: boolean;
    /** Accessible name; undefined falls back to the chip's text content. */
    ariaLabel?: string;
    /** Disabled (e.g. a spent hit-die slot). Never set by dice lines. */
    disabled?: boolean;
    /** Nat-20 styling. */
    crit?: boolean;
    /** Nat-1 styling. */
    fumble?: boolean;
    advantage?: boolean;
    disadvantage?: boolean;
    /** Critical-hit damage styling (tertiary border). */
    critDamage?: boolean;
    /** Render the critical-hit badge alongside the text. */
    critical?: boolean;
    /** Left-half rounding when the chip is split with an options trigger. */
    main?: boolean;
    /** Rendered as data-die-index when set (dice-line dies). */
    dieIndex?: number;
    /** Rendered as data-die-sides when set (hit-dice slots). */
    dieSides?: number;
    /** Rendered as data-slot-index when set (hit-dice slots). */
    slotIndex?: number;
    /** The chip element, so the owning line can animate it on roll. */
    ref?: HTMLElement | null;
    onclick?: () => void;
  }

  let {
    text,
    editable,
    ariaLabel,
    disabled = false,
    crit = false,
    fumble = false,
    advantage = false,
    disadvantage = false,
    critDamage = false,
    critical = false,
    main = false,
    dieIndex,
    dieSides,
    slotIndex,
    ref = $bindable(),
    onclick
  }: Props = $props();
</script>

{#if editable}
  <button
    class="panel-renderer__die-chip"
    class:panel-renderer__die-chip--main={main}
    class:panel-renderer__die-chip--crit={crit}
    class:panel-renderer__die-chip--fumble={fumble}
    class:panel-renderer__die-chip--adv={advantage}
    class:panel-renderer__die-chip--disadv={disadvantage}
    class:panel-renderer__die-chip--crit-damage={critDamage}
    type="button"
    {disabled}
    aria-label={ariaLabel}
    data-die-index={dieIndex}
    data-die-sides={dieSides}
    data-slot-index={slotIndex}
    bind:this={ref}
    {onclick}
  >
    {text}{#if critical}
      <span class="panel-renderer__crit-badge" aria-hidden="true">
        {$t('play.choices.attack.criticalSymbol')}
      </span>
    {/if}
  </button>
{:else}
  <span
    class="panel-renderer__die-chip"
    class:panel-renderer__die-chip--crit={crit}
    class:panel-renderer__die-chip--fumble={fumble}
    class:panel-renderer__die-chip--adv={advantage}
    class:panel-renderer__die-chip--disadv={disadvantage}
    class:panel-renderer__die-chip--crit-damage={critDamage}
    aria-label={ariaLabel}
    data-die-index={dieIndex}
    data-die-sides={dieSides}
    data-slot-index={slotIndex}
  >
    {text}{#if critical}
      <span class="panel-renderer__crit-badge" aria-hidden="true">
        {$t('play.choices.attack.criticalSymbol')}
      </span>
    {/if}
  </span>
{/if}

<style>
  .panel-renderer__die-chip {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    padding: var(--spacing-xs) var(--spacing-sm);
    cursor: pointer;
    white-space: nowrap;
  }

  button.panel-renderer__die-chip:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-highest);
  }

  button.panel-renderer__die-chip:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  span.panel-renderer__die-chip {
    cursor: default;
    background: transparent;
    border: none;
    padding: 0;
  }

  .panel-renderer__die-chip--crit {
    color: var(--md-sys-color-on-primary);
    background: var(--md-sys-color-primary);
    border-color: var(--md-sys-color-primary);
  }

  .panel-renderer__die-chip--fumble {
    color: var(--md-sys-color-on-error);
    background: var(--md-sys-color-error);
    border-color: var(--md-sys-color-error);
  }

  /* Critical damage: distinct tertiary accent border so it never collides with
     the d20 nat-20 primary-fill crit style. */
  .panel-renderer__die-chip--crit-damage {
    border-color: var(--md-sys-color-tertiary);
  }

  .panel-renderer__crit-badge {
    font-size: var(--font-size-md);
    margin-left: var(--spacing-xs);
  }

  /* Left half of a split chip (the options trigger rounds the other half). */
  .panel-renderer__die-chip--main {
    border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  }
</style>
