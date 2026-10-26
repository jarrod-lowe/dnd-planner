import { describe, it, expect } from 'vitest';
import { evaluate, type FactReader, type RuleModule } from '$lib/rules-engine';
import { getModule, isRegistered } from '$lib/rules-engine/registry';
import { lazyRuleGroupIds } from '$lib/rules-engine/lazy';
import { deriveTopBarEntries, deriveResourceEntries } from '$lib/play/derivePanels';
import { resolveValueSource } from '$lib/components/play/panel-renderer/resolveValueSource';
import type { SliderControl } from '$lib/components/play/panel-renderer/types';
import type { VarDefinition } from '$lib/rules-view';
import type { EffectInstance } from '$lib/rules-engine';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * Tormentor — the rule group owning the whole VEHICLE (the one subject it has
 * so far; later stations join this same group as their own subjects). Bringing
 * the vehicle in is ACQUIRING it — equipping a vehicle, not manning a station
 * (the seat fiction is retired): acquiring is a PLAYER action (an ungated
 * free-section offer with NO vehicle subject) whose apply advertises one
 * permanent KEYED effect baking the display-only stat block into
 * `companion.tormentor.*` facts. Acquiring makes the VEHICLE's +ADD panel
 * available: the abandon offer carries the vehicle subject and replaces the
 * acquire effect by key (the steed dismiss pattern). The effect display
 * carries `section: 'mount'` plus a `detailKey` — the first mount chip that
 * FLIPS to a stat-block detail — and the module declares its subject's
 * top-bar entries as data (`panels`), so the vehicle surfaces without any
 * play-layer change.
 */

const ID = 'tormentor';
const T = 'rule.tormentor';
const SUBJECT = 'tormentor';
const F = 'companion.tormentor';

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
    planned: [{ instanceId: 'i0', ruleId: 'acquire-tormentor' }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-acquire'));
  expect(advertised, 'acquiring applies exactly one named effect').toHaveLength(1);
  return advertised[0]!;
}

describe('tormentor registration', () => {
  it('is registered in the registry AND the lazy chunk map', () => {
    expect(isRegistered(ID)).toBe(true);
    expect(lazyRuleGroupIds()).toContain(ID);
  });
});

describe('acquire offer ui', () => {
  it('is an ungated free-section PLAYER offer: no vehicle subject, linking the detail', () => {
    const offers = module().offer!({ selections: {} });
    expect(offers.map((o) => o.id)).toEqual([
      'acquire-tormentor',
      'set-tormentor-occupancy',
      'set-tormentor-ac-mode',
      'record-tormentor-damage',
      'record-tormentor-heal',
      'knock-tormentor-prone',
      'flip-tormentor-upright',
      'take-tormentor-passenger-seat',
      'leave-tormentor-passenger-seat',
      'abandon-tormentor'
    ]);
    const ui = offers[0]!.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    // Acquiring is a PLAYER action: the offer must NOT carry the vehicle
    // subject, or it would file under the vehicle's +ADD panel instead of the
    // player's — a panel that does not exist until the acquire effect does.
    expect(ui.subject).toBeUndefined();
    expect(ui.name).toBe(`${T}.acquire.name`);
    expect(ui.description).toBe(`${T}.acquire.description`);
    expect(ui.detailKey).toBe('vehicle/tormentor');
    expect(ui.actionCost).toEqual([]);
    // Acquiring is EQUIPPING a vehicle: the BUILD family's EQUIP verb, in the
    // 'vehicle' sub-bucket (not the HANDLE gear bucket the records use).
    expect(ui.intents).toEqual({ EQUIP: 'vehicle' });
    // Structurally ungated — no `when`, the offer exists for every character —
    // but ONE legality leg now: acquiring while a Tormentor is already present
    // is ILLEGAL (one vehicle per character, for now), never hidden. The leg
    // itself is pinned in the acquire-legality describe below.
    expect(offers[0]!.when).toBeUndefined();
    expect(offers[0]!.legalWhen).toHaveLength(1);
  });
});

/**
 * ONE vehicle per character, for now (a later pass lifts this for multiples):
 * acquiring while a Tormentor is already present is ILLEGAL, never hidden —
 * the already-have legality leg (the knocked-prone already-prone idiom, the
 * engine's illegal-but-visible contract). The offer keeps NO structural `when`
 * (it stays in the player's +ADD while present), the player may override, and
 * the committed re-acquire is the ONE keyed replacement — the facts stay
 * single, nothing stacks.
 */

/** A reader with the vehicle's presence fact (`active`) set or absent. */
function presenceReader(active: number): FactReader {
  return {
    num: (n) => (n === `${F}.active` ? active : 0),
    has: (n) => n === `${F}.active` && active > 0
  };
}

describe('acquire legality (already have)', () => {
  it('is the ONE legality leg on the otherwise structurally ungated offer', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'acquire-tormentor')!;
    // `when` stays undefined: the offer exists for every character, present or
    // not — the already-present state is `legalWhen`, never a structural gate
    // (the engine's illegal-but-visible contract: the offer stays visible and
    // applicable, flagged illegal, and the player may override).
    expect(raw.when).toBeUndefined();
    expect(raw.legalWhen).toHaveLength(1);
    // …and the legality leg is the already-have one: legal with no vehicle,
    // illegal the moment the presence fact the acquire effect bakes stands.
    expect(raw.legalWhen![0]!.condition(presenceReader(0))).toBe(true);
    expect(raw.legalWhen![0]!.condition(presenceReader(1))).toBe(false);
    expect(raw.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.acquire.already_have`, severity: 'error' }
    ]);
  });

  it('stays VISIBLE but ILLEGAL while a Tormentor is present, with its diagnostic (never hidden)', () => {
    // The engine's illegal-but-visible contract (plan.ts): an illegal offer
    // stays applicable with its diagnostic — the player overrides; the engine
    // never makes an illegal action impossible. Abandon is the legal way out.
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const acquire = out.availableRules.find((r) => r.rule.id === 'acquire-tormentor');
    expect(acquire, 'the acquire is still offered while present').toBeDefined();
    expect(acquire!.legal).toBe(false);
    expect(acquire!.diagnostics).toEqual([
      { code: `${T}.acquire.already_have`, severity: 'error' }
    ]);
    const abandon = out.availableRules.find((r) => r.rule.id === 'abandon-tormentor');
    expect(abandon, 'the abandon is offered while present').toBeDefined();
    expect(abandon!.legal).toBe(true);
    // The committed state is untouched by the gate.
    expect(out.facts[`${F}.active`]).toBe(1);
  });

  it('a planned-anyway re-acquire while ILLEGAL still applies, carrying its diagnostic', () => {
    // The plan.ts contract (the player-override path): an illegal planned row
    // EXECUTES — the keyed replacement re-advertises the ONE acquire
    // (newest-wins, so the facts stay single; nothing stacks) while the row
    // carries the already-have diagnostic.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'acquire-tormentor' }]
    });
    const keyed = out.effects.filter((e) => e.key === 'tormentor-acquire');
    expect(keyed, 'the illegal row still advertises exactly one acquire').toHaveLength(1);
    expect(out.facts[`${F}.active`]).toBe(1);
    expect(out.facts[`${F}.hp.base`]).toBe(60);
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.acquire.already_have`, severity: 'error' }
    ]);
  });

  it('carries the already-have diagnostic message in BOTH locales (tlh is the canary)', () => {
    const messages: Record<string, string | undefined> = {
      en: en.rule.tormentor.acquire?.already_have,
      'en-x-tlh': tlh.rule.tormentor.acquire?.already_have
    };
    for (const [where, value] of Object.entries(messages))
      expect(value, where).toEqual(expect.any(String));
  });
});

