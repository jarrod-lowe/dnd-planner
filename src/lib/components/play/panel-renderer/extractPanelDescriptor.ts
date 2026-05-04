import type { Rule } from '$lib/rules-engine';
import type { PanelDescriptor } from './types';

export function extractPanelDescriptor(rule: Rule): PanelDescriptor {
  const ui = rule.ui ?? {};
  return {
    section: ui.section as string | undefined,
    name: ui.name as string | undefined,
    primaryControl: ui.primaryControl as PanelDescriptor['primaryControl'],
    secondaryControl: ui.secondaryControl as PanelDescriptor['secondaryControl'],
    information: ui.information as PanelDescriptor['information'],
    followups: ui.followups as PanelDescriptor['followups']
  };
}
