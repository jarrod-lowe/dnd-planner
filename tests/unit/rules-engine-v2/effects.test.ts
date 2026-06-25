import { describe, it, expect } from 'vitest';
import { evaluateSheet, evaluatePlan, endTurn } from '$lib/rules-engine-v2';
import type { EffectInstance, PlannedRef, RuleModule } from '$lib/rules-engine-v2';

/**
 * M0 spike, increment 3a — declarative effects.
 *
 * Persistence is a value with an expiry, aged at end of turn — not a
 * self-advertising rule. An active effect simply CONTRIBUTES to the sheet (a
 * spent L1 slot adds +1 to `...spent`), so `remaining = max - spent` falls out of
 * the dataflow. This replaces v1's `advertiseEffect self:true` re-advertisement.
 */
const spellcasting: RuleModule = {
  id: 'spellcasting',
  derive: () => [
    { fact: 'spellcasting.slots.level1.max', value: () => 2 },
    {
      fact: 'spellcasting.slots.level1.remaining',
      value: (f) =>
        f.num('spellcasting.slots.level1.max') - f.num('spellcasting.slots.level1.spent')
    }
  ]
};

// Knows how to apply a persisted "slot spent" effect.
const slotSpent: RuleModule = {
  id: 'slot-spent',
  effectContributions: (e) => [
    { fact: `spellcasting.slots.level${e.state!.level}.spent`, combine: 'sum', value: () => 1 }
  ]
};

const longRestSlot = (id: string, level: number): EffectInstance => ({
  id,
  ruleId: 'slot-spent',
  state: { level },
  expiry: { kind: 'untilLongRest' }
});

describe('v2 declarative effects — persistent contributions with expiry', () => {
  const modules = [spellcasting, slotSpent];

  it('an active effect contributes to the sheet while it lives', () => {
    expect(evaluateSheet(modules, {}, [])['spellcasting.slots.level1.remaining']).toBe(2);
    expect(
      evaluateSheet(modules, {}, [longRestSlot('e1', 1)])['spellcasting.slots.level1.remaining']
    ).toBe(1);
    expect(
      evaluateSheet(modules, {}, [longRestSlot('e1', 1), longRestSlot('e2', 1)])[
        'spellcasting.slots.level1.remaining'
      ]
    ).toBe(0);
  });

  it('untilLongRest effects persist across a normal turn and expire on a long rest', () => {
    const committed = [longRestSlot('e1', 1)];

    const afterTurn = endTurn(committed, [], { longRest: false });
    expect(afterTurn).toHaveLength(1);
    expect(evaluateSheet(modules, {}, afterTurn)['spellcasting.slots.level1.remaining']).toBe(1);

    const afterRest = endTurn(committed, [], { longRest: true });
    expect(afterRest).toHaveLength(0);
    expect(evaluateSheet(modules, {}, afterRest)['spellcasting.slots.level1.remaining']).toBe(2);
  });

  it('a planned cast advertises a persistent effect honored on the next turn', () => {
    const caster: RuleModule = {
      id: 'caster',
      offer: () => [
        {
          id: 'cast-l1',
          legalWhen: [
            {
              condition: (f) => f.num('spellcasting.slots.level1.remaining') > 0,
              diagnostics: [{ code: 'no_slot', severity: 'error' }]
            }
          ],
          apply: () => ({ advertise: [longRestSlot('slot:1:x', 1)] })
        }
      ]
    };
    const all = [spellcasting, slotSpent, caster];
    const planned: PlannedRef[] = [{ instanceId: 'c1', ruleId: 'cast-l1' }];

    const { advertised } = evaluatePlan(all, {}, planned);
    expect(advertised).toHaveLength(1);

    const next = endTurn([], advertised, { longRest: false });
    expect(evaluateSheet(all, {}, next)['spellcasting.slots.level1.remaining']).toBe(1);
  });
});