describe('abandon offer', () => {
  it('sits in the VEHICLE panel under the subject, free section, while acquired', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const abandon = out.availableRules.find((r) => r.rule.id === 'abandon-tormentor');
    expect(abandon, 'the vehicle +ADD carries the abandon offer').toBeDefined();
    const ui = abandon!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.abandon.name`);
    expect(ui.description).toBe(`${T}.abandon.description`);
    expect(ui.actionCost).toEqual([]);
    // Abandoning files beside acquiring: EQUIP 'vehicle', the BUILD family.
    expect(ui.intents).toEqual({ EQUIP: 'vehicle' });
  });

  it('is gated structurally on active (when) with no legality gates', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'abandon-tormentor')!;
    // `when` (not `legalWhen`): with no vehicle acquired, the abandon action
    // does not exist at all — there is nothing to show as illegal.
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
  });

  it('is absent while no vehicle is acquired (structural gate on active)', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'abandon-tormentor')).toBe(false);
  });

  it('apply replaces the acquire effect by key, clearing every baked fact', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'abandon-tormentor' }]
    });
    // One advertised marker sharing the acquire key — the steed dismiss pattern:
    // newest same-key effect evicts the older, so the facts go with it.
    const advertised = out.effects.filter((e) => e.id.endsWith('effect-abandon-tormentor'));
    expect(advertised).toHaveLength(1);
    expect(advertised[0]!.key).toBe('tormentor-acquire');
    expect(advertised[0]!.expiry).toEqual({ kind: 'permanent' });
    // Hidden bookkeeping: no display, or a chip would linger on the strip.
    expect(advertised[0]!.display).toBeUndefined();
    // …and it EVICTS the occupancy record with the acquire effect (the steed
    // dismiss/child-eviction pattern): a stateless same-key marker.
    const evict = out.effects.find((e) => e.key === 'tormentor-occupancy');
    expect(evict, 'abandon advertises the occupancy eviction').toBeDefined();
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    // The baked facts are GONE (absent — unset facts read as 0 downstream, and
    // the panel gates key on presence, so the subject's chips all withdraw).
    expect(out.facts[`${F}.active`]).toBeUndefined();
    expect(out.facts[`${F}.ac.value`]).toBeUndefined();
    expect(out.facts[`${F}.hp.base`]).toBeUndefined();
    expect(out.facts[`${F}.damageThreshold`]).toBeUndefined();
    // hp.max/hp.current are DERIVED now (the steed shape): the contributions
    // stay registered, so unacquired they settle to 0 rather than vanishing —
    // the top-bar gate keys on `active`, which IS gone, so the chip withdraws.
    expect(out.facts[`${F}.hp.max`]).toBe(0);
    expect(out.facts[`${F}.hp.current`]).toBe(0);
  });
});

describe('acquire effect', () => {
  it('bakes the display-only stat block as one permanent keyed effect', () => {
    const e = acquireEffect();
    expect(e.id).toBe('i0#0#effect-tormentor-acquire');
    expect(e.key).toBe('tormentor-acquire');
    expect(e.expiry).toEqual({ kind: 'permanent' });
    expect(e.state).toEqual({
      [`${F}.active`]: 1,
      // AC mode (pass 4): the acquire selection is baked as the 0/1 MODE fact —
      // the flat ac.value bake is GONE (AC is derived as ac.effective below, so
      // a legacy persisted acquire's stale ac.value is inert, never a conflict).
      [`${F}.acMotionless`]: 0,
      // HP bakes its BASE (the pool derives max/current from it — the steed
      // shape) plus the stat block's damage threshold as DATA, so the recorder
      // gates on a fact rather than a literal in the module.
      [`${F}.hp.base`]: 60,
      [`${F}.damageThreshold`]: 10,
      [`${F}.speed`]: 100,
      [`${F}.cargo`]: 500,
      [`${F}.str`]: 16,
      [`${F}.dex`]: 14,
      [`${F}.con`]: 14,
      [`${F}.str.modifier`]: 3,
      [`${F}.dex.modifier`]: 2,
      [`${F}.con.modifier`]: 2,
      // Creature Capacity 4 Medium creatures — the occupancy slider's max.
      [`${F}.creatureCapacity.max`]: 4
    });
  });

  it('owns every vehicle record as a dependent (raw mount-chip removal cascades)', () => {
    // Raw chip removal runs through playStore's removeEffect, which evicts the
    // removed effect's declared dependents by key (the generic mechanism is
    // pinned in playStore.test.ts). What THIS pins is the declaration: every
    // record effect key, so removing the mount chip can never strand a recorded
    // occupancy, a prone record, an HP record or a destroyed wreck under a
    // abandoned vehicle.
    expect(acquireEffect().dependents).toEqual([
      'tormentor-occupancy',
      'tormentor-ac-mode',
      'tormentor-prone',
      'tormentor-hp-damage',
      'tormentor-hp-heal',
      'tormentor-destroyed',
      'tormentor-seat-passenger'
    ]);
  });

  it('displays as a mount chip on its subject that FLIPS to the detail', () => {
    // The steed's mount chip never carried a detailKey; this is the first.
    // The bridge copies display.detailKey onto the effect chip's ui, which is
    // what ActiveStateStrip's flip path reads.
    expect(acquireEffect().display).toEqual({
      name: `${T}.effect.name`,
      section: 'mount',
      subject: SUBJECT,
      detailKey: 'vehicle/tormentor'
    });
  });
});

describe('occupancy offer', () => {
  it('is a vehicle free-section slider offer while acquired (steed HP-modifier shape)', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'set-tormentor-occupancy');
    expect(offer, 'the vehicle +ADD carries the occupancy offer').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.occupancy.name`);
    expect(ui.description).toBe(`${T}.occupancy.description`);
    expect(ui.actionCost).toEqual([]);
    expect(ui.intents).toEqual({ HANDLE: 'gear' });
    // The slider is bounded by the stat block's baked capacity (not a literal),
    // so a later vehicle with a different stat block needs no module change.
    expect(ui.primaryControl).toEqual({
      type: 'slider',
      var: 'occupancy',
      min: { number: 0 },
      max: { fact: `${F}.creatureCapacity.max` }
    });
    // Opens at the RECORDED BASE, never the derived `used`: the seat pass made
    // used = occupancy + held seats, so a seat-inclusive default double-counts
    // the seated player and inflates on every accepted re-record (the
    // resolution behaviour is pinned in the capture-default describe below).
    expect(offer!.rule.vars).toEqual({
      occupancy: { capture: true, default: { fact: `${F}.creatureCapacity.occupancy` } }
    });
  });

  it('is gated structurally on active (when) with no legality gates', () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'set-tormentor-occupancy'
    )!;
    // `when`, like abandon: unacquired the vehicle action does not exist at
    // all. Over-capacity occupancy is illegal-but-possible (no legalWhen) —
    // diagnostics are deferred with acquiring's.
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
  });

  it('is absent while unacquired', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'set-tormentor-occupancy')).toBe(false);
  });

  it('apply advertises ONE permanent keyed effect storing the selection, with a live-value chip', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [
        { instanceId: 'i0', ruleId: 'set-tormentor-occupancy', selections: { occupancy: 3 } }
      ]
    });
    const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-occupancy'));
    expect(advertised).toHaveLength(1);
    expect(advertised[0]!.key).toBe('tormentor-occupancy');
    expect(advertised[0]!.expiry).toEqual({ kind: 'permanent' });
    // The keyed effect IS the stored value (the steed HP-modifier semantics):
    // re-applying replaces, removing the chip clears the modification.
    expect(advertised[0]!.state).toEqual({ [`${F}.creatureCapacity.occupancy`]: 3 });
    // A vehicle-scoped strip chip showing the live derived used — the steed
    // damage-chip displayFact pattern (no detailKey: this chip does not flip).
    expect(advertised[0]!.display).toEqual({
      name: `${T}.occupancy-effect.name`,
      section: 'mount',
      subject: SUBJECT,
      displayFact: `${F}.creatureCapacity.used`
    });
  });

  it('the chip name template carries the live count — {{score}} in BOTH locales', () => {
    // EffectChip renders a displayFact chip as $t(name, { score: liveValue }):
    // a name without the {{score}} placeholder drops the occupant count and
    // shows bare "Occupancy". sveltekit-i18n interpolates DOUBLE braces only,
    // and score is the chip's sole param — pinned per locale (en-x-tlh is the
    // canary for exactly this class of bug).
    const templates: Record<string, string | undefined> = {
      en: en.rule.tormentor['occupancy-effect'].name,
      'en-x-tlh': tlh.rule.tormentor['occupancy-effect'].name
    };
    for (const [locale, name] of Object.entries(templates)) {
      expect(name, `${locale} name template exists`).toBeDefined();
      expect(name?.match(/{{[a-zA-Z]+}}/g), `${locale} interpolates exactly {{score}}`).toEqual([
        '{{score}}'
      ]);
    }
  });
});

/**
 * PR-A — the passenger seat: the seat infrastructure's first station. A seat
 * is a PLAYER-side permanent keyed effect per station (state
 * `companion.tormentor.seats.<station> = 1`, chip under the vehicle panel —
 * the prone/ac-mode effect display pattern), taken and left by a TAKE/LEAVE
 * offer pair in the vehicle's +ADD. Both offers are illegal-but-COMMITTABLE
 * on their legs (the duplicate-acquire pattern): ONE seat per player
 * GLOBALLY (the exclusivity leg reads EVERY station's seat fact, so a later
 * station joins by extending the list) and the free-seat rule (used >= max),
 * with the leave's not-seated leg the flip-upright idiom. The derived
 * capacity counts held seats beside the recorded occupancy; the seat key
 * rides the acquire lifecycle like every other record.
 */

/** The passenger-seat effect, through the real plan fold (acquired, then taken). */
function seatPlannedEffect(): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-passenger-seat' }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-seat-passenger'));
  expect(advertised, 'taking the seat applies exactly one named effect').toHaveLength(1);
  return advertised[0]!;
}

describe('creature capacity derive', () => {
  /**
   * Evaluate acquired with an occupancy row planned at `occupancy` (omitted:
   * none) and, optionally, the passenger seat committed or planned. The seat
   * pass changed the formula: used = recorded occupancy + every HELD SEAT,
   * clamped to 0..max — the default-1 acquirer is RETIRED (a fresh vehicle
   * reads 0/4 until someone takes a seat or records an occupancy).
   */
  const usedAt = (n?: number, seat?: { committed?: boolean }): number | undefined => {
    const committed = [acquireEffect(), ...(seat?.committed ? [seatPlannedEffect()] : [])];
    return evaluate({
      modules: [module()],
      committed,
      planned: [
        ...(n === undefined
          ? []
          : [
              { instanceId: 'i0', ruleId: 'set-tormentor-occupancy', selections: { occupancy: n } }
            ]),
        ...(seat && !seat.committed
          ? [{ instanceId: 'i1', ruleId: 'take-tormentor-passenger-seat' }]
          : [])
      ]
    }).facts[`${F}.creatureCapacity.used`];
  };

  it('reads 0 while acquired with no record and no seat (the default-1 acquirer is retired)', () => {
    expect(usedAt()).toBe(0);
  });

  it('reads the recorded occupancy', () => {
    expect(usedAt(3)).toBe(3);
    // 0 is a RECORD (the vehicle emptied), not the unset default.
    expect(usedAt(0)).toBe(0);
  });

  it('counts a held seat beside the occupancy (committed and merely planned)', () => {
    // The seat alone: 0 + 1.
    expect(usedAt(undefined, { committed: true })).toBe(1);
    expect(usedAt(undefined, {})).toBe(1);
    // Occupancy 3 + the seated player = 4 of 4.
    expect(usedAt(3, { committed: true })).toBe(4);
    expect(usedAt(3, {})).toBe(4);
  });

  it('clamps the SUM to 0..max (the slider bound is UI-only)', () => {
    expect(usedAt(99)).toBe(4);
    expect(usedAt(-2)).toBe(0);
    // Occupancy at the max PLUS a seat: the read clamps at the max, never 5.
    expect(usedAt(4, { committed: true })).toBe(4);
  });

  it('reads 0 while unacquired (the acquire default is not a free occupant)', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(0);
  });
});

/**
 * The occupancy slider's CAPTURE DEFAULT. The default reads the RECORDED BASE
 * (`creatureCapacity.occupancy`), never the derived `used`: the seat pass made
 * used = occupancy + held seats, so a seat-inclusive default DOUBLE-COUNTS a
 * seated player — recorded 2 + seated reads used 3, the slider would open at
 * 3, accepting that writes occupancy 3 → used 4, and every repeat inflates by
 * one more. Reading the base keeps the two counters in their lanes: the slider
 * records the NPCs, the seat counts the player. An UNRECORDED occupancy
 * resolves to undefined and the slider falls back to its min (0) — an
 * INTENDED behaviour change: with no record the default is 0, because the
 * seated player is counted via their seat, not via the slider.
 */
