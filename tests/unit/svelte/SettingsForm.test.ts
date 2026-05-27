import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SettingsForm from '$lib/components/character/SettingsForm.svelte';
import type { SettingDefinition } from '$lib/rules/settingsTypes';

const singleSetting: SettingDefinition = {
  id: 'skill-1',
  type: 'select',
  translations: { en: { name: 'Skill Proficiency' } },
  options: [
    { value: 'athletics', translations: { en: { name: 'Athletics' } } },
    { value: 'insight', translations: { en: { name: 'Insight' } } },
  ],
};

const multipleSettings: SettingDefinition[] = [
  singleSetting,
  {
    id: 'skill-2',
    type: 'select',
    translations: { en: { name: 'Skill Proficiency 2' } },
    options: [
      { value: 'athletics', translations: { en: { name: 'Athletics' } } },
      { value: 'insight', translations: { en: { name: 'Insight' } } },
    ],
  },
];

describe('SettingsForm', () => {
  it('renders one select per setting', () => {
    const { container } = render(SettingsForm, {
      props: { settings: multipleSettings, values: {}, onchange: vi.fn() },
    });
    const selects = container.querySelectorAll('select');
    expect(selects).toHaveLength(2);
  });

  it('renders the setting name as label text', () => {
    const { container } = render(SettingsForm, {
      props: { settings: [singleSetting], values: {}, onchange: vi.fn() },
    });
    const label = container.querySelector('label');
    expect(label?.textContent).toContain('Skill Proficiency');
  });

  it('renders options for each setting', () => {
    const { container } = render(SettingsForm, {
      props: { settings: [singleSetting], values: {}, onchange: vi.fn() },
    });
    const select = container.querySelector('select');
    const options = select?.querySelectorAll('option');
    // 1 placeholder + 2 real options
    expect(options).toHaveLength(3);
  });

  it('calls onchange with updated values when an option is selected', async () => {
    const onchange = vi.fn();
    const { container } = render(SettingsForm, {
      props: { settings: [singleSetting], values: {}, onchange },
    });
    const select = container.querySelector('select')!;
    await fireEvent.change(select, { target: { value: 'athletics' } });
    expect(onchange).toHaveBeenCalledWith({ 'skill-1': 'athletics' });
  });

  it('preserves existing values when changing a new setting', async () => {
    const onchange = vi.fn();
    const { container } = render(SettingsForm, {
      props: {
        settings: multipleSettings,
        values: { 'skill-1': 'athletics' },
        onchange,
      },
    });
    const selects = container.querySelectorAll('select');
    await fireEvent.change(selects[1], { target: { value: 'insight' } });
    expect(onchange).toHaveBeenCalledWith({
      'skill-1': 'athletics',
      'skill-2': 'insight',
    });
  });

  it('sets the selected value on the select element', () => {
    const { container } = render(SettingsForm, {
      props: {
        settings: [singleSetting],
        values: { 'skill-1': 'insight' },
        onchange: vi.fn(),
      },
    });
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('insight');
  });
});
