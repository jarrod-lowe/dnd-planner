import { describe, it, expect } from 'vitest';
import { evaluate, endTurn } from '$lib/rules-engine';
import type { FactReader } from '$lib/rules-engine';
import { CONCENTRATION_SPELL_KEY } from '$lib/rules-engine/builder';
import type { PlannedRef } from '$lib/rules-engine';
import concentration from '$lib/rules-engine/rules/concentration';
import coreEvents from '$lib/rules-engine/rules/core-events';
import bless from '$lib/rules-engine/rules/bless';
import sleep from '$lib/rules-engine/rules/sleep';
import holdPerson from '$lib/rules-engine/rules/hold-person';
import shieldOfFaith from '$lib/rules-engine/rules/shield-of-faith';
import detectEvilAndGood from '$lib/rules-engine/rules/detect-evil-and-good';
import protectionFromEvilAndGood from '$lib/rules-engine/rules/protection-from-evil-and-good';
import calmEmotions from '$lib/rules-engine/rules/calm-emotions';

/**
 * Concentration check — the roll-decides path (notices batch 3).
 *
 * Covers the pieces the check's panel and apply lean on:
 *  - the `concentration.dc` derived fact (single source for the annotation's
 *    interpolated DC and the check's captured `dc` var);
 *  - the shared `CONCENTRATION_SPELL_KEY` on the 7 concentration spell effects
 *    (the eviction mechanism — an empty same-key effect replaces the spell);
 *  - the roll-decides apply: unrolled no-op, pass boundary (total === dc),
 *    fail → eviction, invalid roll diagnostic, and the pure-fold undo.
 */
const ANNOTATION_KEY = 'planner.concentration.annotation';

/** The state every dc/roll test starts from: slot held, save owed. */
const HELD = {
  'concentration.spent': 1,
  'concentration.damage-taken': 1
} as const;

/** Evaluate with the concentration module alone over the held-and-damaged state. */
function dcOver(lastDamage: number | undefined) {
  const inputFacts: Record<string, number> = { ...HELD };
  if (lastDamage !== undefined) inputFacts['concentration.last-damage'] = lastDamage;
  return evaluate({ modules: [concentration], inputFacts, planned: [] });
}

describe('concentration.dc — the derived save DC fact', () => {
  it('derives half the last damage, rounded down (25 → 12)', () => {
    expect(dcOver(25).facts['concentration.dc']).toBe(12);
  });

  it('floors at 10 — small damage still demands DC 10 (5 → 10)', () => {
    expect(dcOver(5).facts['concentration.dc']).toBe(10);
  });

  it('floors at 10 when no damage figure survived (unset → 10)', () => {
    expect(dcOver(undefined).facts['concentration.dc']).toBe(10);
  });

  it('zero damage keeps the DC 10 floor', () => {
    expect(dcOver(0).facts['concentration.dc']).toBe(10);
  });

  it('caps at 30 — massive damage demands no more (100 → 30)', () => {
    expect(dcOver(100).facts['concentration.dc']).toBe(30);
  });

  it('10 damage lands exactly on the floor (10 → 10)', () => {
    expect(dcOver(10).facts['concentration.dc']).toBe(10);
  });

  it('the annotation interpolates the fact — values.dc equals concentration.dc', () => {
    for (const damage of [25, 5, 100]) {
      const out = dcOver(damage);
      const ann = out.annotations.find((a) => a.key === ANNOTATION_KEY);
      expect(ann, `annotation exists at damage ${damage}`).toBeDefined();
      expect(ann!.values).toEqual({ dc: out.facts['concentration.dc'] });
    }
  });
});

/**
 * The eviction mechanism (the find-steed Dismiss pattern): every concentration
 * spell's holding effect carries ONE shared key, so an empty same-key effect
 * advertised by a failed check REPLACES the spell (`dedupeByKey`, newest
 * wins) — its `concentration.spent` contribution vanishes while the eviction
 * is still merely planned (remove the check row and the spell folds back),
 * and `endTurn` merges the replacement into the committed set permanently.
 * Rule modules import only the builder, so the constant lives there.
 */
