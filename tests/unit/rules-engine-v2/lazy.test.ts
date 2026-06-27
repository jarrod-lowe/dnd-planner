import { describe, it, expect } from 'vitest';
import { loadModules, lazyRuleGroupIds, ENGINE_API_VERSION, evaluate } from '$lib/rules-engine-v2';
import { registeredRuleGroupIds } from '$lib/rules-engine-v2/registry';

/**
 * M2 / W3 — lazy chunk loading + version gate.
 *
 * `loadModules` resolves canonical rule-group ids to modules via per-id dynamic
 * imports (Vite code-splits each into its own chunk). It loads only what's asked
 * for, preserves order, reports unknown ids, and gates on engine compatibility.
 * The loaded modules drop straight into the sync, pure `evaluate`.
 */
describe('v2 lazy module loading', () => {
  it('loads a chunk by id and the module runs through evaluate', async () => {
    const { modules, missing, incompatible } = await loadModules([
      'spellcasting',
      'class-paladin-level1'
    ]);
    expect(missing).toEqual([]);
    expect(incompatible).toEqual([]);
    expect(modules.map((m) => m.id)).toEqual(['spellcasting', 'class-paladin-level1']);

    const out = evaluate({ modules, ruleGroupIds: ['spellcasting'] });
    expect(out.facts['spellcasting.slots.level1.remaining']).toBe(2);
  });

  it('reports unknown ids as missing without throwing', async () => {
    const { modules, missing } = await loadModules(['not-ported']);
    expect(modules).toEqual([]);
    expect(missing).toEqual(['not-ported']);
  });

  it('gates on engineApiVersion: a skewed chunk is reported incompatible, not loaded', async () => {
    const { modules, incompatible } = await loadModules(['spell-divine-smite'], {
      'spell-divine-smite': ENGINE_API_VERSION + 1
    });
    expect(modules).toEqual([]);
    expect(incompatible).toEqual(['spell-divine-smite']);
  });

  it('loads when the reported version matches the engine', async () => {
    const { modules, incompatible } = await loadModules(['spell-divine-smite'], {
      'spell-divine-smite': ENGINE_API_VERSION
    });
    expect(incompatible).toEqual([]);
    expect(modules.map((m) => m.id)).toEqual(['spell-divine-smite']);
  });

  it('preserves requested order', async () => {
    const { modules } = await loadModules(['spell-divine-smite', 'ability-scores']);
    expect(modules.map((m) => m.id)).toEqual(['spell-divine-smite', 'ability-scores']);
  });

  it('the lazy loader and the static registry cover the same rule-group ids', () => {
    expect(lazyRuleGroupIds().slice().sort()).toEqual(registeredRuleGroupIds().slice().sort());
  });
});
