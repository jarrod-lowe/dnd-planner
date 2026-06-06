import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

export function correctEntryForPlanItem(
  entry: AvailableRuleEntry,
  item: { rule: Rule }
): AvailableRuleEntry {
  const varsRuntime = item.rule.varsRuntime;
  const errors = (varsRuntime?.errors as string[] | undefined) ?? [];
  const hasErrors = errors.length > 0;

  // When a rule has error tracking (indicated by varsRuntime having an 'errors'
  // key, which is set by the *error-clear activity), trust it as the authority
  // for per-item legality. This handles the case where two instances of the
  // same rule both consume a shared resource: the first succeeds (empty errors
  // → legal), the second overconsumes (non-empty errors → illegal).
  const hasErrorTracking = varsRuntime !== undefined && 'errors' in varsRuntime;

  if (hasErrorTracking) {
    return {
      ...entry,
      legal: !hasErrors,
      diagnostics: hasErrors
        ? errors.map((code) => ({ code, severity: 'error' as const }))
        : entry.diagnostics
    };
  }

  return {
    ...entry,
    legal: hasErrors ? false : entry.legal,
    diagnostics: hasErrors
      ? errors.map((code) => ({ code, severity: 'error' as const }))
      : entry.diagnostics
  };
}