describe('CONCENTRATION_SPELL_KEY — the shared concentration key', () => {
  it('the builder exports the constant the spell modules share', () => {
    // The eviction effect (concentration.ts) and the seven holding effects
    // must agree on ONE string; both import it from the builder.
    expect(CONCENTRATION_SPELL_KEY).toBe('concentration-spell');
  });

  // The engine invariant the whole mechanism leans on, pinned directly: a
  // committed keyed contribution is dropped by a later same-key effect.
  it('an empty same-key effect drops a committed keyed spell contribution', () => {
    const spell = {
      id: 'effect-bless',
      key: 'concentration-spell',
      state: { 'concentration.spent': 1 },
      expiry: { kind: 'turns' as const, remaining: 10 }
    };
    const held = evaluate({ modules: [concentration], planned: [], committed: [spell] });
    expect(held.facts['concentration.remaining']).toBe(0);
    const evicted = evaluate({
      modules: [concentration],
      planned: [],
      committed: [
        spell,
        { id: 'concentration-broken', key: 'concentration-spell', expiry: { kind: 'permanent' } }
      ]
    });
    expect(evicted.facts['concentration.spent'] ?? 0).toBe(0);
    expect(evicted.facts['concentration.remaining']).toBe(1);
  });

  it('every concentration spell holds the slot via an effect carrying the key', () => {
    // A zero-facts reader: the cast gates push their (irrelevant) diagnostics,
    // but apply still advertises — the concentration effect is unconditional.
    const zero: FactReader = { num: () => 0, has: () => false };
    const modules = [
      bless,
      sleep,
      holdPerson,
      shieldOfFaith,
      detectEvilAndGood,
      protectionFromEvilAndGood,
      calmEmotions
    ];
    for (const mod of modules) {
      const offers = mod.offer!({ selections: {} });
      const cast = offers.find((o) => o.id.startsWith('cast-'));
      expect(cast, `${mod.id} has a cast offer`).toBeDefined();
      const result = cast!.apply!(zero, { slotLevel: 1 });
      const holding = result.advertise!.find((e) => e.state?.['concentration.spent'] === 1);
      expect(holding, `${mod.id} holds concentration via an effect`).toBeDefined();
      expect(holding!.key, `${mod.id}'s holding effect carries the shared key`).toBe(
        'concentration-spell'
      );
    }
  });

  it('a double cast is concentration-legal and replaces the hold instead of stacking it', () => {
    const out = evaluate({
      modules: [concentration, bless],
      inputFacts: { 'spell.l1.bless.prepared': 1 },
      planned: [
        { instanceId: 'b1', ruleId: 'cast-bless' },
        { instanceId: 'b2', ruleId: 'cast-bless' }
      ]
    });
    // SRD 5.2, "Another Concentration Effect": starting the second concentration
    // spell is legal and merely dismisses the first — no already_concentrating
    // error rides the row (the over-spent action is no_action's business).
    const codes = (out.planDiagnostics['b2'] ?? []).map((d) => d.code);
    expect(codes).not.toContain('rule.spell-bless.offer-bless.already_concentrating');
    expect(out.facts['concentration.spent']).toBe(1);
  });

  it('a re-cast replaces the committed hold — committed and advertised share the key', () => {
    const modules = [concentration, bless];
    const inputFacts = { 'spell.l1.bless.prepared': 1 };
    const first = evaluate({
      modules,
      inputFacts,
      planned: [{ instanceId: 'b1', ruleId: 'cast-bless' }]
    });
    const committed = endTurn([], first.effects);
    const second = evaluate({
      modules,
      inputFacts,
      committed,
      planned: [{ instanceId: 'b2', ruleId: 'cast-bless' }]
    });
    expect(second.facts['concentration.spent']).toBe(1);
    expect(second.facts['concentration.remaining']).toBe(0);
  });
});

/**
 * The roll-decides apply. The panel persists the kept d20 natural into the
 * `roll` selection (0 = unrolled, 1–20 = the natural); the CON save bonus is
 * captured at add time; the DC is the captured `concentration.dc`. Saves are a
 * pure comparison — nat 20/nat 1 carry no auto rule (SRD 5.2), and the
 * boundary (total === DC) passes.
 */
