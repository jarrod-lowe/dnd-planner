<script lang="ts">
  /**
   * ViewFactsMode - read-only YAML view of all current character facts.
   * Diagnostic/inspector view accessible from the user dropdown menu.
   */
  import { t } from '$lib/i18n';
  import { playStore } from '$lib/play/playStore.svelte';

  interface Props {
    onBack: () => void;
  }

  let { onBack }: Props = $props();

  function factsToYaml(facts: Record<string, unknown>, indent = 0): string {
    const prefix = '  '.repeat(indent);
    const keys = Object.keys(facts).sort();
    const lines: string[] = [];

    for (const key of keys) {
      const value = facts[key];
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`${prefix}${key}:`);
        lines.push(factsToYaml(value as Record<string, unknown>, indent + 1));
      } else {
        lines.push(`${prefix}${key}: ${formatValue(value)}`);
      }
    }

    return lines.join('\n');
  }

  function formatValue(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) return JSON.stringify(value);
    return String(value);
  }

  let yamlText = $derived(factsToYaml(playStore.state.facts as Record<string, unknown>));

  let hasFacts = $derived(Object.keys(playStore.state.facts).length > 0);
</script>

<div class="view-facts">
  <div class="view-facts__header">
    <button
      type="button"
      class="view-facts__back"
      aria-label={$t('facts.backToPlay')}
      onclick={onBack}
    >
      <svg
        class="view-facts__back-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M19 12H5m7-7l-7 7 7 7" />
      </svg>
      {$t('facts.backToPlay')}
    </button>
    <h1 class="view-facts__title">{$t('facts.viewTitle')}</h1>
  </div>

  <div class="view-facts__content">
    {#if hasFacts}
      <div
        class="view-facts__pre"
        role="textbox"
        aria-readonly="true"
        tabindex="0"
        aria-label={$t('facts.ariaLabel')}
      >
        {yamlText}
      </div>
    {:else}
      <p class="view-facts__empty">{$t('facts.empty')}</p>
    {/if}
  </div>
</div>

<style>
  .view-facts {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 48rem;
    height: 100%;
  }

  .view-facts__header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
  }

  .view-facts__back {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--md-sys-color-on-surface);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
    min-height: 2.5rem;
  }

  .view-facts__back:hover {
    background: var(--md-sys-color-surface-container-high);
    border-color: var(--md-sys-color-outline);
  }

  .view-facts__back:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: -2px;
  }

  .view-facts__back-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .view-facts__title {
    font-family: var(--font-display);
    font-size: var(--font-size-lg);
    color: var(--md-sys-color-on-surface);
    letter-spacing: var(--letter-spacing-wide);
    margin: 0;
  }

  .view-facts__content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .view-facts__pre {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
    outline: none;
  }

  .view-facts__pre:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .view-facts__empty {
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    text-align: center;
    padding: var(--spacing-xl);
  }
</style>