describe('occupancy slider capture default', () => {
  /**
   * The slider's opening value, computed exactly as PanelSlider does: the
   * captured-default resolution against the engine's FINAL facts (the same
   * resolveValueSource call the component makes), falling back to the resolved
   * min when the default fact is unrecorded.
   */
  function sliderOpensAt(committed: EffectInstance[]): number {
    const out = evaluate({ modules: [module()], committed });
    const offer = out.availableRules.find((r) => r.rule.id === 'set-tormentor-occupancy');
    expect(offer, 'the occupancy offer exists while acquired').toBeDefined();
    const control = (offer!.rule.ui as Record<string, unknown>).primaryControl as SliderControl;
    const vars = offer!.rule.vars as Record<string, VarDefinition>;
    const min = (resolveValueSource(control.min, out.facts, vars) as number) ?? 0;
    const resolved = resolveValueSource({ var: control.var }, out.facts, vars) as
      | number
      | undefined;
    return resolved ?? min;
  }

  it('a held seat alone does not lift the default: the slider opens at 0 (the seat counts the player)', () => {
    // Seat, no occupancy record: used reads 1, but the slider must NOT open at
    // the seat-inclusive 1 — accepting that would write occupancy 1 and count
    // the player twice.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()]
    });
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(1);
    expect(out.facts[`${F}.creatureCapacity.occupancy`]).toBeUndefined();
    expect(sliderOpensAt([acquireEffect(), seatPlannedEffect()])).toBe(0);
  });

  it('recorded occupancy beside a held seat: the slider opens at the recorded base while used reads the sum', () => {
    // Recorded 2 + seated: used reads 3, but the slider opens at 2 — accepting
    // the default re-writes the base it came from, not the seat-inclusive sum.
    const committed = [acquireEffect(), seatPlannedEffect(), occupancyEffect(2)];
    const out = evaluate({ modules: [module()], committed });
    expect(out.facts[`${F}.creatureCapacity.occupancy`]).toBe(2);
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(3);
    expect(sliderOpensAt(committed)).toBe(2);
  });

  it('accepting the default is idempotent: a re-record at the opening value keeps used at 3 (no inflation)', () => {
    // The double-count repro, end to end: open the slider (default), accept it
    // unchanged. The occupancy record stays 2 and used stays 3 — with a
    // seat-inclusive default this row would write 3 and read used 4, and every
    // repeat would add one more.
    const committed = [acquireEffect(), seatPlannedEffect(), occupancyEffect(2)];
    const opening = sliderOpensAt(committed);
    const out = evaluate({
      modules: [module()],
      committed,
      planned: [
        { instanceId: 'i0', ruleId: 'set-tormentor-occupancy', selections: { occupancy: opening } }
      ]
    });
    expect(out.facts[`${F}.creatureCapacity.occupancy`]).toBe(2);
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(3);
  });
});

/** A reader for the acquired vehicle at the given seat facts / capacity read. */
function seatLegReader(seats: Record<string, number>, used = 0, max = 4): FactReader {
  const prefix = `${F}.seats.`;
  return {
    num: (n) => {
      if (n === `${F}.active`) return 1;
      if (n === `${F}.creatureCapacity.used`) return used;
      if (n === `${F}.creatureCapacity.max`) return max;
      if (n.startsWith(prefix)) return seats[n.slice(prefix.length)] ?? 0;
      return 0;
    },
    has: (n) =>
      n.startsWith(prefix) ? (seats[n.slice(prefix.length)] ?? 0) > 0 : n === `${F}.active`
  };
}

/** The occupancy record a row at `n` advertises, for committing as stored state. */
function occupancyEffect(n: number): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-occupancy', selections: { occupancy: n } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-occupancy'));
  expect(advertised, `an occupancy row at ${n} advertises exactly one record`).toHaveLength(1);
  return advertised[0]!;
}

describe('take-tormentor-passenger-seat offer', () => {
  it('is a vehicle free-section EQUIP offer while acquired, beside abandon', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'take-tormentor-passenger-seat');
    expect(offer, 'the vehicle +ADD carries the take-seat offer').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.take-seat.name`);
    expect(ui.description).toBe(`${T}.take-seat.description`);
    expect(ui.actionCost).toEqual([]);
    // Seat offers file with the acquire/abandon EQUIP 'vehicle' family (the
    // BUILD family's sub-bucket), not the HANDLE gear bucket the records use.
    expect(ui.intents).toEqual({ EQUIP: 'vehicle' });
    // Acquired and unseated at 0/4: legal, no diagnostics.
    expect(offer!.legal).toBe(true);
    expect(offer!.diagnostics).toEqual([]);
  });

  it('is gated structurally on acquired ONLY (when); the seat state is legality', () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'take-tormentor-passenger-seat'
    )!;
    // `when` like every vehicle action: unacquired there is no vehicle to sit
    // in, so the offer does not exist at all. The seat/capacity states are
    // `legalWhen` legs, never structural gates (illegal-but-visible).
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toHaveLength(2);
  });

  it('is absent while unacquired', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'take-tormentor-passenger-seat')).toBe(
      false
    );
  });

  it('leg (a): one seat per player GLOBALLY — the leg reads EVERY station, not just passenger', () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'take-tormentor-passenger-seat'
    )!;
    const leg = raw.legalWhen![0]!;
    // Legal with no seat held anywhere…
    expect(leg.condition(seatLegReader({}))).toBe(true);
    // …and illegal the moment ANY station's seat fact stands — re-taking the
    // seat you hold is the same diagnostic path as holding another station's.
    expect(leg.condition(seatLegReader({ passenger: 1 }))).toBe(false);
    // A station with no offers yet still counts: the leg iterates the station
    // list, so a later station joins exclusivity by extending it.
    expect(leg.condition(seatLegReader({ helm: 1 }))).toBe(false);
    expect(leg.condition(seatLegReader({ clinger: 1 }))).toBe(false);
    expect(leg.diagnostics).toEqual([{ code: `${T}.take-seat.already_seated`, severity: 'error' }]);
  });

  it('leg (b): the free-seat rule — illegal at used >= max, legal below', () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'take-tormentor-passenger-seat'
    )!;
    const leg = raw.legalWhen![1]!;
    expect(leg.condition(seatLegReader({}, 0, 4))).toBe(true);
    expect(leg.condition(seatLegReader({}, 3, 4))).toBe(true);
    expect(leg.condition(seatLegReader({}, 4, 4))).toBe(false);
    expect(leg.diagnostics).toEqual([{ code: `${T}.take-seat.full`, severity: 'error' }]);
  });

  it('apply advertises ONE permanent keyed effect writing exactly the seat fact, with the chip', () => {
    const e = seatPlannedEffect();
    expect(e.id).toContain('effect-tormentor-seat-passenger');
    expect(e.key).toBe('tormentor-seat-passenger');
    // EXACT equality: the state writes the namespaced seat fact and NOTHING
    // else — boarding never touches occupancy or any other record.
    expect(e.state).toEqual({ [`${F}.seats.passenger`]: 1 });
    expect(e.expiry).toEqual({ kind: 'permanent' });
    // The at-a-glance "where am I seated" chip under the vehicle panel — the
    // prone/ac-mode effect display pattern (no detailKey: no passenger detail
    // exists, there is nothing to say).
    expect(e.display).toEqual({
      name: `${T}.seat-passenger-effect.name`,
      section: 'mount',
      subject: SUBJECT
    });
  });

  it('stays VISIBLE but ILLEGAL while seated, with its diagnostic (never hidden)', () => {
    // The engine's illegal-but-visible contract (plan.ts): one seat per
    // player, so re-taking is illegal — leave is the legal way out.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()]
    });
    const take = out.availableRules.find((r) => r.rule.id === 'take-tormentor-passenger-seat');
    expect(take, 'the take is still offered while seated').toBeDefined();
    expect(take!.legal).toBe(false);
    expect(take!.diagnostics).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
    const leave = out.availableRules.find((r) => r.rule.id === 'leave-tormentor-passenger-seat');
    expect(leave, 'the leave is offered while seated').toBeDefined();
    expect(leave!.legal).toBe(true);
  });

  it('stays VISIBLE but ILLEGAL at capacity, with the full diagnostic', () => {
    // Recorded occupancy 4 of 4, no seat held: the free-seat rule.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), occupancyEffect(4)]
    });
    const take = out.availableRules.find((r) => r.rule.id === 'take-tormentor-passenger-seat');
    expect(take, 'the take is still offered at capacity').toBeDefined();
    expect(take!.legal).toBe(false);
    expect(take!.diagnostics).toEqual([{ code: `${T}.take-seat.full`, severity: 'error' }]);
  });

  it('a planned-anyway re-take while ILLEGAL still applies, carrying its diagnostic', () => {
    // The plan.ts contract (the player-override path): an illegal planned row
    // EXECUTES — the keyed replacement re-advertises the one seat (newest-wins,
    // so the fact stays single) while the row carries the diagnostic.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-passenger-seat' }]
    });
    const keyed = out.effects.filter((e) => e.key === 'tormentor-seat-passenger');
    expect(keyed, 'the illegal row still advertises exactly one seat').toHaveLength(1);
    expect(out.facts[`${F}.seats.passenger`]).toBe(1);
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
  });

  it('a planned-anyway take at capacity still applies, carrying the full diagnostic', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), occupancyEffect(4)],
      planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-passenger-seat' }]
    });
    // The seat fact lands; the derive clamps the read at the max (4, never 5).
    expect(out.facts[`${F}.seats.passenger`]).toBe(1);
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(4);
    expect(out.planDiagnostics['i0']).toEqual([{ code: `${T}.take-seat.full`, severity: 'error' }]);
  });
});

describe('leave-tormentor-passenger-seat offer', () => {
  it('is a vehicle free-section EQUIP offer while acquired, mirroring the take', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()]
    });
    const offer = out.availableRules.find((r) => r.rule.id === 'leave-tormentor-passenger-seat');
    expect(offer, 'the vehicle +ADD carries the leave-seat offer').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.leave-seat.name`);
    expect(ui.description).toBe(`${T}.leave-seat.description`);
    expect(ui.actionCost).toEqual([]);
    expect(ui.intents).toEqual({ EQUIP: 'vehicle' });
    // Seated: legal, no diagnostics.
    expect(offer!.legal).toBe(true);
    expect(offer!.diagnostics).toEqual([]);
  });

  it('is gated structurally on acquired ONLY (when); the held seat is the legality gate', () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'leave-tormentor-passenger-seat'
    )!;
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toHaveLength(1);
    // The leg is THIS station's seat (the flip-upright not-prone idiom): legal
    // while the passenger seat is held…
    expect(raw.legalWhen![0]!.condition(seatLegReader({ passenger: 1 }))).toBe(true);
    // …illegal without it — even when ANOTHER station's seat is held (each
    // leave offer clears its own station's seat).
    expect(raw.legalWhen![0]!.condition(seatLegReader({}))).toBe(false);
    expect(raw.legalWhen![0]!.condition(seatLegReader({ helm: 1 }))).toBe(false);
    expect(raw.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.leave-seat.not_seated`, severity: 'error' }
    ]);
  });

  it('is absent while unacquired', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'leave-tormentor-passenger-seat')).toBe(
      false
    );
  });

  it('is VISIBLE but ILLEGAL while not seated, with its diagnostic (never hidden)', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const leave = out.availableRules.find((r) => r.rule.id === 'leave-tormentor-passenger-seat');
    expect(leave, 'the leave is offered while unseated').toBeDefined();
    expect(leave!.legal).toBe(false);
    expect(leave!.diagnostics).toEqual([{ code: `${T}.leave-seat.not_seated`, severity: 'error' }]);
  });

  it('apply advertises the EMPTY same-key eviction — the flip-upright idiom', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'leave-tormentor-passenger-seat' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-passenger'));
    expect(evict, 'leave advertises the seat eviction').toBeDefined();
    expect(evict!.key).toBe('tormentor-seat-passenger');
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    // The seat fact is GONE the moment the row is merely planned (newest-wins),
    // and the capacity derive falls with it.
    expect(out.facts[`${F}.seats.passenger`]).toBeUndefined();
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(0);
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
  });

  it('leaving never touches the occupancy or any other vehicle state', () => {
    // Recorded occupancy 2 beside the held seat (used 3): leaving drops used
    // to the recorded occupancy alone — the record, the acquire and the stats
    // are untouched.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect(), occupancyEffect(2)],
      planned: [{ instanceId: 'i0', ruleId: 'leave-tormentor-passenger-seat' }]
    });
    expect(out.facts[`${F}.seats.passenger`]).toBeUndefined();
    expect(out.facts[`${F}.creatureCapacity.occupancy`]).toBe(2);
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(2);
    expect(out.facts[`${F}.active`]).toBe(1);
    expect(out.facts[`${F}.hp.max`]).toBe(60);
  });

  it('a planned-anyway leave while NOT seated still executes as a no-op eviction, with its diagnostic', () => {
    // The get-up-while-standing precedent: the illegal row still runs, so the
    // empty same-key eviction lands beside nothing to evict (a fact no-op) and
    // the row carries the not-seated diagnostic.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'leave-tormentor-passenger-seat' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-passenger'));
    expect(evict, 'the illegal row still advertises the eviction').toBeDefined();
    expect(out.facts[`${F}.seats.passenger`]).toBeUndefined();
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.leave-seat.not_seated`, severity: 'error' }
    ]);
  });
});

