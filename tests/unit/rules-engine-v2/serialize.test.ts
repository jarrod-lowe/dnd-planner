import { describe, it, expect } from 'vitest';
import { evaluate, serializeInput, resolveInput, resolveModules } from '$lib/rules-engine-v2';
import type { EngineInput, SerializableInput } from '$lib/rules-engine-v2';

/**
 * M2 / W1 — serializable engine input (#355 carry-over).
 *
 * A turn must persist and replay as data: modules carry functions and don't
 * survive JSON, so a turn travels as `ruleGroupIds` + facts/planned/committed.
 * `serializeInput` strips the modules; `resolveInput` rehydrates them via the
 * registry. `evaluate` stays pure and registry-free; resolution is the explicit
 * boundary.
 */
const IDS = ['dnd-5e-2024/spellcasting', 'class-paladin/class-paladin-level1'];

function fromIds(): EngineInput {
  return { ...resolveInput({ ruleGroupIds: IDS }) };
}

describe('v2 serializable input', () => {
  it('round-trips a turn through JSON and reproduces the same facts', () => {
    const direct = fromIds();
    const out = evaluate(direct);

    // Persist -> JSON -> rehydrate -> evaluate.
    const json = JSON.stringify(serializeInput(out.next));
    const replayed = resolveInput(JSON.parse(json) as SerializableInput);
    const out2 = evaluate(replayed);

    expect(out2.facts).toEqual(out.facts);
    // A paladin L1: one spell/turn, two L1 slots — proves real resolution.
    expect(out2.facts['spellcasting.slots.level1.remaining']).toBe(2);
    expect(out2.facts['spellcasting.remaining']).toBe(1);
  });

  it('serializeInput produces JSON-safe data (no functions survive needed)', () => {
    const serialized = serializeInput(fromIds());
    expect(serialized.ruleGroupIds).toEqual(IDS);
    expect(JSON.parse(JSON.stringify(serialized))).toEqual(serialized);
  });

  it('evaluate echoes ruleGroupIds into next for replay-by-id', () => {
    const out = evaluate(fromIds());
    expect(out.next.ruleGroupIds).toEqual(IDS);
  });

  it('refuses to serialize a modules-only input (no provenance)', () => {
    const { modules } = resolveModules(IDS);
    expect(() => serializeInput({ modules })).toThrow(/ruleGroupIds/);
  });

  it('resolveInput drops unported ids leniently', () => {
    const input = resolveInput({ ruleGroupIds: ['dnd-5e-2024/spellcasting', 'spells/not-ported'] });
    expect(input.modules.map((m) => m.id)).toEqual(['spellcasting']);
    expect(input.ruleGroupIds).toEqual(['dnd-5e-2024/spellcasting', 'spells/not-ported']);
  });
});
