/** A translate function shaped like sveltekit-i18n's `$t` store value. */
type Translate = (key: string, params?: Record<string, string>) => string;

/**
 * Compose a rule-authored unit token (e.g. `unit: 'hp'`, `unit: 'ft'`) and a
 * numeric value into its localized display text, under the
 * `play.units.<token>` namespace.
 *
 * Rules keep their literal unit tokens on the data — see `core-events.ts`,
 * `movement.ts`, `find-steed.ts`, etc. — translation happens at the render
 * edge, here, never on the rule. This is the shared entry point for every
 * renderer that joins a `control.unit` (or equivalent) token to a value for
 * display.
 *
 * The composition — whether (and where) a space sits between the number and
 * the unit word — is itself locale-dependent, so it lives IN the pattern
 * (`play.units.<token>` is `"{{value}} ft"`, not the bare word "ft"), never
 * in the caller as a hardcoded template literal. That is the fix for the
 * defect this replaces: `en-x-tlh`'s `ft` reads "qam", a standalone word
 * elsewhere in that locale (see the movement rules' descriptions), so it
 * needs the same `"{{value}} qam"` spacing every other unit gets — a caller
 * that instead did `` `${value}${unitWord}` `` in code had no way to know
 * that, and rendered "5qam" in that locale.
 *
 * `options.compact` selects an alternate pattern under
 * `play.units.compact.<token>`, falling back to the default pattern when no
 * override is authored for that token. This exists because English itself
 * is inconsistent about the very same token: a dice-line's distance reads
 * tight ("5ft", the tabletop-shorthand convention for a range band) while a
 * slider or hit-dice pool spells it out ("20 ft", "18 HP") — two authored
 * conventions for the same word, not two different words, so it can't be
 * captured by the token alone. A locale with no reason to draw that
 * distinction (en-x-tlh: "qam" is spaced either way) just repeats the same
 * pattern under both keys — see the locale files.
 *
 * sveltekit-i18n echoes an unresolved key back verbatim — translating an
 * unauthored token such as "lb" would render the raw dotted key path
 * ("play.units.lb") straight to the player. Detect that and fall back to a
 * plain "<value> <token>" concatenation instead — the same `resolved ===
 * key` idiom `QuickSearch.svelte`'s `resolveKeywords` already uses for the
 * same class of missing-key problem.
 */
export function formatUnitValue(
  t: Translate,
  token: string | undefined,
  value: number | string,
  options?: { compact?: boolean }
): string {
  if (!token) return String(value);
  const params = { value: String(value) };
  if (options?.compact) {
    const compactKey = `play.units.compact.${token}`;
    const compact = t(compactKey, params);
    if (compact !== compactKey) return compact;
  }
  const key = `play.units.${token}`;
  const resolved = t(key, params);
  if (resolved !== key) return resolved;
  return `${value} ${token}`.trim();
}

/**
 * The bare unit word alone, with no value attached — for a render site (the
 * dice roll toast) that lays out its own number separately and only needs
 * the localized unit word beside it. Built on `formatUnitValue` so there
 * remains exactly one place that resolves a unit token to text: this is
 * that same composition with an empty value, trimmed of whatever
 * leading/trailing space the pattern put around the (now-empty)
 * placeholder — which works regardless of where in the pattern `{{value}}`
 * sits.
 */
export function unitLabel(t: Translate, token: string | undefined): string {
  return formatUnitValue(t, token, '').trim();
}
