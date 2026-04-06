<script lang="ts">
  import { t } from '$lib/i18n';
  import WarningIndicator from './WarningIndicator.svelte';
  import type { AvailableRuleEntry, Facts } from '$lib/rules-engine';

  interface Props {
    entry: AvailableRuleEntry;
    onTap?: () => void;
    editable?: boolean;
    facts?: Facts;
    onSelectionChange?: (selections: Record<string, unknown>) => void;
    // Control buttons (for planned items)
    showControls?: boolean;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onRemove?: () => void;
  }

  let {
    entry,
    onTap,
    editable = false,
    facts = {},
    onSelectionChange,
    showControls = false,
    canMoveUp = true,
    canMoveDown = true,
    onMoveUp,
    onMoveDown,
    onRemove
  }: Props = $props();

  const hasWarning = $derived(!entry.legal || !entry.applicable);
  const warningType = $derived(
    !entry.legal ? 'illegal' : !entry.applicable ? 'inapplicable' : null
  );

  // Get specific diagnostic messages from entry.diagnostics
  // Multiple diagnostics are joined with newlines for multi-line display
  const warningMessage = $derived.by(() => {
    if (!hasWarning || entry.diagnostics.length === 0) return undefined;
    const messages = entry.diagnostics.map((d) => $t(d.code));
    return messages.join('\n');
  });

  const warningLabel = $derived.by(() => {
    if (!hasWarning || !warningType) return '';
    // Use specific message if available, otherwise generic
    if (warningMessage) return ` (${warningMessage})`;
    const key = warningType === 'illegal' ? 'play.choices.illegal' : 'play.choices.inapplicable';
    return ` (${$t(key)})`;
  });

  const ariaLabel = $derived(`${entry.rule.description || entry.rule.id}${warningLabel}`);

  // Extract UI config from rule
  const uiSection = $derived(entry.rule.ui?.section as string | undefined);
  const uiName = $derived(entry.rule.ui?.name as string | undefined);
  const uiModel = $derived(entry.rule.ui?.model as string | undefined);

  // Helper to resolve a var's default value from facts
  function resolveVarDefault(varName: string): number | undefined {
    // Check for captured value first (for planned rules with capture: true)
    if (entry.rule.selections?.[varName] !== undefined) {
      return entry.rule.selections[varName] as number;
    }

    const varDef = entry.rule.vars?.[varName];
    if (!varDef) return undefined;

    const defaultSource = varDef.default;
    if (defaultSource.number !== undefined) {
      return defaultSource.number;
    }
    if (defaultSource.fact !== undefined) {
      return facts[defaultSource.fact] as number | undefined;
    }
    return undefined;
  }

  // Move model specific values
  const moveMaxDistance = $derived(
    uiModel === 'move' ? resolveVarDefault('maxDistance') : undefined
  );
  const moveCurrentDistance = $derived(
    uiModel === 'move' ? resolveVarDefault('distance') : undefined
  );

  // Ability score model specific values
  const abilityScoreValue = $derived(
    uiModel === 'ability-score' ? resolveVarDefault('score') : undefined
  );

  // Skill proficiency model specific values
  const proficiencyLevel = $derived(
    uiModel === 'skill-proficiency' ? resolveVarDefault('level') : undefined
  );

  const proficiencyOptions = [
    { value: 0.5, label: '\u25CB', ariaLabel: $t('play.choices.skillProficiency.half') },
    { value: 1, label: '\u25CF', ariaLabel: $t('play.choices.skillProficiency.full') },
    { value: 2, label: '\u25CF\u25CF', ariaLabel: $t('play.choices.skillProficiency.double') }
  ] as const;

  // Slider state - initialized from current/max distance, controlled by user
  // Using writable derived pattern for slider value
  let sliderValue = $derived.by(() => {
    if (uiModel === 'ability-score') {
      if (entry.rule.selections?.score !== undefined) {
        return entry.rule.selections.score as number;
      }
      return abilityScoreValue ?? 10;
    }
    if (uiModel === 'skill-proficiency') {
      if (entry.rule.selections?.level !== undefined) {
        return entry.rule.selections.level as number;
      }
      return proficiencyLevel ?? 1;
    }
    // For display, use the selection from the rule if it exists
    if (entry.rule.selections?.distance !== undefined) {
      return entry.rule.selections.distance as number;
    }
    return moveCurrentDistance ?? moveMaxDistance ?? 0;
  });

  // Handle slider change
  function handleSliderChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);

    if (onSelectionChange) {
      if (uiModel === 'ability-score') {
        onSelectionChange({ score: value });
      } else if (uiModel === 'skill-proficiency') {
        onSelectionChange({ level: value });
      } else {
        onSelectionChange({ distance: value });
      }
    }
  }

  function handleProficiencyChange(value: number): void {
    if (onSelectionChange) {
      onSelectionChange({ level: value });
    }
  }
