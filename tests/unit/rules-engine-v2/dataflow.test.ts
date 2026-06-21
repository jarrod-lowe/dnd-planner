import { describe, it, expect } from 'vitest';
import { evaluateSheet } from '$lib/rules-engine-v2';
import type { RuleModule } from '$lib/rules-engine-v2';
import abilityScores from '$lib/rules-engine-v2/rules/ability-scores';
import hp from '$lib/rules-engine-v2/rules/hp';
import paladinLevel1 from '$lib/rules-engine-v2/rules/class-paladin-level1';

/**
 * M0 spike, increment 1 — the dataflow "sheet" pass.
 *
 * This is the central proof that v2 kills *ordering fragility* (pain #1). In v1,
 * `tests/integration/rules-engine/yaml-scenarios/ability-modifier-ordering/`
 * exists ONLY to guard a class of bug where a consumer reads a producer's fact
 * as 0 because standing rules ran in array order with no mutual `after` edge.
 *
 * Here, ordering is derived from fact references, not authored. The modules carry
 * NO `phase` / `group` / `after` — registration order must not matter.
 */
describe('v2 dataflow sheet — ordering is structural, not authored', () => {
  it('resolves hp.max/current with consumers registered BEFORE producers', () => {
    // Deliberately "wrong" order: hp (consumer) and paladin (mid) before
    // ability-scores (producer of con.modifier).
    const modules: RuleModule[] = [hp, paladinLevel1, abilityScores];
    const facts = evaluateSheet(modules, { 'con.value': 14 });

    expect(facts['con.modifier']).toBe(2); // statToModifier(14)
    expect(facts['hp.base.max']).toBe(12); // 10 + con.modifier
    expect(facts['hp.max']).toBe(12);
    expect(facts['hp.current']).toBe(12);
    expect(facts['proficiency.bonus']).toBe(2);
  });

  it('is order-independent (producer-first registration gives the same result)', () => {
    const facts = evaluateSheet([abilityScores, paladinLevel1, hp], { 'con.value': 14 });
    expect(facts['hp.max']).toBe(12);
    expect(facts['hp.current']).toBe(12);
  });

  it('settles ALL contributors to a fact before a dependent reads it (copy-after-settle, free)', () => {
    // Two class levels both summing into hp.base.max; hp.max must see the total.
    // In v1 this needs the hp-total/hp-set/hp-copied three-group dance.
    const secondClass: RuleModule = {
      id: 'second-class',
      derive: () => [
        { fact: 'hp.base.max', combine: 'sum', value: (f) => 6 + f.num('con.modifier') }
      ]
    };
    const facts = evaluateSheet([hp, secondClass, paladinLevel1, abilityScores], {
      'con.value': 14
    });
    expect(facts['hp.base.max']).toBe(20); // (10+2) + (6+2)
    expect(facts['hp.max']).toBe(20);
    expect(facts['hp.current']).toBe(20);
  });

  it('reads an uncontributed fact as 0 (v1 "facts start at zero" parity)', () => {
    const facts = evaluateSheet([hp], {});
    expect(facts['hp.max']).toBe(0);
    expect(facts['hp.current']).toBe(0);
  });

  it('throws on a dependency cycle', () => {
    const a: RuleModule = { id: 'a', derive: () => [{ fact: 'x', value: (f) => f.num('y') }] };
    const b: RuleModule = { id: 'b', derive: () => [{ fact: 'y', value: (f) => f.num('x') }] };
    expect(() => evaluateSheet([a, b], {})).toThrow(/cycle/i);
  });
});
