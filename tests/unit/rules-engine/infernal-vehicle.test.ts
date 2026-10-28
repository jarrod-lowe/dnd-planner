import { describe, it, expect } from 'vitest';
import {
  endTurn,
  evaluate,
  type EffectInstance,
  type FactReader,
  type Offer
} from '$lib/rules-engine';
import { getModule, isRegistered } from '$lib/rules-engine/registry';
import { lazyRuleGroupIds } from '$lib/rules-engine/lazy';
import {
  buildInfernalVehicle,
  infernalAcquireEffect,
  type InfernalVehicleSpec
} from '$lib/rules-engine/rules/infernal-vehicle';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * The infernal-vehicle FACTORY surface — the spec→module emission pins. The
 * Tormentor's behaviour is pinned by tormentor-ui.test.ts + the 51 yaml
 * scenarios (the corpus this factory must reproduce byte-for-byte); what THIS
 * file pins is the PARAMETERISATION: one spec in, one fully-templated rule
 * group out, with every identity string derived from the spec (id → module id,
 * offer ids, effect ids/keys, i18n prefixes and diagnostics; subject → panel
 * declarations; factStem → every baked fact) and every NUMBER read from the
 * stat block. The spec under test is deliberately NOT the Tormentor's — a
 * different id, subject, stem, stat block and seat list, so a string or number
 * that survived the extraction hardcoded fails here even though the Tormentor
 * corpus stays green.
 *
 * The last describe is the migration's i18n guard: the factory builds its keys
 * from spec data, which the STATIC module-i18n-coverage scan cannot see (it
 * expands `${PREFIX}.suffix` templates in the module SOURCE only), so this file
 * walks the registered Tormentor module's EMITTED surface — offer ui, legality
 * diagnostics, advertised effect chips, plan-row diagnostics, annotations,
 * panels — and asserts every key resolves in BOTH locales, restoring the guard
 * the templating moved out of static reach.
 */

const SPEC_ID = 'infernal-test';
const SUBJECT = 'infernal-test';
const F = 'companion.infernalTest';
const T = 'rule.infernal-test';

/** A vehicle that is NOT the Tormentor: every number differs on purpose. */
const TEST_SPEC: InfernalVehicleSpec = {
  id: SPEC_ID,
  subject: SUBJECT,
  factStem: F,
  statBlock: {
    hpBase: 200,
    damageThreshold: 10,
    mishapThreshold: 20,
    cargo: 2000,
    creatureCapacity: 8,
    abilities: [
      { ability: 'str', score: 18, modifier: 4, checkName: `${T}.check-str.name` },
      { ability: 'dex', score: 10, modifier: 0, checkName: `${T}.check-dex.name` },
      { ability: 'con', score: 18, modifier: 4, checkName: `${T}.check-con.name` }
    ]
  },
  acMode: { moving: 19, motionless: 17 },
  fuelSpeeds: [0, 60, 50],
  boostBonus: 25,
  dashAllowanceBase: 3,
  juke: true,
  details: {
    statBlock: 'vehicle/infernal-test',
    damage: 'vehicle/infernal-test-damage',
    prone: 'vehicle/infernal-test-prone',
    helm: 'vehicle/infernal-test-helm',
    fuel: 'vehicle/infernal-test-fuel'
  },
  seats: [
    {
      station: 'helm',
      take: { name: `${T}.take-helm-seat.name`, description: `${T}.take-helm-seat.description` },
      leave: { name: `${T}.leave-helm-seat.name`, description: `${T}.leave-helm-seat.description` },
      effectName: `${T}.seat-helm-effect.name`,
      consumesSeat: true
    },
    {
      station: 'ballista',
      take: {
        name: `${T}.take-ballista-seat.name`,
        description: `${T}.take-ballista-seat.description`
      },
      leave: {
        name: `${T}.leave-ballista-seat.name`,
        description: `${T}.leave-ballista-seat.description`
      },
      effectName: `${T}.seat-ballista-effect.name`,
      consumesSeat: true,
      weapon: {
        fire: { name: `${T}.fire-ballista.name`, description: `${T}.fire-ballista.description` },
        noAction: `${T}.fire-ballista.no_action`,
        detailKey: 'vehicle/infernal-test-ballista',
        hitBonus: 9,
        damageBonus: 4,
        damageDie: 8,
        damageCount: 8,
        damageType: 'bludgeoning'
      }
    },
    {
      station: 'net',
      take: { name: `${T}.take-net-seat.name`, description: `${T}.take-net-seat.description` },
      leave: { name: `${T}.leave-net-seat.name`, description: `${T}.leave-net-seat.description` },
      effectName: `${T}.seat-net-effect.name`,
      consumesSeat: false,
      detailKey: 'vehicle/infernal-test-net',
      notice: { key: `${T}.net-notice`, body: `${T}.net-notice.body` }
    }
  ]
};

/** The same vehicle with NO acMode but a FLAT AC — the stat block that prints
 *  "AC 19" with no rider (the Demon Grinder shape): the flat-AC branch, where
 *  the spec's number becomes a derive + chip INSTEAD of the mode machinery. */
const FLAT_SPEC: InfernalVehicleSpec = { ...TEST_SPEC, acMode: undefined, flatAc: 19 };

/** A spec with NEITHER an acMode NOR a flat AC (a vehicle whose stat block
 *  prints no AC line at all): no AC machinery of either kind. */
