/**
 * Pure matching logic for the +ADD panel Quick Search.
 *
 * Operates over normalised options ({@link SearchOption}) so the component can
 * stay thin: it resolves localised name + keyword strings via i18n, then defers
 * all filtering/badging to these functions. Matches return in natural order
 * (no ranking, no ★ LIKELY).
 */

/** Fixed-height results window: 3 rows × 3 columns = 9 visible cells. */
export const CAP = 9;
export const WELL_ROWS = 3;
export const RESULTS_COLUMNS = 3;
/** Open/close cross-fade duration in ms (skipped under prefers-reduced-motion). */
export const REVEAL_MS = 220;

export interface SearchOption {
  id: string;
  name: string;
  /** Space/comma-separated keyword string (localised). May be empty. */
  keywords: string;
}

/** Lowercased "name + keywords" haystack for a single option. */
export function searchText(opt: SearchOption): string {
  return `${opt.name} ${opt.keywords}`.toLowerCase().trim();
}

/** Case-insensitive substring ("contains") test, anywhere in name + keywords. */
export function isMatch(query: string, opt: SearchOption): boolean {
  return searchText(opt).includes(query.toLowerCase());
}

/** Options matching the query, in natural (input) order. */
export function filterMatches(query: string, opts: SearchOption[]): SearchOption[] {
  return opts.filter((opt) => isMatch(query, opt));
}

/** Splits matches into the first {@link CAP} (shown) and the overflow count. */
export function splitShown<T>(matches: T[], cap = CAP): { shown: T[]; overflowCount: number } {
  return {
    shown: matches.slice(0, cap),
    overflowCount: Math.max(0, matches.length - cap)
  };
}

/** Whether appending `letter` to `query` would still yield at least one match. */
export function keyEnabled(query: string, letter: string, opts: SearchOption[]): boolean {
  return opts.some((opt) => isMatch(query + letter, opt));
}

/**
 * The keyword that explains a keyword-only hit, or null.
 * Returns null when the name itself contains the query (no badge needed).
 */
export function whyBadge(query: string, opt: SearchOption): string | null {
  if (opt.name.toLowerCase().includes(query.toLowerCase())) return null;
  const q = query.toLowerCase();
  const tokens = opt.keywords.split(/[\s,]+/).filter(Boolean);
  return tokens.find((token) => token.toLowerCase().includes(q)) ?? null;
}