describe('the seat rides the acquire lifecycle', () => {
  it('a re-acquire advertises the empty same-key eviction beside the acquire effect', () => {
    // A keyed replacement alone does not fire dependents, so the re-acquire
    // clears the seat explicitly (the steed recast/child-eviction pattern): a
    // fresh acquire starts with NO seat — used reads 0/4 until one is taken.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'acquire-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-passenger'));
    expect(evict, 're-acquire advertises the seat eviction').toBeDefined();
    expect(evict!.key).toBe('tormentor-seat-passenger');
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    expect(out.facts[`${F}.seats.passenger`]).toBeUndefined();
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(0);
  });

  it('abandon advertises the same eviction while clearing every baked fact', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'abandon-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-passenger'));
    expect(evict, 'abandon advertises the seat eviction').toBeDefined();
    expect(evict!.state).toBeUndefined();
    expect(out.facts[`${F}.seats.passenger`]).toBeUndefined();
    expect(out.facts[`${F}.active`]).toBeUndefined();
  });
});

describe('passenger seat i18n (tlh is the canary)', () => {
  it('the offer names/descriptions, chip name and diagnostics exist in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en take name': en.rule.tormentor['take-seat']?.name,
      'en-x-tlh take name': tlh.rule.tormentor['take-seat']?.name,
      'en take description': en.rule.tormentor['take-seat']?.description,
      'en-x-tlh take description': tlh.rule.tormentor['take-seat']?.description,
      'en already seated': en.rule.tormentor['take-seat']?.already_seated,
      'en-x-tlh already seated': tlh.rule.tormentor['take-seat']?.already_seated,
      'en full': en.rule.tormentor['take-seat']?.full,
      'en-x-tlh full': tlh.rule.tormentor['take-seat']?.full,
      'en leave name': en.rule.tormentor['leave-seat']?.name,
      'en-x-tlh leave name': tlh.rule.tormentor['leave-seat']?.name,
      'en leave description': en.rule.tormentor['leave-seat']?.description,
      'en-x-tlh leave description': tlh.rule.tormentor['leave-seat']?.description,
      'en not seated': en.rule.tormentor['leave-seat']?.not_seated,
      'en-x-tlh not seated': tlh.rule.tormentor['leave-seat']?.not_seated,
      'en chip name': en.rule.tormentor['seat-passenger-effect']?.name,
      'en-x-tlh chip name': tlh.rule.tormentor['seat-passenger-effect']?.name
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

// The acquired stat facts (every gate the declarations read, plus the pool the
// HP chip renders).
const BOARDED = {
  [`${F}.active`]: 1,
  [`${F}.ac.effective`]: 21,
  [`${F}.hp.max`]: 60,
  [`${F}.hp.current`]: 60,
  [`${F}.speed`]: 100,
  [`${F}.cargo`]: 500,
  [`${F}.str.modifier`]: 3,
  [`${F}.dex.modifier`]: 2,
  [`${F}.con.modifier`]: 2,
  [`${F}.creatureCapacity.max`]: 4,
  [`${F}.creatureCapacity.used`]: 1
};

describe('module-declared panel entries', () => {
  it('top bar: a usedMax HP chip (current/max) + AC/Speed/Cargo value chips + a STR/DEX/CON ability chip, stamped with the subject', () => {
    expect(deriveTopBarEntries(BOARDED, [module()]).filter((e) => e.subject === SUBJECT)).toEqual([
      {
        // The HP chip becomes a POOL with the damageable pass: usedMax renders
        // "remaining/total", so it reads "45/60" — the steed's HP chip shape.
        type: 'usedMax',
        label: 'play.stats.tormentor.hp',
        total: `${F}.hp.max`,
        remaining: `${F}.hp.current`,
        subject: SUBJECT
      },
      {
        type: 'value',
        label: 'play.stats.tormentor.ac',
        fact: `${F}.ac.effective`,
        subject: SUBJECT
      },
      {
        type: 'value',
        label: 'play.stats.tormentor.speed',
        fact: `${F}.speed`,
        subject: SUBJECT
      },
      {
        // Cargo capacity: display-only like the rest of the stat block.
        type: 'value',
        label: 'play.stats.tormentor.cargo',
        fact: `${F}.cargo`,
        subject: SUBJECT
      },
      {
        // Like the steed's chip but THREE abilities and no saveFact (a vehicle
        // makes no saves of its own; Int/Wis/Cha do not exist on the stat block).
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

  it('resources: one usedMax creature-capacity row reading used/max, stamped with the subject', () => {
    expect(deriveResourceEntries(BOARDED, [module()]).filter((e) => e.subject === SUBJECT)).toEqual(
      [
        {
          // usedMax renders "remaining/total" — for capacity that is USED/max
          // ("3/4"): the row counts occupants, not open seats.
          type: 'usedMax',
          label: 'play.stats.tormentor.creatureCapacity',
          total: `${F}.creatureCapacity.max`,
          remaining: `${F}.creatureCapacity.used`,
          subject: SUBJECT
        }
      ]
    );
  });

  it('holds every entry back while unacquired (the gate fact is absent)', () => {
    expect(deriveTopBarEntries({}, [module()]).some((e) => e.subject === SUBJECT)).toBe(false);
  });
});

/**
 * Pass 2 — vehicle prone + Prone Deficiency: STATE TRACKING ONLY. The fact is
 * namespaced (`companion.tormentor.prone`) under its own keyed
 * effect, never the player-global `condition.prone` (the builder's
 * `proneEffect()` would flip the PLAYER's attack flags, notice and movement
 * legs). Recorded from the vehicle's +ADD and flipped upright by an empty
 * same-key eviction; the BOARD is each offer's one structural gate (`when`),
 * while the prone state itself is a LEGALITY gate (illegal-but-visible, the
 * plan.ts contract — illegal rows stay applicable with diagnostics and still
 * execute; no Speed leg, the vehicle has no movement economy), evicted with
 * the acquire, and carried as a NOTICE while prone (the Life-Bond annotate
 * pattern gated on the prone fact — PC-prone parity: the condition triggers
 * its notice).
 */

/** A reader for the acquired vehicle at the given prone state (gate pins). */
function readerAt(prone: number): FactReader {
  return {
    num: (n) => (n === `${F}.prone` ? prone : n === `${F}.active` ? 1 : 0),
    has: (n) => n === `${F}.prone` || n === `${F}.active`
  };
}

/** The prone record, through the real plan fold (acquired, then knocked). */
function proneEffect(): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-prone'));
  expect(advertised, 'knocked-prone applies exactly one named effect').toHaveLength(1);
  return advertised[0]!;
}

describe('knocked-prone offer', () => {
  it('is a vehicle free-section offer while acquired, LEGAL while upright', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'knock-tormentor-prone');
    expect(offer, 'the vehicle +ADD carries the knocked-prone offer').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.knocked-prone.name`);
    expect(ui.description).toBe(`${T}.knocked-prone.description`);
    // Tapping the offer flips to the VEHICLE's prone detail — the player's
    // condition/prone text would promise crawling and half-Speed recovery a
    // war machine cannot do.
    expect(ui.detailKey).toBe('vehicle/tormentor-prone');
    expect(ui.actionCost).toEqual([]);
    // A vehicle CONDITION files like the PC's: record-prone's CONDITION
    // 'held' sub-bucket (#467 taxonomy), not the HANDLE gear bucket the
    // vehicle's record offers use.
    expect(ui.intents).toEqual({ CONDITION: 'held' });
    // Acquired and upright: legal, no diagnostics.
    expect(offer!.legal).toBe(true);
    expect(offer!.diagnostics).toEqual([]);
  });

  it('is gated structurally on acquired ONLY (when); the prone state is a legality gate', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'knock-tormentor-prone')!;
    // `when` like the other vehicle actions: unacquired, recording a prone for
    // a vehicle nobody rides does not exist at all. The ALREADY-PRONE state is
    // `legalWhen`, never `when` (the engine's illegal-but-visible contract):
    // while prone the offer stays visible and applicable, flagged illegal with
    // its diagnostic, and a planned-anyway row still executes.
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toHaveLength(1);
    // The structural gate is the acquire alone: it holds while prone.
    expect(raw.when!(readerAt(1))).toBe(true);
    // …and the legality leg is the already-prone one.
    expect(raw.legalWhen![0]!.condition(readerAt(0))).toBe(true);
    expect(raw.legalWhen![0]!.condition(readerAt(1))).toBe(false);
    expect(raw.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.knocked-prone.already_prone`, severity: 'error' }
    ]);
  });

  it('is absent while unacquired', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'knock-tormentor-prone')).toBe(false);
  });

  it('stays VISIBLE but ILLEGAL while already prone, with its diagnostic (never hidden)', () => {
    // The engine's illegal-but-visible contract (plan.ts): an illegal offer
    // stays applicable with its diagnostic — the player overrides; the engine
    // never makes an illegal action impossible. Its mirror, flip-upright, is
    // the LEGAL offer now.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), proneEffect()]
    });
    const knock = out.availableRules.find((r) => r.rule.id === 'knock-tormentor-prone');
    expect(knock, 'the knock is still offered while prone').toBeDefined();
    expect(knock!.legal).toBe(false);
    expect(knock!.diagnostics).toEqual([
      { code: `${T}.knocked-prone.already_prone`, severity: 'error' }
    ]);
    const flip = out.availableRules.find((r) => r.rule.id === 'flip-tormentor-upright');
    expect(flip, 'the flip is offered while prone').toBeDefined();
    expect(flip!.legal).toBe(true);
    // The committed state is untouched by the gate.
    expect(out.facts[`${F}.prone`]).toBe(1);
  });

  it('apply advertises ONE permanent keyed effect writing exactly the namespaced fact', () => {
    const e = proneEffect();
    expect(e.key).toBe('tormentor-prone');
    // EXACT equality: the state writes the namespaced fact and NOTHING else —
    // no player-global legs ride along (pinned again, behaviourally, below).
    expect(e.state).toEqual({ [`${F}.prone`]: 1 });
    // Permanent, not the player's untilShortRest: a rest does not right a
    // vehicle — only Flip Upright (or the acquire lifecycle) clears it.
    expect(e.expiry).toEqual({ kind: 'permanent' });
  });

  it('the effect displays as a vehicle chip under the subject that FLIPS to the prone detail', () => {
    // Same flip path as the acquire chip: the bridge copies display.detailKey
    // onto the chip's ui, so tapping the Prone chip opens the vehicle's own
    // condition text (not the player's condition/prone detail).
    expect(proneEffect().display).toEqual({
      name: `${T}.prone-effect.name`,
      section: 'mount',
      subject: SUBJECT,
      detailKey: 'vehicle/tormentor-prone'
    });
  });

  it('a planned-anyway re-record while ILLEGAL still applies, carrying its diagnostic', () => {
    // The plan.ts contract (the player-override path): an illegal planned row
    // EXECUTES — the keyed replacement re-advertises the one record
    // (newest-wins, so still a single prone fact) while the row carries the
    // already-prone diagnostic.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), proneEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
    });
    const keyed = out.effects.filter((e) => e.key === 'tormentor-prone');
    expect(keyed, 'the illegal row still advertises the record').toHaveLength(1);
    expect(out.facts[`${F}.prone`]).toBe(1);
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.knocked-prone.already_prone`, severity: 'error' }
    ]);
  });

  it('carries the already-prone diagnostic message in BOTH locales (tlh is the canary)', () => {
    const messages: Record<string, string | undefined> = {
      en: en.rule.tormentor['knocked-prone']?.already_prone,
      'en-x-tlh': tlh.rule.tormentor['knocked-prone']?.already_prone
    };
    for (const [where, value] of Object.entries(messages))
      expect(value, where).toEqual(expect.any(String));
  });
});

describe('flip-upright offer', () => {
  it('is gated structurally on acquired ONLY (when); prone is a legality gate, both states visible', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'flip-tormentor-upright')!;
    // `when` is the acquire alone (like the knock): while UPRIGHT the offer
    // stays visible and applicable but is flagged ILLEGAL with its not-prone
    // diagnostic (the engine's illegal-but-visible contract, the get-up shape).
    expect(typeof raw.when).toBe('function');
    expect(raw.when!(readerAt(0))).toBe(true);
    expect(raw.when!(readerAt(1))).toBe(true);
    expect(raw.legalWhen).toHaveLength(1);
    expect(raw.legalWhen![0]!.condition(readerAt(1))).toBe(true);
    expect(raw.legalWhen![0]!.condition(readerAt(0))).toBe(false);
    expect(raw.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.flip-upright.not_prone`, severity: 'error' }
    ]);
  });

  it('is offered in BOTH prone states: legal while prone, illegal-but-visible while upright', () => {
    // Acquired and upright: the flip EXISTS (nothing hides it) and is illegal.
    const upright = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const uprightFlip = upright.availableRules.find((r) => r.rule.id === 'flip-tormentor-upright');
    expect(uprightFlip, 'the flip is offered while upright').toBeDefined();
    expect(uprightFlip!.legal).toBe(false);
    expect(uprightFlip!.diagnostics).toEqual([
      { code: `${T}.flip-upright.not_prone`, severity: 'error' }
    ]);
    // Acquired and prone (the record planned this very turn): flippable now.
    const prone = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
    });
    const proneFlip = prone.availableRules.find((r) => r.rule.id === 'flip-tormentor-upright');
    expect(proneFlip).toBeDefined();
    expect(proneFlip!.legal).toBe(true);
    expect(proneFlip!.diagnostics).toEqual([]);
  });

  it('sits in the vehicle panel, free section, while prone', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
    });
    const offer = out.availableRules.find((r) => r.rule.id === 'flip-tormentor-upright');
    expect(offer).toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.flip-upright.name`);
    expect(ui.description).toBe(`${T}.flip-upright.description`);
    // The condition-END offer flips to the same vehicle-prone detail as its
    // recorder: the player tapping either wants what fallen-prone means here.
    expect(ui.detailKey).toBe('vehicle/tormentor-prone');
    expect(ui.actionCost).toEqual([]);
    // The vehicle's condition-END offer files with its condition (the 'held'
    // bucket — "Prone (both offers)" in the #467 taxonomy), so both prone
    // offers sit under the Conditions grouping in the vehicle +ADD. (The
    // PLAYER's Get Up is a MOVE 'rise' offer because it spends movement; the
    // free vehicle flip is not a movement action.)
    expect(ui.intents).toEqual({ CONDITION: 'held' });
  });

  it('apply advertises the EMPTY same-key eviction (the get-up idiom)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), proneEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'flip-tormentor-upright' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-prone'));
    expect(evict, 'flip-upright advertises the prone eviction').toBeDefined();
    expect(evict!.key).toBe('tormentor-prone');
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    // The fact is GONE the moment the row is merely planned (newest-wins): no
    // effect writes it, so the key vanishes — unset reads as 0 downstream.
    expect(out.facts[`${F}.prone`]).toBeUndefined();
  });

  it('a planned-anyway flip while upright still executes as a no-op eviction, with its diagnostic', () => {
    // The get-up-while-standing precedent: the illegal row still runs, so the
    // empty same-key eviction lands beside nothing to evict (a fact no-op) and
    // the row carries the not-prone diagnostic — the override path never
    // silently swallows the plan.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'flip-tormentor-upright' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-prone'));
    expect(evict, 'the illegal row still advertises the eviction').toBeDefined();
    expect(out.facts[`${F}.prone`]).toBeUndefined();
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.flip-upright.not_prone`, severity: 'error' }
    ]);
  });

  it('carries the not-prone diagnostic message in BOTH locales (tlh is the canary)', () => {
    const messages: Record<string, string | undefined> = {
      en: en.rule.tormentor['flip-upright']?.not_prone,
      'en-x-tlh': tlh.rule.tormentor['flip-upright']?.not_prone
    };
    for (const [where, value] of Object.entries(messages))
      expect(value, where).toEqual(expect.any(String));
  });
});