const NO_AC_SPEC: InfernalVehicleSpec = { ...TEST_SPEC, acMode: undefined };

/**
 * A SECOND vehicle — different id, subject, stem AND speeds (a soul coin opens
 * 90 ft., not the first spec's 60), so the shared spend's cross-vehicle
 * arithmetic cannot pass on any per-vehicle fact. TEST-ONLY: it is built and
 * evaluated directly and never registered (pinned in the shared-spend describe
 * below) — a real second vehicle is its own merged rule group with its own
 * yaml corpus, not a fixture here.
 */
const SECOND_ID = 'infernal-second';
const SECOND_SPEC: InfernalVehicleSpec = {
  id: SECOND_ID,
  subject: SECOND_ID,
  factStem: 'companion.infernalSecond',
  statBlock: {
    hpBase: 100,
    damageThreshold: 5,
    mishapThreshold: 15,
    cargo: 1000,
    creatureCapacity: 6,
    abilities: [
      { ability: 'str', score: 20, modifier: 5, checkName: 'rule.infernal-second.check-str.name' },
      { ability: 'dex', score: 12, modifier: 1, checkName: 'rule.infernal-second.check-dex.name' },
      { ability: 'con', score: 16, modifier: 3, checkName: 'rule.infernal-second.check-con.name' }
    ]
  },
  fuelSpeeds: [0, 90, 70],
  boostBonus: 20,
  dashAllowanceBase: 2,
  details: {
    statBlock: 'vehicle/infernal-second',
    damage: 'vehicle/infernal-second-damage',
    prone: 'vehicle/infernal-second-prone',
    helm: 'vehicle/infernal-second-helm',
    fuel: 'vehicle/infernal-second-fuel'
  },
  seats: [
    {
      station: 'helm',
      take: {
        name: 'rule.infernal-second.take-helm-seat.name',
        description: 'rule.infernal-second.take-helm-seat.description'
      },
      leave: {
        name: 'rule.infernal-second.leave-helm-seat.name',
        description: 'rule.infernal-second.leave-helm-seat.description'
      },
      effectName: 'rule.infernal-second.seat-helm-effect.name',
      consumesSeat: true
    }
  ]
};

/** The built module's offer catalog (empty while the factory is a stub). */
function offers(spec: InfernalVehicleSpec = TEST_SPEC): Offer[] {
  return buildInfernalVehicle(spec).offer?.({ selections: {} }) ?? [];
}

describe('factory: spec identity → module identity', () => {
  it('the module id is the spec id, with meta keys templated from it', () => {
    const mod = buildInfernalVehicle(TEST_SPEC);
    expect(mod.id).toBe(SPEC_ID);
    expect(mod.meta).toEqual({
      name: `${T}.name`,
      description: `${T}.description`,
      keywords: `${T}.keywords`
    });
  });

  it('the acquire offer is the PLAYER-side offer: id and keys templated, no subject', () => {
    const acquire = offers().find((o) => o.id === `acquire-${SPEC_ID}`);
    expect(acquire, `the catalog carries acquire-${SPEC_ID}`).toBeDefined();
    const ui = acquire!.ui as Record<string, unknown>;
    expect(ui.subject).toBeUndefined();
    expect(ui.name).toBe(`${T}.acquire.name`);
    expect(ui.description).toBe(`${T}.acquire.description`);
    expect(ui.detailKey).toBe('vehicle/infernal-test');
  });

  it('the abandon offer sits under the spec SUBJECT', () => {
    const abandon = offers().find((o) => o.id === `abandon-${SPEC_ID}`);
    expect(abandon, `the catalog carries abandon-${SPEC_ID}`).toBeDefined();
    expect((abandon!.ui as Record<string, unknown>).subject).toBe(SUBJECT);
  });
});

describe('factory: statBlock → the acquire effect', () => {
  it('bakes exactly the spec stat block under the spec fact stem', () => {
    const e = infernalAcquireEffect(TEST_SPEC);
    expect(e.id).toBe(`effect-${SPEC_ID}-acquire`);
    expect(e.key).toBe(`${SPEC_ID}-acquire`);
    expect(e.expiry).toEqual({ kind: 'permanent' });
    expect(e.state).toEqual({
      [`${F}.active`]: 1,
      [`${F}.hp.base`]: 200,
      [`${F}.damageThreshold`]: 10,
      [`${F}.mishapThreshold`]: 20,
      [`${F}.cargo`]: 2000,
      [`${F}.str`]: 18,
      [`${F}.dex`]: 10,
      [`${F}.con`]: 18,
      [`${F}.str.modifier`]: 4,
      [`${F}.dex.modifier`]: 0,
      [`${F}.con.modifier`]: 4,
      [`${F}.creatureCapacity.max`]: 8,
      [`${F}.acMotionless`]: 0
    });
    expect(e.display).toEqual({
      name: `${T}.effect.name`,
      section: 'mount',
      subject: SUBJECT,
      detailKey: 'vehicle/infernal-test'
    });
  });

  it("the acquire selection's mode flows into the bake (the creature-type idiom)", () => {
    expect(infernalAcquireEffect(TEST_SPEC, 1).state?.[`${F}.acMotionless`]).toBe(1);
  });

  it('a spec with NO acMode bakes no mode fact', () => {
    const state = infernalAcquireEffect(FLAT_SPEC).state ?? {};
    expect(Object.keys(state).some((k) => k.includes('acMotionless'))).toBe(false);
  });

  it('owns every record as a dependent, seats templated per station', () => {
    expect(infernalAcquireEffect(TEST_SPEC).dependents).toEqual([
      `${SPEC_ID}-occupancy`,
      `${SPEC_ID}-ac-mode`,
      `${SPEC_ID}-fuel`,
      `${SPEC_ID}-boost`,
      `${SPEC_ID}-prone`,
      `${SPEC_ID}-hp-damage`,
      `${SPEC_ID}-hp-heal`,
      `${SPEC_ID}-destroyed`,
      `${SPEC_ID}-seat-helm`,
      `${SPEC_ID}-seat-ballista`,
      `${SPEC_ID}-seat-net`
    ]);
  });
});