describe('concentration-check — the roll decides', () => {
  // Bless held, 25 damage recorded → DC 12, and a +2 CON save bonus, so the
  // pass boundary is exactly roll 10 (10 + 2 === 12).
  const MODULES = [concentration, coreEvents, bless];
  const FACTS = { 'spell.l1.bless.prepared': 1, 'con.save': 2 };
  const castBless = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'cast-bless' });
  const takeDamage = (instanceId: string, amount: number): PlannedRef => ({
    instanceId,
    ruleId: 'record-damage',
    selections: { amount }
  });
  const check = (instanceId: string, roll?: number): PlannedRef => ({
    instanceId,
    ruleId: 'concentration-check',
    ...(roll !== undefined ? { selections: { roll } } : {})
  });
  /** A check row carrying its full persisted state (what the panel wrote). */
  const checkWith = (instanceId: string, selections: Record<string, unknown>): PlannedRef => ({
    instanceId,
    ruleId: 'concentration-check',
    selections
  });
  const run = (planned: PlannedRef[]) => evaluate({ modules: MODULES, inputFacts: FACTS, planned });
  const base = () => [castBless('b1'), takeDamage('d1', 25)];
  const broken = (out: ReturnType<typeof evaluate>) =>
    out.effects.filter((e) => e.id.split('#').includes('concentration-broken'));

  it('a roll that meets the DC exactly passes — total === dc, no auto rules', () => {
    const out = run([...base(), check('c1', 10)]);
    // The apply read the STEP-TIME DC (12): 10 + 2 === 12 passes, and the
    // fail test below (9 + 2 = 11) fails — the boundary discriminates. The
    // post-plan `concentration.dc` fact itself has collapsed back to the 10
    // floor by then, because the check's marker-clear zeroes last-damage by
    // design (no later reminder quotes stale damage).
    expect(out.facts['concentration.check-passed']).toBe(1);
    // A pass clears the marker (the save is resolved) and keeps the spell.
    expect(out.facts['concentration.damage-taken']).toBe(0);
    expect(out.facts['concentration.last-damage']).toBe(0);
    expect(out.facts['concentration.remaining']).toBe(0);
    expect(broken(out)).toEqual([]);
  });

  it('a failed roll advertises the eviction — permanent, keyed, displayed', () => {
    const out = run([...base(), check('c1', 9)]); // 9 + 2 = 11 < 12
    expect(out.facts['concentration.check-passed']).toBe(0);
    expect(out.facts['concentration.damage-taken']).toBe(0);
    // The eviction replaces the keyed spell effect, so the slot frees while
    // the failure is still merely planned.
    expect(out.facts['concentration.remaining']).toBe(1);
    expect(out.facts['concentration.spent'] ?? 0).toBe(0);
    const [eviction] = broken(out);
    expect(eviction, 'the eviction is advertised').toBeDefined();
    expect(eviction.key).toBe('concentration-spell');
    expect(eviction.expiry).toEqual({ kind: 'permanent' });
    expect(eviction.display).toEqual({
      name: 'planner.concentration.broken',
      section: 'other'
    });
    // The spell's own effect is still advertised by the cast — the eviction
    // merely outranks it (same key, newer) — and the slot is offered again.
    expect(out.availableRules.some((r) => r.rule.id === 'cast-bless')).toBe(true);
  });

  it('an unrolled row records no outcome and keeps the save owed', () => {
    const out = run([...base(), check('c1')]); // no roll persisted yet
    expect(out.facts['concentration.check-passed']).toBe(-1);
    // The marker survives (the save is still owed) and the spell is untouched.
    expect(out.facts['concentration.damage-taken']).toBe(1);
    expect(out.facts['concentration.last-damage']).toBe(25);
    expect(out.facts['concentration.remaining']).toBe(0);
    expect(broken(out)).toEqual([]);
    // The offer stays up so the player can still take the save.
    expect(out.availableRules.some((r) => r.rule.id === 'concentration-check')).toBe(true);
  });

  it.each([21, 0.5, -3])('an impossible roll (%s) is diagnosed and treated as unrolled', (roll) => {
    const out = run([...base(), check('c1', roll)]);
    const diags = out.planDiagnostics['c1'] ?? [];
    expect(diags.map((d) => d.code)).toContain('planner.concentration.check.invalid_roll');
    expect(diags.find((d) => d.code === 'planner.concentration.check.invalid_roll')!.severity).toBe(
      'error'
    );
    expect(out.facts['concentration.check-passed']).toBe(-1);
    expect(out.facts['concentration.damage-taken']).toBe(1);
    expect(broken(out)).toEqual([]);
  });

  it('removing the check row re-folds the spell back — the fold is a pure function', () => {
    // The failed evaluation above evicted the spell; dropping the check row
    // (what removing the plan row does) restores it and the owed save.
    const out = run(base());
    expect(out.facts['concentration.remaining']).toBe(0);
    expect(out.facts['concentration.damage-taken']).toBe(1);
    // And a re-rolled PASS in the same position ends with the spell held.
    const passed = run([...base(), check('c1', 20)]);
    expect(passed.facts['concentration.remaining']).toBe(0);
    expect(passed.facts['concentration.check-passed']).toBe(1);
    expect(broken(passed)).toEqual([]);
  });

  it('a captured DC survives the marker clear — the row keeps the DC it was added against', () => {
    // selections carry the captured vars (what the panel persists at add
    // time): a re-added check behind an earlier check row still demands the
    // DC of the damage that tripped it, not the post-clear floor of 10.
    const out = run([
      ...base(),
      check('c1', 9),
      {
        instanceId: 'c2',
        ruleId: 'concentration-check',
        selections: { roll: 9, dc: 12, saveBonus: 2 }
      }
    ]);
    // 9 + 2 = 11 < 12 → the second row fails against the CAPTURED 12.
    expect(out.facts['concentration.check-passed']).toBe(0);
    expect(out.facts['concentration.remaining']).toBe(1);
  });

  // The rider the roll captured (Aura of Protection folded into the roll by
  // the panel's riderVar write-back) joins the verdict: without it the chip
  // could display a passing total (natural + base + aura) while the apply
  // judged the natural and base alone — and a failure evicts the spell.
  it('a captured rider joins the verdict — the same roll that fails alone passes with it', () => {
    const alone = run([
      ...base(),
      checkWith('c1', { roll: 9, saveBonus: 1, riderBonus: 0, dc: 12 })
    ]);
    // 9 + 1 = 10 < 12 → fails and evicts.
    expect(alone.facts['concentration.check-passed']).toBe(0);
    expect(alone.facts['concentration.remaining']).toBe(1);
    const withAura = run([
      ...base(),
      checkWith('c1', { roll: 9, saveBonus: 1, riderBonus: 3, dc: 12 })
    ]);
    // 9 + 1 + 3 = 13 ≥ 12 → passes, no eviction, marker cleared.
    expect(withAura.facts['concentration.check-passed']).toBe(1);
    expect(withAura.facts['concentration.damage-taken']).toBe(0);
    expect(withAura.facts['concentration.remaining']).toBe(0);
    expect(broken(withAura)).toEqual([]);
  });

  it('the rider sits inside the same pass boundary — roll + save + rider === dc passes', () => {
    // 8 + 1 + 3 = 12 === dc 12: the boundary comparison spans all three legs.
    const out = run([...base(), checkWith('c1', { roll: 8, saveBonus: 1, riderBonus: 3, dc: 12 })]);
    expect(out.facts['concentration.check-passed']).toBe(1);
    expect(broken(out)).toEqual([]);
  });

  it('an unset rider reads as 0 — a row that never rolled riders still decides', () => {
    // The captured default is 0, and the apply's 0 fallback covers a row
    // whose selections carry no riderBonus at all (the pre-riderVar shape).
    const out = run([...base(), checkWith('c1', { roll: 9, saveBonus: 1, dc: 12 })]);
    expect(out.facts['concentration.check-passed']).toBe(0);
    expect(broken(out)).toBeDefined();
    expect(broken(out).length).toBe(1);
  });
});