</script>

{#if editable}
  <!-- Editable mode: div container with interactive controls -->
  <div
    class="choice-panel choice-panel--editable"
    class:choice-panel--warning={hasWarning}
    aria-label={ariaLabel}
    role="group"
  >
    {#if hasWarning && warningType}
      <WarningIndicator type={warningType} message={warningMessage} />
    {/if}
    {#if uiSection}
      <div class="choice-panel__header">
        <span class="choice-panel__type">{$t(`play.choices.sections.${uiSection}`)}</span>
      </div>
    {/if}
    <div class="choice-panel__body">
      {#if uiName}
        <span class="choice-panel__title">{$t(uiName)}</span>
      {:else}
        <span class="choice-panel__description">
          {entry.rule.description || entry.rule.id}
        </span>
      {/if}

      {#if uiModel === 'move' && moveMaxDistance !== undefined}
        <div class="choice-panel__model">
          <input
            type="range"
            class="move-slider"
            min="0"
            max={moveMaxDistance}
            step="5"
            value={sliderValue}
            aria-label={$t('play.choices.move.distance')}
            oninput={handleSliderChange}
          />
          <span class="move-value">{sliderValue} ft</span>
        </div>
      {/if}
      {#if uiModel === 'ability-score'}
        <div class="choice-panel__model">
          <input
            type="range"
            class="move-slider"
            min="1"
            max="30"
            step="1"
            value={sliderValue}
            aria-label={$t(uiName ?? '')}
            oninput={handleSliderChange}
          />
          <span class="ability-score-value">{sliderValue}</span>
        </div>
      {/if}
      {#if uiModel === 'skill-proficiency'}
        <div class="choice-panel__model" role="radiogroup" aria-label={$t(uiName ?? '')}>
          {#each proficiencyOptions as option (option.value)}
            <button
              type="button"
              class="choice-panel__radio"
              class:choice-panel__radio--active={proficiencyLevel === option.value}
              role="radio"
              aria-checked={proficiencyLevel === option.value}
              aria-label={option.ariaLabel}
              disabled={!editable}
              onclick={() => handleProficiencyChange(option.value)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
    {#if showControls}
      <div class="choice-panel__actions" role="group" aria-label="Item controls">
        <button
          type="button"
          class="choice-panel__button choice-panel__button--move-up"
          disabled={!canMoveUp}
          onclick={onMoveUp}
          aria-label={$t('play.plan.moveUp')}
          title={$t('play.plan.moveUp')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>
        <button
          type="button"
          class="choice-panel__button choice-panel__button--move-down"
          disabled={!canMoveDown}
          onclick={onMoveDown}
          aria-label={$t('play.plan.moveDown')}
          title={$t('play.plan.moveDown')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
        <button
          type="button"
          class="choice-panel__button choice-panel__button--remove"
          onclick={onRemove}
          aria-label={$t('play.plan.remove')}
          title={$t('play.plan.remove')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>
    {/if}
  </div>
{:else}
  <!-- Read-only mode: button to add to plan -->
  <button
    type="button"
    class="choice-panel"
    class:choice-panel--warning={hasWarning}
    onclick={onTap}
    aria-label={ariaLabel}
  >
    {#if hasWarning && warningType}
      <WarningIndicator type={warningType} message={warningMessage} />
    {/if}
    {#if uiSection}
      <div class="choice-panel__header">
        <span class="choice-panel__type">{$t(`play.choices.sections.${uiSection}`)}</span>
      </div>
    {/if}
    <div class="choice-panel__body">
      {#if uiName}
        <span class="choice-panel__title">{$t(uiName)}</span>
      {:else}
        <span class="choice-panel__description">
          {entry.rule.description || entry.rule.id}
        </span>
      {/if}

      {#if uiModel === 'move' && moveMaxDistance !== undefined}
        <div class="choice-panel__model">
          <input
            type="range"
            class="move-slider"
            min="0"
            max={moveMaxDistance}
            step="5"
            value={sliderValue}
            disabled
            aria-label={$t('play.choices.move.distance')}
          />
          <span class="move-value">{sliderValue} ft</span>
        </div>
      {/if}
      {#if uiModel === 'ability-score'}
        <div class="choice-panel__model">
          <input
            type="range"
            class="move-slider"
            min="1"
            max="30"
            step="1"
            value={sliderValue}
            disabled
            aria-label={$t(uiName ?? '')}
          />
          <span class="ability-score-value">{sliderValue}</span>
        </div>
      {/if}
      {#if uiModel === 'skill-proficiency'}
        <div class="choice-panel__model" role="radiogroup" aria-label={$t(uiName ?? '')}>
          {#each proficiencyOptions as option (option.value)}
            <span
              class="choice-panel__radio choice-panel__radio--readonly"
              class:choice-panel__radio--active={proficiencyLevel === option.value}
              role="radio"
              aria-checked={proficiencyLevel === option.value}
              aria-label={option.ariaLabel}
            >
              {option.label}
            </span>
          {/each}
        </div>
      {/if}
    </div>
  </button>
{/if}

<style>
  .choice-panel {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    width: 100%;
    padding: var(--spacing-md);
    padding-bottom: 0; /* Body handles bottom padding */
    background: var(--md-sys-color-surface-container-high);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body);
    font-size: var(--font-size-base);
    line-height: var(--line-height-md);
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  /* Eliminate top gap - first content element doesn't need it */
  .choice-panel > .choice-panel__header:first-of-type,
  .choice-panel > .choice-panel__body:first-of-type {
    margin-top: calc(-1 * var(--spacing-xs));
  }

  .choice-panel:hover {
    background: var(--md-sys-color-surface-container-highest);
  }

  .choice-panel:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .choice-panel:active {
    background: var(--md-sys-color-surface-container-highest);
    transform: scale(0.98);
  }

  .choice-panel--warning {
    border-color: var(--md-sys-color-error-container);
  }

  .choice-panel--editable {
    cursor: default;
  }

  .choice-panel--editable:active {
    transform: none;
  }

  .choice-panel__header {
    padding-bottom: var(--spacing-xs);
    border-bottom: 1px solid var(--md-sys-color-outline-variant);
  }

  .choice-panel__type {
    font-family: var(--font-body);
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    color: var(--md-sys-color-on-surface-variant);
    letter-spacing: var(--letter-spacing-wide);
  }

  .choice-panel__body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding-bottom: var(--spacing-md); /* Add back bottom padding here */
  }

  .choice-panel__title {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }

  .choice-panel__description {
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
  }

  .choice-panel__model {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .move-slider {
    flex: 1;
    accent-color: var(--md-sys-color-primary);
  }

  .move-slider:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .move-value {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    min-width: 3rem;
    text-align: right;
  }

  .ability-score-value {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    min-width: 2rem;
    text-align: right;
  }

  .choice-panel__radio {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    color: var(--md-sys-color-on-surface-variant);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    font-weight: 500;
    text-align: center;
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast),
      color var(--transition-fast);
  }

  .choice-panel__radio:hover:not(:disabled):not(.choice-panel__radio--readonly) {
    background: var(--md-sys-color-surface-container-high);
  }

  .choice-panel__radio:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .choice-panel__radio--active {
    background: var(--md-sys-color-primary-container);
    border-color: var(--md-sys-color-primary);
    color: var(--md-sys-color-on-primary-container);
  }

  .choice-panel__radio:disabled,
  .choice-panel__radio--readonly {
    opacity: 0.6;
    cursor: default;
  }

  /* Actions positioned at top-right inside panel */
  .choice-panel__actions {
    position: absolute;
    top: var(--spacing-sm);
    right: var(--spacing-sm);
    display: flex;
    gap: var(--spacing-xs);
    padding: var(--spacing-xs);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    z-index: 1;
  }

  .choice-panel__button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: transparent;
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-sm);
    color: var(--md-sys-color-on-surface-variant);
    cursor: pointer;
    transition:
      background-color var(--transition-fast),
      color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .choice-panel__button:hover:not(:disabled) {
    background: var(--md-sys-color-surface-container-highest);
  }

  .choice-panel__button:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .choice-panel__button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .choice-panel__button svg {
    width: 1rem;
    height: 1rem;
  }

  .choice-panel__button--remove:hover:not(:disabled) {
    background: var(--md-sys-color-error-container);
    color: var(--md-sys-color-on-error-container);
    border-color: var(--md-sys-color-error);
  }

  /* Warning indicator positioned at top-left as overlay */
  .choice-panel :global(.warning-indicator) {
    position: absolute;
    top: var(--spacing-xs);
    left: var(--spacing-xs);
    z-index: 2;
  }
</style>