describe('factory: seats → offers', () => {
  it('every station gets its TAKE/LEAVE pair with templated ids', () => {
    const ids = offers().map((o) => o.id);
    for (const station of ['helm', 'ballista', 'net']) {
      expect(ids).toContain(`take-${SPEC_ID}-${station}-seat`);
      expect(ids).toContain(`leave-${SPEC_ID}-${station}-seat`);
    }
  });

  it('a seat-CONSUMING station carries the two legs; a capacity-free station the one', () => {
    const consuming = offers().find((o) => o.id === `take-${SPEC_ID}-ballista-seat`)!;
    expect(consuming.legalWhen).toHaveLength(2);
    const free = offers().find((o) => o.id === `take-${SPEC_ID}-net-seat`)!;
    expect(free.legalWhen).toHaveLength(1);
  });

  it('a weapon station adds its FIRE offer with the spec numbers as derives', () => {
    const fire = offers().find((o) => o.id === `fire-${SPEC_ID}-ballista`);
    expect(fire, 'the weapon station carries its attack').toBeDefined();
    const ui = fire!.ui as Record<string, unknown>;
    expect(ui.name).toBe(`${T}.fire-ballista.name`);
    expect(ui.detailKey).toBe('vehicle/infernal-test-ballista');
    expect(ui.primaryControl).toEqual({
      type: 'dice-line',
      dice: [
        { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
        {
          sides: 8,
          count: 8,
          bonus: { var: 'damageBonus' },
          purpose: 'damage',
          damageType: { string: 'bludgeoning' }
        }
      ]
    });
    expect(fire!.vars).toEqual({
      hitBonus: { capture: true, default: { fact: `${F}.ballista.hitBonus` } },
      damageDie: { default: { number: 8 } },
      damageBonus: { capture: true, default: { fact: `${F}.ballista.damageBonus` } }
    });
  });

  it('the take applies ONE keyed effect writing exactly the station fact', () => {
    const out = evaluate({
      modules: [buildInfernalVehicle(TEST_SPEC)],
      planned: [
        { instanceId: 'i0', ruleId: `acquire-${SPEC_ID}` },
        { instanceId: 'i1', ruleId: `take-${SPEC_ID}-helm-seat` }
      ]
    });
    const seat = out.effects.find((e) => e.id.endsWith(`effect-${SPEC_ID}-seat-helm`));
    expect(seat, 'the fold advertises the templated seat effect').toBeDefined();
    expect(seat!.key).toBe(`${SPEC_ID}-seat-helm`);
    expect(seat!.state).toEqual({ [`${F}.seats.helm`]: 1 });
  });

  it("a station's standing notice is emitted while its seat fact stands", () => {
    const reader: FactReader = {
      num: (n) => (n === `${F}.seats.net` ? 1 : 0),
      has: (n) => n === `${F}.seats.net`
    };
    const annotations = buildInfernalVehicle(TEST_SPEC).annotate?.(reader, []) ?? [];
    expect(annotations.some((a) => a.key === `${T}.net-notice`)).toBe(true);
  });
});

describe('factory: panels declared per subject', () => {
  it('every declaration is stamped with the spec subject and gated on active', () => {
    const panels = buildInfernalVehicle(TEST_SPEC).panels ?? [];
    expect(panels.length).toBeGreaterThan(0);
    for (const p of panels) {
      expect(p.subject).toBe(SUBJECT);
      expect(JSON.stringify(p.gate)).toContain(`${F}.active`);
    }
  });

  it('the top bar reads the spec fact stem (HP pool) and the resources the movement pool', () => {
    const panels = buildInfernalVehicle(TEST_SPEC).panels ?? [];
    const hp = panels.find(
      (p) => p.panel === 'topBar' && JSON.stringify(p.entry).includes(`${F}.hp.max`)
    );
    expect(hp, 'a top-bar HP chip exists').toBeDefined();
    expect((hp!.entry as unknown as Record<string, unknown>).remaining).toBe(`${F}.hp.current`);
    const movement = panels.find(
      (p) => p.panel === 'resources' && JSON.stringify(p.entry).includes(`${F}.movement.total`)
    );
    expect(movement, 'a resources movement row exists').toBeDefined();
  });

  it('the acMode spec adds the derived-AC chip; a flat spec has none', () => {
    const withMode = buildInfernalVehicle(TEST_SPEC).panels ?? [];
    expect(withMode.some((p) => JSON.stringify(p.entry).includes(`${F}.ac.effective`))).toBe(true);
    const flat = buildInfernalVehicle(NO_AC_SPEC).panels ?? [];
    expect(flat.some((p) => JSON.stringify(p.entry).includes(`${F}.ac.effective`))).toBe(false);
  });
});

describe('factory: the flat-AC branch (a spec that sets flatAc, no acMode)', () => {
  it('derives ac.effective at the spec number while acquired, 0 unacquired', () => {
    const out = evaluate({
      modules: [buildInfernalVehicle(FLAT_SPEC)],
      planned: [{ instanceId: 'i0', ruleId: `acquire-${SPEC_ID}` }]
    });
    expect(out.facts[`${F}.ac.effective`]).toBe(19);
    const unacquired = evaluate({ modules: [buildInfernalVehicle(FLAT_SPEC)] });
    expect(unacquired.facts[`${F}.ac.effective`]).toBe(0);
  });

  it('adds the AC chip beside the pool, with no mode machinery anywhere', () => {
    const panels = buildInfernalVehicle(FLAT_SPEC).panels ?? [];
    expect(panels.some((p) => JSON.stringify(p.entry).includes(`${F}.ac.effective`))).toBe(true);
    const acquire = offers(FLAT_SPEC).find((o) => o.id === `acquire-${SPEC_ID}`)!;
    expect((acquire.ui as Record<string, unknown>).secondaryControl).toBeUndefined();
    expect(offers(FLAT_SPEC).some((o) => o.id === `set-${SPEC_ID}-ac-mode`)).toBe(false);
    expect(infernalAcquireEffect(FLAT_SPEC).state?.[`${F}.acMotionless`]).toBeUndefined();
  });

  it('a spec setting BOTH acMode and flatAc fails loud at build time', () => {
    expect(() =>
      buildInfernalVehicle({ ...TEST_SPEC, flatAc: 19 } satisfies InfernalVehicleSpec)
    ).toThrow(/acMode.*flatAc|flatAc.*acMode/);
  });
});

describe('factory: the Reaction optionality (a spec that sets no juke)', () => {
  it('emits no Juke offer at all — a stat block with no Reaction gets none', () => {
    // SECOND_SPEC sets no `juke`: nothing in its catalog, dormant or otherwise.
    expect(offers(SECOND_SPEC).some((o) => o.id === `juke-${SECOND_ID}`)).toBe(false);
    // TEST_SPEC sets one: the offer exists (helm-gated like every station
    // action — the Tormentor corpus pins the surfaced behaviour).
    expect(offers().some((o) => o.id === `juke-${SPEC_ID}`)).toBe(true);
  });
});

describe('factory: diagnostics templated from the id', () => {
  it('the shared seat diagnostics and the wrecked leg carry the spec prefix', () => {
    const consuming = offers().find((o) => o.id === `take-${SPEC_ID}-ballista-seat`)!;
    expect(consuming.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
    expect(consuming.legalWhen![1]!.diagnostics).toEqual([
      { code: `${T}.take-seat.full`, severity: 'error' }
    ]);
    const leave = offers().find((o) => o.id === `leave-${SPEC_ID}-helm-seat`)!;
    expect(leave.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.leave-seat.not_seated`, severity: 'error' }
    ]);
    const drive = offers().find((o) => o.id === `drive-${SPEC_ID}`)!;
    expect(drive.legalWhen!.at(-1)!.diagnostics).toEqual([
      { code: `${T}.wrecked`, severity: 'error' }
    ]);
  });

  it('the per-offer legs and the dash risk note interpolate the spec numbers', () => {
    const drive = offers().find((o) => o.id === `drive-${SPEC_ID}`)!;
    expect(drive.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.drive.no_action`, severity: 'error' }
    ]);
    const out = evaluate({
      modules: [buildInfernalVehicle(TEST_SPEC)],
      planned: [
        { instanceId: 'i0', ruleId: `acquire-${SPEC_ID}` },
        { instanceId: 'i1', ruleId: `take-${SPEC_ID}-helm-seat` },
        { instanceId: 'i2', ruleId: `dash-${SPEC_ID}` }
      ]
    });
    // The dash risk note: the allowance is the spec base + the spec CON
    // modifier read from the FACTS (3 + 4 = 7 — never a hardcoded total).
    expect(out.planDiagnostics['i2']).toEqual([
      { code: `${T}.dash.no_bonus_action`, severity: 'error' },
      { code: `${T}.dash.risk`, severity: 'notice', params: { allowance: 7 } }
    ]);
  });

  it('the record rollers read the spec abilities (saves shared, checks spec-keyed)', () => {
    const ids = offers().map((o) => o.id);
    expect(ids).toContain(`${SPEC_ID}-save-str`);
    expect(ids).toContain(`${SPEC_ID}-check-con`);
    const check = offers().find((o) => o.id === `${SPEC_ID}-check-con`)!;
    expect((check.ui as Record<string, unknown>).name).toBe(`${T}.check-con.name`);
  });
});

