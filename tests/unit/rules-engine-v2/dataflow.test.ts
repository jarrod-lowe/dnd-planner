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

  it('records input-driven conditional dependencies (pull-based, not probe)', () => {
    // `out` reads `a` only when input `useA` is truthy; `a` is contributed by a
    // module registered AFTER the consumer. Probe-based discovery (zero-valued)
    // would take the else branch and miss the dep on `a`, then read it as 0.
    const consumer: RuleModule = {
      id: 'consumer',
      derive: () => [{ fact: 'out', value: (f) => (f.num('useA') ? f.num('a') : 0) }]
    };
    const producer: RuleModule = {
      id: 'producer',
      derive: () => [{ fact: 'a', value: () => 42 }]
    };
    expect(evaluateSheet([consumer, producer], { useA: 1 })['out']).toBe(42);
    expect(evaluateSheet([consumer, producer], { useA: 0 })['out']).toBe(0);
  });

  it('rejects duplicate override writers to the same fact (order-independence guard)', () => {
    const a: RuleModule = { id: 'a', derive: () => [{ fact: 'x', value: () => 1 }] };
    const b: RuleModule = { id: 'b', derive: () => [{ fact: 'x', value: () => 2 }] };
    expect(() => evaluateSheet([a, b], {})).toThrow(/override/i);
  });

  it('rejects conflicting combine modes for the same fact', () => {
    const a: RuleModule = {
      id: 'a',
      derive: () => [{ fact: 'x', combine: 'sum', value: () => 1 }]
    };
    const b: RuleModule = {
      id: 'b',
      derive: () => [{ fact: 'x', combine: 'max', value: () => 2 }]
    };
    expect(() => evaluateSheet([a, b], {})).toThrow(/combine mode/i);
  });

  // v1 parity: statToModifierHandler returns 0 for an undefined (unset) score, so
  // an unset ability modifier must be 0 — not statToModifier(0) = -5. The
  // ability-score-set scenario asserts str.modifier: 0 before a score is chosen.
  it('keeps unset ability modifiers at 0 (undefined -> 0, not -5)', () => {
    const facts = evaluateSheet([abilityScores], {}); // no scores set
    for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      expect(facts[`${a}.modifier`]).toBe(0);
    }
  });

  it('derives a set ability modifier', () => {
    expect(evaluateSheet([abilityScores], { 'str.value': 16 })['str.modifier']).toBe(3);
    expect(evaluateSheet([abilityScores], { 'int.value': 8 })['int.modifier']).toBe(-1);
  });

  it('an unset CON keeps hp.base.max at the class base (10), not 5', () => {
    const facts = evaluateSheet([hp, paladinLevel1, abilityScores], {});
    expect(facts['con.modifier']).toBe(0);
    expect(facts['hp.base.max']).toBe(10);
    expect(facts['hp.max']).toBe(10);
  });

  it('throws on a dependency cycle', () => {
    const a: RuleModule = { id: 'a', derive: () => [{ fact: 'x', value: (f) => f.num('y') }] };
    const b: RuleModule = { id: 'b', derive: () => [{ fact: 'y', value: (f) => f.num('x') }] };
    expect(() => evaluateSheet([a, b], {})).toThrow(/cycle/i);
  });

  // Inputs are pre-settled sources with no contributor (the evaluateSheet
  // contract). Settling used to silently replace an input with the combined
  // contributions when both existed — now the overlap fails loudly.
  it('throws when a module contributes to an input fact (inputs are not contributions)', () => {
    const m: RuleModule = {
      id: 'clobberer',
      derive: () => [{ fact: 'str.value', combine: 'sum', value: () => 1 }]
    };
    expect(() => evaluateSheet([m], { 'str.value': 15 })).toThrow(
      /input fact "str\.value".*clobberer/i
    );
  });

  it('throws when an effect contributes to an input fact', () => {
    expect(() =>
      evaluateSheet([], { 'hp.temp': 3 }, [
        { id: 'aid', state: { 'hp.temp': 5 }, expiry: { kind: 'permanent' } }
      ])
    ).toThrow(/input fact "hp\.temp"/i);
  });
});