describe('prone never touches the player-global condition', () => {
  it('condition.prone and its attack flags stay unset by this module', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
    });
    // The player-global prone chassis (condition.prone + the STR/DEX attack
    // disadvantage flags the rollers read) must never be written by the
    // vehicle's record — a prone VEHICLE is not a prone PLAYER.
    expect(out.facts['condition.prone']).toBeUndefined();
    expect(out.facts['attack.str.disadvantage']).toBeUndefined();
    expect(out.facts['attack.dex.disadvantage']).toBeUndefined();
    // …while the namespaced fact is live.
    expect(out.facts[`${F}.prone`]).toBe(1);
  });
});

describe('prone eviction rides the acquire lifecycle', () => {
  it('a re-acquire advertises the empty same-key eviction beside the acquire effect', () => {
    // A keyed replacement alone does not fire dependents, so the re-acquire
    // resets prone explicitly (the occupancy re-acquire pattern): a fresh acquire
    // starts upright.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), proneEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'acquire-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-prone'));
    expect(evict, 're-acquire advertises the prone eviction').toBeDefined();
    expect(evict!.state).toBeUndefined();
    expect(out.facts[`${F}.prone`]).toBeUndefined();
  });

  it('abandon advertises the same eviction while clearing every baked fact', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), proneEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'abandon-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-prone'));
    expect(evict, 'abandon advertises the prone eviction').toBeDefined();
    expect(evict!.state).toBeUndefined();
    expect(out.facts[`${F}.prone`]).toBeUndefined();
    expect(out.facts[`${F}.active`]).toBeUndefined();
  });
});

describe('prone-deficiency notice', () => {
  it('stands only while the vehicle is PRONE, with the vehicle as its source', () => {
    // Acquired but upright: NO notice — the notice is the condition's, not the
    // acquire's (PC-prone parity: the player's Prone notice stands only while
    // prone, and a merely-acquired vehicle has nothing to warn about).
    const upright = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(
      upright.annotations.some((a) => a.key === `${T}.notice`),
      'no notice while acquired and upright'
    ).toBe(false);
    // Prone: the notice stands (the Life-Bond annotate pattern), sourced on
    // the vehicle.
    const prone = evaluate({
      modules: [module()],
      committed: [acquireEffect(), proneEffect()]
    });
    const notice = prone.annotations.find((a) => a.key === `${T}.notice`);
    expect(notice, 'a notice stands while the vehicle is prone').toBeDefined();
    expect(notice!.targets).toEqual(['notice']);
    expect(notice!.source).toBe(`${T}.effect.name`);
    expect(notice!.body).toBe(`${T}.notice.body`);
  });

  it('tracks the prone state: flipping upright or abandoning withdraws it', () => {
    // Flipped upright (the eviction merely PLANNED — newest-wins clears the
    // fact now): the condition is gone, so its notice goes with it…
    const flipped = evaluate({
      modules: [module()],
      committed: [acquireEffect(), proneEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'flip-tormentor-upright' }]
    });
    expect(flipped.annotations.some((a) => a.key === `${T}.notice`)).toBe(false);
    // …and the unacquired vehicle carries no notice at all (the prone record
    // never outlives the acquire).
    const unacquired = evaluate({ modules: [module()] });
    expect(unacquired.annotations.some((a) => a.key === `${T}.notice`)).toBe(false);
  });

  it('carries the notice label, body and chip name in BOTH locales (tlh is the canary)', () => {
    const strings: Record<string, string | undefined> = {
      'en notice label': en.rule.tormentor.notice,
      'en-x-tlh notice label': tlh.rule.tormentor.notice,
      'en notice body': en.rule.tormentor['notice.body'],
      'en-x-tlh notice body': tlh.rule.tormentor['notice.body'],
      'en chip name': en.rule.tormentor['prone-effect']?.name,
      'en-x-tlh chip name': tlh.rule.tormentor['prone-effect']?.name
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

/**
 * Pass 3 — damageable HP: the flat display-only `hp.max` baked fact gives way
 * to the steed-shaped pool (base baked on the acquire effect; max/current/
 * modifier derived), recorded from the STATION's +ADD by damage and heal
 * recorders whose ONE keyed untilLongRest effect carries the running total
 * (the steed recorder idiom). The stat block's damage threshold is a BAKED
 * FACT the shared factory consults (threshold model v2, user-corrected
 * 2026-10-26: sub-threshold damage is LEGAL to attempt — the GM tells the
 * player an amount and the player records it): a Use-Threshold blow below the
 * fact records NOTHING and returns a 'notice' diagnostic that rides THAT
 * planned row alone (never an error, never an illegality, never a panel
 * annotation); an Ignore-Threshold blow records the RAW amount in full (the
 * GM correction); at or above the threshold the FULL amount lands (a floor,
 * not a cap). Damage that brings hp.current to 0 ALSO advertises a permanent
 * keyed `tormentor-destroyed` wreck (the steed lethal-check placement, but NO
 * auto-abandon: the acquire effect persists so the wreck stays inspectable)
 * with a standing NOTICE gated on the destroyed fact. Re-acquiring/abandoning
 * evict the HP records and the wreck with everything else.
 */

/** The HP record effect ids/keys the vehicle recorders advertise. */
const HP_DAMAGE_EFFECT = 'effect-tormentor-hp-damage';
const HP_HEAL_EFFECT = 'effect-tormentor-hp-heal';
const DESTROYED_EFFECT = 'effect-tormentor-destroyed';

/** Plan ONE damage row at `amount` on a committed acquire (the real plan fold). */
function planDamage(amount: number) {
  return evaluate({
    modules: [module()],
    committed: [acquireEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'record-tormentor-damage', selections: { amount } }]
  });
}

/** The damage-record effect a row at `amount` advertises (exactly one). */
function damageRecordEffect(amount: number): EffectInstance {
  const out = planDamage(amount);
  const advertised = out.effects.filter((e) => e.id.endsWith(HP_DAMAGE_EFFECT));
  expect(advertised, `a ${amount}-damage row advertises exactly one record`).toHaveLength(1);
  return advertised[0]!;
}

/** The destroyed-wreck effect a row at `amount` advertises (exactly one). */
function destroyedEffect(): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'record-tormentor-damage', selections: { amount: 60 } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith(DESTROYED_EFFECT));
  expect(advertised, 'a destroying blow advertises exactly one wreck').toHaveLength(1);
  return advertised[0]!;
}

describe('vehicle HP pool derives', () => {
  it('derives the steed-shaped pool from the baked base while acquired', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(out.facts[`${F}.hp.max`]).toBe(60);
    expect(out.facts[`${F}.hp.current`]).toBe(60);
    expect(out.facts[`${F}.hp.modifier.current`]).toBe(0);
    // The threshold is data beside the pool it gates.
    expect(out.facts[`${F}.damageThreshold`]).toBe(10);
  });

  it('current = currentHp(max, modifier): damage drops it, heals lift it, floored at 0', () => {
    // 25 damage planned: 60/60 → 35/60.
    expect(planDamage(25).facts[`${F}.hp.current`]).toBe(35);
    // The modifier reads heals − damage (the steed derive), so a committed
    // damage record plus a planned heal nets out.
    const healed = evaluate({
      modules: [module()],
      committed: [acquireEffect(), damageRecordEffect(30)],
      planned: [{ instanceId: 'i0', ruleId: 'record-tormentor-heal', selections: { amount: 10 } }]
    });
    expect(healed.facts[`${F}.hp.modifier.current`]).toBe(-20);
    expect(healed.facts[`${F}.hp.current`]).toBe(40);
  });

  it('reads 0 while unacquired (contributions stay registered, gated on active)', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.facts[`${F}.hp.max`]).toBe(0);
    expect(out.facts[`${F}.hp.current`]).toBe(0);
  });
});