describe('factory: the flat-AC optionality (a spec that sets no acMode)', () => {
  it('carries no mode control on the acquire and no ac-mode record offer', () => {
    const acquire = offers(FLAT_SPEC).find((o) => o.id === `acquire-${SPEC_ID}`);
    expect(acquire, 'the flat vehicle is still acquirable').toBeDefined();
    expect((acquire!.ui as Record<string, unknown>).secondaryControl).toBeUndefined();
    expect(offers(FLAT_SPEC).some((o) => o.id === `set-${SPEC_ID}-ac-mode`)).toBe(false);
  });
});

/**
 * The SHARED movement spend — Demon Grinder PR-2. ONE player-level fact
 * (`companion.vehicle.movement.spent`, the stem chosen because it sits in the
 * companion namespace BESIDE the per-vehicle stems without being owned by any
 * one vehicle's factStem or lifecycle) carries every infernal vehicle's
 * driven feet: each vehicle's Drive writes it, each vehicle's remaining reads
 * its OWN total minus it. Same-turn driving across vehicles therefore draws
 * ONE pool, capped at whichever vehicle you are currently driving — the
 * cross-vehicle cap the Tormentor seats job recorded as the goal.
 */
describe('factory: the movement spend is ONE shared player-level pool', () => {
  const SHARED = 'companion.vehicle.movement.spent';
  const SECOND_F = SECOND_SPEC.factStem;

  /** A committed acquire + helm seat + soul-coin fuel record for one spec. */
  const fuelledHelm = (spec: InfernalVehicleSpec): EffectInstance[] => [
    infernalAcquireEffect(spec),
    {
      id: `effect-${spec.id}-seat-helm`,
      key: `${spec.id}-seat-helm`,
      state: { [`${spec.factStem}.seats.helm`]: 1 },
      expiry: { kind: 'permanent' }
    },
    {
      id: `effect-${spec.id}-fuel`,
      key: `${spec.id}-fuel`,
      state: { [`${spec.factStem}.fuel.recorded`]: 1 },
      expiry: { kind: 'permanent' }
    }
  ];

  it("Drive writes the SHARED fact — never the vehicle's own stem", () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [buildInfernalVehicle(TEST_SPEC), economy],
      committed: fuelledHelm(TEST_SPEC),
      planned: [{ instanceId: 'i0', ruleId: `drive-${SPEC_ID}`, selections: { distance: 25 } }]
    });
    // The one keyless endOfTurn spend (shape unchanged) carries the distance
    // against the SHARED stem; remaining = the vehicle's own total − shared.
    expect(out.facts[SHARED]).toBe(25);
    expect(out.facts[`${F}.movement.spent`]).toBeUndefined();
    expect(out.facts[`${F}.movement.total`]).toBe(60);
    expect(out.facts[`${F}.movement.remaining`]).toBe(35);
  });

  it('same-turn driving across vehicles draws ONE pool: each vehicle caps at its OWN total', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [buildInfernalVehicle(TEST_SPEC), buildInfernalVehicle(SECOND_SPEC), economy],
      committed: [...fuelledHelm(TEST_SPEC), ...fuelledHelm(SECOND_SPEC)],
      // 25 ft driven at the FIRST vehicle's helm…
      planned: [{ instanceId: 'i0', ruleId: `drive-${SPEC_ID}`, selections: { distance: 25 } }]
    });
    expect(out.facts[SHARED]).toBe(25);
    // …and BOTH pools pay for it: each remaining = its OWN total − the shared
    // spend (60 − 25 and 90 − 25), never its own private ledger.
    expect(out.facts[`${F}.movement.remaining`]).toBe(35);
    expect(out.facts[`${SECOND_F}.movement.total`]).toBe(90);
    expect(out.facts[`${SECOND_F}.movement.remaining`]).toBe(65);
  });

  it('a LEGACY per-vehicle spend effect is inert, tolerated, and still expires', () => {
    const economy = getModule('action-economy')!;
    // The pre-shared shape: a persisted keyless endOfTurn Drive spend under
    // the per-vehicle stem. Nothing derives or reads that name any more, so
    // evaluation must not break and the fact must not reach the arithmetic.
    const legacy: EffectInstance = {
      id: 'effect-drive-cost',
      state: { [`${F}.movement.spent`]: 30 },
      expiry: { kind: 'endOfTurn' }
    };
    const committed = [...fuelledHelm(TEST_SPEC), legacy];
    const out = evaluate({
      modules: [buildInfernalVehicle(TEST_SPEC), economy],
      committed
    });
    expect(out.facts[`${F}.movement.total`]).toBe(60);
    expect(out.facts[`${F}.movement.remaining`]).toBe(60); // NOT 30 — unread
    // The old effect still ages away with the turn, exactly as it did before.
    const aged = endTurn(committed, out.effects, {});
    expect(aged.some((e) => e.id === 'effect-drive-cost')).toBe(false);
    const after = evaluate({
      modules: [buildInfernalVehicle(TEST_SPEC), economy],
      committed: aged
    });
    expect(after.facts[`${F}.movement.remaining`]).toBe(60);
  });

  it('the second vehicle is a TEST-ONLY fixture: never registered, never lazy-loaded', () => {
    expect(isRegistered(SECOND_ID)).toBe(false);
    expect(lazyRuleGroupIds()).not.toContain(SECOND_ID);
  });
});

