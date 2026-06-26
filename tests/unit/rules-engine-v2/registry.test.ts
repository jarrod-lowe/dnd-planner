import { describe, it, expect } from 'vitest';
import {
  getModule,
  resolveModules,
  isRegistered,
  registeredRuleGroupIds
} from '$lib/rules-engine-v2/registry';
import divineSmite from '$lib/rules-engine-v2/rules/divine-smite';

/**
 * M1 / W2 — the rule-group-id -> module registry.
 *
 * The parity harness (W5) and, later, the app resolve a scenario's `ruleGroups`
 * list to v2 modules by id. M1 ships a static map; M2 swaps in lazy chunks.
 */
describe('v2 registry', () => {
  it('resolves a known rule-group id to its module', () => {
    expect(getModule('spells/spell-divine-smite')).toBe(divineSmite);
    expect(isRegistered('spells/spell-divine-smite')).toBe(true);
  });

  it('reports unknown ids as unregistered', () => {
    expect(getModule('spells/does-not-exist')).toBeUndefined();
    expect(isRegistered('spells/does-not-exist')).toBe(false);
  });

  it('resolves a list of ids to modules, in order, skipping unported ones', () => {
    const { modules, missing } = resolveModules([
      'dnd-5e-2024/ability-scores',
      'spells/not-ported-yet',
      'spells/spell-divine-smite'
    ]);
    expect(modules.map((m) => m.id)).toEqual(['ability-scores', 'spell-divine-smite']);
    expect(missing).toEqual(['spells/not-ported-yet']);
  });

  it('every registered id maps to a module whose ported set is non-empty', () => {
    const ids = registeredRuleGroupIds();
    expect(ids).toContain('dnd-5e-2024/attacks');
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(getModule(id)).toBeDefined();
  });
});