describe('record-tormentor-damage offer', () => {
  it('is a vehicle free-section HEALTH slider while acquired, gated on the acquire ONLY', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'record-tormentor-damage');
    expect(offer, 'the vehicle +ADD carries the damage recorder').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.record-damage.name`);
    expect(ui.description).toBe(`${T}.record-damage.description`);
    // The recorder carries the DAMAGE detail (threshold/immunities/mishap) —
    // the settled home for the stat block's damage semantics.
    expect(ui.detailKey).toBe('vehicle/tormentor-damage');
    expect(ui.actionCost).toEqual([]);
    // An HP record, not a condition: the steed damage recorder's HEALTH bucket.
    expect(ui.intents).toEqual({ HEALTH: 'hp' });
    expect(ui.primaryControl).toEqual({
      type: 'slider',
      var: 'amount',
      min: { number: 0 },
      max: { fact: `${F}.hp.max` },
      unit: 'hp'
    });
    // The damage panel declares no annotation labels: the below-threshold
    // bounce is a per-row notice, not a panel annotation, so nothing targets it.
    expect(ui.annotationLabels).toBeUndefined();
    // The [Use Threshold | Ignore Threshold] segmented SECONDARY control (the
    // generic factory emission): `enabled.condition` names the baked threshold
    // fact, and PanelRenderer hides a false-gated control — unacquired or
    // threshold-less subjects see exactly the old single-slider look.
    expect(ui.secondaryControl).toEqual({
      type: 'segmented',
      var: 'thresholdMode',
      prefix: 'planner.record.threshold.prefix',
      options: [
        { value: 0, label: 'planner.record.threshold.use' },
        { value: 1, label: 'planner.record.threshold.ignore' }
      ],
      enabled: {
        condition: { fact: `${F}.damageThreshold`, operator: 'greaterThan', value: 0 }
      }
    });
    expect(offer!.rule.vars).toEqual({
      amount: { capture: true, default: { number: 0 } },
      thresholdMode: { capture: true, default: { number: 0 } }
    });
    // LEGAL with no legality gates: sub-threshold damage is legal to attempt
    // (the GM tells the player the amount) — the bounce is post-hoc feedback,
    // never an illegality.
    expect(offer!.legal).toBe(true);
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'record-tormentor-damage'
    )!;
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
  });

  it('is absent while unacquired', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'record-tormentor-damage')).toBe(false);
  });

  it('records the RUNNING total in one keyed untilLongRest effect with a live-value chip', () => {
    const e = damageRecordEffect(25);
    expect(e.key).toBe('tormentor-hp-damage');
    // prior total + this amount — records ADD UP (the steed recorder idiom),
    // never each carrying only its own amount (which would evict the prior).
    expect(e.state).toEqual({ [`${F}.hp.damageRecorded`]: 25 });
    expect(e.expiry).toEqual({ kind: 'untilLongRest' });
    expect(e.display).toEqual({
      name: `${T}.hp-damage-effect.name`,
      section: 'mount',
      subject: SUBJECT,
      displayFact: `${F}.hp.damageRecorded`
    });
  });

  it('sub-threshold damage records NOTHING — a per-row notice diagnostic is the feedback (threshold model v2)', () => {
    const out = planDamage(9);
    // No record effect, no fact change — the blow bounces off the armor plate.
    expect(out.effects).toHaveLength(0);
    expect(out.facts[`${F}.hp.damageRecorded`]).toBeUndefined();
    expect(out.facts[`${F}.hp.current`]).toBe(60);
    // Sub-threshold damage is LEGAL to attempt (the GM tells the player the
    // amount): the feedback is ONE informational notice on THIS row — never an
    // error, and the row and the plan stay legal.
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.record-damage.below_threshold`, severity: 'notice' }
    ]);
    expect(out.plannedOffers['i0']!.legal).toBe(true);
    expect(out.status.legal).toBe(true);
    // No annotation exists — a per-commit bounce is not a standing panel truth.
    expect(out.annotations.some((a) => a.key === `${T}.record-damage.below_threshold`)).toBe(false);
  });

  it('two rows planned: the notice rides the bounced row ONLY (the user repro)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [
        { instanceId: 'i0', ruleId: 'record-tormentor-damage', selections: { amount: 10 } },
        { instanceId: 'i1', ruleId: 'record-tormentor-damage', selections: { amount: 9 } }
      ]
    });
    expect(out.facts[`${F}.hp.damageRecorded`]).toBe(10);
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    expect(out.planDiagnostics['i1']).toEqual([
      { code: `${T}.record-damage.below_threshold`, severity: 'notice' }
    ]);
    expect(out.plannedOffers['i0']!.legal).toBe(true);
    expect(out.plannedOffers['i1']!.legal).toBe(true);
  });

  it('Ignore Threshold records the RAW amount in full (the GM-correction mode)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [
        {
          instanceId: 'i0',
          ruleId: 'record-tormentor-damage',
          selections: { amount: 9, thresholdMode: 1 }
        }
      ]
    });
    expect(out.facts[`${F}.hp.damageRecorded`]).toBe(9);
    expect(out.facts[`${F}.hp.current`]).toBe(51);
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    expect(out.annotations.some((a) => a.key === `${T}.record-damage.below_threshold`)).toBe(false);
  });

  it('threshold and above record the FULL amount (the threshold is a floor, not a cap)', () => {
    expect(planDamage(10).facts[`${F}.hp.damageRecorded`]).toBe(10);
    expect(planDamage(60).facts[`${F}.hp.damageRecorded`]).toBe(60);
  });
});

