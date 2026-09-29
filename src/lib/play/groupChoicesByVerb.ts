import type { AvailableRuleEntry, Verb } from '$lib/rules-view';
import { deriveVerbFromRule } from './stepUtils';
import { SUB_BUCKET_ORDER, VERB_ORDER } from './verbConfig';

export interface VerbGroup {
  verb: Verb;
  entries: AvailableRuleEntry[];
  subBuckets: Map<string, AvailableRuleEntry[]>;
}

/**
 * Re-orders a verb's sub-buckets so a pinned taxonomy (SUB_BUCKET_ORDER) leads
 * in its curated order and every unpinned bucket follows in first-encounter
 * order. The display order contract: both the OR INSTEAD strip (PlanRow groups
 * its alternatives by first encounter over `entries`) and the picker iterate
 * what this function produces, so pinning the order here pins it everywhere.
 */
function orderBuckets(
  verb: Verb,
  buckets: Map<string, AvailableRuleEntry[]>
): Map<string, AvailableRuleEntry[]> {
  const pinned = SUB_BUCKET_ORDER[verb];
  if (!pinned) return buckets;
  const ordered = new Map<string, AvailableRuleEntry[]>();
  for (const slug of pinned) {
    const bucketEntries = buckets.get(slug);
    if (bucketEntries) ordered.set(slug, bucketEntries);
  }
  for (const [slug, bucketEntries] of buckets) {
    if (!ordered.has(slug)) ordered.set(slug, bucketEntries);
  }
  return ordered;
}

/**
 * Groups available rule entries by verb (from ui.intents or section-based fallback),
 * then organizes into sub-buckets within each verb.
 *
 * @param entries - Flat list of available rule entries
 * @param verbOrder - Array defining the order of verbs in the picker
 * @returns Array of verb groups, ordered by verbOrder
 */
export function groupChoicesByVerb(
  entries: AvailableRuleEntry[],
  verbOrder: Verb[] = VERB_ORDER
): VerbGroup[] {
  if (entries.length === 0) {
    return [];
  }

  // Build verb → subBucket → entries[] map
  const verbMap = new Map<Verb, Map<string, AvailableRuleEntry[]>>();

  for (const entry of entries) {
    const verb = deriveVerbFromRule(entry.rule);
    const subBucket = getSubBucket(entry.rule, verb);

    if (!verbMap.has(verb)) {
      verbMap.set(verb, new Map());
    }
    const bucketMap = verbMap.get(verb)!;
    if (!bucketMap.has(subBucket)) {
      bucketMap.set(subBucket, []);
    }
    bucketMap.get(subBucket)!.push(entry);
  }

  // Build ordered groups
  const groups: VerbGroup[] = [];
  for (const verb of verbOrder) {
    const bucketMap = verbMap.get(verb);
    if (!bucketMap) continue;
    const orderedBuckets = orderBuckets(verb, bucketMap);
    const allEntries: AvailableRuleEntry[] = [];
    for (const bucketEntries of orderedBuckets.values()) {
      allEntries.push(...bucketEntries);
    }
    groups.push({ verb, entries: allEntries, subBuckets: orderedBuckets });
  }

  return groups;
}

/**
 * Returns the sub-bucket label for a rule under a given verb.
 * Extracts from ui.intents[verb], falls back to "default".
 */
export function getSubBucket(rule: AvailableRuleEntry['rule'], verb: Verb): string {
  const ui = rule.ui as Record<string, unknown> | undefined;
  if (ui?.intents && typeof ui.intents === 'object') {
    const intents = ui.intents as Record<string, unknown>;
    const bucket = intents[verb];
    if (typeof bucket === 'string') return bucket;
  }
  return 'default';
}

/**
 * Finds a default entry for a given verb — the first entry matching the verb.
 * Returns null if no entries exist for the verb.
 */
export function findDefaultEntryForVerb(
  entries: AvailableRuleEntry[],
  verb: Verb
): AvailableRuleEntry | null {
  let firstForVerb: AvailableRuleEntry | null = null;
  for (const entry of entries) {
    if (deriveVerbFromRule(entry.rule) === verb) {
      if (entry.legal) return entry;
      if (!firstForVerb) firstForVerb = entry;
    }
  }
  return firstForVerb;
}

/**
 * Gets the i18n key for a verb's display label.
 */
export function verbLabelKey(verb: Verb): string {
  return `play.verbs.${verb}`;
}

/**
 * Gets the i18n key for a sub-bucket's display label.
 */
export function subBucketLabelKey(verb: Verb, bucket: string): string {
  return `play.verbBuckets.${verb}.${bucket}`;
}