/**
 * The SEAT-COVER contribution — cover.md PR-2. The seam is generic at the
 * VEHICLE side: a seat's cover degree is SPEC DATA (`SeatSpec.cover`, the
 * cover module's 0-3 ordinal scale), and the factory emits ONE derive onto the
 * shared player-level fact `cover.seat` — the vehicle's best HELD seat, combine
 * `max`, reading the seat facts alone (no acquire gate, no lifecycle wiring:
 * leaving a seat or abandoning the vehicle clears the seat fact, and the
 * contribution follows for free). The player-side cover module maxes its
 * manual record with the FACT in `cover.effective` (pinned in cover.test.ts);
 * a later vehicle (the Demon Grinder's seats) plugs in as pure spec data with
 * no vehicle list anywhere — the engine's max combine enumerates them.
 */
describe('factory: the seat-cover contribution (cover PR-2 seam)', () => {
  const COVER_SEAT = 'cover.seat';

  /**
   * A fixture whose ordinals deliberately SWAP the Tormentor's (helm 1,
   * ballista 2 — the Tormentor prints helm 2, harpoon 1), so a station→degree
   * map that survived the extraction hardcoded fails here even though the
   * Tormentor corpus stays green. The net station carries NO ordinal.
   */
  const COVER_SPEC: InfernalVehicleSpec = {
    ...TEST_SPEC,
    seats: [
      {
        station: 'helm',
        take: { name: `${T}.take-helm-seat.name`, description: `${T}.take-helm-seat.description` },
        leave: {
          name: `${T}.leave-helm-seat.name`,
          description: `${T}.leave-helm-seat.description`
        },
        effectName: `${T}.seat-helm-effect.name`,
        consumesSeat: true,
        cover: 1
      },
      {
        station: 'ballista',
        take: {
          name: `${T}.take-ballista-seat.name`,
          description: `${T}.take-ballista-seat.description`
        },
        leave: {
          name: `${T}.leave-ballista-seat.name`,
          description: `${T}.leave-ballista-seat.description`
        },
        effectName: `${T}.seat-ballista-effect.name`,
        consumesSeat: true,
        cover: 2,
        weapon: {
          fire: { name: `${T}.fire-ballista.name`, description: `${T}.fire-ballista.description` },
          noAction: `${T}.fire-ballista.no_action`,
          detailKey: 'vehicle/infernal-test-ballista',
          hitBonus: 9,
          damageBonus: 4,
          damageDie: 8,
          damageCount: 8,
          damageType: 'bludgeoning'
        }
      },
      {
        station: 'net',
        take: { name: `${T}.take-net-seat.name`, description: `${T}.take-net-seat.description` },
        leave: { name: `${T}.leave-net-seat.name`, description: `${T}.leave-net-seat.description` },
        effectName: `${T}.seat-net-effect.name`,
        consumesSeat: false,
        detailKey: 'vehicle/infernal-test-net',
        notice: { key: `${T}.net-notice`, body: `${T}.net-notice.body` }
      }
    ]
  };

  /** A SECOND cover-carrying vehicle (different id, stem and ordinal again). */
  const COVER_SECOND: InfernalVehicleSpec = {
    ...SECOND_SPEC,
    seats: [{ ...SECOND_SPEC.seats[0]!, cover: 2 }]
  };

  /** A committed seat effect for a station (the shape the take advertises). */
  const seatAt = (spec: InfernalVehicleSpec, station: string): EffectInstance => ({
    id: `effect-${spec.id}-seat-${station}`,
    key: `${spec.id}-seat-${station}`,
    state: { [`${spec.factStem}.seats.${station}`]: 1 },
    expiry: { kind: 'permanent' }
  });

  /** The shared cover.seat fact with the given seats held on the given spec. */
  const coverSeatWith = (spec: InfernalVehicleSpec, ...stations: string[]): number | undefined =>
    evaluate({
      modules: [buildInfernalVehicle(spec)],
      committed: [infernalAcquireEffect(spec), ...stations.map((s) => seatAt(spec, s))]
    }).facts[COVER_SEAT];

  it('each cover seat contributes its SPEC ordinal while held (data, not station name)', () => {
    // The swapped ordinals: helm 1, ballista 2 — not the Tormentor's map.
    expect(coverSeatWith(COVER_SPEC, 'helm')).toBe(1);
    expect(coverSeatWith(COVER_SPEC, 'ballista')).toBe(2);
  });

  it('a seat with NO cover ordinal contributes nothing while held', () => {
    expect(coverSeatWith(COVER_SPEC, 'net')).toBe(0);
  });

  it('two held seats (the planned-anyway state) contribute the more protective degree', () => {
    expect(coverSeatWith(COVER_SPEC, 'helm', 'ballista')).toBe(2);
  });

  it('the contribution reads the SEAT FACT ALONE — no acquire gate to keep in step with the lifecycle', () => {
    // A seat effect without its acquire cannot arise through play (the take
    // offers gate on the acquire and the lifecycle evicts them together); the
    // derive deliberately reads ONLY the seat fact, so the leave/abandon paths
    // need no cover wiring. This pins that minimal input set.
    const out = evaluate({
      modules: [buildInfernalVehicle(COVER_SPEC)],
      committed: [seatAt(COVER_SPEC, 'ballista')]
    });
    expect(out.facts[COVER_SEAT]).toBe(2);
  });

  it('a spec with NO cover seats emits no cover.seat contribution at all', () => {
    // The optionality precedent (juke, acMode): what a stat block does not
    // carry does not exist. SECOND_SPEC sets no cover on any seat.
    const mod = buildInfernalVehicle(SECOND_SPEC);
    expect(mod.derive!({ selections: {} }).some((c) => c.fact === COVER_SEAT)).toBe(false);
    const out = evaluate({
      modules: [mod],
      committed: [infernalAcquireEffect(SECOND_SPEC), seatAt(SECOND_SPEC, 'helm')]
    });
    expect(out.facts[COVER_SEAT]).toBeUndefined();
  });

  it('the emitted derive carries combine max — vehicles CO-WRITE the one fact without a conflict', () => {
    const contribution = buildInfernalVehicle(COVER_SPEC).derive!({ selections: {} }).find(
      (c) => c.fact === COVER_SEAT
    );
    expect(contribution, 'a cover-carrying spec contributes the shared fact').toBeDefined();
    expect(contribution!.combine).toBe('max');
    // Cross-vehicle: a seat held on each vehicle — the more protective degree
    // wins (sum would read 3; override would throw on the second writer).
    const out = evaluate({
      modules: [buildInfernalVehicle(COVER_SPEC), buildInfernalVehicle(COVER_SECOND)],
      committed: [
        infernalAcquireEffect(COVER_SPEC),
        seatAt(COVER_SPEC, 'helm'),
        infernalAcquireEffect(COVER_SECOND),
        seatAt(COVER_SECOND, 'helm')
      ]
    });
    expect(out.facts[COVER_SEAT]).toBe(2);
  });
});

