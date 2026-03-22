<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Character } from '$lib/character/types';

  interface Props {
    character: Character;
    onBack: () => void;
  }

  let { character, onBack }: Props = $props();
</script>

<div class="play-character">
  <button
    class="play-character__back"
    onclick={() => onBack()}
    aria-label={$t('play.backToSelection')}
  >
    {$t('play.backToSelection')}
  </button>
  <h1 class="play-character__name">{character.name}</h1>
  <p class="play-character__todo">TODO</p>
</div>

<style>
  .play-character {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xl);
    width: 100%;
    max-width: 40rem;
  }

  .play-character__back {
    align-self: flex-start;
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-md);
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    min-height: 2.5rem;
    transition: background-color var(--transition-fast);
  }

  .play-character__back:hover {
    background: var(--md-sys-color-surface-container);
  }

  .play-character__back:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .play-character__name {
    font-family: var(--font-display);
    font-size: var(--font-size-3xl);
    color: var(--md-sys-color-primary);
    margin: 0;
    text-align: center;
  }

  .play-character__todo {
    font-family: var(--font-display);
    font-size: var(--font-size-4xl);
    font-weight: 700;
    color: var(--md-sys-color-outline);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    margin: 0;
  }
</style>
