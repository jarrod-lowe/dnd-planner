import { describe, it, expect } from 'vitest';
import { evaluatePlan, evaluateOffers } from '$lib/rules-engine';
import type { PlannedRef, RuleModule } from '$lib/rules-engine';
import coreEvents from '$lib/rules-engine/rules/core-events';
import conditionRestrained from '$lib/rules-engine/rules/condition-restrained';
import { resolveValueSource } from '$lib/components/play/panel-renderer/resolveValueSource';

/**
 * Restrained — Saving Throws Affected reaches the six core-events save
 * recorders (the wiring this condition ships): every saveOffer primaryControl
 * carries `advantage: { fact: 'save.<ability>.disadvantage' }` at the CONTROL
 * level (the skill-checks/attacks/record-check idiom), which PanelDiceLine
 * resolves truthy → default roll mode 'disadvantage' (per-die manual override
 * still wins — component behaviour, pinned there, not here). Restrained only
 * writes the DEX fact today; the other five sources are dead wiring until
 * future writers (leather-armor-style derivers, wave 5) land — accepted, and
 * pinned here so the shape cannot silently drift meanwhile. The yaml grammar
 * cannot assert control payloads, so this unit test is the roller pin.
 */
const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

/** Offers evaluated against a plan whose only row is "record being Restrained". */
const offersWhenRestrained = (mods: RuleModule[]) => {
  const facts = evaluatePlan(mods, {}, [ref('i0', 'record-restrained')]).facts;
  expect(facts['condition.restrained']).toBe(1);
  return { facts, offers: evaluateOffers(mods, facts) };
};

describe('condition-restrained — the six save recorders read the save-disadvantage flags', () => {
  it('every record-save primaryControl declares its ability save-disadvantage source', () => {
    const { offers } = offersWhenRestrained([coreEvents, conditionRestrained]);
    for (const a of ABILITIES) {
      const offer = offers.find((o) => o.id === `record-save-${a}`);
      expect(offer, `record-save-${a} offered`).toBeDefined();
      const ui = offer?.ui as { primaryControl?: { advantage?: { fact: string } } } | undefined;
      // Authored shape: the dice-line declares its own ability's save flag.
      expect(ui?.primaryControl?.advantage, `record-save-${a} advantage source`).toEqual({
        fact: `save.${a}.disadvantage`
      });
    }
  });

  it('the DEX source resolves truthy against a restrained plan — the exact input PanelDiceLine reads', () => {
    const { facts, offers } = offersWhenRestrained([coreEvents, conditionRestrained]);
    expect(facts['save.dex.disadvantage'], 'restrained writes the DEX save flag').toBe(1);

    const offer = offers.find((o) => o.id === 'record-save-dex');
    const ui = offer?.ui as { primaryControl?: { advantage?: { fact: string } } } | undefined;
    const vars = (offer?.vars ?? {}) as Parameters<typeof resolveValueSource>[2];
    // ...and resolved it is truthy — the source PanelDiceLine's
    // rulesDisadvantage reads, so a DEX save rolls 2d20-take-low by default.
    expect(resolveValueSource(ui?.primaryControl?.advantage, facts, vars)).toBe(1);
    // The other five stay 0 (unset reads 0; no writers yet): dead wiring,
    // not phantom modes.
    for (const a of ABILITIES.filter((x) => x !== 'dex')) {
      expect(facts[`save.${a}.disadvantage`] ?? 0, `${a} has no writer while restrained`).toBe(0);
    }
  });
});
