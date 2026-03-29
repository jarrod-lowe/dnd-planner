<script lang="ts">
  /**
   * EditCustomRules - edit custom rules for a character in YAML format.
   */
  import { t } from '$lib/i18n';
  import type { Character } from '$lib/character/types';
  import { yamlToRules, rulesToYaml } from '$lib/rules/yamlConverter';
  import { validateRules } from '$lib/rules/validateRules';
  import { playStore } from '$lib/play/playStore.svelte';
  import { debounce } from '$lib/play/debounce';
  import type { Rule } from '$lib/rules-engine';

  interface Props {
    character: Character;
    onBack: () => void;
  }

  let { character, onBack }: Props = $props();

  // Snapshot of custom rules from the store, used for reset and initialization
  let storeYaml = $derived.by(() => {
    const customGroupId = 'custom-' + character.characterId;
    const customRules: Rule[] = playStore.state.ruleGroupRulesMap[customGroupId] ?? [];
    return rulesToYaml(customRules);
  });

  // Track whether we've done first-load initialization
  let initialized = $state(false);

  // Mutable editor content
  let yamlContent = $state('');
  let validationErrors: { message: string; path: string }[] = $state([]);
  let isSaving = $state(false);
  let saveError: string | null = $state(null);

  let isValid = $derived(validationErrors.length === 0);

  // One-time initialization: populate editor from store on first load
  $effect(() => {
    if (!initialized) {
      yamlContent = storeYaml;
      initialized = true;
    }
  });

  // Reset target: always reflects the current store snapshot
  function handleReset(): void {
    yamlContent = storeYaml;
    validationErrors = [];
    saveError = null;
  }

  async function runValidation(content: string): Promise<void> {
    const errors: { message: string; path: string }[] = [];

    const parsed = yamlToRules(content);
    if (parsed.error) {
      errors.push({ message: parsed.error, path: '' });
    }
    if (parsed.rules) {
      try {
        const result = await validateRules(parsed.rules);
        errors.push(...result.errors);
      } catch {
        errors.push({ message: $t('rules.saveError'), path: '' });
      }
    }

    validationErrors = errors;
  }

  const debouncedValidate = debounce((content: string) => runValidation(content), 500);

  function handleInput(e: Event): void {
    yamlContent = (e.target as HTMLTextAreaElement).value;
    debouncedValidate(yamlContent);
  }

  async function handleSave(): Promise<void> {
    isSaving = true;
    saveError = null;

    try {
      const parsed = yamlToRules(yamlContent);
      if (!parsed.rules) {
        saveError = $t('rules.yamlSyntaxError');
        return;
      }

      await playStore.updateCustomRules(character.characterId, parsed.rules);
      onBack();
    } catch {
      saveError = $t('rules.saveError');
    } finally {
      isSaving = false;
    }
  }

  let parsedRulesForSave = $derived(yamlToRules(yamlContent).rules);
</script>

