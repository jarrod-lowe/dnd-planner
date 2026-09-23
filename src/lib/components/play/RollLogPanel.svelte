<script lang="ts">
  import { t } from '$lib/i18n';
  import { rollLog } from '$lib/play/rollLogStore.svelte';
  import DiceRollToast from './panel-renderer/DiceRollToast.svelte';

  let panelEl: HTMLDivElement | undefined = $state();

  // The element focused when the panel opened (the dice button): captured at
  // open so close can hand focus back — a modal dialog must not strand
  // keyboard focus in the (now gone) panel. Captured BEFORE focus moves in,
  // and only once per open: the focus-in effect below re-runs when `panelEl`
  // binds, by which point document.activeElement is the panel itself.
  let opener: HTMLElement | null = null;

  // Focus in, the SettingsModal convention: the dialog element itself takes
  // focus (tabindex="-1"), so Tab starts from the top of the panel.
  $effect(() => {
    if (rollLog.isOpen) {
      if (opener === null) {
        opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      panelEl?.focus();
    }
  });

  // Focus out: the {#if} below tears the panel down on close, so this is the
  // close hook no matter which gesture closed it (X, scrim or Escape).
  $effect(() => {
    if (!rollLog.isOpen) {
      opener?.focus();
      opener = null;
    }
  });

  // Tab trap: aria-modal="true" promises assistive tech the background is
  // inert, but nothing enforces that for keyboards (the scrim only stops
  // pointers) — Tab from the close button would walk into the play screen.
  // Tab/Shift+Tab wrap inside the drawer instead. The panel is the only
  // tabbable region while open, so the window-level handler sees every press.
  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      rollLog.close();
      return;
    }
    if (e.key !== 'Tab' || !panelEl) return;
    const focusables = Array.from(panelEl.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusables.length === 0) {
      // Nothing to hand focus to — the dialog itself keeps it.
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    // Focus not on a tabbable element — outside the panel, or still on the
    // dialog root itself (tabindex="-1") right after open — counts as
    // "before first": Tab enters at the top, Shift+Tab wraps to the last.
    const beforeFirst =
      !panelEl.contains(document.activeElement) || document.activeElement === panelEl;
    if (e.shiftKey) {
      if (beforeFirst || document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (beforeFirst || document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if rollLog.isOpen}
  <!-- Scrim: taps close. The play grid never reflows — the panel is a fixed
       overlay above it. -->
  <div class="roll-log__scrim" role="presentation" onclick={() => rollLog.close()}></div>

  <div
    class="roll-log"
    role="dialog"
    aria-modal="true"
    aria-label={$t('play.rollLog.title')}
    bind:this={panelEl}
    tabindex="-1"
  >
    <div class="roll-log__header">
      <h2 class="roll-log__title">{$t('play.rollLog.title')}</h2>
      <button
        type="button"
        class="roll-log__close"
        aria-label={$t('play.rollLog.close')}
        onclick={() => rollLog.close()}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="roll-log__body">
      {#if rollLog.rolls.length === 0}
        <p class="roll-log__empty">{$t('play.rollLog.empty')}</p>
      {:else}
        <!-- The store reads latest-first, so plain order puts the newest roll
             on top. Scroll position is never touched: a player scrolled down
             the history stays put when a new roll lands. role="list" because
             the list-style:none below makes WebKit (Safari/VoiceOver) drop
             the list from the accessibility tree without it. -->
        <ol class="roll-log__list" role="list">
          {#each rollLog.rolls as entry (entry.id)}
            <li class="roll-log__entry" class:roll-log__entry--replaced={entry.replaced}>
              <DiceRollToast
                title={entry.title}
                rollType={entry.rollType}
                result={entry.result}
                modifiers={entry.modifiers}
                damageTypeKey={entry.damageTypeKey}
                unitKey={entry.unitKey}
              />
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Modal tier, not overlay: the scrim must sit ABOVE --z-overlay cards
     (ReminderPopover) — an aria-modal drawer leaves nothing behind it
     clickable. */
  .roll-log__scrim {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-modal) - 1);
    background: color-mix(in srgb, var(--md-sys-color-scrim) 50%, transparent);
  }

  .roll-log {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-modal);
    width: min(24rem, 90vw);
    display: flex;
    flex-direction: column;
    background: var(--md-sys-color-surface-container-low);
    border-left: 1px solid var(--md-sys-color-outline-variant);
    box-shadow: var(--shadow-lg);
  }

  /* The slide-in is motion-gated (QuickSearch convention): with
     prefers-reduced-motion the drawer simply appears in place. */
  @media (prefers-reduced-motion: no-preference) {
    .roll-log {
      animation: roll-log-enter 0.2s ease-out;
    }
  }

  @keyframes roll-log-enter {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .roll-log__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
  }

  .roll-log__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--md-sys-color-on-surface);
    letter-spacing: var(--letter-spacing-wide);
  }

  .roll-log__close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    color: var(--md-sys-color-on-surface-variant);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: background-color var(--transition-fast);
  }

  .roll-log__close svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .roll-log__close:hover {
    background: var(--md-sys-color-surface-container-high);
  }

  .roll-log__close:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .roll-log__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--spacing-md);
  }

  .roll-log__list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    list-style: none;
    margin: 0;
    padding: 0;
  }

  /* The entry wrapper itself paints nothing: the shared DiceRollToast card is
     the entry. A re-roll superseding one is signalled structurally, never with
     opacity (compositing towards the background is what sank the depleted
     ledger cells) and never by ADDING prominence — a replaced roll is spent,
     not emphasised. So the card hollows out: it drops to the flat page
     surface, below both its own raised card and the list it sits on, and its
     solid border goes dotted. The toast's text colours are untouched and AA
     on that surface in both themes (roll-log-contrast.test.ts). */
  .roll-log__entry--replaced :global(.dice-toast) {
    background: var(--md-sys-color-surface);
    border-style: dotted;
  }

  .roll-log__empty {
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-style: italic;
    color: var(--md-sys-color-on-surface-variant);
  }
</style>
