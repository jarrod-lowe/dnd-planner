import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import { getModule, registeredRuleGroupIds, resolveModules } from '$lib/rules-engine/registry';
import type { EngineInput, EngineOutput, Facts, FactReader } from '$lib/rules-engine';

/**
 * M1 / W3 — purity rails.
 *
 * Rule modules must be deterministic, stateless functions of their facts (this
 * is what keeps the UI's what-if reprocessing valid and lets M2 memoize). We
 * prove it two ways: each module evaluated twice against a fixed reader yields an
 * identical fully-resolved snapshot, and `evaluate()` run twice on the same input
 * yields identical output.
 */

const SAMPLE: Facts = {
  'str.value': 15,
  'dex.value': 14,
  'con.value': 13,
  'con.modifier': 1,
  'actions.spent': 0,
  'bonusActions.spent': 0,
  'spellcasting.spent': 0,
  'spellcasting.slots.level1.total': 2,
  'attack.activation.count': 1,
  'spell.l1.divineSmite.prepared': 1,
  'paladinSmite.total': 1,
  'paladinSmite.spent': 0
};

function reader(facts: Facts): FactReader {
  return {
    num: (n) => facts[n] ?? 0,
    has: (n) => Object.prototype.hasOwnProperty.call(facts, n)
  };
}

/** A fully-evaluated, serializable view of a module against the sample facts. */
function moduleSnapshot(ruleGroupId: string) {
  const m = getModule(ruleGroupId)!;
  const f = reader(SAMPLE);
  const ctx = { selections: {} };
  return {
    derive: (m.derive?.(ctx) ?? []).map((c) => ({
      fact: c.fact,
      combine: c.combine ?? null,
      value: c.value(f)
    })),
    offers: (m.offer?.(ctx) ?? []).map((o) => ({
      id: o.id,
      ui: o.ui ?? null,
      vars: o.vars ?? null,
      when: o.when ? o.when(f) : null,
      legal: (o.legalWhen ?? []).map((g) => g.condition(f)),
      apply: o.apply ? o.apply(f, {}) : null
    })),
    annotations: m.annotate?.(f) ?? []
  };
}

/** The serializable (function-free) part of an EngineOutput. */
function data(out: EngineOutput) {
  return {
    status: out.status,
    facts: out.facts,
    availableRules: out.availableRules,
    planDiagnostics: out.planDiagnostics,
    annotations: out.annotations,
    effects: out.effects,
    diagnostics: out.diagnostics
  };
}

describe('purity', () => {
  it('every registered module is deterministic and stateless', () => {
    for (const id of registeredRuleGroupIds()) {
      expect(moduleSnapshot(id)).toEqual(moduleSnapshot(id));
    }
  });

  it('evaluate() is pure end-to-end across representative inputs', () => {
    const all = resolveModules(registeredRuleGroupIds()).modules;
    const attack = { instanceId: 'a1', ruleId: 'unarmed-strike-use-action' };
    // With every module loaded, slots and smite-prepared are module-contributed
    // (paladin levels, paladin-smite) — the sheet rejects inputs that overlap
    // contributions — so the representative input is a genuine one: a raw
    // ability score (at runtime scores arrive as build effects or inputs).
    const inputs: EngineInput[] = [
      { modules: all, inputFacts: {} },
      {
        modules: all,
        inputFacts: { 'str.value': 15 },
        planned: [attack, { instanceId: 's1', ruleId: 'cast-divine-smite' }]
      }
    ];
    for (const input of inputs) {
      expect(data(evaluate(input))).toEqual(data(evaluate(input)));
    }
  });
});
