import { describe, it, expect } from 'vitest';
import { evaluate, type EffectInstance, type RuleModule } from '$lib/rules-engine';
import { getModule, isRegistered } from '$lib/rules-engine/registry';
import { lazyRuleGroupIds } from '$lib/rules-engine/lazy';
import { deriveTopBarEntries, deriveResourceEntries } from '$lib/play/derivePanels';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * Demon Grinder — PR-3's seat-free base, extended by PR-4's SEATS, PR-5's
 * Wrecking Ball and PR-6's Chomper. The second vehicle on the shared
 * infernal-vehicle factory (rules/infernal-vehicle.ts): everything here pins
 * what is DATA — the spec's identity strings and its STAT BLOCK (HP 200,
 * thresholds 10/20, capacity 8, cargo 2,000 lb., STR/DEX/CON 18/10/18, the
 * FLAT AC 19 with NO AC-mode machinery anywhere) — plus the stations as pure
 * spec entries: the HELM (PR-4: one crew, three-quarters cover, the gate
 * behind drive/dash/fuel/boost), the CHOMPER (PR-6: one crew, half cover,
 * +9 to hit, 6d6+4 piercing — the ground-to-bits-and-spat-through-the-pipes
 * rider is copy only, GM adjudicates), the WRECKING BALL (PR-5: one crew,
 * half cover, +9 to hit, 8d8+4 bludgeoning — the doubled damage against
 * objects and structures is copy only, GM adjudicates) and ONE HARPOON
 * FLINGER (PR-4: one crew, half cover, +5 to hit, 2d8 piercing with no
 * damage bonus). NO passenger, NO clinger, and NO Juke (the stat block
 * carries no Reaction — the spec omits `juke`, so the factory never emits the
 * offer at all). The factory's own behaviour is pinned by
 * infernal-vehicle.test.ts; the Tormentor's corpus stays green untouched.
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
    // The emitted catalog: the base surface plus PR-4's stations — the two
    // take/leave pairs, the fire offer, NO ac-mode record (the flat-AC
    // branch). The drive/dash and fuel/boost offers are helm-gated (the seat
    // describe below pins the gate); NO Juke anywhere.
    expect(offers.map((o) => o.id)).toEqual([
      `acquire-${ID}`,
      `set-${ID}-occupancy`,
      `set-${ID}-fuel`,
      `set-${ID}-boost`,
      `record-${ID}-damage`,
      `record-${ID}-heal`,
      `knock-${ID}-prone`,
      `flip-${ID}-upright`,
      // The stations in +ADD order (stat-block order): the Helm, the Chomper
      // (PR-6, slotted ahead of the ball exactly as PR-5 placed it), the
      // Wrecking Ball, then the Harpoon Flinger — each a take/leave pair
      // first, then every weapon station's fire offer.
      `take-${ID}-helm-seat`,
      `leave-${ID}-helm-seat`,
      `take-${ID}-chomper-seat`,
      `leave-${ID}-chomper-seat`,
      `take-${ID}-wrecking-ball-seat`,
      `leave-${ID}-wrecking-ball-seat`,
      `take-${ID}-harpoon-seat`,
      `leave-${ID}-harpoon-seat`,
      `fire-${ID}-chomper`,
      `fire-${ID}-wrecking-ball`,
      `fire-${ID}-harpoon`,
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

  it('owns every vehicle record as a dependent — no ac-mode, the four seats', () => {
    expect(acquireEffect().dependents).toEqual([
      `${ID}-occupancy`,
      `${ID}-fuel`,
      `${ID}-boost`,
      `${ID}-prone`,
      `${ID}-hp-damage`,
      `${ID}-hp-heal`,
      `${ID}-destroyed`,
      `${ID}-seat-helm`,
      `${ID}-seat-chomper`,
      `${ID}-seat-wrecking-ball`,
      `${ID}-seat-harpoon`
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

describe('the helm-gated offers surface ONLY while the Helm seat is held', () => {
  /** A committed helm seat beside the acquire (the take's advertise shape). */
  function seatedAtHelm(): EffectInstance[] {
    return [
      ...acquired(),
      {
        id: `effect-${ID}-seat-helm`,
        key: `${ID}-seat-helm`,
        state: { [`${F}.seats.helm`]: 1 },
        expiry: { kind: 'permanent' }
      } satisfies EffectInstance
    ];
  }

  it('unseated (acquired or not): drive/dash/fuel/boost are structurally absent, and there is never a Juke', () => {
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

  it('seated at the Helm: drive/dash/fuel/boost all surface — still NO Juke', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHelm() });
    for (const id of [`drive-${ID}`, `dash-${ID}`, `set-${ID}-fuel`, `set-${ID}-boost`])
      expect(
        out.availableRules.some((r) => r.rule.id === id),
        `${id} surfaces at the Helm`
      ).toBe(true);
    // The stat block carries no Reaction: no Juke exists even with a driver
    // seated (the spec omits `juke`, so the factory never emits the offer).
    expect(out.availableRules.some((r) => r.rule.id === `juke-${ID}`)).toBe(false);
  });

  it('the dash risk note interpolates the GRINDER allowance: 3 + CON mod 4 = 7, from the facts', () => {
    const out = evaluate({
      modules: [module()],
      committed: seatedAtHelm(),
      planned: [{ instanceId: 'i0', ruleId: `dash-${ID}` }]
    });
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.dash.no_bonus_action`, severity: 'error' },
      { code: `${T}.dash.risk`, severity: 'notice', params: { allowance: 7 } }
    ]);
  });

  it('the dash risk template interpolates {{allowance}} in BOTH locales', () => {
    for (const [locale, dict] of [
      ['en', en],
      ['en-x-tlh', tlh]
    ] as const) {
      const value = i18nAt(dict, `rule.${ID}.dash.risk`);
      expect(value, `${locale} dash risk exists`).toEqual(expect.any(String));
      expect(value, `${locale} interpolates {{allowance}}`).toContain('{{allowance}}');
    }
  });
});

describe('seats — the Helm, the Chomper, the Wrecking Ball and the Harpoon Flinger', () => {
  /** A committed seat effect for a station (the take's advertise shape). */
  function seatAt(station: string): EffectInstance {
    return {
      id: `effect-${ID}-seat-${station}`,
      key: `${ID}-seat-${station}`,
      state: { [`${F}.seats.${station}`]: 1 },
      expiry: { kind: 'permanent' }
    };
  }

  it('take applies ONE keyed seat effect under the vehicle stem; the chip files under the subject', () => {
    const out = evaluate({
      modules: [module()],
      committed: acquired(),
      planned: [{ instanceId: 'i0', ruleId: `take-${ID}-helm-seat` }]
    });
    const seat = out.effects.find((e) => e.id.endsWith(`effect-${ID}-seat-helm`));
    expect(seat, 'the fold advertises the keyed seat effect').toBeDefined();
    expect(seat!.key).toBe(`${ID}-seat-helm`);
    expect(seat!.state).toEqual({ [`${F}.seats.helm`]: 1 });
    expect(seat!.display).toEqual({
      name: `${T}.seat-helm-effect.name`,
      section: 'mount',
      subject: SUBJECT
    });
  });

  it('the capacity derive counts each held seat toward the 8: helm alone reads 1/8', () => {
    const helm = evaluate({ modules: [module()], committed: [...acquired(), seatAt('helm')] });
    expect(helm.facts[`${F}.creatureCapacity.used`]).toBe(1);
    // The Chomper and the Wrecking Ball are seat-CONSUMING stations like
    // every Grinder station: their held facts count the same way.
    const chomper = evaluate({
      modules: [module()],
      committed: [...acquired(), seatAt('chomper')]
    });
    expect(chomper.facts[`${F}.creatureCapacity.used`]).toBe(1);
    const ball = evaluate({
      modules: [module()],
      committed: [...acquired(), seatAt('wrecking-ball')]
    });
    expect(ball.facts[`${F}.creatureCapacity.used`]).toBe(1);
    // All four seats held is the planned-anyway state (one seat per player):
    // the derive still counts every held fact — 4 of 8.
    const all = evaluate({
      modules: [module()],
      committed: [
        ...acquired(),
        seatAt('helm'),
        seatAt('chomper'),
        seatAt('harpoon'),
        seatAt('wrecking-ball')
      ]
    });
    expect(all.facts[`${F}.creatureCapacity.used`]).toBe(4);
  });

  it('leave is illegal while the seat is unheld; take carries the two legs with the DG keys', () => {
    const out = evaluate({ modules: [module()], committed: acquired() });
    const leave = out.availableRules.find((r) => r.rule.id === `leave-${ID}-helm-seat`);
    expect(leave, 'the leave offer exists once acquired').toBeDefined();
    expect(leave!.legal).toBe(false);
    expect(leave!.diagnostics).toEqual([{ code: `${T}.leave-seat.not_seated`, severity: 'error' }]);
    const take = out.availableRules.find((r) => r.rule.id === `take-${ID}-helm-seat`);
    expect(take, 'the take offer exists once acquired').toBeDefined();
    expect(take!.legal).toBe(true);
    expect(take!.diagnostics).toEqual([]);
    // The take's TWO legs, off the raw catalog offer (the seat-consuming
    // station's full set — exclusivity plus the free-seat rule).
    const raw = module().offer!({ selections: {} }).find((o) => o.id === `take-${ID}-helm-seat`)!;
    expect(raw.legalWhen).toHaveLength(2);
    expect(raw.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
    expect(raw.legalWhen![1]!.diagnostics).toEqual([
      { code: `${T}.take-seat.full`, severity: 'error' }
    ]);
  });

  it('one seat per player WITHIN the vehicle: seated at the Helm, the harpoon take is illegal-but-committable', () => {
    const out = evaluate({
      modules: [module()],
      committed: [...acquired(), seatAt('helm')],
      planned: [{ instanceId: 'i0', ruleId: `take-${ID}-harpoon-seat` }]
    });
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
    // The override still applies — the ONE keyed harpoon seat, nothing stacked.
    expect(out.facts[`${F}.seats.harpoon`]).toBe(1);
  });

  it('the seat-cover contribution: the Helm grants ¾ (2), the Chomper, Wrecking Ball and Harpoon Flinger ½ (1)', () => {
    // The #497 seam: the factory derives the best HELD seat onto the shared
    // player-level cover.seat fact (combine max) — DG seats are data-only.
    const helm = evaluate({ modules: [module()], committed: [...acquired(), seatAt('helm')] });
    expect(helm.facts['cover.seat']).toBe(2);
    const chomper = evaluate({
      modules: [module()],
      committed: [...acquired(), seatAt('chomper')]
    });
    expect(chomper.facts['cover.seat']).toBe(1);
    const ball = evaluate({
      modules: [module()],
      committed: [...acquired(), seatAt('wrecking-ball')]
    });
    expect(ball.facts['cover.seat']).toBe(1);
    const harpoon = evaluate({
      modules: [module()],
      committed: [...acquired(), seatAt('harpoon')]
    });
    expect(harpoon.facts['cover.seat']).toBe(1);
    // Helm-and-chomper held (planned-anyway): the more protective degree
    // wins, never a sum.
    const both = evaluate({
      modules: [module()],
      committed: [...acquired(), seatAt('helm'), seatAt('chomper')]
    });
    expect(both.facts['cover.seat']).toBe(2);
  });

  it('every seat i18n key exists in BOTH locales (tlh is the canary)', () => {
    expectStringInBothLocales([
      `rule.${ID}.take-helm-seat.name`,
      `rule.${ID}.take-helm-seat.description`,
      `rule.${ID}.leave-helm-seat.name`,
      `rule.${ID}.leave-helm-seat.description`,
      `rule.${ID}.seat-helm-effect.name`,
      `rule.${ID}.take-chomper-seat.name`,
      `rule.${ID}.take-chomper-seat.description`,
      `rule.${ID}.leave-chomper-seat.name`,
      `rule.${ID}.leave-chomper-seat.description`,
      `rule.${ID}.seat-chomper-effect.name`,
      `rule.${ID}.take-wrecking-ball-seat.name`,
      `rule.${ID}.take-wrecking-ball-seat.description`,
      `rule.${ID}.leave-wrecking-ball-seat.name`,
      `rule.${ID}.leave-wrecking-ball-seat.description`,
      `rule.${ID}.seat-wrecking-ball-effect.name`,
      `rule.${ID}.take-harpoon-seat.name`,
      `rule.${ID}.take-harpoon-seat.description`,
      `rule.${ID}.leave-harpoon-seat.name`,
      `rule.${ID}.leave-harpoon-seat.description`,
      `rule.${ID}.seat-harpoon-effect.name`,
      `rule.${ID}.take-seat.already_seated`,
      `rule.${ID}.take-seat.full`,
      `rule.${ID}.leave-seat.not_seated`
    ]);
  });
});

describe('the Harpoon Flinger fire offer (the weapon-station machinery)', () => {
  it('gated on the harpoon seat: dice line +5 to hit, 2d8 piercing, NO damage bonus', () => {
    const seated = evaluate({
      modules: [module()],
      committed: [
        ...acquired(),
        {
          id: `effect-${ID}-seat-harpoon`,
          key: `${ID}-seat-harpoon`,
          state: { [`${F}.seats.harpoon`]: 1 },
          expiry: { kind: 'permanent' }
        } satisfies EffectInstance
      ]
    });
    const fire = seated.availableRules.find((r) => r.rule.id === `fire-${ID}-harpoon`)!;
    expect(fire, 'seated at the flinger, the fire offer exists').toBeDefined();
    expect(fire.rule.ui).toEqual({
      section: 'action-attack',
      subject: SUBJECT,
      name: `${T}.fire-harpoon.name`,
      description: `${T}.fire-harpoon.description`,
      detailKey: 'vehicle/demon-grinder-harpoon',
      intents: { ATTACK: 'weapons' },
      actionCost: ['action'],
      annotationLabels: ['dice.any.companion'],
      primaryControl: {
        type: 'dice-line',
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
          {
            sides: 8,
            count: 2,
            bonus: { var: 'damageBonus' },
            purpose: 'damage',
            damageType: { string: 'piercing' }
          }
        ]
      }
    });
    expect(fire.rule.vars).toEqual({
      hitBonus: { capture: true, default: { fact: `${F}.harpoon.hitBonus` } },
      damageDie: { default: { number: 8 } },
      damageBonus: { capture: true, default: { fact: `${F}.harpoon.damageBonus` } }
    });
    // The derives the dice line reads: +5 to hit, +0 damage (2d8 carries no
    // bonus — the Grinder's flinger, not the Tormentor's +2).
    expect(seated.facts[`${F}.harpoon.hitBonus`]).toBe(5);
    expect(seated.facts[`${F}.harpoon.damageBonus`]).toBe(0);
  });

  it('nobody at the flinger (even at the Helm): no fire offer, and the fire i18n keys exist', () => {
    const atHelm = evaluate({
      modules: [module()],
      committed: [
        ...acquired(),
        {
          id: `effect-${ID}-seat-helm`,
          key: `${ID}-seat-helm`,
          state: { [`${F}.seats.helm`]: 1 },
          expiry: { kind: 'permanent' }
        } satisfies EffectInstance
      ]
    });
    expect(atHelm.availableRules.some((r) => r.rule.id === `fire-${ID}-harpoon`)).toBe(false);
    expectStringInBothLocales([
      `rule.${ID}.fire-harpoon.name`,
      `rule.${ID}.fire-harpoon.description`,
      `rule.${ID}.fire-harpoon.no_action`
    ]);
  });

  it('firing spends the GENERIC action — no attack-pool facts of any kind', () => {
    const out = evaluate({
      modules: [module(), getModule('action-economy')!],
      committed: [
        ...acquired(),
        {
          id: `effect-${ID}-seat-harpoon`,
          key: `${ID}-seat-harpoon`,
          state: { [`${F}.seats.harpoon`]: 1 },
          expiry: { kind: 'permanent' }
        } satisfies EffectInstance
      ],
      planned: [{ instanceId: 'i0', ruleId: `fire-${ID}-harpoon` }]
    });
    expect(out.facts['actions.spent']).toBe(1);
    // No attack accounting: nothing granted, nothing charged — a vehicle
    // action is not a PC weapon attack (no Extra Attack either way).
    expect(out.facts['attacks.spent']).toBeUndefined();
    expect(out.facts['attackAction.extraRemaining']).toBeUndefined();
    // The seat stays taken; the vehicle's state is untouched.
    expect(out.facts[`${F}.seats.harpoon`]).toBe(1);
  });
});

describe('the Chomper bite offer (PR-6, the same machinery)', () => {
  /** A committed chomper seat beside the acquire. */
  function atTheChomper(): EffectInstance[] {
    return [
      ...acquired(),
      {
        id: `effect-${ID}-seat-chomper`,
        key: `${ID}-seat-chomper`,
        state: { [`${F}.seats.chomper`]: 1 },
        expiry: { kind: 'permanent' }
      } satisfies EffectInstance
    ];
  }

  it('gated on the chomper seat: dice line +9 to hit, 6d6+4 piercing', () => {
    const seated = evaluate({ modules: [module()], committed: atTheChomper() });
    const bite = seated.availableRules.find((r) => r.rule.id === `fire-${ID}-chomper`)!;
    expect(bite, 'seated at the chomper, the bite offer exists').toBeDefined();
    expect(bite.rule.ui).toEqual({
      section: 'action-attack',
      subject: SUBJECT,
      name: `${T}.fire-chomper.name`,
      description: `${T}.fire-chomper.description`,
      detailKey: 'vehicle/demon-grinder-chomper',
      intents: { ATTACK: 'weapons' },
      actionCost: ['action'],
      annotationLabels: ['dice.any.companion'],
      primaryControl: {
        type: 'dice-line',
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
          {
            sides: 6,
            count: 6,
            bonus: { var: 'damageBonus' },
            purpose: 'damage',
            damageType: { string: 'piercing' }
          }
        ]
      }
    });
    expect(bite.rule.vars).toEqual({
      hitBonus: { capture: true, default: { fact: `${F}.chomper.hitBonus` } },
      damageDie: { default: { number: 6 } },
      damageBonus: { capture: true, default: { fact: `${F}.chomper.damageBonus` } }
    });
    // The derives the dice line reads: +9 to hit, +4 damage (6d6 PLUS the
    // machine's grinding force — the ball's bonus shape, not the flinger's).
    expect(seated.facts[`${F}.chomper.hitBonus`]).toBe(9);
    expect(seated.facts[`${F}.chomper.damageBonus`]).toBe(4);
  });

  it('nobody at the chomper (even at the Helm): no bite offer; the fire i18n keys exist', () => {
    const atHelm = evaluate({
      modules: [module()],
      committed: [
        ...acquired(),
        {
          id: `effect-${ID}-seat-helm`,
          key: `${ID}-seat-helm`,
          state: { [`${F}.seats.helm`]: 1 },
          expiry: { kind: 'permanent' }
        } satisfies EffectInstance
      ]
    });
    expect(atHelm.availableRules.some((r) => r.rule.id === `fire-${ID}-chomper`)).toBe(false);
    expectStringInBothLocales([
      `rule.${ID}.fire-chomper.name`,
      `rule.${ID}.fire-chomper.description`,
      `rule.${ID}.fire-chomper.no_action`
    ]);
  });

  it('the ground-to-bits rider rides the OFFER COPY in BOTH locales', () => {
    // The stat block's one Chomper rider — a target reduced to 0 hit points
    // is ground to bits and spat out through the vehicle's pipes, its
    // nonmagical items destroyed — is copy only (the GM adjudicates what was
    // held or carried; nothing in the engine models the kill): the bite
    // description must state it in every locale. tlh carries the rider in its
    // own words (tlhIchvo' ngeHlu' — sent out through the pipes) rather than
    // English.
    const english = i18nAt(en, `rule.${ID}.fire-chomper.description`);
    expect(english, 'en bite description exists').toEqual(expect.any(String));
    expect(english, 'en states the 0-hit-points trigger').toContain('0 hit points');
    expect(english, 'en states the pipes').toContain('pipes');
    expect(english, 'en states the item destruction').toMatch(/nonmagical items .*destroyed/i);
    const klingon = i18nAt(tlh, `rule.${ID}.fire-chomper.description`);
    expect(klingon, 'en-x-tlh bite description exists').toEqual(expect.any(String));
    expect(klingon, 'en-x-tlh states the ground-to-bits rider').toContain("tlhIchvo' ngeHlu'");
  });

  it('biting spends the GENERIC action — no attack-pool facts of any kind', () => {
    const out = evaluate({
      modules: [module(), getModule('action-economy')!],
      committed: atTheChomper(),
      planned: [{ instanceId: 'i0', ruleId: `fire-${ID}-chomper` }]
    });
    expect(out.facts['actions.spent']).toBe(1);
    expect(out.facts['attacks.spent']).toBeUndefined();
    expect(out.facts['attackAction.extraRemaining']).toBeUndefined();
    // The seat stays taken; the vehicle's state is untouched.
    expect(out.facts[`${F}.seats.chomper`]).toBe(1);
  });
});

describe('the Wrecking Ball swing offer (PR-5, the same machinery)', () => {
  /** A committed wrecking-ball seat beside the acquire. */
  function atTheBall(): EffectInstance[] {
    return [
      ...acquired(),
      {
        id: `effect-${ID}-seat-wrecking-ball`,
        key: `${ID}-seat-wrecking-ball`,
        state: { [`${F}.seats.wrecking-ball`]: 1 },
        expiry: { kind: 'permanent' }
      } satisfies EffectInstance
    ];
  }

  it('gated on the wrecking-ball seat: dice line +9 to hit, 8d8+4 bludgeoning', () => {
    const seated = evaluate({ modules: [module()], committed: atTheBall() });
    const swing = seated.availableRules.find((r) => r.rule.id === `fire-${ID}-wrecking-ball`)!;
    expect(swing, 'seated at the ball, the swing offer exists').toBeDefined();
    expect(swing.rule.ui).toEqual({
      section: 'action-attack',
      subject: SUBJECT,
      name: `${T}.fire-wrecking-ball.name`,
      description: `${T}.fire-wrecking-ball.description`,
      detailKey: 'vehicle/demon-grinder-wrecking-ball',
      intents: { ATTACK: 'weapons' },
      actionCost: ['action'],
      annotationLabels: ['dice.any.companion'],
      primaryControl: {
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
      }
    });
    expect(swing.rule.vars).toEqual({
      hitBonus: { capture: true, default: { fact: `${F}.wrecking-ball.hitBonus` } },
      damageDie: { default: { number: 8 } },
      damageBonus: { capture: true, default: { fact: `${F}.wrecking-ball.damageBonus` } }
    });
    // The derives the dice line reads: +9 to hit, +4 damage (8d8 PLUS the
    // ball's weight — not the flinger's zero-bonus shape).
    expect(seated.facts[`${F}.wrecking-ball.hitBonus`]).toBe(9);
    expect(seated.facts[`${F}.wrecking-ball.damageBonus`]).toBe(4);
  });

  it('nobody at the ball (even at the Helm): no swing offer; the fire i18n keys exist', () => {
    const atHelm = evaluate({
      modules: [module()],
      committed: [
        ...acquired(),
        {
          id: `effect-${ID}-seat-helm`,
          key: `${ID}-seat-helm`,
          state: { [`${F}.seats.helm`]: 1 },
          expiry: { kind: 'permanent' }
        } satisfies EffectInstance
      ]
    });
    expect(atHelm.availableRules.some((r) => r.rule.id === `fire-${ID}-wrecking-ball`)).toBe(false);
    expectStringInBothLocales([
      `rule.${ID}.fire-wrecking-ball.name`,
      `rule.${ID}.fire-wrecking-ball.description`,
      `rule.${ID}.fire-wrecking-ball.no_action`
    ]);
  });

  it('the doubled-damage rider rides the OFFER COPY in BOTH locales', () => {
    // The stat block's one Wrecking Ball rider — damage doubled against
    // objects and structures — is copy only (the GM adjudicates what counts;
    // no mechanic doubles anything): the swing description must state it in
    // every locale. tlh carries the rider in its own words (cha'logh qIp —
    // the damage strikes twice) rather than English.
    const english = i18nAt(en, `rule.${ID}.fire-wrecking-ball.description`);
    expect(english, 'en swing description exists').toEqual(expect.any(String));
    expect(english, 'en states the doubled-damage rider').toMatch(/doubl/i);
    expect(english, 'en names what the doubling hits').toContain('objects and structures');
    const klingon = i18nAt(tlh, `rule.${ID}.fire-wrecking-ball.description`);
    expect(klingon, 'en-x-tlh swing description exists').toEqual(expect.any(String));
    expect(klingon, 'en-x-tlh states the doubled-damage rider').toContain("cha'logh qIp");
  });

  it('swinging spends the GENERIC action — no attack-pool facts of any kind', () => {
    const out = evaluate({
      modules: [module(), getModule('action-economy')!],
      committed: atTheBall(),
      planned: [{ instanceId: 'i0', ruleId: `fire-${ID}-wrecking-ball` }]
    });
    expect(out.facts['actions.spent']).toBe(1);
    expect(out.facts['attacks.spent']).toBeUndefined();
    expect(out.facts['attackAction.extraRemaining']).toBeUndefined();
    // The seat stays taken; the vehicle's state is untouched.
    expect(out.facts[`${F}.seats.wrecking-ball`]).toBe(1);
  });
});

describe('cross-vehicle one-seat exclusivity (both REAL vehicles loaded)', () => {
  /** The registered Tormentor module + its committed acquire. */
  function tormentorAcquired(): { mod: RuleModule; committed: EffectInstance[] } {
    const mod = getModule('tormentor')!;
    return {
      mod,
      committed: [
        // The Tormentor acquire effect (the exported helper's exact shape).
        ...(
          evaluate({
            modules: [mod],
            planned: [{ instanceId: 't0', ruleId: 'acquire-tormentor' }]
          }).effects ?? []
        ).filter((e) => e.id.endsWith('effect-tormentor-acquire'))
      ]
    };
  }

  it('seated on the TORMENTOR, the Demon Grinder helm take is illegal-but-committable', () => {
    const { mod, committed } = tormentorAcquired();
    const out = evaluate({
      modules: [module(), mod],
      committed: [
        ...committed,
        ...acquired(),
        {
          id: 'effect-tormentor-seat-helm',
          key: 'tormentor-seat-helm',
          state: { 'companion.tormentor.seats.helm': 1 },
          expiry: { kind: 'permanent' }
        } satisfies EffectInstance
      ]
    });
    const take = out.availableRules.find((r) => r.rule.id === `take-${ID}-helm-seat`)!;
    expect(take).toBeDefined();
    expect(take.legal).toBe(false);
    expect(take.diagnostics).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
  });

  it('seated on the DEMON GRINDER, the Tormentor helm take is illegal — and vice versa legal once left', () => {
    const { mod, committed } = tormentorAcquired();
    const grinderSeated = [
      ...committed,
      ...acquired(),
      {
        id: `effect-${ID}-seat-harpoon`,
        key: `${ID}-seat-harpoon`,
        state: { [`${F}.seats.harpoon`]: 1 },
        expiry: { kind: 'permanent' }
      } satisfies EffectInstance
    ];
    const out = evaluate({ modules: [module(), mod], committed: grinderSeated });
    const take = out.availableRules.find((r) => r.rule.id === 'take-tormentor-helm-seat')!;
    expect(take).toBeDefined();
    expect(take.legal).toBe(false);
    expect(take.diagnostics).toEqual([
      { code: 'rule.tormentor.take-seat.already_seated', severity: 'error' }
    ]);
    // The DG seat left: the Tormentor take is legal again (the eviction
    // closes the leg exactly as within-vehicle leaves do).
    const left = evaluate({
      modules: [module(), mod],
      committed: grinderSeated.filter((e) => e.key !== `${ID}-seat-harpoon`)
    });
    const reopened = left.availableRules.find((r) => r.rule.id === 'take-tormentor-helm-seat');
    expect(reopened, 'the Tormentor take is offered again').toBeDefined();
    expect(reopened!.legal).toBe(true);
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
      `${ID}-destroyed`,
      `${ID}-seat-helm`,
      `${ID}-seat-chomper`,
      `${ID}-seat-wrecking-ball`,
      `${ID}-seat-harpoon`
    ]) {
      const evict = out.effects.find((e) => e.key === key);
      expect(evict, `abandon advertises the ${key} eviction`).toBeDefined();
      expect(evict!.state).toBeUndefined();
      expect(evict!.expiry).toEqual({ kind: 'permanent' });
    }
    expect(out.facts[`${F}.active`]).toBeUndefined();
    expect(out.facts[`${F}.hp.max`]).toBe(0);
  });

  it('a held seat dies with the abandon: the seat fact and its cover contribution go', () => {
    const out = evaluate({
      modules: [module()],
      committed: [
        ...acquired(),
        {
          id: `effect-${ID}-seat-helm`,
          key: `${ID}-seat-helm`,
          state: { [`${F}.seats.helm`]: 1 },
          expiry: { kind: 'permanent' }
        } satisfies EffectInstance
      ],
      planned: [{ instanceId: 'i0', ruleId: `abandon-${ID}` }]
    });
    // The seat FACT vanishes with its effect (absent — an unset fact reads 0
    // wherever it is consumed), while the DERIVED cover contribution settles
    // back to 0 (it stays registered).
    expect(out.facts[`${F}.seats.helm`]).toBeUndefined();
    expect(out.facts['cover.seat']).toBe(0);
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
