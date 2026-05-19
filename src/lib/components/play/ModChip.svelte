<script lang="ts">
  import { t } from '$lib/i18n';

  interface Props {
    variant: 'toggle' | 'effect' | 'illegal';
    label: string;
    toggled?: boolean;
    disabled?: boolean;
    illegalReason?: string;
    onToggle?: () => void;
  }

  let {
    variant,
    label,
    toggled = false,
    disabled = false,
    illegalReason,
    onToggle
  }: Props = $props();

  const chipClass = $derived(
    `mod-chip mod-chip--${variant}` +
      (toggled ? ' mod-chip--active' : '') +
      (disabled ? ' mod-chip--disabled' : '')
  );

  const ariaLabel = $derived.by(() => {
    if (variant === 'toggle') {
      return $t('play.modChip.toggle', { name: label });
    }
    if (variant === 'effect') {
      return $t('play.modChip.effectSource', { name: label });
    }
    if (variant === 'illegal' && illegalReason) {
      return $t('play.modChip.illegalWhy', { reason: $t(illegalReason) });
    }
    return label;
  });

  function handleClick() {
    if (!disabled && onToggle) {
      onToggle();
    }
  }
</script>

{#if variant === 'toggle'}
  <button
    type="button"
    class={chipClass}
    role="checkbox"
    aria-checked={toggled}
    aria-label={ariaLabel}
    {disabled}
    onclick={handleClick}
  >
    {#if toggled}
      <svg class="mod-chip__check" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
    {/if}
    <span class="mod-chip__label">{label}</span>
  </button>
{:else if variant === 'effect'}
  <span class={chipClass} aria-label={ariaLabel}>
    <span class="mod-chip__fx-badge" aria-hidden="true">FX</span>
    <span class="mod-chip__label">{label}</span>
  </span>
{:else}
  <span class={chipClass} aria-label={ariaLabel}>
    <span class="mod-chip__label">{label}</span>
    <span class="mod-chip__illegal-tag" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor" class="mod-chip__illegal-icon">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
        />
      </svg>
    </span>
  </span>
{/if}

<style>
  .mod-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 0.125rem var(--spacing-sm);
    border-radius: var(--radius-full);
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    line-height: 1.4;
    white-space: nowrap;
  }

  /* Toggle variant */
  .mod-chip--toggle {
    border: 1.5px solid var(--md-sys-color-outline);
    color: var(--md-sys-color-on-surface-variant);
    background: transparent;
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .mod-chip--toggle:hover:not(.mod-chip--disabled) {
    background: var(--md-sys-color-surface-container-highest);
  }

  .mod-chip--toggle:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .mod-chip--toggle.mod-chip--active {
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary-container);
    background: var(--md-sys-color-primary-container);
  }

  .mod-chip--toggle.mod-chip--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mod-chip__check {
    width: 0.75rem;
    height: 0.75rem;
    color: var(--md-sys-color-primary);
  }

  /* Effect variant */
  .mod-chip--effect {
    border: 2px double var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary-container);
    background: color-mix(in srgb, var(--md-sys-color-primary-container) 60%, transparent);
    pointer-events: none;
  }

  .mod-chip__fx-badge {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--md-sys-color-primary);
    opacity: 0.7;
  }

  /* Illegal variant */
  .mod-chip--illegal {
    border: 1.5px dashed var(--md-sys-color-outline-variant);
    color: var(--md-sys-color-on-surface-variant);
    background: transparent;
    opacity: 0.6;
  }

  .mod-chip__illegal-icon {
    width: 0.75rem;
    height: 0.75rem;
    color: var(--md-sys-color-error);
  }

  .mod-chip__label {
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