describe('record-tormentor-heal offer', () => {
  it("is the damage recorder's mirror: vehicle free-section HEALTH slider, no detailKey", () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'record-tormentor-heal');
    expect(offer, 'the vehicle +ADD carries the heal recorder').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.record-heal.name`);
    expect(ui.description).toBe(`${T}.record-heal.description`);
    // Minimal: the damage semantics detail rides the damage offer alone.
    expect(ui.detailKey).toBeUndefined();
    expect(ui.intents).toEqual({ HEALTH: 'hp' });
    expect(ui.primaryControl).toEqual({
      type: 'slider',
      var: 'amount',
      min: { number: 0 },
      max: { fact: `${F}.hp.max` },
      unit: 'hp'
    });
    // The threshold control is the DAMAGE direction's alone: repairs have no
    // threshold semantics and never bounce.
    expect(ui.secondaryControl).toBeUndefined();
    expect(ui.annotationLabels).toBeUndefined();
    expect(offer!.rule.vars).toEqual({ amount: { capture: true, default: { number: 0 } } });
  });

  it('records the running heal CAPPED at the net missing HP (the steed idiom)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), damageRecordEffect(30)],
      planned: [{ instanceId: 'i0', ruleId: 'record-tormentor-heal', selections: { amount: 40 } }]
    });
    const advertised = out.effects.filter((e) => e.id.endsWith(HP_HEAL_EFFECT));
    expect(advertised).toHaveLength(1);
    expect(advertised[0]!.key).toBe('tormentor-hp-heal');
    // 40 healing on 30 damage: back to full, the surplus is lost (never banked
    // to pre-cancel a later blow).
    expect(advertised[0]!.state).toEqual({ [`${F}.hp.healRecorded`]: 30 });
    expect(advertised[0]!.expiry).toEqual({ kind: 'untilLongRest' });
    expect(advertised[0]!.display).toEqual({
      name: `${T}.hp-heal-effect.name`,
      section: 'mount',
      subject: SUBJECT,
      displayFact: `${F}.hp.healRecorded`
    });
    expect(out.facts[`${F}.hp.current`]).toBe(60);
  });
});

describe('destroyed at zero HP', () => {
  it('a destroying blow advertises the permanent keyed wreck BESIDE the damage record', () => {
    const out = planDamage(60);
    expect(out.facts[`${F}.hp.current`]).toBe(0);
    expect(out.facts[`${F}.destroyed`]).toBe(1);
    const e = destroyedEffect();
    expect(e.key).toBe('tormentor-destroyed');
    expect(e.state).toEqual({ [`${F}.destroyed`]: 1 });
    // PERMANENT, unlike the untilLongRest damage record: a long rest restores
    // the pool but never un-burns a war machine.
    expect(e.expiry).toEqual({ kind: 'permanent' });
    expect(e.display).toEqual({
      name: `${T}.destroyed-effect.name`,
      section: 'mount',
      subject: SUBJECT
    });
    // The damage record still lands (the blow happened)…
    expect(out.effects.some((x) => x.id.endsWith(HP_DAMAGE_EFFECT))).toBe(true);
    // …and the BOARD persists (NO auto-abandon — the steed lethal-check
    // placement deliberately stops short of retiring the vehicle): the wreck
    // stays inspectable and the crew can abandon.
    expect(out.facts[`${F}.active`]).toBe(1);
  });

  it('overkill destroys too (exact-0 is the boundary, not the only trigger)', () => {
    expect(planDamage(70).facts[`${F}.destroyed`]).toBe(1);
    expect(planDamage(70).facts[`${F}.hp.current`]).toBe(0);
  });

  it('a destroying-adjacent blow does NOT destroy: 59 of 60 leaves it whole', () => {
    expect(planDamage(59).facts[`${F}.destroyed`]).toBeUndefined();
    expect(planDamage(59).facts[`${F}.hp.current`]).toBe(1);
  });

  it('more damage on a committed wreck keeps the single keyed wreck (idempotent)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), damageRecordEffect(60), destroyedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'record-tormentor-damage', selections: { amount: 10 } }]
    });
    expect(out.facts[`${F}.destroyed`]).toBe(1);
    expect(out.effects.filter((e) => e.key === 'tormentor-destroyed')).toHaveLength(1);
  });
});

describe('destroyed notice', () => {
  it('stands only while the vehicle is destroyed, with the vehicle as its source', () => {
    const whole = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(
      whole.annotations.some((a) => a.key === `${T}.destroyed-notice`),
      'no destroyed notice on a whole vehicle'
    ).toBe(false);
    const wrecked = evaluate({
      modules: [module()],
      committed: [acquireEffect(), destroyedEffect()]
    });
    const notice = wrecked.annotations.find((a) => a.key === `${T}.destroyed-notice`);
    expect(notice, 'a notice stands while the vehicle is destroyed').toBeDefined();
    expect(notice!.targets).toEqual(['notice']);
    expect(notice!.source).toBe(`${T}.effect.name`);
    expect(notice!.body).toBe(`${T}.destroyed-notice.body`);
  });

  it('stands beside the prone notice when both states hold (distinct keys)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), proneEffect(), destroyedEffect()]
    });
    const keys = out.annotations.filter((a) => a.targets.includes('notice')).map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining([`${T}.notice`, `${T}.destroyed-notice`]));
  });
});

describe('HP records and the wreck ride the acquire lifecycle', () => {
  it('a re-acquire advertises the empty same-key evictions beside the acquire effect', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), damageRecordEffect(20), destroyedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'acquire-tormentor' }]
    });
    for (const key of ['tormentor-hp-damage', 'tormentor-hp-heal', 'tormentor-destroyed']) {
      const evict = out.effects.find((e) => e.id.endsWith(`evict-${key}`));
      expect(evict, `re-acquire advertises the ${key} eviction`).toBeDefined();
      expect(evict!.key).toBe(key);
      expect(evict!.state).toBeUndefined();
      expect(evict!.expiry).toEqual({ kind: 'permanent' });
    }
    // A fresh acquire starts whole: no damage banked, no wreck, no notice.
    expect(out.facts[`${F}.hp.damageRecorded`]).toBeUndefined();
    expect(out.facts[`${F}.destroyed`]).toBeUndefined();
    expect(out.facts[`${F}.hp.current`]).toBe(60);
    expect(out.annotations.some((a) => a.key === `${T}.destroyed-notice`)).toBe(false);
  });

  it('abandon advertises the same evictions while clearing every baked fact', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), damageRecordEffect(20), destroyedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'abandon-tormentor' }]
    });
    for (const key of ['tormentor-hp-damage', 'tormentor-hp-heal', 'tormentor-destroyed']) {
      expect(
        out.effects.find((e) => e.id.endsWith(`evict-${key}`)),
        `abandon advertises the ${key} eviction`
      ).toBeDefined();
    }
    expect(out.facts[`${F}.active`]).toBeUndefined();
    expect(out.facts[`${F}.hp.current`]).toBe(0);
  });
});

describe('pass 3 i18n (tlh is the canary)', () => {
  it('the record chip name templates carry the live total — {{score}} in BOTH locales', () => {
    // EffectChip renders a displayFact chip as $t(name, { score: liveValue }):
    // a name without the {{score}} placeholder drops the running total.
    const templates: Record<string, string | undefined> = {
      'en damage chip': en.rule.tormentor['hp-damage-effect']?.name,
      'en-x-tlh damage chip': tlh.rule.tormentor['hp-damage-effect']?.name,
      'en heal chip': en.rule.tormentor['hp-heal-effect']?.name,
      'en-x-tlh heal chip': tlh.rule.tormentor['hp-heal-effect']?.name
    };
    for (const [where, name] of Object.entries(templates)) {
      expect(name, `${where} template exists`).toBeDefined();
      expect(name?.match(/{{[a-zA-Z]+}}/g), `${where} interpolates exactly {{score}}`).toEqual([
        '{{score}}'
      ]);
    }
  });

  it('the below-threshold annotation, destroyed chip and destroyed notice exist in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en below-threshold annotation': en.rule.tormentor['record-damage']?.below_threshold,
      'en-x-tlh below-threshold annotation': tlh.rule.tormentor['record-damage']?.below_threshold,
      'en destroyed chip': en.rule.tormentor['destroyed-effect']?.name,
      'en-x-tlh destroyed chip': tlh.rule.tormentor['destroyed-effect']?.name,
      'en destroyed notice label': en.rule.tormentor['destroyed-notice'],
      'en-x-tlh destroyed notice label': tlh.rule.tormentor['destroyed-notice'],
      'en destroyed notice body': en.rule.tormentor['destroyed-notice.body'],
      'en-x-tlh destroyed notice body': tlh.rule.tormentor['destroyed-notice.body']
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

/**
 * Pass 4 — AC mode (v2: the segmented-control rework; v1's annotation state
 * chip was abandoned, see the plan). The stat block's "AC 21 (19 while
 * motionless)" becomes a MODE the player records, not a standing flag:
 *
 * - The BOARD offer carries a [Moving | Motionless] segmented SECONDARY control
 *   (the find-steed creature-type precedent — a segmented control can only be a
 *   secondaryControl in PanelRenderer) defaulting to Moving, and the acquire
 *   effect bakes the selection as the 0/1 `acMotionless` mode fact. The acquire
 *   effect NO LONGER bakes a flat `ac.value`.
 * - AC is DERIVED as `ac.effective` (19 motionless, else 21, gated on active) —
 *   a deliberately NEW fact name: legacy persisted acquires bake flat ac.value,
 *   and nothing may derive ac.value or the sheet's input/contribution overlap
 *   would throw on every evaluation (the pass-3 hp.max lesson). The stale
 *   legacy ac.value is simply inert, and a legacy acquire derives 21 (Moving)
 *   with the vehicle record working on top of it — no load-seam migration.
 * - The vehicle's +ADD carries an always-present (while acquired) "AC Mode"
 *   record offer — the occupancy intent class, applied IMMEDIATELY — with the
 *   same segmented control pre-showing the CURRENT mode. Its ONE permanent
 *   keyed effect (`tormentor-ac-mode`) stores the mode as the DISTINCT
 *   `acMotionless.recorded` fact: the engine sum-combines two live effects
 *   writing one fact, so a record writing `acMotionless` itself could never
 *   flip a Motionless acquire back to Moving (1 + 0 still reads 1). The derive
 *   prefers the record when present (the occupancy has-preference idiom), so
 *   the record overrides the acquire bake in BOTH directions.
 * - The mode key joins CHILD_KEYS: re-acquire/abandon evict the record, and a
 *   fresh acquire resets to the acquire SELECTION.
 */
describe('acquire offer AC-mode control', () => {
  it('carries a [Moving | Motionless] segmented SECONDARY control defaulting to Moving (creatureType precedent)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'acquire-tormentor')!;
    // Segmented controls are secondaryControl-only in PanelRenderer — find-steed
    // is the precedent for a cast offer's secondary picker.
    expect(raw.ui!.secondaryControl).toEqual({
      type: 'segmented',
      var: 'mode',
      prefix: 'play.choices.tormentor.mode',
      options: [
        { value: 0, label: `${T}.mode.moving` },
        { value: 1, label: `${T}.mode.motionless` }
      ]
    });
    expect(raw.vars).toEqual({ mode: { capture: true, default: { number: 0 } } });
  });

  it('bakes the SELECTED mode (no ac.value bake — AC is derived from here on)', () => {
    // Default (no selection): Moving.
    const moving = acquireEffect();
    expect(moving.state?.[`${F}.acMotionless`]).toBe(0);
    expect(moving.state?.[`${F}.ac.value`]).toBeUndefined();
    // Motionless selected: the selection flows into the effect state exactly
    // the way creatureType flows into the steed effect.
    const out = evaluate({
      modules: [module()],
      planned: [{ instanceId: 'i0', ruleId: 'acquire-tormentor', selections: { mode: 1 } }]
    });
    const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-acquire'));
    expect(advertised).toHaveLength(1);
    expect(advertised[0]!.state?.[`${F}.acMotionless`]).toBe(1);
    expect(advertised[0]!.state?.[`${F}.ac.value`]).toBeUndefined();
  });
});

/** A committed acquire effect at the given acquire-time mode (the real plan fold). */
function acquireEffectAt(mode: number): EffectInstance {
  const out = evaluate({
    modules: [module()],
    planned: [{ instanceId: 'i0', ruleId: 'acquire-tormentor', selections: { mode } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-acquire'));
  expect(advertised, 'acquiring at a mode advertises exactly one acquire effect').toHaveLength(1);
  return advertised[0]!;
}

/** The AC-mode record a vehicle row at `mode` advertises (exactly one). */
function acModeEffect(mode: number): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-ac-mode', selections: { mode } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-ac-mode'));
  expect(advertised, `an AC-mode row at ${mode} advertises exactly one record`).toHaveLength(1);
  return advertised[0]!;
}

describe('ac.effective derive', () => {
  it('reads 21 acquired-and-moving, 19 acquired-and-motionless, 0 unacquired', () => {
    const moving = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(moving.facts[`${F}.ac.effective`]).toBe(21);
    expect(moving.facts[`${F}.acMotionless.current`]).toBe(0);
    const motionless = evaluate({ modules: [module()], committed: [acquireEffectAt(1)] });
    expect(motionless.facts[`${F}.ac.effective`]).toBe(19);
    expect(motionless.facts[`${F}.acMotionless.current`]).toBe(1);
    const unacquired = evaluate({ modules: [module()] });
    expect(unacquired.facts[`${F}.ac.effective`]).toBe(0);
  });

  it('the vehicle record overrides the acquire bake in BOTH directions (never summed)', () => {
    // The edge a same-fact write could never survive: a MOTIONLESS acquire plus a
    // recorded MOVING must read 21 — sum-combining 1 + 0 would still read 1,
    // which is why the record is a distinct fact the derive prefers.
    const backToMoving = evaluate({
      modules: [module()],
      committed: [acquireEffectAt(1), acModeEffect(0)]
    });
    expect(backToMoving.facts[`${F}.acMotionless`]).toBe(1);
    expect(backToMoving.facts[`${F}.acMotionless.recorded`]).toBe(0);
    expect(backToMoving.facts[`${F}.acMotionless.current`]).toBe(0);
    expect(backToMoving.facts[`${F}.ac.effective`]).toBe(21);
    const toMotionless = evaluate({
      modules: [module()],
      committed: [acquireEffectAt(0), acModeEffect(1)]
    });
    expect(toMotionless.facts[`${F}.acMotionless.current`]).toBe(1);
    expect(toMotionless.facts[`${F}.ac.effective`]).toBe(19);
  });

  it('a LEGACY persisted acquire (flat ac.value, no acMotionless) evaluates and derives 21', () => {
    // The pre-pass-4 acquire shape, as persisted on a test character: the flat
    // ac.value bake is an INPUT no module derives or reads any more, so it is
    // inert rather than a two-writer conflict, and the missing mode fact reads
    // as the Moving default.
    const legacy: EffectInstance = {
      id: 'effect-tormentor-acquire',
      key: 'tormentor-acquire',
      state: {
        [`${F}.active`]: 1,
        [`${F}.ac.value`]: 21,
        [`${F}.hp.base`]: 60,
        [`${F}.damageThreshold`]: 10,
        [`${F}.speed`]: 100,
        [`${F}.cargo`]: 500,
        [`${F}.str`]: 16,
        [`${F}.dex`]: 14,
        [`${F}.con`]: 14,
        [`${F}.str.modifier`]: 3,
        [`${F}.dex.modifier`]: 2,
        [`${F}.con.modifier`]: 2,
        [`${F}.creatureCapacity.max`]: 4
      },
      expiry: { kind: 'permanent' }
    };
    const out = evaluate({ modules: [module()], committed: [legacy] });
    expect(out.facts[`${F}.ac.value`]).toBe(21);
    expect(out.facts[`${F}.ac.effective`]).toBe(21);
    expect(out.facts[`${F}.acMotionless.current`]).toBe(0);
    // The vehicle record works on a legacy acquire (dismiss + re-add is the
    // accepted migration; the record needs no mode fact to exist).
    expect(out.availableRules.some((r) => r.rule.id === 'set-tormentor-ac-mode')).toBe(true);
  });
});

describe('set-tormentor-ac-mode offer', () => {
  it('is a vehicle free-section record offer while acquired, segmented pre-showing the CURRENT mode', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'set-tormentor-ac-mode');
    expect(offer, 'the vehicle +ADD carries the AC-mode offer').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.ac-mode.name`);
    expect(ui.description).toBe(`${T}.ac-mode.description`);
    expect(ui.actionCost).toEqual([]);
    // The occupancy intent class (a HANDLE gear record, not a condition).
    expect(ui.intents).toEqual({ HANDLE: 'gear' });
    expect(ui.secondaryControl).toEqual({
      type: 'segmented',
      var: 'mode',
      prefix: 'play.choices.tormentor.mode',
      options: [
        { value: 0, label: `${T}.mode.moving` },
        { value: 1, label: `${T}.mode.motionless` }
      ]
    });
    // Opens at the CURRENT mode (recorded value once set, acquire bake otherwise).
    expect(offer!.rule.vars).toEqual({
      mode: { capture: true, default: { fact: `${F}.acMotionless.current` } }
    });
    // Always applicable while acquired: no legality gates (the mode is a fact,
    // not a resource).
    expect(offer!.legal).toBe(true);
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'set-tormentor-ac-mode')!;
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
  });

  it('is absent while unacquired (structural gate on the acquire)', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'set-tormentor-ac-mode')).toBe(false);
  });

  it('apply advertises ONE permanent keyed effect storing the mode as the distinct recorded fact', () => {
    const e = acModeEffect(1);
    expect(e.id).toContain('effect-tormentor-ac-mode');
    expect(e.key).toBe('tormentor-ac-mode');
    // The RECORDED fact, not the acquire-baked acMotionless: the engine
    // sum-combines two live effects writing one fact, so the record must be its
    // own fact for the derive to prefer it in both directions.
    expect(e.state).toEqual({ [`${F}.acMotionless.recorded`]: 1 });
    expect(e.expiry).toEqual({ kind: 'permanent' });
    expect(e.display).toEqual({
      name: `${T}.ac-mode-effect.name`,
      section: 'mount',
      subject: SUBJECT
    });
  });

  it('re-apply REPLACES by key and the AC flips immediately both ways', () => {
    // Committed Motionless record, planned Moving row: the projection folds the
    // newest keyed effect at once — 21, and only ONE record effect by key.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), acModeEffect(1)],
      planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-ac-mode', selections: { mode: 0 } }]
    });
    expect(out.facts[`${F}.acMotionless.recorded`]).toBe(0);
    expect(out.facts[`${F}.ac.effective`]).toBe(21);
    // …and the reverse on a Moving record: 19 the moment the row is planned.
    const reverse = evaluate({
      modules: [module()],
      committed: [acquireEffect(), acModeEffect(0)],
      planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-ac-mode', selections: { mode: 1 } }]
    });
    expect(reverse.facts[`${F}.ac.effective`]).toBe(19);
  });
});

