<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Rule } from '$lib/rules-view';
  import type { Facts } from '$lib/rules-view';

  interface Props {
    effect: Rule;
    facts: Facts;
    anchorRect: DOMRect;
    onOutcome: (outcome: 'pass' | 'fail') => void;
    onClose: () => void;
  }

  let { anchorRect, onOutcome, onClose }: Props = $props();

  const popoverStyle = $derived.by(() => {
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const spaceRight = window.innerWidth - anchorRect.left;
    const cardHeight = 200;
    const cardWidth = 320;

    let top: number;
    if (spaceBelow >= cardHeight) {
      top = anchorRect.bottom + 4;
    } else {
      top = Math.max(4, anchorRect.top - cardHeight - 4);
    }

    let left: number;
    if (spaceRight >= cardWidth) {
      left = anchorRect.left;
    } else {
      left = Math.max(4, window.innerWidth - cardWidth - 4);
    }

    return `position: fixed; top: ${top}px; left: ${left}px; z-index: var(--z-overlay);`;
  });
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<!-- Backdrop -->
<div class="reminder-popover__backdrop" role="presentation" onclick={onClose}></div>

<!-- Card -->
<div
  class="reminder-popover__card"
  style={popoverStyle}
  role="dialog"
  aria-label={$t('play.reminder.title')}
>
  <div class="reminder-popover__header">
    <svg class="reminder-popover__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
    </svg>
    <span class="reminder-popover__title">{$t('play.reminder.concCheck')}</span>
  </div>

  <p class="reminder-popover__body">{$t('play.reminder.title')}</p>

  <div class="reminder-popover__actions">
    <button
      type="button"
      class="reminder-popover__action reminder-popover__action--pass"
      onclick={() => onOutcome('pass')}
    >
      {$t('play.reminder.outcomePass')}
    </button>
    <button
      type="button"
      class="reminder-popover__action reminder-popover__action--fail"
      onclick={() => onOutcome('fail')}
    >
      {$t('play.reminder.outcomeFail')}
    </button>
  </div>
</div>

<style>
  .reminder-popover__backdrop {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-overlay) - 1);
  }

  .reminder-popover__card {
    min-width: 18rem;
    max-width: 22rem;
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    animation: reminder-popover-enter 0.15s ease-out;
  }

  @keyframes reminder-popover-enter {
    from {
      opacity: 0;
      transform: translateY(-0.25rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .reminder-popover__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .reminder-popover__icon {
    width: 1.25rem;
    height: 1.25rem;
    color: var(--md-sys-color-error);
    flex-shrink: 0;
  }

  .reminder-popover__title {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    letter-spacing: var(--letter-spacing-wide);
    text-transform: uppercase;
  }

  .reminder-popover__body {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0;
    line-height: var(--line-height-md);
  }

  .reminder-popover__actions {
    display: flex;
    gap: var(--spacing-sm);
    margin-top: var(--spacing-xs);
  }

  .reminder-popover__action {
    flex: 1;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 600;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    border: 1px solid var(--md-sys-color-outline-variant);
    cursor: pointer;
    min-height: 2.75rem;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast);
  }

  .reminder-popover__action:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .reminder-popover__action--pass {
    background: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-on-surface);
  }

  .reminder-popover__action--pass:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .reminder-popover__action--fail {
    background: var(--md-sys-color-surface-container);
    color: var(--md-sys-color-error);
  }

  .reminder-popover__action--fail:hover {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
  }
</style>
