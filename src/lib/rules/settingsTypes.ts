export interface SettingOption {
  value: string;
  translations: Record<string, { name: string }>;
}

export interface SettingDefinition {
  id: string;
  type: 'select';
  translations: Record<string, { name: string; description?: string }>;
  options: SettingOption[];
  effect: Record<string, unknown>;
}
