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
  <!--
    Codex P2: `aria-label` on a bare `<span>` is prohibited ARIA — a span has
    no role that supports naming, so a screen reader may ignore the label
    and fall back to the chip's raw text content, losing the
    purpose/range/critical context `dieAriaLabel()` builds. `role="img"`
    (same fix as `WarningIndicator`'s `.panel-renderer__markers`) makes the
    span a valid naming target AND makes the label the chip's only announced
    content — role="img" carries presentational children, so the visible
    text/badge inside is no longer separately read, exactly like a real
    <img>'s alt text stands in for its pixels. That's correct here: the
    label already incorporates the shown value, so nothing is lost, and
    nothing gets read twice. Only applied when a name is actually supplied —
    a chip with no ariaLabel (e.g. PanelLoadout's plain read-only chips) has
    no author name to protect, so it stays a plain, role-less span and its
    text reads for itself. The editable branch above stays a <button>,
    which supports aria-label natively and is unaffected.
  -->
  <span
    class="panel-renderer__die-chip"
    class:panel-renderer__die-chip--crit={crit}
    class:panel-renderer__die-chip--fumble={fumble}
    class:panel-renderer__die-chip--adv={advantage}
    class:panel-renderer__die-chip--disadv={disadvantage}
    class:panel-renderer__die-chip--crit-damage={critDamage}
    role={ariaLabel ? 'img' : undefined}
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

  /* Every read-only chip (rendered as a <span> once the row collapses) gets a
     non-pointer cursor regardless of state — it is never a control. */
  span.panel-renderer__die-chip {
    cursor: default;
  }

  /* The plain, borderless, unpadded "reads as text, not a button" look is
     deliberate for a read-only chip that carries NO state — but this reset
     must not touch a chip that DID roll a state (crit/fumble/crit-damage):
     unscoped, `span.panel-renderer__die-chip` has specificity (0,1,1) —
     element + class — which unconditionally beats the state rules' (0,1,0)
     regardless of source order, so a natural-20/natural-1/critical-damage die
     would lose its fill and border the instant its row collapsed and the chip
     became a <span> (Codex P2). Excluding the state classes here lets the
     state rules below — same specificity as the base rule, later in source —
     win normally, and the base rule's own padding comes along for the ride so
     a stated read-only chip reads as the same filled badge its editable
     counterpart does. */
  span.panel-renderer__die-chip:not(.panel-renderer__die-chip--crit):not(
      .panel-renderer__die-chip--fumble
    ):not(.panel-renderer__die-chip--crit-damage) {
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
