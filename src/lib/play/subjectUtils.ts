import type { Rule } from '$lib/rules-engine';

/**
 * Extracts the subject from a rule's ui config.
 * Returns undefined for player rules (the default).
 * Returns the subject string for companion rules (e.g., 'steed').
 */
export function getSubject(rule: Rule): string | undefined {
  const ui = rule.ui as Record<string, unknown> | undefined;
  if (!ui) return undefined;
  const subject = ui.subject;
  return typeof subject === 'string' ? subject : undefined;
}
