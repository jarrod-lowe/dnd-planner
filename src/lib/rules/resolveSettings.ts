import type { SettingDefinition } from './settingsTypes';
import { substituteTemplate } from './substituteSettings';
import type { EffectInstance } from '$lib/rules-engine';

export interface SettingsGroup {
  ruleGroupId: string;
  settings: SettingDefinition[];
  values: Record<string, string>;
}

export interface MetaLookup {
  requires: string[];
}

export interface ResolvedSettings {
  additionalRuleGroupIds: string[];
  effects: EffectInstance[];
}

export function resolveSettings(
  groups: SettingsGroup[],
  lookupMeta: (id: string) => MetaLookup | undefined
): ResolvedSettings {
  const additionalRuleGroupIds: string[] = [];
  const effects: EffectInstance[] = [];

  for (const group of groups) {
    for (const setting of group.settings) {
      const chosenValue = group.values[setting.id];
      if (!chosenValue) continue;

      if (setting.type === 'select-rule-group') {
        additionalRuleGroupIds.push(chosenValue);
        const meta = lookupMeta(chosenValue);
        if (meta) {
          for (const depId of meta.requires) {
            if (!additionalRuleGroupIds.includes(depId)) {
              additionalRuleGroupIds.push(depId);
            }
          }
        }
      } else if (setting.effect) {
        // The template is an EffectInstance with ${value} placeholders; namespace
        // its id per rule group so re-assigning stays idempotent (dedupe by key).
        const effect = substituteTemplate(setting.effect, chosenValue) as unknown as EffectInstance;
        effect.id = `${group.ruleGroupId}::${effect.id}`;
        effects.push(JSON.parse(JSON.stringify(effect)));
      }
    }
  }

  return { additionalRuleGroupIds, effects };
}

interface SimpleMeta {
  name: string;
  description: string;
  requires: string[];
  settings: SettingDefinition[];
}

export function discoverSettingsSteps(
  ruleGroupIds: string[],
  lookupMeta: (id: string) => SimpleMeta | undefined
): Array<{ ruleGroupId: string; name: string; settings: SettingDefinition[] }> {
  const steps: Array<{
    ruleGroupId: string;
    name: string;
    settings: SettingDefinition[];
  }> = [];
  for (const id of ruleGroupIds) {
    const meta = lookupMeta(id);
    if (meta && meta.settings.length > 0) {
      steps.push({ ruleGroupId: id, name: meta.name, settings: meta.settings });
    }
  }
  return steps;
}
