import { describe, it, expect } from 'vitest';
import { evaluate, type EffectInstance, type RuleModule } from '$lib/rules-engine';
import { getModule, isRegistered } from '$lib/rules-engine/registry';
import { lazyRuleGroupIds } from '$lib/rules-engine/lazy';
import { deriveTopBarEntries, deriveResourceEntries } from '$lib/play/derivePanels';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * Demon Grinder — PR-3, the SEAT-FREE base. The second vehicle on the shared
 * infernal-vehicle factory (rules/infernal-vehicle.ts): everything here pins
 * what is DATA — the spec's identity strings and its STAT BLOCK (HP 200,
 * thresholds 10/20, capacity 8, cargo 2,000 lb., STR/DEX/CON 18/10/18, the
 * FLAT AC 19 with NO AC-mode machinery anywhere) — plus the one structural
 * fact of this PR: the spec's seat list is EMPTY, so no station exists and
 * every helm-gated offer (drive/dash/juke/fuel/boost) never surfaces. The
 * factory's own behaviour is pinned by infernal-vehicle.test.ts; the
 * Tormentor's corpus stays green untouched.
 *
 * Seats (the Helm, a Harpoon Flinger, the Chomper, the Wrecking Ball) and the
 * offers they gate land in PR-4+; this file is the base those extend.
 */

const ID = 'demon-grinder';
const T = 'rule.demon-grinder';
const SUBJECT = 'demon-grinder';
const F = 'companion.demonGrinder';

/** The module under test, via the registry (fails loud + clear before GREEN). */
function module(): RuleModule {
  const m = getModule(ID);
  if (!m) throw new Error(`${ID} is not registered in the registry`);
  return m;
}

