import { describe, it, expect } from 'vitest';
import type { Offer, RuleModule } from '$lib/rules-engine';
import conditionBlinded from '$lib/rules-engine/rules/condition-blinded';
import conditionCharmed from '$lib/rules-engine/rules/condition-charmed';
import conditionDeafened from '$lib/rules-engine/rules/condition-deafened';
import conditionExhaustion from '$lib/rules-engine/rules/condition-exhaustion';
import conditionFrightened from '$lib/rules-engine/rules/condition-frightened';
import conditionGrappled from '$lib/rules-engine/rules/condition-grappled';
import conditionIncapacitated from '$lib/rules-engine/rules/condition-incapacitated';
import conditionInvisible from '$lib/rules-engine/rules/condition-invisible';
import conditionParalyzed from '$lib/rules-engine/rules/condition-paralyzed';
import conditionPetrified from '$lib/rules-engine/rules/condition-petrified';
import conditionPoisoned from '$lib/rules-engine/rules/condition-poisoned';
import conditionProne from '$lib/rules-engine/rules/condition-prone';
import conditionRestrained from '$lib/rules-engine/rules/condition-restrained';
import conditionStunned from '$lib/rules-engine/rules/condition-stunned';
import conditionUnconscious from '$lib/rules-engine/rules/condition-unconscious';

/**
 * The CONDITION verb's sub-bucket taxonomy — five functional buckets, not one
 * per condition (user-directed 2026-09-29). One bucket per condition put 15
 * labelled lines in the OR INSTEAD strip, each label restating the single
 * button inside it. The consolidation and its grounding:
 *
 *  - `senses`   — Blinded, Deafened, Invisible: pure perception states
 *                 (Invisible is the mechanical mirror of Blinded).
 *  - `held`     — Prone (both offers), Grappled, Restrained: position/speed
 *                 states — Speed 0 or on the floor.
 *  - `helpless` — Incapacitated plus Paralyzed, Petrified, Stunned, Knocked
 *                 Unconscious and its end-offer: the SRD 5.2 incapacitation
 *                 family (each of those conditions carries the literal
 *                 "Incapacitated. You have the Incapacitated condition."
 *                 bullet — docs/srd52.txt).
 *  - `compelled`— Charmed, Frightened: mind influence anchored to a source
 *                 creature (the charmer / the source of fear).
 *  - `weakened` — Poisoned, Exhaustion: physical malaise, actions intact.
 *
 * Regain Consciousness STAYS in the list (user decision): every same-verb
 * offer is swappable, illegal ones carry their tag. Get Up is a MOVE: rise
 * offer and deliberately absent here — adding a CONDITION intent to it fails
 * the exact-set assertion below.
 *
 * This pins the module side (the slug every condition offer declares);
 * `intent-bucket-coverage.test.ts` already forces both locales to label
 * whatever slugs exist, and `groupChoicesByVerb.test.ts` pins the display
 * order.
 */
const EXPECTED: Record<string, Record<string, string>> = {
  'condition-blinded': { 'record-blinded': 'senses' },
  'condition-deafened': { 'record-deafened': 'senses' },
  'condition-invisible': { 'record-invisible': 'senses' },
  'condition-prone': { 'record-prone': 'held', 'drop-prone': 'held' },
  'condition-grappled': { 'record-grappled': 'held' },
  'condition-restrained': { 'record-restrained': 'held' },
  'condition-incapacitated': { 'record-incapacitated': 'helpless' },
  'condition-paralyzed': { 'record-paralyzed': 'helpless' },
  'condition-petrified': { 'record-petrified': 'helpless' },
  'condition-stunned': { 'record-stunned': 'helpless' },
  'condition-unconscious': {
    'record-unconscious': 'helpless',
    'regain-consciousness': 'helpless'
  },
  'condition-charmed': { 'record-charmed': 'compelled' },
  'condition-frightened': { 'record-frightened': 'compelled' },
  'condition-poisoned': { 'record-poisoned': 'weakened' },
  'condition-exhaustion': { 'record-exhaustion': 'weakened' }
};

const MODULES: Record<string, RuleModule> = {
  'condition-blinded': conditionBlinded,
  'condition-charmed': conditionCharmed,
  'condition-deafened': conditionDeafened,
  'condition-exhaustion': conditionExhaustion,
  'condition-frightened': conditionFrightened,
  'condition-grappled': conditionGrappled,
  'condition-incapacitated': conditionIncapacitated,
  'condition-invisible': conditionInvisible,
  'condition-paralyzed': conditionParalyzed,
  'condition-petrified': conditionPetrified,
  'condition-poisoned': conditionPoisoned,
  'condition-prone': conditionProne,
  'condition-restrained': conditionRestrained,
  'condition-stunned': conditionStunned,
  'condition-unconscious': conditionUnconscious
};

/** offer.id → CONDITION sub-bucket for every offer that declares one. */
function conditionIntents(m: RuleModule): Record<string, string> {
  const found: Record<string, string> = {};
  for (const offer of (m.offer ? m.offer({ selections: {} }) : []) as Offer[]) {
    const intents = (offer.ui as Record<string, unknown> | undefined)?.intents as
      | Record<string, unknown>
      | undefined;
    const bucket = intents?.CONDITION;
    if (typeof bucket === 'string') found[offer.id] = bucket;
  }
  return found;
}

describe('CONDITION verb buckets — the five-bucket taxonomy', () => {
  it.each(Object.keys(EXPECTED))('%s declares exactly the expected offers and slugs', (id) => {
    expect(conditionIntents(MODULES[id])).toEqual(EXPECTED[id]);
  });

  it('the taxonomy is exactly five buckets — no condition offers a sixth slug', () => {
    const slugs = new Set<string>();
    for (const m of Object.values(MODULES)) {
      for (const slug of Object.values(conditionIntents(m))) slugs.add(slug);
    }
    expect(slugs).toEqual(new Set(['senses', 'held', 'helpless', 'compelled', 'weakened']));
  });
});
