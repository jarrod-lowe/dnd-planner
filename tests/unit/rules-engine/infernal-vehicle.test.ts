import { describe, it, expect } from 'vitest';
import { evaluate, type FactReader, type Offer } from '$lib/rules-engine';
import { getModule } from '$lib/rules-engine/registry';
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

/** The same vehicle with NO acMode — the flat-AC optionality (a spec that sets
 *  no mode gets no mode machinery). */
const FLAT_SPEC: InfernalVehicleSpec = { ...TEST_SPEC, acMode: undefined };

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
    const flat = buildInfernalVehicle(FLAT_SPEC).panels ?? [];
    expect(flat.some((p) => JSON.stringify(p.entry).includes(`${F}.ac.effective`))).toBe(false);
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