/**
 * The MIGRATION guard: every `rule.*`/`play.*` key the registered Tormentor
 * module EMITS resolves in both locales. The factory builds its keys from spec
 * data, which the static module-i18n-coverage scan cannot expand — this walk
 * restores that guard at the emitted surface (offer ui, legality and plan-row
 * diagnostics, effect chips, annotations, panels, control prefixes).
 */
describe('factory: the registered Tormentor module emits only resolvable keys', () => {
  const TORMENTOR = 'tormentor';
  const TF = 'companion.tormentor';

  /** Flatten a locale dict exactly as sveltekit-i18n does (dot-joined leaves). */
  function flatKeys(locale: unknown, prefix: string, out: Set<string>): void {
    if (typeof locale === 'string') {
      out.add(prefix);
      return;
    }
    if (locale && typeof locale === 'object' && !Array.isArray(locale)) {
      for (const [k, v] of Object.entries(locale)) flatKeys(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }

  /** Deep-walk a plain `ui`/effect payload for every i18n-shaped string it carries. */
  function i18nStrings(node: unknown, out: Set<string>): void {
    if (typeof node === 'string') {
      if (/^(rule|play|planner)\.[a-zA-Z0-9._-]+$/.test(node)) out.add(node);
    } else if (node && typeof node === 'object') {
      for (const v of Object.values(node)) i18nStrings(v, out);
    }
  }

  function collectedKeys(): Set<string> {
    const mod = getModule(TORMENTOR)!;
    const keys = new Set<string>();
    // The offer catalog's ui (names, descriptions, control labels/prefixes)…
    for (const offer of mod.offer!({ selections: {} })) {
      i18nStrings(offer.ui, keys);
      // …and every legality leg's diagnostic code.
      for (const leg of offer.legalWhen ?? [])
        for (const d of leg.diagnostics) i18nStrings(d.code, keys);
    }
    // The plan fold: advertised effect chips, per-row diagnostics (the apply
    // re-checks + the bounce/mishap/risk notices), and the final annotations.
    const out = evaluate({
      modules: [mod],
      planned: [
        { instanceId: 'a', ruleId: 'flip-tormentor-upright' },
        { instanceId: 'b', ruleId: 'acquire-tormentor' },
        { instanceId: 'c', ruleId: 'set-tormentor-occupancy', selections: { occupancy: 3 } },
        { instanceId: 'd', ruleId: 'knock-tormentor-prone' },
        { instanceId: 'e', ruleId: 'take-tormentor-passenger-seat' },
        { instanceId: 'f', ruleId: 'take-tormentor-harpoon-seat' },
        { instanceId: 'g', ruleId: 'take-tormentor-clinger-seat' },
        { instanceId: 'h', ruleId: 'take-tormentor-helm-seat' },
        { instanceId: 'i', ruleId: 'set-tormentor-fuel', selections: { fuel: 1 } },
        { instanceId: 'j', ruleId: 'set-tormentor-boost', selections: { boost: 1 } },
        { instanceId: 'k', ruleId: 'record-tormentor-damage', selections: { amount: 5 } },
        { instanceId: 'l', ruleId: 'record-tormentor-damage', selections: { amount: 60 } },
        { instanceId: 'm', ruleId: 'record-tormentor-heal', selections: { amount: 10 } },
        { instanceId: 'n', ruleId: 'drive-tormentor', selections: { distance: 30 } },
        { instanceId: 'o', ruleId: 'dash-tormentor' },
        { instanceId: 'p', ruleId: 'juke-tormentor' },
        { instanceId: 'q', ruleId: 'fire-tormentor-harpoon' }
      ]
    });
    for (const effect of out.effects) if (effect.display) i18nStrings(effect.display, keys);
    for (const diags of Object.values(out.planDiagnostics))
      for (const d of diags) i18nStrings(d.code, keys);
    // The annotate surface, with every standing-notice fact set directly.
    const reader: FactReader = {
      num: (n) =>
        n === `${TF}.prone` || n === `${TF}.destroyed` || n === `${TF}.seats.clinger` ? 1 : 0,
      has: (n) => n === `${TF}.prone` || n === `${TF}.destroyed` || n === `${TF}.seats.clinger`
    };
    for (const a of mod.annotate!(reader, [])) i18nStrings([a.key, a.body, a.source], keys);
    // The declared panels (the label surface the renderer translates).
    for (const p of mod.panels ?? []) i18nStrings(p.entry, keys);
    return keys;
  }

  it('collects a meaningful key set (the walk is not silently broken)', () => {
    expect(collectedKeys().size).toBeGreaterThan(60);
  });

  for (const [locale, dict] of [
    ['en', en],
    ['en-x-tlh', tlh]
  ] as const) {
    it(`every emitted key resolves in ${locale}`, () => {
      const flat = new Set<string>();
      flatKeys(dict, '', flat);
      const missing = [...collectedKeys()].filter((key) => !flat.has(key));
      expect(missing.sort(), `unresolved keys in ${locale}`).toEqual([]);
    });
  }
});

/**
 * The SAME emitted-surface i18n guard, for the registered Demon Grinder module
 * (PR-3, seat-free): the factory builds its keys from spec data the static
 * module-i18n-coverage scan cannot expand, so this walk restores the guard at
 * the EMITTED surface — offer ui (including the helm-gated offers the empty
 * seat list keeps from ever surfacing: their keys are still emitted, so they
 * must still resolve), legality diagnostics, advertised effect chips, plan-row
 * diagnostics (the bounce/mishap notes), annotations, panels.
 */
describe('factory: the registered Demon Grinder module emits only resolvable keys', () => {
  const DG = 'demon-grinder';
  const DGF = 'companion.demonGrinder';

  /** Flatten a locale dict exactly as sveltekit-i18n does (dot-joined leaves). */
  function dgFlatKeys(locale: unknown, prefix: string, out: Set<string>): void {
    if (typeof locale === 'string') {
      out.add(prefix);
      return;
    }
    if (locale && typeof locale === 'object' && !Array.isArray(locale)) {
      for (const [k, v] of Object.entries(locale))
        dgFlatKeys(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }

  /** Deep-walk a plain `ui`/effect payload for every i18n-shaped string it carries. */
  function dgI18nStrings(node: unknown, out: Set<string>): void {
    if (typeof node === 'string') {
      if (/^(rule|play|planner)\.[a-zA-Z0-9._-]+$/.test(node)) out.add(node);
    } else if (node && typeof node === 'object') {
      for (const v of Object.values(node)) dgI18nStrings(v, out);
    }
  }

  function dgCollectedKeys(): Set<string> {
    const registered = getModule(DG);
    if (!registered) throw new Error(`${DG} is not registered in the registry`);
    const mod = registered;
    const keys = new Set<string>();
    // The offer catalog's ui (names, descriptions, control labels/prefixes —
    // the dormant helm-gated offers included)… and every legality leg's code.
    for (const offer of mod.offer!({ selections: {} })) {
      dgI18nStrings(offer.ui, keys);
      for (const leg of offer.legalWhen ?? [])
        for (const d of leg.diagnostics) dgI18nStrings(d.code, keys);
    }
    // The plan fold: effect chips, per-row diagnostics (the re-checks, the
    // bounce and mishap notes, the wrecked leg on a planned-anyway repair).
    const out = evaluate({
      modules: [mod],
      planned: [
        { instanceId: 'a', ruleId: `flip-${DG}-upright` },
        { instanceId: 'b', ruleId: `acquire-${DG}` },
        { instanceId: 'c', ruleId: `set-${DG}-occupancy`, selections: { occupancy: 3 } },
        { instanceId: 'd', ruleId: `knock-${DG}-prone` },
        { instanceId: 'e', ruleId: `record-${DG}-damage`, selections: { amount: 5 } },
        { instanceId: 'f', ruleId: `record-${DG}-damage`, selections: { amount: 200 } },
        { instanceId: 'g', ruleId: `record-${DG}-heal`, selections: { amount: 10 } }
      ]
    });
    for (const effect of out.effects) if (effect.display) dgI18nStrings(effect.display, keys);
    for (const diags of Object.values(out.planDiagnostics))
      for (const d of diags) dgI18nStrings(d.code, keys);
    // The annotate surface, with every standing-notice fact set directly.
    const reader: FactReader = {
      num: (n) => (n === `${DGF}.prone` || n === `${DGF}.destroyed` ? 1 : 0),
      has: (n) => n === `${DGF}.prone` || n === `${DGF}.destroyed`
    };
    for (const a of mod.annotate!(reader, [])) dgI18nStrings([a.key, a.body, a.source], keys);
    // The declared panels (the label surface the renderer translates).
    for (const p of mod.panels ?? []) dgI18nStrings(p.entry, keys);
    return keys;
  }

  it('collects a meaningful key set (the walk is not silently broken)', () => {
    expect(dgCollectedKeys().size).toBeGreaterThan(50);
  });

  it('the flat spec walks no mode keys (the absent branch emits none)', () => {
    const keys = dgCollectedKeys();
    expect([...keys].some((k) => k.includes('acMotionless') || k.includes('ac-mode'))).toBe(false);
  });

  for (const [locale, dict] of [
    ['en', en],
    ['en-x-tlh', tlh]
  ] as const) {
    it(`every emitted key resolves in ${locale}`, () => {
      const flat = new Set<string>();
      dgFlatKeys(dict, '', flat);
      const missing = [...dgCollectedKeys()].filter((key) => !flat.has(key));
      expect(missing.sort(), `unresolved keys in ${locale}`).toEqual([]);
    });
  }
});