/** The acquire effect, through the real plan fold (apply → advertise). */
function acquireEffect(): EffectInstance {
  const out = evaluate({
    modules: [module()],
    planned: [{ instanceId: 'i0', ruleId: `acquire-${ID}` }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith(`effect-${ID}-acquire`));
  expect(advertised, 'acquiring applies exactly one named effect').toHaveLength(1);
  return advertised[0]!;
}

/**
 * Safe dot-path read into a locale dict. The `rule.demon-grinder` block does
 * not exist at RED — this returns undefined so the canary FAILS on the
 * assertion instead of throwing on the way there.
 */
function i18nAt(locale: unknown, path: string): unknown {
  let node: unknown = locale;
  for (const part of path.split('.')) {
    if (node && typeof node === 'object' && part in (node as Record<string, unknown>))
      node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return node;
}

/** Every path resolves to a string in BOTH locales (tlh is the canary). */
function expectStringInBothLocales(paths: string[]): void {
  for (const path of paths) {
    expect(i18nAt(en, path), `en ${path}`).toEqual(expect.any(String));
    expect(i18nAt(tlh, path), `en-x-tlh ${path}`).toEqual(expect.any(String));
  }
}

/** A committed acquire — stored state for the folds below. */
function acquired(): EffectInstance[] {
  return [acquireEffect()];
}

describe('demon-grinder registration', () => {
  it('is registered in the registry AND the lazy chunk map', () => {
    expect(isRegistered(ID)).toBe(true);
    expect(lazyRuleGroupIds()).toContain(ID);
  });
});

describe('acquire offer ui', () => {
  it('is an ungated free-section PLAYER offer: no vehicle subject, no mode control', () => {
    const offers = module().offer!({ selections: {} });
    // The emitted catalog: the base surface only — NO seat pairs, NO fire
    // offer, NO ac-mode record (the flat-AC branch). The drive/dash/juke and
    // fuel/boost offers ARE emitted by the factory but never surface (the
    // helm gate below pins that): their ids stay in the raw list, their
    // visibility does not.
    expect(offers.map((o) => o.id)).toEqual([
      `acquire-${ID}`,
      `set-${ID}-occupancy`,
      `set-${ID}-fuel`,
      `set-${ID}-boost`,
      `record-${ID}-damage`,
      `record-${ID}-heal`,
      `knock-${ID}-prone`,
      `flip-${ID}-upright`,
      `drive-${ID}`,
      `dash-${ID}`,
      // NO Juke: the Demon Grinder's stat block carries no Reaction (the
      // spec omits `juke`, so the factory never emits the offer at all).
      // The six record rollers (saves first, then checks, in stat-block order).
      `${ID}-save-str`,
      `${ID}-save-dex`,
      `${ID}-save-con`,
      `${ID}-check-str`,
      `${ID}-check-dex`,
      `${ID}-check-con`,
      `abandon-${ID}`
    ]);
    expect(offers.some((o) => o.id === `juke-${ID}`)).toBe(false);
    const acquire = offers[0]!;
    const ui = acquire.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    // Acquiring is a PLAYER action: no vehicle subject (the panel does not
    // exist before the acquire effect does).
    expect(ui.subject).toBeUndefined();
    expect(ui.name).toBe(`${T}.acquire.name`);
    expect(ui.description).toBe(`${T}.acquire.description`);
    expect(ui.detailKey).toBe('vehicle/demon-grinder');
    expect(ui.actionCost).toEqual([]);
    expect(ui.intents).toEqual({ EQUIP: 'vehicle' });
    // The FLAT-AC spec: NO mode control on the acquire (and no mode vars).
    expect(ui.secondaryControl).toBeUndefined();
    expect(acquire.vars).toBeUndefined();
    // ONE legality leg: the per-vehicle already-have (owning one of EACH
    // vehicle rule group is legal — the leg reads only this stem's presence).
    expect(acquire.when).toBeUndefined();
    expect(acquire.legalWhen).toHaveLength(1);
  });
});

describe('acquire effect', () => {
  it('bakes the stat block as one permanent keyed effect — NO acMotionless key', () => {
    const e = acquireEffect();
    expect(e.key).toBe(`${ID}-acquire`);
    expect(e.expiry).toEqual({ kind: 'permanent' });
    expect(e.state).toEqual({
      [`${F}.active`]: 1,
      // The FLAT-AC vehicle bakes NO AC at all — the stat block's 19 is the
      // flatAc derive below, and there is no mode fact of any name.
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
      [`${F}.creatureCapacity.max`]: 8
    });
    expect(Object.keys(e.state!).some((k) => k.includes('acMotionless'))).toBe(false);
  });

  it('owns every vehicle record as a dependent — no ac-mode, no seats', () => {
    expect(acquireEffect().dependents).toEqual([
      `${ID}-occupancy`,
      `${ID}-fuel`,
      `${ID}-boost`,
      `${ID}-prone`,
      `${ID}-hp-damage`,
      `${ID}-hp-heal`,
      `${ID}-destroyed`
    ]);
  });

  it('displays as a mount chip on its subject that FLIPS to the stat-block detail', () => {
    expect(acquireEffect().display).toEqual({
      name: `${T}.effect.name`,
      section: 'mount',
      subject: SUBJECT,
      detailKey: 'vehicle/demon-grinder'
    });
  });
});

describe('the flat AC (a spec with NO acMode)', () => {
  it('derives ac.effective at the stat block 19 while acquired, 0 otherwise', () => {
    const out = evaluate({ modules: [module()], committed: acquired() });
    expect(out.facts[`${F}.ac.effective`]).toBe(19);
    const unacquired = evaluate({ modules: [module()] });
    expect(unacquired.facts[`${F}.ac.effective`]).toBe(0);
    const abandoned = evaluate({
      modules: [module()],
      committed: acquired(),
      planned: [{ instanceId: 'i0', ruleId: `abandon-${ID}` }]
    });
    expect(abandoned.facts[`${F}.ac.effective`]).toBe(0);
  });

  it('emits NO mode machinery anywhere: no mode offer, no mode facts', () => {
    // No ac-mode record offer in the raw catalog…
    expect(module().offer!({ selections: {} }).some((o) => o.id === `set-${ID}-ac-mode`)).toBe(
      false
    );
    // …and through the fold, no mode fact ever exists (unset reads 0, so the
    // pin reads both the current and the raw baked names).
    const out = evaluate({ modules: [module()], committed: acquired() });
    expect(out.facts[`${F}.acMotionless`]).toBeUndefined();
    expect(out.facts[`${F}.acMotionless.current`]).toBeUndefined();
    expect(out.facts[`${F}.acMotionless.recorded`]).toBeUndefined();
  });
});

describe('no helm-gated offer ever surfaces (the seat-free spec)', () => {
  it('drive/dash/juke/fuel/boost are emitted but structurally absent, acquired or not', () => {
    for (const committed of [[], acquired()]) {
      const out = evaluate({ modules: [module()], committed });
      for (const id of [
        `drive-${ID}`,
        `dash-${ID}`,
        `juke-${ID}`,
        `set-${ID}-fuel`,
        `set-${ID}-boost`
      ])
        expect(
          out.availableRules.some((r) => r.rule.id === id),
          `${id} never surfaces`
        ).toBe(false);
    }
  });
});

describe('fuel/speed/movement derives (the generic machinery, offer-free)', () => {
  /** A committed fuel record at ordinal `n` (the stored shape the Helm's offer would write). */
  function fuelled(n: number): EffectInstance[] {
    return [
      ...acquired(),
      {
        id: `effect-${ID}-fuel`,
        key: `${ID}-fuel`,
        state: { [`${F}.fuel.recorded`]: n },
        expiry: { kind: 'permanent' }
      } satisfies EffectInstance
    ];
  }

  it("unfuelled reads speed 0 and an empty movement pool (the pool is the fuel's)", () => {
    const out = evaluate({ modules: [module()], committed: acquired() });
    expect(out.facts[`${F}.speed.effective`]).toBe(0);
    expect(out.facts[`${F}.movement.base`]).toBe(0);
    expect(out.facts[`${F}.movement.total`]).toBe(0);
    expect(out.facts[`${F}.movement.remaining`]).toBe(0);
  });

  it('the fuel map reads 0 / 100 / 80: a soul coin opens 100, demon ichor 80', () => {
    const soul = evaluate({ modules: [module()], committed: fuelled(1) });
    expect(soul.facts[`${F}.fuel.current`]).toBe(1);
    expect(soul.facts[`${F}.speed.effective`]).toBe(100);
    expect(soul.facts[`${F}.movement.total`]).toBe(100);
    expect(soul.facts[`${F}.movement.remaining`]).toBe(100);
    const ichor = evaluate({ modules: [module()], committed: fuelled(2) });
    expect(ichor.facts[`${F}.speed.effective`]).toBe(80);
  });

  it('a standing boost adds its 30 to the effective speed', () => {
    const committed = [
      ...fuelled(1),
      {
        id: `effect-${ID}-boost`,
        key: `${ID}-boost`,
        state: { [`${F}.boost.recorded`]: 1 },
        expiry: { kind: 'permanent' }
      } satisfies EffectInstance
    ];
    const out = evaluate({ modules: [module()], committed });
    expect(out.facts[`${F}.boost.current`]).toBe(1);
    expect(out.facts[`${F}.speed.effective`]).toBe(130);
    expect(out.facts[`${F}.movement.total`]).toBe(130);
  });
});

describe('module-declared panel entries', () => {
  // The acquired stat facts (every gate the declarations read, plus the pools
  // the chips render).
  const BOARDED = {
    [`${F}.active`]: 1,
    [`${F}.ac.effective`]: 19,
    [`${F}.hp.max`]: 200,
    [`${F}.hp.current`]: 200,
    [`${F}.fuel.current`]: 0,
    [`${F}.speed.effective`]: 0,
    [`${F}.cargo`]: 2000,
    [`${F}.str.modifier`]: 4,
    [`${F}.dex.modifier`]: 0,
    [`${F}.con.modifier`]: 4,
    [`${F}.creatureCapacity.max`]: 8,
    [`${F}.creatureCapacity.used`]: 0,
    [`${F}.movement.total`]: 0,
    [`${F}.movement.remaining`]: 0
  };

  it('top bar: a usedMax HP chip + FLAT AC/Speed/Fuel/Cargo value chips + the ability chip', () => {
    expect(deriveTopBarEntries(BOARDED, [module()]).filter((e) => e.subject === SUBJECT)).toEqual([
      {
        type: 'usedMax',
        label: `play.stats.${SUBJECT}.hp`,
        total: `${F}.hp.max`,
        remaining: `${F}.hp.current`,
        subject: SUBJECT
      },
      {
        // The FLAT AC chip — the derive, not a mode resolve (same slot the
        // Tormentor's mode chip renders in).
        type: 'value',
        label: `play.stats.${SUBJECT}.ac`,
        fact: `${F}.ac.effective`,
        subject: SUBJECT
      },
      {
        type: 'value',
        label: `play.stats.${SUBJECT}.speed`,
        fact: `${F}.speed.effective`,
        subject: SUBJECT
      },
      {
        type: 'value',
        label: `play.stats.${SUBJECT}.fuel`,
        fact: `${F}.fuel.current`,
        valueLabels: {
          0: `${T}.fuel.none`,
          1: 'rule.demon-grinder.fuel.soul-coin',
          2: 'rule.demon-grinder.fuel.demon-ichor'
        },
        subject: SUBJECT
      },
      {
        type: 'value',
        label: `play.stats.${SUBJECT}.cargo`,
        fact: `${F}.cargo`,
        subject: SUBJECT
      },
      {
        type: 'ability',
        label: 'play.topBar.abilities',
        abilities: (['str', 'dex', 'con'] as const).map((a) => ({
          name: `play.stats.${a}`,
          fact: `${F}.${a}.modifier`
        })),
        subject: SUBJECT
      }
    ]);
  });

  it('resources: usedMax creature-capacity and movement rows, stamped with the subject', () => {
    expect(deriveResourceEntries(BOARDED, [module()]).filter((e) => e.subject === SUBJECT)).toEqual(
      [
        {
          type: 'usedMax',
          label: `play.stats.${SUBJECT}.creatureCapacity`,
          total: `${F}.creatureCapacity.max`,
          remaining: `${F}.creatureCapacity.used`,
          subject: SUBJECT
        },
        {
          type: 'usedMax',
          label: `play.stats.${SUBJECT}.movement`,
          total: `${F}.movement.total`,
          remaining: `${F}.movement.remaining`,
          subject: SUBJECT
        }
      ]
    );
  });

  it('holds every entry back while unacquired (the gate fact is absent)', () => {
    expect(deriveTopBarEntries({}, [module()]).some((e) => e.subject === SUBJECT)).toBe(false);
  });

  it('every panel label and the subject labels exist in BOTH locales (tlh is the canary)', () => {
    expectStringInBothLocales([
      `play.stats.${SUBJECT}.hp`,
      `play.stats.${SUBJECT}.ac`,
      `play.stats.${SUBJECT}.speed`,
      `play.stats.${SUBJECT}.fuel`,
      `play.stats.${SUBJECT}.cargo`,
      `play.stats.${SUBJECT}.creatureCapacity`,
      `play.stats.${SUBJECT}.movement`,
      `play.companion.${SUBJECT}`,
      `play.addRow.${SUBJECT}Sublabel`
    ]);
    // The companion label carries the wheel glyph + the vehicle name, exactly
    // as the Tormentor's does.
    expect(i18nAt(en, `play.companion.${SUBJECT}`)).toBe('🛞 Demon Grinder');
  });
});

describe('occupancy offer', () => {
  it('apply advertises ONE permanent keyed effect storing the selection, with a live-value chip', () => {
    const out = evaluate({
      modules: [module()],
      committed: acquired(),
      planned: [{ instanceId: 'i0', ruleId: `set-${ID}-occupancy`, selections: { occupancy: 6 } }]
    });
    const advertised = out.effects.filter((e) => e.id.endsWith(`effect-${ID}-occupancy`));
    expect(advertised).toHaveLength(1);
    expect(advertised[0]!.key).toBe(`${ID}-occupancy`);
    expect(advertised[0]!.expiry).toEqual({ kind: 'permanent' });
    expect(advertised[0]!.state).toEqual({ [`${F}.creatureCapacity.occupancy`]: 6 });
    expect(advertised[0]!.display).toEqual({
      name: `${T}.occupancy-effect.name`,
      section: 'mount',
      subject: SUBJECT,
      displayFact: `${F}.creatureCapacity.used`
    });
    // The read clamps to the stat block's 8 (the slider bound is UI-only).
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(6);
  });

  it('the chip name template carries the live count — {{score}} in BOTH locales', () => {
    const templates: Record<string, unknown> = {
      en: i18nAt(en, `rule.${ID}.occupancy-effect.name`),
      'en-x-tlh': i18nAt(tlh, `rule.${ID}.occupancy-effect.name`)
    };
    for (const [locale, name] of Object.entries(templates)) {
      expect(name, `${locale} name template exists`).toEqual(expect.any(String));
      expect(
        String(name).match(/{{[a-zA-Z]+}}/g),
        `${locale} interpolates exactly {{score}}`
      ).toEqual(['{{score}}']);
    }
  });
});

describe('the HP recorders (threshold + mishap on the 200 pool)', () => {
  it('derives the pool at 200/200 while acquired', () => {
    const out = evaluate({ modules: [module()], committed: acquired() });
    expect(out.facts[`${F}.hp.max`]).toBe(200);
    expect(out.facts[`${F}.hp.current`]).toBe(200);
  });

  it('a mishap-threshold row carries the note with {{amount}}/{{threshold}} params', () => {
    const out = evaluate({
      modules: [module()],
      committed: acquired(),
      planned: [{ instanceId: 'i0', ruleId: `record-${ID}-damage`, selections: { amount: 25 } }]
    });
    expect(out.facts[`${F}.hp.current`]).toBe(175);
    expect(out.planDiagnostics['i0']).toEqual([
      {
        code: `${T}.record-damage.mishap_threshold`,
        severity: 'notice',
        params: { amount: 25, threshold: 20 }
      }
    ]);
  });

  it('the mishap note interpolates {{amount}} and {{threshold}} in BOTH locales', () => {
    for (const [locale, dict] of [
      ['en', en],
      ['en-x-tlh', tlh]
    ] as const) {
      const value = i18nAt(dict, `rule.${ID}.record-damage.mishap_threshold`);
      expect(value, `${locale} mishap note exists`).toEqual(expect.any(String));
      expect(value, `${locale} interpolates {{amount}}`).toContain('{{amount}}');
      expect(value, `${locale} interpolates {{threshold}}`).toContain('{{threshold}}');
    }
  });

  it('a pool-emptying blow destroys the vehicle beside the record; repairs go illegal-but-committable', () => {
    const wrecked = evaluate({
      modules: [module()],
      committed: acquired(),
      planned: [{ instanceId: 'i0', ruleId: `record-${ID}-damage`, selections: { amount: 200 } }]
    });
    expect(wrecked.facts[`${F}.hp.current`]).toBe(0);
    expect(wrecked.facts[`${F}.destroyed`]).toBe(1);
    expect(wrecked.effects.some((e) => e.id.endsWith(`effect-${ID}-destroyed`))).toBe(true);
    const heal = wrecked.availableRules.find((r) => r.rule.id === `record-${ID}-heal`);
    expect(heal, 'the repair recorder is still offered on a wreck').toBeDefined();
    expect(heal!.legal).toBe(false);
    expect(heal!.diagnostics).toEqual([{ code: `${T}.wrecked`, severity: 'error' }]);
    // Damage recording carries no wrecked leg: the blow happened.
    const damage = wrecked.availableRules.find((r) => r.rule.id === `record-${ID}-damage`);
    expect(damage!.legal).toBe(true);
  });
});

describe('the prone pair and its notice', () => {
  it('records prone under the vehicle stem, never the player-global condition', () => {
    const out = evaluate({
      modules: [module()],
      committed: acquired(),
      planned: [{ instanceId: 'i0', ruleId: `knock-${ID}-prone` }]
    });
    expect(out.facts[`${F}.prone`]).toBe(1);
    expect(out.facts['condition.prone']).toBeUndefined();
    const notice = out.annotations.find((a) => a.key === `${T}.notice`);
    expect(notice, 'the Prone Deficiency notice stands while prone').toBeDefined();
    expect(notice!.targets).toEqual(['notice']);
  });

  it('flip-upright clears the record and withdraws the notice (illegal while upright)', () => {
    const prone = evaluate({
      modules: [module()],
      committed: [
        ...acquired(),
        {
          id: `effect-${ID}-prone`,
          key: `${ID}-prone`,
          state: { [`${F}.prone`]: 1 },
          expiry: { kind: 'permanent' }
        } as EffectInstance
      ]
    });
    const flip = prone.availableRules.find((r) => r.rule.id === `flip-${ID}-upright`);
    expect(flip!.legal).toBe(true);
    const upright = evaluate({
      modules: [module()],
      committed: [
        ...acquired(),
        {
          id: `effect-${ID}-prone`,
          key: `${ID}-prone`,
          state: { [`${F}.prone`]: 1 },
          expiry: { kind: 'permanent' }
        }
      ],
      planned: [{ instanceId: 'i0', ruleId: `flip-${ID}-upright` }]
    });
    expect(upright.facts[`${F}.prone`]).toBeUndefined();
    expect(upright.annotations.some((a) => a.key === `${T}.notice`)).toBe(false);
  });
});

describe('abandon evicts every child record', () => {
  it('advertises the marker plus an empty same-key eviction for every child key', () => {
    const out = evaluate({
      modules: [module()],
      committed: acquired(),
      planned: [{ instanceId: 'i0', ruleId: `abandon-${ID}` }]
    });
    const marker = out.effects.filter((e) => e.id.endsWith(`effect-abandon-${ID}`));
    expect(marker).toHaveLength(1);
    expect(marker[0]!.key).toBe(`${ID}-acquire`);
    for (const key of [
      `${ID}-occupancy`,
      `${ID}-fuel`,
      `${ID}-boost`,
      `${ID}-prone`,
      `${ID}-hp-damage`,
      `${ID}-hp-heal`,
      `${ID}-destroyed`
    ]) {
      const evict = out.effects.find((e) => e.key === key);
      expect(evict, `abandon advertises the ${key} eviction`).toBeDefined();
      expect(evict!.state).toBeUndefined();
      expect(evict!.expiry).toEqual({ kind: 'permanent' });
    }
    expect(out.facts[`${F}.active`]).toBeUndefined();
    expect(out.facts[`${F}.hp.max`]).toBe(0);
  });
});

describe('checks and saves (the record rollers)', () => {
  it('six rollers read the BAKED modifier facts — never a hardcoded number', () => {
    const out = evaluate({ modules: [module()], committed: acquired() });
    for (const [ability, modifier] of [
      ['str', 4],
      ['dex', 0],
      ['con', 4]
    ] as const) {
      const save = out.availableRules.find((r) => r.rule.id === `${ID}-save-${ability}`);
      expect(save, `the ${ability} save row exists`).toBeDefined();
      expect(save!.rule.vars).toEqual({
        rollBonus: { capture: true, default: { fact: `${F}.${ability}.modifier` } },
        passed: { capture: true, default: { number: -1 } }
      });
      expect(out.facts[`${F}.${ability}.modifier`]).toBe(modifier);
      const check = out.availableRules.find((r) => r.rule.id === `${ID}-check-${ability}`);
      expect(check, `the ${ability} check row exists`).toBeDefined();
      expect(check!.rule.vars).toEqual({
        rollBonus: { capture: true, default: { fact: `${F}.${ability}.modifier` } }
      });
    }
  });

  it('the check names exist in BOTH locales (tlh is the canary)', () => {
    expectStringInBothLocales([
      `rule.${ID}.check-str.name`,
      `rule.${ID}.check-dex.name`,
      `rule.${ID}.check-con.name`
    ]);
  });
});
