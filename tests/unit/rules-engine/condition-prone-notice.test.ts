import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import type { Facts, PlannedRef } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';
import speciesHuman from '$lib/rules-engine/rules/species-human';
import movement from '$lib/rules-engine/rules/movement';
import conditionProne from '$lib/rules-engine/rules/condition-prone';

/**
 * The Prone notice's Get Up sentence (docs/plans/ideas/condition-prone.md):
 * the standing-effects body interpolates the live cost — half your SPEED,
 * floored (`character.movement.half_speed`), NOT half of movement.total, so
 * dashing never raises the quoted figure. The YAML runner's annotation
 * grammar can assert existence/targets but not `values`, so the interpolated
 * cost is pinned here against the module's annotate output, and the body
 * templates are pinned to exactly one `{{cost}}` param in both locales (the
 * hold-person double-brace syntax).
 */
const CP = 'rule.dnd-5e-2024.condition-prone';
const ALL = [speciesHuman, movement, conditionProne];
const FACTS: Facts = {};
const record = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'record-prone' });

type GroupNode = Record<string, string | undefined>;
type CategoryNode = Record<string, GroupNode>;

const bodyOf = (catalog: unknown): string | undefined =>
  ((catalog as { rule: Record<string, CategoryNode> }).rule['dnd-5e-2024'] ?? {})[
    'condition-prone'
  ]?.['notice.body'];

describe('condition-prone annotate — notice Get Up cost', () => {
  it('carries the floored half-Speed cost as the notice body interpolation value', () => {
    const out = evaluate({ modules: ALL, inputFacts: FACTS, planned: [record('c1')] });
    expect(out.facts['condition.prone'], 'prone in this state').toBe(1);
    expect(out.facts['character.movement.half_speed']).toBe(15);
    const notice = out.annotations.find((a) => a.key === `${CP}.notice`);
    expect(notice, 'notice exists while prone').toBeDefined();
    expect(notice!.targets).toEqual([NOTICE_TARGET]);
    expect(notice!.values, 'the body interpolates the live Get Up cost').toEqual({ cost: 15 });
  });

  it('the body template interpolates only the cost — in both locales', () => {
    for (const catalog of [enCommon, tlhCommon]) {
      const body = bodyOf(catalog);
      expect(body, 'body template exists').toBeDefined();
      // {{cost}} double-brace (sveltekit-i18n), and it is the ONLY param.
      expect(body?.match(/{{[a-zA-Z]+}}/g)).toEqual(['{{cost}}']);
    }
  });
});
