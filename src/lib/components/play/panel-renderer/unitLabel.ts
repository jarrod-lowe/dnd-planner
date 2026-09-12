/**
 * Translate a rule-authored unit token (e.g. `unit: 'hp'`, `unit: 'ft'`) to
 * its localized display label, under the `play.units.<token>` namespace.
 *
 * Rules keep their literal unit tokens on the data — see `core-events.ts`,
 * `movement.ts`, `find-steed.ts`, etc. — translation happens at the render
 * edge, here, never on the rule. This is the shared entry point for every
 * renderer that concatenates a `control.unit` (or equivalent) token into
 * display text; a caller that only has the key (not `$t` itself) can also
 * build it directly as `` `play.units.${token}` `` and check for the same
 * missing-key fallback below.
 *
 * sveltekit-i18n echoes an unresolved key back verbatim — translating an
 * unauthored token such as "lb" would render the raw dotted key path
 * ("play.units.lb") straight to the player. Detect that and fall back to
 * the token itself instead — the same `resolved === key` idiom
 * `QuickSearch.svelte`'s `resolveKeywords` already uses for the same class
 * of missing-key problem.
 */
export function unitLabel(t: (key: string) => string, token: string | undefined): string {
  if (!token) return '';
  const key = `play.units.${token}`;
  const translated = t(key);
  return translated === key ? token : translated;
}
