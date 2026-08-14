import { describe, it, expect } from 'vitest';
import { getModule, registeredRuleGroupIds } from '$lib/rules-engine/registry';
import type { Offer, RuleModule } from '$lib/rules-engine';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * Every offer declares `ui.intents` as verb → sub-bucket (e.g. `{ SAVE: 'steed' }`),
 * and the picker renders that bucket's heading via
 * `play.verbBuckets.<verb>.<bucket>` (groupChoicesByVerb.ts). A bucket with no
 * key renders the raw key string to the player, and nothing else catches it —
 * `stat-verb-buckets.test.ts` asserts a hand-written list, so it only covers the
 * buckets someone remembered. This enumerates what the modules actually declare.
 */
function offersOf(m: RuleModule): Offer[] {
  return m.offer ? m.offer({ selections: {} }) : [];
}

function declaredBuckets(): { verb: string; bucket: string; ruleId: string }[] {
  const found: { verb: string; bucket: string; ruleId: string }[] = [];
  for (const id of registeredRuleGroupIds()) {
    const m = getModule(id);
    if (!m) continue;
    for (const offer of offersOf(m)) {
      const intents = (offer.ui as Record<string, unknown> | undefined)?.intents;
      if (!intents || typeof intents !== 'object') continue;
      for (const [verb, bucket] of Object.entries(intents as Record<string, unknown>)) {
        if (typeof bucket === 'string') found.push({ verb, bucket, ruleId: offer.id });
      }
    }
  }
  return found;
}

function missingIn(locale: Record<string, unknown>): string[] {
  const play = (locale as { play?: Record<string, unknown> }).play ?? {};
  const buckets = (play.verbBuckets ?? {}) as Record<string, Record<string, unknown>>;
  const missing = new Set<string>();
  for (const { verb, bucket, ruleId } of declaredBuckets()) {
    if (buckets[verb]?.[bucket] === undefined) {
      missing.add(`play.verbBuckets.${verb}.${bucket} (declared by ${ruleId})`);
    }
  }
  return [...missing].sort();
}

describe('intent sub-bucket i18n coverage', () => {
  it('every bucket a module declares has an en label', () => {
    const missing = missingIn(en as unknown as Record<string, unknown>);
    expect(missing, `missing en labels: ${missing.join(', ')}`).toEqual([]);
  });

  it('every bucket a module declares has an en-x-tlh label', () => {
    const missing = missingIn(tlh as unknown as Record<string, unknown>);
    expect(missing, `missing en-x-tlh labels: ${missing.join(', ')}`).toEqual([]);
  });
});