/**
 * The panel ui — the check is ROLLABLE, not a bare title. The dice line reuses
 * the record-save shape (d20 + the captured save bonus, `purpose: 'save'` so
 * save-scoped riders can find the roller) plus the two check-specific hooks:
 * `writeBack` persists the kept d20 natural into the `roll` selection the
 * roll-decides apply reads, and `outcomeVs` gives the panel's pass/fail chip
 * the same captured DC the apply compares against. The information line shows
 * that DC (the label the damage reminder already interpolates).
 */
describe('concentration-check — the panel ui', () => {
  const ui = (() => {
    const offer = concentration.offer!({ selections: {} }).find(
      (o) => o.id === 'concentration-check'
    );
    expect(offer, 'the concentration-check offer exists').toBeDefined();
    return offer!.ui!;
  })();

  it('annotationLabels are exactly the save/dice labels riders and reminders need', () => {
    // `save.any` + `save.con`: Aura of Protection and CON-specific riders reach
    // the roller. `dice.any`: the panel rolls a d20, so Heroic Inspiration's
    // reroll-any-die reminder must find it (annotation-targets gate).
    expect(ui.annotationLabels).toEqual(['save.any', 'save.con', 'dice.any']);
  });

  it('primaryControl is a d20 save roller that writes the natural and rider back, judged against the DC', () => {
    expect(ui.primaryControl).toEqual({
      type: 'dice-line',
      dice: [
        {
          sides: 20,
          bonus: { var: 'saveBonus' },
          purpose: 'save',
          writeBack: { var: 'roll', riderVar: 'riderBonus' }
        }
      ],
      outcomeVs: { var: 'dc' }
    });
  });

  it('information shows the DC line, interpolated from the same captured dc var', () => {
    expect(ui.information).toEqual([
      {
        type: 'text',
        label: 'play.information.saveDcCon',
        labelValues: { dc: { var: 'dc' } }
      }
    ]);
  });
});