<div class="edit-custom-rules">
  <div class="edit-custom-rules__header">
    <button class="edit-custom-rules__back" onclick={() => onBack()}>
      {$t('rules.backToManageRules')}
    </button>
    <h1 class="edit-custom-rules__title">{$t('rules.customRulesTitle')}</h1>
  </div>

  <textarea
    class="edit-custom-rules__editor"
    aria-label={$t('rules.customRulesTitle')}
    aria-invalid={validationErrors.length > 0}
    aria-describedby="edit-custom-rules-errors"
    oninput={handleInput}
    value={yamlContent}
    spellcheck="false"
  ></textarea>

  <div
    id="edit-custom-rules-errors"
    class="edit-custom-rules__errors"
    role="alert"
    aria-live="polite"
  >
    <h2 class="edit-custom-rules__errors-heading">{$t('rules.validationErrors')}</h2>
    {#if validationErrors.length === 0}
      <p class="edit-custom-rules__no-errors">{$t('rules.noErrors')}</p>
    {:else}
      <ul class="edit-custom-rules__error-list">
        {#each validationErrors as error, i ((error.path ?? '') + error.message + i)}
          <li class="edit-custom-rules__error-item">
            {#if error.path}
              <span class="edit-custom-rules__error-path">{error.path}:</span>
            {/if}
            {error.message}
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if saveError}
    <p class="edit-custom-rules__save-error" role="alert">{saveError}</p>
  {/if}

  <div class="edit-custom-rules__actions">
    <button class="edit-custom-rules__reset" onclick={handleReset}>
      {$t('rules.resetRules')}
    </button>
    <button
      class="edit-custom-rules__save"
      onclick={handleSave}
      disabled={!isValid || isSaving || !parsedRulesForSave}
    >
      {isSaving ? $t('rules.saving') : $t('rules.saveRules')}
    </button>
  </div>
</div>

<style>
  .edit-custom-rules {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: var(--spacing-md);
  }

  .edit-custom-rules__header {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .edit-custom-rules__back {
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

  .edit-custom-rules__back:hover {
    background: var(--md-sys-color-surface-container);
  }

  .edit-custom-rules__back:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .edit-custom-rules__title {
    font-family: var(--font-display);
    font-size: var(--font-size-xl);
    color: var(--md-sys-color-on-surface);
    letter-spacing: var(--letter-spacing-wide);
    margin: 0;
  }

  .edit-custom-rules__editor {
    flex: 1;
    width: 100%;
    min-height: 12rem;
    padding: var(--spacing-md);
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-md);
    resize: vertical;
    transition:
      border-color var(--transition-fast),
      box-shadow var(--transition-fast);
  }

  .edit-custom-rules__editor:focus {
    outline: none;
    border-color: var(--md-sys-color-primary);
    box-shadow: 0 0 0 1px var(--md-sys-color-primary);
  }

  .edit-custom-rules__editor[aria-invalid='true'] {
    border-color: var(--md-sys-color-error);
    box-shadow: 0 0 0 1px var(--md-sys-color-error);
  }

  .edit-custom-rules__errors {
    background: var(--md-sys-color-surface-container);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    padding: var(--spacing-md);
  }

  .edit-custom-rules__errors-heading {
    font-family: var(--font-display);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface);
    margin: 0 0 var(--spacing-sm) 0;
  }

  .edit-custom-rules__no-errors {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
    margin: 0;
  }

  .edit-custom-rules__error-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .edit-custom-rules__error-item {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-error);
  }

  .edit-custom-rules__error-path {
    font-family: var(--font-mono, monospace);
    font-weight: 600;
  }

  .edit-custom-rules__save-error {
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-error);
    margin: 0;
  }

  .edit-custom-rules__actions {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .edit-custom-rules__reset {
    background: transparent;
    border: 1px solid var(--md-sys-color-outline);
    border-radius: var(--radius-md);
    color: var(--md-sys-color-on-surface);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    padding: var(--spacing-sm) var(--spacing-lg);
    min-height: 2.75rem;
    transition:
      background-color var(--transition-fast),
      border-color var(--transition-fast);
  }

  .edit-custom-rules__reset:hover {
    background: var(--md-sys-color-surface-container);
  }

  .edit-custom-rules__reset:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .edit-custom-rules__save {
    background: var(--md-sys-color-primary);
    border: none;
    border-radius: var(--radius-md);
    color: var(--md-sys-color-on-primary);
    cursor: pointer;
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    padding: var(--spacing-sm) var(--spacing-lg);
    min-height: 2.75rem;
    transition:
      background-color var(--transition-fast),
      opacity var(--transition-fast);
  }

  .edit-custom-rules__save:hover:not(:disabled) {
    background: var(--md-sys-color-primary-container);
    color: var(--md-sys-color-on-primary-container);
  }

  .edit-custom-rules__save:focus-visible {
    outline: 2px solid var(--md-sys-color-primary);
    outline-offset: 2px;
  }

  .edit-custom-rules__save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
