<script lang="ts">
  import { t, locale } from '$lib/i18n';
  import type { SettingDefinition } from '$lib/rules/settingsTypes';
  import { get } from 'svelte/store';

  interface Props {
    settings: SettingDefinition[];
    values: Record<string, string>;
    onchange: (values: Record<string, string>) => void;
    disabled?: boolean;
  }

  let { settings, values, onchange, disabled = false }: Props = $props();

  function getSettingName(setting: SettingDefinition): string {
    const currentLocale = get(locale);
    return (
      setting.translations[currentLocale]?.name ??
      setting.translations['en']?.name ??
      setting.id
    );
  }

  function getOptionName(setting: SettingDefinition, optionValue: string): string {
    const currentLocale = get(locale);
    const option = setting.options.find((o) => o.value === optionValue);
    if (!option) return optionValue;
    return (
      option.translations[currentLocale]?.name ??
      option.translations['en']?.name ??
      optionValue
    );
  }
</script>

{#each settings as setting (setting.id)}
  <label class="dialog__label">
    <span>{getSettingName(setting)}</span>
    <select
      class="dialog__select"
      onchange={(e) => {
        onchange({ ...values, [setting.id]: e.currentTarget.value });
      }}
      value={values[setting.id] ?? ''}
      {disabled}
    >
      <option value="" disabled>{get(t)('rules.settingsSelectPlaceholder')}</option>
      {#each setting.options as option (option.value)}
        <option value={option.value}>{getOptionName(setting, option.value)}</option>
      {/each}
    </select>
  </label>
{/each}

<style>
  .dialog__label {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    font-family: var(--font-body);
    font-size: var(--font-size-sm);
    color: var(--md-sys-color-on-surface-variant);
  }

  .dialog__select {
    width: 100%;
    padding: var(--spacing-md);
    font-family: var(--font-body);
    font-size: var(--font-size-md);
    color: var(--md-sys-color-on-surface);
    background: var(--md-sys-color-surface);
    border: 1px solid var(--md-sys-color-outline-variant);
    border-radius: var(--radius-md);
    cursor: pointer;
    min-height: 2.75rem;
    transition: border-color var(--transition-fast);
  }

  .dialog__select:focus {
    outline: none;
    border-color: var(--md-sys-color-primary);
  }
</style>
