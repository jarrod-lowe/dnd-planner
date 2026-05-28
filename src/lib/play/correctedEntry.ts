import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

export function correctEntryForPlanItem(
  entry: AvailableRuleEntry,
  item: { rule: Rule }
): AvailableRuleEntry {
  const errors = (item.rule.varsRuntime?.errors as string[] | undefined) || [];
  const hasErrors = errors.length > 0;

  return {
    ...entry,
    legal: hasErrors ? false : entry.legal,
    diagnostics: hasErrors
      ? errors.map((code) => ({ code, severity: 'error' as const }))
      : entry.diagnostics
  };
}