describe('the AC-mode record rides the acquire lifecycle', () => {
  it('a re-acquire evicts the record and resets the mode to the acquire SELECTION', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffectAt(1), acModeEffect(0)],
      planned: [{ instanceId: 'i0', ruleId: 'acquire-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-ac-mode'));
    expect(evict, 're-acquire advertises the AC-mode eviction').toBeDefined();
    expect(evict!.key).toBe('tormentor-ac-mode');
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    // The fresh acquire (no selection) resets to Moving: 21, no record.
    expect(out.facts[`${F}.acMotionless.recorded`]).toBeUndefined();
    expect(out.facts[`${F}.ac.effective`]).toBe(21);
    // A re-acquire SELECTING Motionless stands: 19.
    const selected = evaluate({
      modules: [module()],
      committed: [acquireEffectAt(0), acModeEffect(0)],
      planned: [{ instanceId: 'i0', ruleId: 'acquire-tormentor', selections: { mode: 1 } }]
    });
    expect(selected.facts[`${F}.acMotionless`]).toBe(1);
    expect(selected.facts[`${F}.ac.effective`]).toBe(19);
  });

  it('abandon evicts the record with the acquire', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), acModeEffect(1)],
      planned: [{ instanceId: 'i0', ruleId: 'abandon-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-ac-mode'));
    expect(evict, 'abandon advertises the AC-mode eviction').toBeDefined();
    expect(evict!.state).toBeUndefined();
    expect(out.facts[`${F}.acMotionless.recorded`]).toBeUndefined();
    expect(out.facts[`${F}.ac.effective`]).toBe(0);
  });
});

describe('pass 4 i18n (tlh is the canary)', () => {
  it('the mode labels exist in BOTH locales, shared by the acquire and vehicle controls', () => {
    const strings: Record<string, string | undefined> = {
      'en moving': en.rule.tormentor.mode?.moving,
      'en-x-tlh moving': tlh.rule.tormentor.mode?.moving,
      'en motionless': en.rule.tormentor.mode?.motionless,
      'en-x-tlh motionless': tlh.rule.tormentor.mode?.motionless,
      'en segmented prefix': (en.play.choices as Record<string, { mode?: string }>).tormentor?.mode,
      'en-x-tlh segmented prefix': (tlh.play.choices as Record<string, { mode?: string }>).tormentor
        ?.mode
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });

  it('the AC-mode offer name/description and the record chip name exist in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en offer name': en.rule.tormentor['ac-mode']?.name,
      'en-x-tlh offer name': tlh.rule.tormentor['ac-mode']?.name,
      'en offer description': en.rule.tormentor['ac-mode']?.description,
      'en-x-tlh offer description': tlh.rule.tormentor['ac-mode']?.description,
      'en chip name': en.rule.tormentor['ac-mode-effect']?.name,
      'en-x-tlh chip name': tlh.rule.tormentor['ac-mode-effect']?.name
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

describe('acquire/abandon i18n (tlh is the canary)', () => {
  it('the acquire/abandon offer names and descriptions exist in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en acquire name': en.rule.tormentor.acquire?.name,
      'en-x-tlh acquire name': tlh.rule.tormentor.acquire?.name,
      'en acquire description': en.rule.tormentor.acquire?.description,
      'en-x-tlh acquire description': tlh.rule.tormentor.acquire?.description,
      'en abandon name': en.rule.tormentor.abandon?.name,
      'en-x-tlh abandon name': tlh.rule.tormentor.abandon?.name,
      'en abandon description': en.rule.tormentor.abandon?.description,
      'en-x-tlh abandon description': tlh.rule.tormentor.abandon?.description
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });

  it('the EQUIP vehicle sub-bucket label exists in BOTH locales (the picker heading)', () => {
    const buckets = (locale: Record<string, unknown>): string | undefined =>
      (
        (
          (locale.play as Record<string, unknown>).verbBuckets as Record<
            string,
            Record<string, unknown>
          >
        ).EQUIP as Record<string, unknown>
      )?.vehicle as string | undefined;
    expect(buckets(en as unknown as Record<string, unknown>), 'en label').toEqual(
      expect.any(String)
    );
    expect(buckets(tlh as unknown as Record<string, unknown>), 'en-x-tlh label').toEqual(
      expect.any(String)
    );
  });

  it('the subject label, add-row sublabel and stat labels carry the de-seated key in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en companion label': (en.play.companion as Record<string, string | undefined>).tormentor,
      'en-x-tlh companion label': (tlh.play.companion as Record<string, string | undefined>)
        .tormentor,
      'en addRow sublabel': (en.play.addRow as Record<string, string | undefined>)
        .tormentorSublabel,
      'en-x-tlh addRow sublabel': (tlh.play.addRow as Record<string, string | undefined>)
        .tormentorSublabel,
      'en stats hp': (
        (en.play.stats as unknown as Record<string, Record<string, string>>).tormentor as
          | Record<string, string>
          | undefined
      )?.hp,
      'en-x-tlh stats hp': (
        (tlh.play.stats as unknown as Record<string, Record<string, string>>).tormentor as
          | Record<string, string>
          | undefined
      )?.hp
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });

  it('the subject label is de-seated: plain "Tormentor", no parenthetical', () => {
    expect((en.play.companion as Record<string, string>).tormentor).toBe('🛞 Tormentor');
  });
});
