import { describe, it, expect } from 'vitest';
import {
  getModule,
  resolveModules,
  isRegistered,
  registeredRuleGroupIds
} from '$lib/rules-engine/registry';
import divineSmite from '$lib/rules-engine/rules/divine-smite';

/**
 * M1 / W2 — the rule-group-id -> module registry. Keyed by the canonical bare id
 * (= each module's `id`), the same id namespace the backend uses.
 *
 * The parity harness (W5) and, later, the app resolve groups to rule modules by id.
 * M1 ships a static map; M2 swaps in lazy chunks.
 */
describe('registry', () => {
  it('resolves a known rule-group id to its module', () => {
    expect(getModule('spell-divine-smite')).toBe(divineSmite);
    expect(isRegistered('spell-divine-smite')).toBe(true);
  });

  it('reports unknown ids as unregistered', () => {
    expect(getModule('does-not-exist')).toBeUndefined();
    expect(isRegistered('does-not-exist')).toBe(false);
  });

  it('resolves a list of ids to modules, in order, skipping unported ones', () => {
    const { modules, missing } = resolveModules([
      'ability-scores',
      'not-ported-yet',
      'spell-divine-smite'
    ]);
    expect(modules.map((m) => m.id)).toEqual(['ability-scores', 'spell-divine-smite']);
    expect(missing).toEqual(['not-ported-yet']);
  });

  it('registry keys equal the canonical module ids', () => {
    const ids = registeredRuleGroupIds();
    expect(ids).toContain('attacks');
    expect(ids).toContain('spell-divine-smite');
    for (const id of ids) expect(getModule(id)!.id).toBe(id);
  });
});
