import { describe, it, expect } from 'vitest';
import { evaluate, type FactReader, type PlannedRef, type RuleModule } from '$lib/rules-engine';
import { getModule, isRegistered } from '$lib/rules-engine/registry';
import { lazyRuleGroupIds } from '$lib/rules-engine/lazy';
import { enumerateLoadouts } from '$lib/rules-engine/loadout';
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
      'set-tormentor-fuel',
      'set-tormentor-boost',
      'record-tormentor-damage',
      'record-tormentor-heal',
      'knock-tormentor-prone',
      'flip-tormentor-upright',
      'take-tormentor-passenger-seat',
      'leave-tormentor-passenger-seat',
      'take-tormentor-harpoon-seat',
      'leave-tormentor-harpoon-seat',
      'take-tormentor-helm-seat',
      'leave-tormentor-helm-seat',
      'take-tormentor-clinger-seat',
      'leave-tormentor-clinger-seat',
      'fire-tormentor-harpoon',
      'drive-tormentor',
      'dash-tormentor',
      'juke-tormentor',
      // PR-7's move-trait roll row: the vehicle-level Crushing Wheels
      // consequence of driving (no seat, no spend).
      'wheels-tormentor',
      // The six record rollers (the steed's saves/skills placement: after the
      // station actions, before the way out) — saves first, then checks.
      'tormentor-save-str',
      'tormentor-save-dex',
      'tormentor-save-con',
      'tormentor-check-str',
      'tormentor-check-dex',
      'tormentor-check-con',
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
      // gates on a fact rather than a literal in the module — and beside it
      // the mishap threshold, the same DATA shape the recorder's per-row
      // mishap note reads.
      [`${F}.hp.base`]: 60,
      [`${F}.damageThreshold`]: 10,
      [`${F}.mishapThreshold`]: 20,
      // Speed bakes NOTHING (PR-D): the derived speed.effective reads the
      // fuel, and the flat `speed` name is retired exactly like ac.value —
      // a legacy persisted bake stays inert, never a two-writer conflict.
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
    // occupancy, a prone record, an HP record or a destroyed wreck under an
    // abandoned vehicle. (No dash key: the app tracks no per-encounter Dash
    // count — the rule text informs, the player counts.)
    expect(acquireEffect().dependents).toEqual([
      'tormentor-occupancy',
      'tormentor-ac-mode',
      'tormentor-fuel',
      'tormentor-boost',
      'tormentor-prone',
      'tormentor-hp-damage',
      'tormentor-hp-heal',
      'tormentor-destroyed',
      'tormentor-seat-passenger',
      'tormentor-seat-harpoon',
      'tormentor-seat-helm',
      'tormentor-seat-clinger'
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

/**
 * PR-B — the Harpoon Flinger station: the seat infrastructure's SECOND seat,
 * plus the station's ACTION. The seat is another SeatSpec on the same helper
 * (effect `effect-tormentor-seat-harpoon`, key `tormentor-seat-harpoon`, fact
 * `companion.tormentor.seats.harpoon = 1`, chip like the passenger's); every
 * seat condition and count iterates SEAT_STATIONS, so the exclusivity leg and
 * the capacity derive picked the station up by extending the list — and the
 * key joins CHILD_KEYS, so the acquire lifecycle evicts it like every record.
 * The attack offer (`fire-tormentor-harpoon`) is FILED like a weapon attack
 * on the vehicle subject but PRICED like a generic action: structurally gated
 * on the acquire AND the harpoon seat (nobody at the flinger, no offer), legal
 * while the player's ACTION pool alone is open (its own no-action diagnostic
 * otherwise, committable), spending the action through the plain
 * `actions.spent` spend (the Dash/simple-actions idiom — a vehicle action is
 * not a PC weapon attack, so Extra Attack neither applies nor is granted) and
 * writing NO facts of its own. The numbers (+7 to hit, 2d8+2 piercing) are
 * module derives the dice-line vars read (the steed-slam pattern); 120 ft. and
 * one target are copy + detail.
 */

/** The harpoon-seat effect, through the real plan fold (acquired, then taken). */
function harpoonSeatEffect(): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-harpoon-seat' }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-seat-harpoon'));
  expect(advertised, 'taking the seat applies exactly one named effect').toHaveLength(1);
  return advertised[0]!;
}

/** A committed acquire with the harpoon seat held (stored state for later folds). */
function seatedAtHarpoon(): EffectInstance[] {
  return [acquireEffect(), harpoonSeatEffect()];
}

describe('take-tormentor-harpoon-seat offer', () => {
  it('is a vehicle free-section EQUIP offer while acquired, with the station-specific keys', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'take-tormentor-harpoon-seat');
    expect(offer, 'the vehicle +ADD carries the take-harpoon offer').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.take-harpoon-seat.name`);
    expect(ui.description).toBe(`${T}.take-harpoon-seat.description`);
    expect(ui.actionCost).toEqual([]);
    // Seat offers file with the acquire/abandon EQUIP 'vehicle' family.
    expect(ui.intents).toEqual({ EQUIP: 'vehicle' });
    // Acquired and unseated at 0/4: legal, no diagnostics.
    expect(offer!.legal).toBe(true);
    expect(offer!.diagnostics).toEqual([]);
  });

  it('rides the shared seat helper: the same two legs with the station-generic diagnostics', () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'take-tormentor-harpoon-seat'
    );
    expect(raw, 'the take-harpoon offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.legalWhen).toHaveLength(2);
    // Leg (a) — one seat per player, GLOBALLY: the passenger seat held makes
    // taking the harpoon seat illegal, and re-taking the harpoon seat you hold
    // is the same path. NO new diagnostic keys: the station-generic pair.
    expect(raw!.legalWhen![0]!.condition(seatLegReader({}))).toBe(true);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ harpoon: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
    // Leg (b) — the free-seat rule, shared key like the passenger's.
    expect(raw!.legalWhen![1]!.condition(seatLegReader({}, 3, 4))).toBe(true);
    expect(raw!.legalWhen![1]!.condition(seatLegReader({}, 4, 4))).toBe(false);
    expect(raw!.legalWhen![1]!.diagnostics).toEqual([
      { code: `${T}.take-seat.full`, severity: 'error' }
    ]);
  });

  it('apply advertises ONE permanent keyed effect writing exactly the station fact, with the chip', () => {
    const e = harpoonSeatEffect();
    expect(e.id).toContain('effect-tormentor-seat-harpoon');
    expect(e.key).toBe('tormentor-seat-harpoon');
    // EXACT equality: the state writes the namespaced seat fact and NOTHING
    // else — the same contract the passenger seat carries.
    expect(e.state).toEqual({ [`${F}.seats.harpoon`]: 1 });
    expect(e.expiry).toEqual({ kind: 'permanent' });
    // The at-a-glance "where am I seated" chip, passenger-shaped.
    expect(e.display).toEqual({
      name: `${T}.seat-harpoon-effect.name`,
      section: 'mount',
      subject: SUBJECT
    });
  });

  it('the derived capacity counts the held harpoon seat (the derive iterates every station)', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHarpoon() });
    expect(out.facts[`${F}.seats.harpoon`]).toBe(1);
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(1);
  });
});

describe('leave-tormentor-harpoon-seat offer', () => {
  it("is the passenger mirror: the not-seated leg reads THIS station's seat alone", () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'leave-tormentor-harpoon-seat'
    );
    expect(raw, 'the leave-harpoon offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.legalWhen).toHaveLength(1);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ harpoon: 1 }))).toBe(true);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({}))).toBe(false);
    // Another station's seat does not satisfy the leg — each leave clears its own.
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.leave-seat.not_seated`, severity: 'error' }
    ]);
  });

  it('apply advertises the EMPTY same-key eviction — and the fire offer goes with the seat', () => {
    const out = evaluate({
      modules: [module()],
      committed: seatedAtHarpoon(),
      planned: [{ instanceId: 'i0', ruleId: 'leave-tormentor-harpoon-seat' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-harpoon'));
    expect(evict, 'leave advertises the seat eviction').toBeDefined();
    expect(evict!.key).toBe('tormentor-seat-harpoon');
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    // The seat fact is GONE the moment the row is merely planned (newest-wins),
    // the capacity falls with it — and with nobody at the flinger the attack
    // offer no longer exists (the `when` gate).
    expect(out.facts[`${F}.seats.harpoon`]).toBeUndefined();
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(0);
    expect(out.availableRules.some((r) => r.rule.id === 'fire-tormentor-harpoon')).toBe(false);
  });
});

describe('the harpoon seat rides the acquire lifecycle', () => {
  it('a re-acquire and an abandon both advertise the empty same-key eviction', () => {
    for (const ruleId of ['acquire-tormentor', 'abandon-tormentor'] as const) {
      const out = evaluate({
        modules: [module()],
        committed: seatedAtHarpoon(),
        planned: [{ instanceId: 'i0', ruleId }]
      });
      const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-harpoon'));
      expect(evict, `${ruleId} advertises the harpoon-seat eviction`).toBeDefined();
      expect(evict!.key).toBe('tormentor-seat-harpoon');
      expect(evict!.state).toBeUndefined();
      expect(out.facts[`${F}.seats.harpoon`]).toBeUndefined();
    }
  });
});

describe('fire-tormentor-harpoon offer', () => {
  it('is a plan-row ATTACK offer on the vehicle subject, filed like a weapon attack', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHarpoon() });
    const offer = out.availableRules.find((r) => r.rule.id === 'fire-tormentor-harpoon');
    expect(offer, 'the vehicle +ADD carries the fire offer while seated').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('action-attack');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.fire-harpoon.name`);
    expect(ui.description).toBe(`${T}.fire-harpoon.description`);
    // The attack detail: +7 / 120 ft. / one target / 2d8+2, the 10 harpoons,
    // the magical weapons note.
    expect(ui.detailKey).toBe('vehicle/tormentor-harpoon');
    expect(ui.intents).toEqual({ ATTACK: 'weapons' });
    expect(ui.actionCost).toEqual(['action']);
    // A dice-line roller carries a dice.any label so reroll riders can find
    // the panel — and because the panel lives under the vehicle SUBJECT it is
    // the companion-suffixed form (the steed's COMPANION_DICE_LABEL precedent;
    // companion-annotation-labels pins the suffix registry-wide).
    expect(ui.annotationLabels).toEqual(['dice.any.companion']);
    // 120 ft. / one target are copy + detail — no ranges machinery, so the
    // control is dice alone: d20 + hitBonus to hit, 2d8 + damageBonus
    // piercing (the HEAL_TOUCH count:2 precedent for the damage pair).
    expect(ui.primaryControl).toEqual({
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
    });
    // The slam-spelled vars: both bonuses CAPTURED from the module derives,
    // the damage die a plain constant (no grip machinery on a vehicle).
    expect(offer!.rule.vars).toEqual({
      hitBonus: { capture: true, default: { fact: `${F}.harpoon.hitBonus` } },
      damageDie: { default: { number: 8 } },
      damageBonus: { capture: true, default: { fact: `${F}.harpoon.damageBonus` } }
    });
  });

  it('is gated structurally on the acquire AND the harpoon seat (when)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'fire-tormentor-harpoon');
    expect(raw, 'the fire offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    // seatLegReader carries active=1: the harpoon seat alone satisfies the gate.
    expect(raw!.when!(seatLegReader({ harpoon: 1 }))).toBe(true);
    // A passenger does not man the flinger…
    expect(raw!.when!(seatLegReader({ passenger: 1 }))).toBe(false);
    // …and neither does nobody.
    expect(raw!.when!(seatLegReader({}))).toBe(false);
    // Through the fold: acquired but unseated, the offer does not exist.
    const unseated = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(unseated.availableRules.some((r) => r.rule.id === 'fire-tormentor-harpoon')).toBe(false);
  });

  it('legality is the generic action-pool idiom (Dash/simple-actions) plus the wrecked leg', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'fire-tormentor-harpoon');
    expect(raw, 'the fire offer exists').toBeDefined();
    // Two legs: the action pool and the shared wrecked leg (pinned in the
    // wrecked-legality describe below — appended last).
    expect(raw!.legalWhen).toHaveLength(2);
    const leg = raw!.legalWhen![0]!;
    const poolReader = (actions: number, extra = 0): FactReader => ({
      num: (n) =>
        n === 'actions.remaining'
          ? actions
          : n === 'attackAction.extraRemaining'
            ? extra
            : n === `${F}.active`
              ? 1
              : 0,
      has: (n) => n === `${F}.active`
    });
    expect(leg.condition(poolReader(1))).toBe(true);
    expect(leg.condition(poolReader(0))).toBe(false);
    // NO Extra Attack leg: a VEHICLE action is not a PC weapon attack, so a
    // free follow-up charge must NOT open the pool (the user's tablet bug —
    // the weapon idiom made weapon-attack-then-harpoon read legal).
    expect(leg.condition(poolReader(0, 1))).toBe(false);
    // The diagnostic is the offer's OWN no-action key — the per-offer key every
    // generic action offer carries (Dash, the simple actions) — never the
    // shared WEAPON-attack one.
    expect(leg.diagnostics).toEqual([{ code: `${T}.fire-harpoon.no_action`, severity: 'error' }]);
  });

  it('apply is the generic action spend (the simple-actions actionOffer shape): ONE keyless endOfTurn effect writing exactly the action', () => {
    // The action-economy module joins the set so the player's action pool
    // derives for real.
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: seatedAtHarpoon(),
      planned: [{ instanceId: 'i0', ruleId: 'fire-tormentor-harpoon' }]
    });
    // Exactly ONE advertised effect — the generic per-turn spend (endOfTurn,
    // keyless), never a vehicle fact: no ammunition tracking, no station state.
    expect(out.effects).toHaveLength(1);
    expect(out.effects[0]!.key).toBeUndefined();
    expect(out.effects[0]!.expiry).toEqual({ kind: 'endOfTurn' });
    // EXACT equality: the ACTION spend and NOTHING else — no extraGranted, no
    // activation count, no attack-kind marker. A vehicle action never touches
    // the PC's attack-pool accounting (Extra Attack is a weapon-attack feature).
    expect(out.effects[0]!.state).toEqual({ 'actions.spent': 1 });
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    // The vehicle state is untouched by firing.
    expect(out.facts[`${F}.seats.harpoon`]).toBe(1);
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(1);
    expect(out.facts[`${F}.hp.current`]).toBe(60);
  });

  it("a no-action row still fires (the override path), flagged with the fire offer's own diagnostic", () => {
    // The plan.ts contract: the illegal row EXECUTES — the second spend lands
    // (the projection reads the over-commit) — while the row carries the
    // no-action diagnostic, exactly like a second Dash.
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: seatedAtHarpoon(),
      planned: [
        { instanceId: 'i0', ruleId: 'fire-tormentor-harpoon' },
        { instanceId: 'i1', ruleId: 'fire-tormentor-harpoon' }
      ]
    });
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    expect(out.planDiagnostics['i1']).toEqual([
      { code: `${T}.fire-harpoon.no_action`, severity: 'error' }
    ]);
  });
});

/**
 * The fire offer's ECONOMY, end to end against a real PC weapon: firing the
 * Tormentor's harpoon consumes the player's full ACTION and NEVER the attack
 * accounting (the user's tablet bug — the weapon idiom made each order read
 * legal after the other). Seeded with a held dagger and the level-5 Extra
 * Attack budget, BOTH orders must flag the second row illegal: the harpoon is
 * a vehicle action, not an Attack action, so it neither grants nor rides the
 * follow-up budget. (Like extra-attack.test.ts: no yaml scenario reaches
 * Extra Attack, so the fold is driven directly.)
 */
describe('the fire offer never touches the PC attack accounting', () => {
  /** The fold's module set: the vehicle, the economy, and a dagger-wielding level-5 PC. */
  function seatedMods(): RuleModule[] {
    return [
      module(),
      getModule('action-economy')!,
      getModule('attacks')!,
      getModule('hands')!,
      getModule('loadout')!,
      getModule('dagger')!,
      getModule('class-paladin-level5')!
    ];
  }

  /** Put the dagger in hand (the only equip path — the extra-attack test shape). */
  function equipDagger(mods: RuleModule[]): PlannedRef {
    const config = enumerateLoadouts(mods).find((c) => c.id === 'dagger');
    if (!config) throw new Error('no dagger loadout configuration');
    return { instanceId: 'i0', ruleId: 'set-loadout', selections: { loadout: config } };
  }

  it('fire the harpoon, then a PC weapon attack: the ATTACK is illegal (the action is gone)', () => {
    const mods = seatedMods();
    const out = evaluate({
      modules: mods,
      planned: [
        equipDagger(mods),
        { instanceId: 'i1', ruleId: 'acquire-tormentor' },
        { instanceId: 'i2', ruleId: 'take-tormentor-harpoon-seat' },
        { instanceId: 'i3', ruleId: 'fire-tormentor-harpoon' }
      ]
    });
    // Firing spent the ACTION and granted NO follow-up budget: Extra Attack is
    // the PC's weapon-attack feature, and a vehicle action is not one.
    expect(out.facts['actions.remaining']).toBe(0);
    expect(out.facts['attackAction.extraRemaining'] ?? 0).toBe(0);
    // So the PC's weapon attack flags illegal with the weapon attacks' own
    // shared diagnostic — the action spent on the vehicle's flinger is not
    // ALSO an Attack action with a free swing on it (the weapon idiom read
    // this legal: firing had granted the follow-up budget).
    const swing = out.availableRules.find((r) => r.rule.id === 'dagger-use-action');
    expect(swing, 'the dagger attack is still offered').toBeDefined();
    expect(swing!.legal).toBe(false);
    expect(swing!.diagnostics).toEqual([
      { code: 'rule.dnd-5e-2024.attacks.activation.no_action', severity: 'error' }
    ]);
  });

  it('a PC weapon attack, then the harpoon: the FIRE is illegal (a free Extra Attack charge is not an action)', () => {
    const mods = seatedMods();
    const out = evaluate({
      modules: mods,
      planned: [
        equipDagger(mods),
        { instanceId: 'i1', ruleId: 'acquire-tormentor' },
        { instanceId: 'i2', ruleId: 'take-tormentor-harpoon-seat' },
        { instanceId: 'i3', ruleId: 'dagger-use-action' }
      ]
    });
    // The Attack action is spent; the free follow-up charge remains…
    expect(out.facts['actions.remaining']).toBe(0);
    expect(out.facts['attackAction.extraRemaining']).toBe(1);
    // …but a vehicle action cannot ride it: the fire stays visible and ILLEGAL
    // with its OWN no-action diagnostic (the weapon idiom read this legal via
    // the extraRemaining leg).
    const fire = out.availableRules.find((r) => r.rule.id === 'fire-tormentor-harpoon');
    expect(fire, 'the fire offer is still offered').toBeDefined();
    expect(fire!.legal).toBe(false);
    expect(fire!.diagnostics).toEqual([{ code: `${T}.fire-harpoon.no_action`, severity: 'error' }]);
  });
});

describe('harpoon derives (the numbers the dice-line reads)', () => {
  it('hitBonus 7 and damageBonus 2 while acquired, 0 unacquired', () => {
    const acquired = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(acquired.facts[`${F}.harpoon.hitBonus`]).toBe(7);
    expect(acquired.facts[`${F}.harpoon.damageBonus`]).toBe(2);
    const unacquired = evaluate({ modules: [module()] });
    expect(unacquired.facts[`${F}.harpoon.hitBonus`]).toBe(0);
    expect(unacquired.facts[`${F}.harpoon.damageBonus`]).toBe(0);
  });
});

describe('harpoon seat + attack i18n (tlh is the canary)', () => {
  it('the take/leave offer names, the chip name and the attack name/description exist in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en take name': en.rule.tormentor['take-harpoon-seat']?.name,
      'en-x-tlh take name': tlh.rule.tormentor['take-harpoon-seat']?.name,
      'en take description': en.rule.tormentor['take-harpoon-seat']?.description,
      'en-x-tlh take description': tlh.rule.tormentor['take-harpoon-seat']?.description,
      'en leave name': en.rule.tormentor['leave-harpoon-seat']?.name,
      'en-x-tlh leave name': tlh.rule.tormentor['leave-harpoon-seat']?.name,
      'en leave description': en.rule.tormentor['leave-harpoon-seat']?.description,
      'en-x-tlh leave description': tlh.rule.tormentor['leave-harpoon-seat']?.description,
      'en chip name': en.rule.tormentor['seat-harpoon-effect']?.name,
      'en-x-tlh chip name': tlh.rule.tormentor['seat-harpoon-effect']?.name,
      'en attack name': en.rule.tormentor['fire-harpoon']?.name,
      'en-x-tlh attack name': tlh.rule.tormentor['fire-harpoon']?.name,
      'en attack description': en.rule.tormentor['fire-harpoon']?.description,
      'en-x-tlh attack description': tlh.rule.tormentor['fire-harpoon']?.description,
      'en fire no action': en.rule.tormentor['fire-harpoon']?.no_action,
      'en-x-tlh fire no action': tlh.rule.tormentor['fire-harpoon']?.no_action
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

/**
 * PR-C — the HELM station: the seat infrastructure's third seat plus the
 * station's OFFERS. The seat is another SeatSpec on the same helper (effect
 * `effect-tormentor-seat-helm`, key `tormentor-seat-helm`, fact
 * `companion.tormentor.seats.helm = 1`, chip like the passenger's); every
 * seat condition and count iterates SEAT_STATIONS, so the exclusivity leg and
 * the capacity derive picked the station up by extending the list — and the
 * key joins CHILD_KEYS, so the acquire lifecycle evicts it like every record.
 *
 * The station's offers are the ECONOMY RULING in miniature: vehicle activities
 * consume the PLAYER's matching economy slot through the GENERIC spend (never
 * the weapon attacks' pool — Extra Attack neither applies nor is granted).
 * Drive is the vehicle's MOVEMENT offer (the steed's move rows, PC-parity
 * house rule): a distance slider against the derived movement pool, apply
 * spending the player's ACTION beside the captured distance. Dash spends the
 * action and DOUBLES the pool for the turn (the steed's dashed flag). Juke is
 * the driver's REACTION (the opportunity-attack economy idiom), spending the
 * reaction alone — the Dex-save advantage is applied at the table — with a
 * second able-to-move leg reading the vehicle's prone record (PR-D refines
 * that leg to speed.effective > 0 once fuel exists).
 */

/** The helm-seat effect, through the real plan fold (acquired, then taken). */
function helmSeatEffect(): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-helm-seat' }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-seat-helm'));
  expect(advertised, 'taking the seat applies exactly one named effect').toHaveLength(1);
  return advertised[0]!;
}

/** A committed acquire with the helm seat held (stored state for later folds). */
function seatedAtHelm(): EffectInstance[] {
  return [acquireEffect(), helmSeatEffect()];
}

/**
 * The fuel record a row at `n` advertises, for committing as stored state —
 * the committed shape every fuelled fold below starts from.
 */
function fuelRecordEffect(n: number): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect(), helmSeatEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-fuel', selections: { fuel: n } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-fuel'));
  expect(advertised, `a fuel row at ${n} advertises exactly one record`).toHaveLength(1);
  return advertised[0]!;
}

/**
 * The boost record a row at `n` advertises, for committing as stored state —
 * committed on a SOUL-COIN fuel (the legal combination).
 */
function boostRecordEffect(n: number): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect(), helmSeatEffect(), fuelRecordEffect(1)],
    planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-boost', selections: { boost: n } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-boost'));
  expect(advertised, `a boost row at ${n} advertises exactly one record`).toHaveLength(1);
  return advertised[0]!;
}

/**
 * A committed acquire with the helm seat held AND a soul coin in the burner —
 * the fuelled helm fold the station's movement/reaction offers test against
 * (PR-D: the pool is the fuel's, and Juke needs the machine rolling).
 */
function helmFuelled(): EffectInstance[] {
  return [acquireEffect(), helmSeatEffect(), fuelRecordEffect(1)];
}

describe('take-tormentor-helm-seat offer', () => {
  it('is a vehicle free-section EQUIP offer while acquired, with the station-specific keys', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'take-tormentor-helm-seat');
    expect(offer, 'the vehicle +ADD carries the take-helm offer').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.take-helm-seat.name`);
    expect(ui.description).toBe(`${T}.take-helm-seat.description`);
    expect(ui.actionCost).toEqual([]);
    // Seat offers file with the acquire/abandon EQUIP 'vehicle' family.
    expect(ui.intents).toEqual({ EQUIP: 'vehicle' });
    // Acquired and unseated at 0/4: legal, no diagnostics.
    expect(offer!.legal).toBe(true);
    expect(offer!.diagnostics).toEqual([]);
  });

  it('rides the shared seat helper: the same two legs with the station-generic diagnostics', () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'take-tormentor-helm-seat'
    );
    expect(raw, 'the take-helm offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.legalWhen).toHaveLength(2);
    // Leg (a) — one seat per player, GLOBALLY: any other station's seat held
    // makes taking the Helm illegal, and re-taking the Helm you hold is the
    // same path. NO new diagnostic keys: the station-generic pair.
    expect(raw!.legalWhen![0]!.condition(seatLegReader({}))).toBe(true);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ harpoon: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ helm: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
    // Leg (b) — the free-seat rule, shared key like the passenger's.
    expect(raw!.legalWhen![1]!.condition(seatLegReader({}, 3, 4))).toBe(true);
    expect(raw!.legalWhen![1]!.condition(seatLegReader({}, 4, 4))).toBe(false);
    expect(raw!.legalWhen![1]!.diagnostics).toEqual([
      { code: `${T}.take-seat.full`, severity: 'error' }
    ]);
  });

  it('apply advertises ONE permanent keyed effect writing exactly the station fact, with the chip', () => {
    const e = helmSeatEffect();
    expect(e.id).toContain('effect-tormentor-seat-helm');
    expect(e.key).toBe('tormentor-seat-helm');
    expect(e.state).toEqual({ [`${F}.seats.helm`]: 1 });
    expect(e.expiry).toEqual({ kind: 'permanent' });
    expect(e.display).toEqual({
      name: `${T}.seat-helm-effect.name`,
      section: 'mount',
      subject: SUBJECT
    });
  });

  it('the derived capacity counts the held helm seat (the derive iterates every station)', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHelm() });
    expect(out.facts[`${F}.seats.helm`]).toBe(1);
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(1);
  });
});

describe('leave-tormentor-helm-seat offer', () => {
  it("is the passenger mirror: the not-seated leg reads THIS station's seat alone", () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'leave-tormentor-helm-seat'
    );
    expect(raw, 'the leave-helm offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.legalWhen).toHaveLength(1);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ helm: 1 }))).toBe(true);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({}))).toBe(false);
    // Another station's seat does not satisfy the leg — each leave clears its own.
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.leave-seat.not_seated`, severity: 'error' }
    ]);
  });

  it('apply advertises the EMPTY same-key eviction — and the station offers go with the seat', () => {
    const out = evaluate({
      modules: [module()],
      committed: seatedAtHelm(),
      planned: [{ instanceId: 'i0', ruleId: 'leave-tormentor-helm-seat' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-helm'));
    expect(evict, 'leave advertises the seat eviction').toBeDefined();
    expect(evict!.key).toBe('tormentor-seat-helm');
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    // The seat fact is GONE the moment the row is merely planned (newest-wins),
    // the capacity falls with it — and with nobody at the Helm the station's
    // offers no longer exist (the `when` gate).
    expect(out.facts[`${F}.seats.helm`]).toBeUndefined();
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(0);
    for (const id of ['drive-tormentor', 'dash-tormentor', 'juke-tormentor'])
      expect(
        out.availableRules.some((r) => r.rule.id === id),
        `${id} goes with the seat`
      ).toBe(false);
  });
});

describe('the helm seat rides the acquire lifecycle', () => {
  it('a re-acquire and an abandon both advertise the empty same-key eviction', () => {
    for (const ruleId of ['acquire-tormentor', 'abandon-tormentor'] as const) {
      const out = evaluate({
        modules: [module()],
        committed: seatedAtHelm(),
        planned: [{ instanceId: 'i0', ruleId }]
      });
      const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-helm'));
      expect(evict, `${ruleId} advertises the helm-seat eviction`).toBeDefined();
      expect(evict!.key).toBe('tormentor-seat-helm');
      expect(evict!.state).toBeUndefined();
      expect(out.facts[`${F}.seats.helm`]).toBeUndefined();
    }
  });
});

/**
 * The vehicle's MOVEMENT ECONOMY — the steed's, copied exactly (the PC-parity
 * house rule): `movement.base/total/remaining` derives in the steed's shape
 * (find-steed's derives), with base a DERIVATION of the speed facts (the PR-D
 * seam: fuel/boost re-plumbs that one read) rather than a copy of the number,
 * total doubling while Dashed, remaining = total − spent, every spend
 * endOfTurn so the pool resets with the turn.
 */
describe('tormentor movement derives (the steed pattern)', () => {
  it('derives base/total/remaining from the FUEL while acquired (unfuelled reads 0)', () => {
    // No seat needed: the movement economy belongs to the VEHICLE, not the
    // Helm — the offers are seat-gated, the pool is acquire-gated. PR-D
    // re-plumbed base to the derived speed.effective, so a fresh unfuelled
    // vehicle stands still (0 ft.) until the Helm feeds it.
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(out.facts[`${F}.speed.effective`]).toBe(0);
    expect(out.facts[`${F}.movement.base`]).toBe(0);
    expect(out.facts[`${F}.movement.total`]).toBe(0);
    expect(out.facts[`${F}.movement.remaining`]).toBe(0);
  });

  it('a soul coin opens the pool at 100 (base READS the effective speed)', () => {
    const out = evaluate({ modules: [module()], committed: helmFuelled() });
    expect(out.facts[`${F}.fuel.current`]).toBe(1);
    expect(out.facts[`${F}.speed.effective`]).toBe(100);
    expect(out.facts[`${F}.movement.base`]).toBe(100);
    expect(out.facts[`${F}.movement.total`]).toBe(100);
    expect(out.facts[`${F}.movement.remaining`]).toBe(100);
  });

  it('base is a derivation, never a bake: no movement or speed fact rides the acquire effect', () => {
    // The PR-D seam, re-plumbed: base READS the derived speed.effective, and
    // the acquire bakes neither — the flat `speed` name is retired like
    // ac.value (a legacy bake stays inert, never a two-writer conflict).
    expect(acquireEffect().state).not.toHaveProperty(`${F}.movement.base`);
    expect(acquireEffect().state).not.toHaveProperty(`${F}.movement.total`);
    expect(acquireEffect().state).not.toHaveProperty(`${F}.speed`);
  });

  it('settles to 0 unacquired and on abandon (the contributions stay registered)', () => {
    const unacquired = evaluate({ modules: [module()] });
    expect(unacquired.facts[`${F}.movement.base`]).toBe(0);
    expect(unacquired.facts[`${F}.movement.total`]).toBe(0);
    expect(unacquired.facts[`${F}.movement.remaining`]).toBe(0);
    const abandoned = evaluate({
      modules: [module()],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'abandon-tormentor' }]
    });
    expect(abandoned.facts[`${F}.movement.base`]).toBe(0);
    expect(abandoned.facts[`${F}.movement.total`]).toBe(0);
    expect(abandoned.facts[`${F}.movement.remaining`]).toBe(0);
  });

  it('a planned Dash doubles total and remaining for the turn (the steed semantics)', () => {
    const out = evaluate({
      modules: [module()],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'dash-tormentor' }]
    });
    expect(out.facts[`${F}.movement.total`]).toBe(200);
    expect(out.facts[`${F}.movement.remaining`]).toBe(200);
  });
});

describe('drive-tormentor offer (the vehicle movement offer)', () => {
  it('is the steed move-offer shape on the vehicle subject: MOVE section, distance slider, ACTION cost', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHelm() });
    const offer = out.availableRules.find((r) => r.rule.id === 'drive-tormentor');
    expect(offer, 'the vehicle panel carries Drive while seated').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    // The steed's move rows sit in the MOVE section (the movement panel); the
    // economy ruling adds what the steed's moves lack — the ACTION cost chip
    // (a vehicle activity is the player's full slot).
    expect(ui.section).toBe('move');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.drive.name`);
    expect(ui.description).toBe(`${T}.drive.description`);
    expect(ui.detailKey).toBe('vehicle/tormentor-helm');
    expect(ui.intents).toEqual({ MOVE: 'travel' });
    expect(ui.actionCost).toEqual(['action']);
    // The steed's STEED_MOVE_CONTROL/STEED_MOVE_VARS shape exactly: record the
    // actual feet driven, bounded by the (Dash-doubled) total, defaulting to
    // all remaining — min 0 so an over-committed prefix is never a meaningful
    // opening distance.
    expect(ui.primaryControl).toEqual({
      type: 'slider',
      var: 'distance',
      max: { fact: `${F}.movement.total` },
      step: 5,
      unit: 'ft'
    });
    expect(offer!.rule.vars).toEqual({
      distance: { capture: true, min: 0, default: { fact: `${F}.movement.remaining` } }
    });
  });

  it('is gated structurally on the acquire AND the helm seat (when)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'drive-tormentor');
    expect(raw, 'the drive offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.when!(seatLegReader({ helm: 1 }))).toBe(true);
    expect(raw!.when!(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.when!(seatLegReader({ harpoon: 1 }))).toBe(false);
    expect(raw!.when!(seatLegReader({}))).toBe(false);
    // Through the fold: acquired but unseated, the offer does not exist.
    const unseated = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(unseated.availableRules.some((r) => r.rule.id === 'drive-tormentor')).toBe(false);
  });

  it('legality is the action pool PLUS the steed out-of-movement leg (and the wrecked leg)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'drive-tormentor');
    expect(raw, 'the drive offer exists').toBeDefined();
    // Three legs: the two below plus the shared wrecked leg (pinned in the
    // wrecked-legality describe — appended last).
    expect(raw!.legalWhen).toHaveLength(3);
    const reader = (actions: number, remaining: number): FactReader => ({
      num: (n) =>
        n === 'actions.remaining' ? actions : n === `${F}.movement.remaining` ? remaining : 0,
      has: () => false
    });
    // Leg (a) — the player's action pool (the economy ruling).
    const legA = raw!.legalWhen![0]!;
    expect(legA.condition(reader(1, 100))).toBe(true);
    expect(legA.condition(reader(0, 100))).toBe(false);
    expect(legA.diagnostics).toEqual([{ code: `${T}.drive.no_action`, severity: 'error' }]);
    // Leg (b) — the steed's out-of-movement gate (remaining >= 5: a machine
    // with under 5 ft left cannot usefully roll).
    const legB = raw!.legalWhen![1]!;
    expect(legB.condition(reader(1, 100))).toBe(true);
    expect(legB.condition(reader(1, 0))).toBe(false);
    expect(legB.diagnostics).toEqual([{ code: `${T}.drive.out_of_movement`, severity: 'error' }]);
  });

  it('apply spends the player ACTION and the distance against the pool — ONE keyless endOfTurn effect', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'drive-tormentor', selections: { distance: 30 } }]
    });
    // Exactly ONE advertised effect — the action spend and the movement spend
    // together (the steed-dash idiom: two facts, one per-turn effect). The
    // distance lands on the SHARED player-level spend every vehicle's
    // remaining reads, never the per-vehicle stem — now carrying the
    // PER-VEHICLE drove marker beside the shared spend (PR-7's wheels gate).
    expect(out.effects).toHaveLength(1);
    expect(out.effects[0]!.key).toBeUndefined();
    expect(out.effects[0]!.expiry).toEqual({ kind: 'endOfTurn' });
    expect(out.effects[0]!.state).toEqual({
      'actions.spent': 1,
      'companion.vehicle.movement.spent': 30,
      'companion.tormentor.movement.drove': 1
    });
    expect(out.planDiagnostics['i0'] ?? []).toEqual([
      {
        code: `${T}.drive.crushing_wheels`,
        severity: 'notice',
        params: { dc: 13 }
      }
    ]);
    expect(out.facts['actions.remaining']).toBe(0);
    expect(out.facts[`${F}.movement.remaining`]).toBe(70);
    // The seat stays taken and the capacity counts it still — moving writes
    // nothing else.
    expect(out.facts[`${F}.seats.helm`]).toBe(1);
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(1);
  });

  it('distance defaults to ALL remaining when the row carries no selection (the steed idiom)', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'drive-tormentor' }]
    });
    expect(out.effects[0]!.state).toEqual({
      'actions.spent': 1,
      'companion.vehicle.movement.spent': 100,
      'companion.tormentor.movement.drove': 1
    });
    expect(out.facts[`${F}.movement.remaining`]).toBe(0);
  });

  it('an over-distance row carries the steed out-of-movement diagnostic while its spend still lands', () => {
    // The steed partial-distance pin: the legality gate alone (>= 5) would let
    // an oversized selection through — apply validates the SELECTED distance,
    // so the row errors while the over-commit still projects (remaining reads
    // negative, floored nowhere — the steed spells it the same way).
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'drive-tormentor', selections: { distance: 150 } }]
    });
    expect(out.effects[0]!.state).toEqual({
      'actions.spent': 1,
      'companion.vehicle.movement.spent': 150,
      'companion.tormentor.movement.drove': 1
    });
    expect(out.facts[`${F}.movement.remaining`]).toBe(-50);
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.drive.out_of_movement`, severity: 'error' },
      {
        code: `${T}.drive.crushing_wheels`,
        severity: 'notice',
        params: { dc: 13 }
      }
    ]);
  });

  it('a no-action row still moves (the override path), flagged with its OWN diagnostic alone', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [
        { instanceId: 'i0', ruleId: 'drive-tormentor', selections: { distance: 30 } },
        { instanceId: 'i1', ruleId: 'drive-tormentor' }
      ]
    });
    // The second row over-commits the ACTION (the first row spent it) with 70
    // ft still in the pool, so the out-of-movement gate passes and the failing
    // leg is the action alone — the row carries exactly its own diagnostic
    // (the trait note after it) while its default distance still lands.
    expect(out.planDiagnostics['i0'] ?? []).toEqual([
      {
        code: `${T}.drive.crushing_wheels`,
        severity: 'notice',
        params: { dc: 13 }
      }
    ]);
    expect(out.planDiagnostics['i1']).toEqual([
      { code: `${T}.drive.no_action`, severity: 'error' },
      {
        code: `${T}.drive.crushing_wheels`,
        severity: 'notice',
        params: { dc: 13 }
      }
    ]);
    expect(out.facts[`${F}.movement.remaining`]).toBe(0);
  });

  it('NO prone leg: a fallen vehicle leaves Drive legal (the GM adjudicates the rest)', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
    });
    expect(out.facts[`${F}.prone`]).toBe(1);
    const offer = out.availableRules.find((r) => r.rule.id === 'drive-tormentor');
    expect(offer, 'drive stays offered while prone').toBeDefined();
    expect(offer!.legal, 'drive is legal while prone').toBe(true);
    expect(offer!.diagnostics).toEqual([]);
  });

  it('the crushing wheels note rides every drive row: a SHORT pointer whose only param is the DC', () => {
    // The stat block's Crushing Wheels trait — the Tormentor rolls through
    // the space of Medium or smaller creatures; every creature it passes over
    // must save (DC 13 Dex) or take the wheels' damage — is PR-7's move-trait
    // machinery restructured (user review): ONE unconditional 'notice' on
    // EVERY planned drive row (the dash-risk idiom), a POINTER not the
    // rulebook. The DC is the note's ONLY param; the formula and type live on
    // the ROLL row's dice line.
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'drive-tormentor', selections: { distance: 30 } }]
    });
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.drive.crushing_wheels`, severity: 'notice', params: { dc: 13 } }
    ]);
    // The note commits nothing: the row's one spend is the drive's own.
    expect(out.effects).toHaveLength(1);
  });

  it('the wheels note is a POINTER in BOTH locales: {{dc}} alone, no rule text, no damage word', () => {
    // Dot-path reads with a cast: the key did not exist at the original RED,
    // and a typed property access would not compile there (the DG file's
    // i18nAt note).
    const at = (dict: unknown): string | undefined =>
      (
        dict as {
          rule?: { tormentor?: { drive?: Record<string, string | undefined> } };
        }
      ).rule?.tormentor?.drive?.['crushing_wheels'];
    for (const [locale, dict] of [
      ['en', en],
      ['en-x-tlh', tlh]
    ] as const) {
      const value = at(dict);
      expect(value, `${locale} wheels note exists`).toEqual(expect.any(String));
      expect(value, `${locale} interpolates {{dc}}`).toContain('{{dc}}');
      expect(value, `${locale} note carries no damage param`).not.toContain('{{damage}}');
    }
    const english = at(en) as string;
    // The pointer names the roll row and the save, and NOTHING else: the full
    // rule (size qualifier, already-prone clause, once per turn) lives on the
    // ROLL row's description.
    expect(english).toContain('Crushing Wheels');
    expect(english).toContain('Dexterity saving throw');
    for (const absent of [
      'already prone',
      'instead of being knocked prone',
      'Medium or smaller',
      '11',
      '2d10',
      'bludgeoning'
    ])
      expect(english, `the slim note restates no rule detail (${absent})`).not.toContain(absent);
    const klingon = at(tlh) as string;
    expect(klingon, 'the tlh note leaks no English damage-type identifier').not.toContain(
      'bludgeoning'
    );
    expect(
      klingon,
      'the tlh note leaks no English damage-type identifier (slashing)'
    ).not.toContain('slashing');
  });

  it('the Crushing Wheels ROLL row: vehicle-level, free, no seat gate, damage-only dice line (DC 13, 2d10)', () => {
    // The consequence surface (user review restructure): a VEHICLE-level
    // roll offer — `when` the acquire ALONE (no Helm seat), FREE with no
    // economy spend (the save/check-recorder precedent), carrying the damage
    // as a DICE LINE built from the spec (the type as the IDENTIFIER the
    // render site localizes through damage-type.* — never a param).
    const unseated = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const row = unseated.availableRules.find((r) => r.rule.id === 'wheels-tormentor');
    expect(row, 'the roll row exists while acquired, with nobody at the Helm').toBeDefined();
    expect(row!.rule.ui).toEqual({
      section: 'free',
      subject: SUBJECT,
      name: `${T}.wheels.name`,
      description: `${T}.wheels.description`,
      detailKey: 'vehicle/tormentor',
      intents: { SAVE: 'vehicle' },
      actionCost: [],
      annotationLabels: ['dice.any.companion'],
      primaryControl: {
        type: 'dice-line',
        dice: [
          {
            sides: 10,
            count: 2,
            purpose: 'damage',
            damageType: { string: 'bludgeoning' }
          }
        ]
      }
    });
    // The RAW catalog offer carries no apply — the recorder shape: the row
    // rolls, it commits nothing (the descriptor surface never exposes one).
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'wheels-tormentor')!;
    expect(raw.apply).toBeUndefined();
    // The full rule lives in the DESCRIPTION, both locales — the
    // already-prone clause, the once-per-turn cap, the size qualifier and
    // the Drive advertisement (numbers hardcoded per the fire-offer
    // description convention; the DICE LINE carries the formula).
    const wheelsAt = (dict: unknown, leaf: string): string | undefined =>
      (
        dict as {
          rule?: { tormentor?: { wheels?: Record<string, string | undefined> } };
        }
      ).rule?.tormentor?.wheels?.[leaf];
    for (const [locale, dict] of [
      ['en', en],
      ['en-x-tlh', tlh]
    ] as const) {
      for (const leaf of ['name', 'description', 'not_driven'])
        expect(wheelsAt(dict, leaf), `${locale} wheels.${leaf}`).toEqual(expect.any(String));
    }
    const english = wheelsAt(en, 'description') as string;
    for (const detail of [
      'Medium or smaller',
      'DC 13',
      '2d10',
      'already prone',
      'instead of being knocked prone',
      'once',
      'Driven'
    ])
      expect(english, `the description carries the full rule (${detail})`).toContain(detail);
  });

  it('the roll row is ILLEGAL until the Tormentor has Driven this turn — the per-vehicle marker', () => {
    const economy = getModule('action-economy')!;
    const before = evaluate({ modules: [module(), economy], committed: helmFuelled() });
    const row = before.availableRules.find((r) => r.rule.id === 'wheels-tormentor')!;
    expect(row.legal).toBe(false);
    expect(row.diagnostics).toEqual([{ code: `${T}.wheels.not_driven`, severity: 'error' }]);
    const after = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [
        { instanceId: 'i0', ruleId: 'drive-tormentor', selections: { distance: 30 } },
        { instanceId: 'i1', ruleId: 'wheels-tormentor' }
      ]
    });
    const driven = after.availableRules.find((r) => r.rule.id === 'wheels-tormentor')!;
    expect(driven.legal).toBe(true);
    expect(after.facts[`${F}.movement.drove`]).toBe(1);
    expect(after.planDiagnostics['i1'] ?? []).toEqual([]);
  });
});

describe('dash-tormentor offer', () => {
  it('is the BONUS-action row (bonus-action section, no control), the player BONUS ACTION', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHelm() });
    const offer = out.availableRules.find((r) => r.rule.id === 'dash-tormentor');
    expect(offer, 'the vehicle +ADD carries Dash while seated').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    // The 2024-format stat block takes the vehicle's Dash as a BONUS action
    // (the user's ruling): the row files with the bonus actions (the steed's
    // ability rows' section), in the MOVE verb's dash bucket.
    expect(ui.section).toBe('bonus-action');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.dash.name`);
    expect(ui.description).toBe(`${T}.dash.description`);
    expect(ui.detailKey).toBe('vehicle/tormentor-helm');
    expect(ui.intents).toEqual({ MOVE: 'dash' });
    expect(ui.actionCost).toEqual(['bonus']);
    // No dice, no vars: the doubling is a fact, not a capture — there is
    // nothing to roll and nothing to select.
    expect(ui.primaryControl).toBeUndefined();
    expect(offer!.rule.vars).toBeUndefined();
  });

  it('is gated structurally on the acquire AND the helm seat (when)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'dash-tormentor');
    expect(raw, 'the dash offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.when!(seatLegReader({ helm: 1 }))).toBe(true);
    expect(raw!.when!(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.when!(seatLegReader({ harpoon: 1 }))).toBe(false);
    expect(raw!.when!(seatLegReader({}))).toBe(false);
    // Through the fold: acquired but unseated, the offer does not exist.
    const unseated = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(unseated.availableRules.some((r) => r.rule.id === 'dash-tormentor')).toBe(false);
  });

  it('legality is the player bonus-action pool idiom plus the wrecked leg', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'dash-tormentor');
    expect(raw, 'the dash offer exists').toBeDefined();
    // Two legs: the bonus pool and the shared wrecked leg (pinned in the
    // wrecked-legality describe below — appended last).
    expect(raw!.legalWhen).toHaveLength(2);
    const leg = raw!.legalWhen![0]!;
    const poolReader = (bonus: number): FactReader => ({
      num: (n) => (n === 'bonusActions.remaining' ? bonus : 0),
      has: () => false
    });
    expect(leg.condition(poolReader(1))).toBe(true);
    expect(leg.condition(poolReader(0))).toBe(false);
    expect(leg.diagnostics).toEqual([{ code: `${T}.dash.no_bonus_action`, severity: 'error' }]);
  });

  it('apply spends the BONUS action and DOUBLES the movement — the spend ALONE, nothing durable', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'dash-tormentor' }]
    });
    // ONE advertised effect: the per-turn spend (the player's BONUS action
    // and the dashed flag together — the steed's steedSpend({bonusActions.spent,
    // dashed}) idiom). The app tracks NO per-encounter counter (there is no
    // encounter to count within — the rule text informs, the player counts),
    // so nothing durable is written beside the spend.
    expect(out.effects).toHaveLength(1);
    const [cost] = out.effects;
    expect(cost!.key).toBeUndefined();
    expect(cost!.expiry).toEqual({ kind: 'endOfTurn' });
    expect(cost!.state).toEqual({ 'bonusActions.spent': 1, [`${F}.dashed`]: 1 });
    // NO dash-count facts stand — not zero, ABSENT: nothing derives or
    // records a count or an allowance any more.
    expect(out.facts[`${F}.dashes.taken`]).toBeUndefined();
    expect(out.facts[`${F}.dashes.allowance`]).toBeUndefined();
    // The BONUS pool alone: the player's ACTION stays open.
    expect(out.facts['bonusActions.remaining']).toBe(0);
    expect(out.facts['actions.remaining']).toBe(1);
    expect(out.facts[`${F}.movement.total`]).toBe(200);
    expect(out.facts[`${F}.movement.remaining`]).toBe(200);
    // The seat stays taken and the capacity counts it still.
    expect(out.facts[`${F}.seats.helm`]).toBe(1);
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(1);
  });

  it('a no-bonus row still executes (the override path), error and note together', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: seatedAtHelm(),
      planned: [
        { instanceId: 'i0', ruleId: 'dash-tormentor' },
        { instanceId: 'i1', ruleId: 'dash-tormentor' }
      ]
    });
    // The second row over-commits the BONUS action (the first row spent it)
    // and still executes — carrying its own error BESIDE the unconditional
    // rule-text note (dedupe keeps the error first, the note after).
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.dash.risk`, severity: 'notice', params: { allowance: 5 } }
    ]);
    expect(out.planDiagnostics['i1']).toEqual([
      { code: `${T}.dash.no_bonus_action`, severity: 'error' },
      { code: `${T}.dash.risk`, severity: 'notice', params: { allowance: 5 } }
    ]);
    // No count anywhere — not on the first Dash, not on the second.
    expect(out.facts[`${F}.dashes.taken`]).toBeUndefined();
  });

  it('the rule-text note rides EVERY Dash row — unconditional, with the live allowance as params', () => {
    // The app has no encounter tracking: it cannot know where the player
    // sits in the 3-plus-CON-mod Dashes each encounter, so the row carries
    // the WHOLE rule as an informational note on every Dash (the FIRST
    // included) and the player counts. The allowance is computed from the
    // FACTS at fold time — 3 + the baked Constitution modifier, no hardcoded
    // total — and travels as diagnostic params the render layer interpolates.
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: seatedAtHelm(),
      planned: [{ instanceId: 'i0', ruleId: 'dash-tormentor' }]
    });
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.dash.risk`, severity: 'notice', params: { allowance: 5 } }
    ]);
    // Informational, never the error path: the row and the plan stay LEGAL.
    expect(out.status.legal).toBe(true);
    // A re-baked stat block moves the number with no other edit: CON 18 (+4)
    // reads 7 in the note's params, never a hardcoded 5.
    const con18: EffectInstance = {
      ...acquireEffect(),
      state: { ...acquireEffect().state, [`${F}.con.modifier`]: 4 }
    };
    const rederived = evaluate({
      modules: [module(), economy],
      committed: [con18, helmSeatEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'dash-tormentor' }]
    });
    expect(rederived.planDiagnostics['i0']).toEqual([
      { code: `${T}.dash.risk`, severity: 'notice', params: { allowance: 7 } }
    ]);
  });

  it('abandon clears the dashed/movement state — no counter exists to outlive the vehicle', () => {
    // With the counter gone the acquire lifecycle still owns every durable
    // vehicle fact: abandoning replaces the acquire effect, the movement
    // economy settles to nothing, and no dash record can strand under an
    // abandoned vehicle because none is ever written.
    const out = evaluate({
      modules: [module()],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'abandon-tormentor' }]
    });
    expect(
      out.effects.some((e) => e.id.split('#').includes('evict-tormentor-dash-count')),
      'no dash-count eviction exists to advertise'
    ).toBe(false);
    expect(out.facts[`${F}.movement.total`]).toBe(0);
    expect(out.facts[`${F}.movement.remaining`]).toBe(0);
    expect(out.facts[`${F}.dashed`] ?? 0).toBe(0);
    expect(out.facts[`${F}.dashes.taken`]).toBeUndefined();
  });

  it('NO prone leg: a fallen vehicle leaves Dash legal (the GM adjudicates the rest)', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: seatedAtHelm(),
      planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
    });
    expect(out.facts[`${F}.prone`]).toBe(1);
    const offer = out.availableRules.find((r) => r.rule.id === 'dash-tormentor');
    expect(offer, 'dash stays offered while prone').toBeDefined();
    expect(offer!.legal, 'dash is legal while prone').toBe(true);
    expect(offer!.diagnostics).toEqual([]);
  });
});

describe('juke-tormentor offer', () => {
  it('is the Helm REACTION on the vehicle subject, filed like an opportunity attack', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHelm() });
    const offer = out.availableRules.find((r) => r.rule.id === 'juke-tormentor');
    expect(offer, 'the vehicle +ADD carries Juke while seated').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('reaction');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.juke.name`);
    expect(ui.description).toBe(`${T}.juke.description`);
    expect(ui.detailKey).toBe('vehicle/tormentor-helm');
    expect(ui.intents).toEqual({ REACT: 'ward' });
    expect(ui.actionCost).toEqual(['reaction']);
    // No dice, no vars: the Dex-save advantage is applied at the table — the
    // row records the intent, nothing is wired to roll.
    expect(ui.primaryControl).toBeUndefined();
    expect(offer!.rule.vars).toBeUndefined();
  });

  it('is gated structurally on the acquire AND the helm seat (when)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'juke-tormentor');
    expect(raw, 'the juke offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.when!(seatLegReader({ helm: 1 }))).toBe(true);
    expect(raw!.when!(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.when!(seatLegReader({ harpoon: 1 }))).toBe(false);
    expect(raw!.when!(seatLegReader({}))).toBe(false);
    // Through the fold: acquired but unseated, the offer does not exist.
    const unseated = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(unseated.availableRules.some((r) => r.rule.id === 'juke-tormentor')).toBe(false);
  });

  it('legality is the reaction-pool idiom PLUS the able-to-move leg (and the wrecked leg)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'juke-tormentor');
    expect(raw, 'the juke offer exists').toBeDefined();
    // Three legs: the two below plus the shared wrecked leg (pinned in the
    // wrecked-legality describe — appended last).
    expect(raw!.legalWhen).toHaveLength(3);
    const poolReader = (reactions: number, prone: number, speed = 100): FactReader => ({
      num: (n) =>
        n === 'reactions.remaining'
          ? reactions
          : n === `${F}.prone`
            ? prone
            : n === `${F}.speed.effective`
              ? speed
              : 0,
      has: () => false
    });
    // Leg (a) — the reaction pool (the unarmed opportunity-attack spelling).
    const legA = raw!.legalWhen![0]!;
    expect(legA.condition(poolReader(1, 0))).toBe(true);
    expect(legA.condition(poolReader(0, 0))).toBe(false);
    expect(legA.diagnostics).toEqual([{ code: `${T}.juke.no_reaction`, severity: 'error' }]);
    // Leg (b) — the vehicle able to move, PR-D's refinement: the derived
    // speed AND the prone record — out of fuel OR fallen over, one shared
    // unable-to-move diagnostic (a war machine that cannot roll cannot swerve).
    const legB = raw!.legalWhen![1]!;
    expect(legB.condition(poolReader(1, 0))).toBe(true);
    expect(legB.condition(poolReader(1, 0, 0))).toBe(false);
    expect(legB.condition(poolReader(1, 1))).toBe(false);
    expect(legB.diagnostics).toEqual([{ code: `${T}.juke.unable_to_move`, severity: 'error' }]);
  });

  it('apply is the reaction spend ALONE: ONE keyless endOfTurn effect, no facts of its own', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'juke-tormentor' }]
    });
    // Exactly ONE advertised effect — the generic per-turn REACTION spend,
    // never a vehicle fact: the Dex-save advantage is applied at the table,
    // the plan row records the intent.
    expect(out.effects).toHaveLength(1);
    expect(out.effects[0]!.key).toBeUndefined();
    expect(out.effects[0]!.expiry).toEqual({ kind: 'endOfTurn' });
    expect(out.effects[0]!.state).toEqual({ 'reactions.spent': 1 });
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    // The REACTION pool alone: the action stays open.
    expect(out.facts['reactions.remaining']).toBe(0);
    expect(out.facts['actions.remaining']).toBe(1);
    expect(out.facts[`${F}.seats.helm`]).toBe(1);
  });

  it('a no-reaction row still executes (the override path), flagged with its OWN diagnostic', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [
        { instanceId: 'i0', ruleId: 'juke-tormentor' },
        { instanceId: 'i1', ruleId: 'juke-tormentor' }
      ]
    });
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    expect(out.planDiagnostics['i1']).toEqual([
      { code: `${T}.juke.no_reaction`, severity: 'error' }
    ]);
  });

  it('a prone-vehicle row is illegal-but-committable: the spend lands with the unable-to-move diagnostic', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [
        { instanceId: 'i0', ruleId: 'knock-tormentor-prone' },
        { instanceId: 'i1', ruleId: 'juke-tormentor' }
      ]
    });
    expect(out.facts[`${F}.prone`]).toBe(1);
    // A reaction IS available — the ONLY failing leg is able-to-move, so the
    // row carries exactly that diagnostic.
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    expect(out.planDiagnostics['i1']).toEqual([
      { code: `${T}.juke.unable_to_move`, severity: 'error' }
    ]);
    // The override row still spends the reaction (the over-commit projection).
    expect(out.facts['reactions.remaining']).toBe(0);
  });

  it('an unfuelled row is illegal the same way: the one leg covers out-of-fuel and prone together', () => {
    // PR-D's refinement, the fuel side: a fresh unfuelled vehicle (upright,
    // reaction open) fails the SAME single able-to-move leg, and the
    // planned-anyway row still spends the reaction.
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: seatedAtHelm(),
      planned: [{ instanceId: 'i0', ruleId: 'juke-tormentor' }]
    });
    expect(out.facts[`${F}.speed.effective`]).toBe(0);
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.juke.unable_to_move`, severity: 'error' }
    ]);
    expect(out.facts['reactions.remaining']).toBe(0);
  });
});

describe('helm seat + station actions i18n (tlh is the canary)', () => {
  it('the take/leave names, chip name, action names/descriptions and diagnostics exist in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en take name': en.rule.tormentor['take-helm-seat']?.name,
      'en-x-tlh take name': tlh.rule.tormentor['take-helm-seat']?.name,
      'en take description': en.rule.tormentor['take-helm-seat']?.description,
      'en-x-tlh take description': tlh.rule.tormentor['take-helm-seat']?.description,
      'en leave name': en.rule.tormentor['leave-helm-seat']?.name,
      'en-x-tlh leave name': tlh.rule.tormentor['leave-helm-seat']?.name,
      'en leave description': en.rule.tormentor['leave-helm-seat']?.description,
      'en-x-tlh leave description': tlh.rule.tormentor['leave-helm-seat']?.description,
      'en chip name': en.rule.tormentor['seat-helm-effect']?.name,
      'en-x-tlh chip name': tlh.rule.tormentor['seat-helm-effect']?.name,
      'en drive name': en.rule.tormentor.drive?.name,
      'en-x-tlh drive name': tlh.rule.tormentor.drive?.name,
      'en drive description': en.rule.tormentor.drive?.description,
      'en-x-tlh drive description': tlh.rule.tormentor.drive?.description,
      'en drive no action': en.rule.tormentor.drive?.no_action,
      'en-x-tlh drive no action': tlh.rule.tormentor.drive?.no_action,
      'en drive out of movement': en.rule.tormentor.drive?.out_of_movement,
      'en-x-tlh drive out of movement': tlh.rule.tormentor.drive?.out_of_movement,
      'en dash name': en.rule.tormentor.dash?.name,
      'en-x-tlh dash name': tlh.rule.tormentor.dash?.name,
      'en dash description': en.rule.tormentor.dash?.description,
      'en-x-tlh dash description': tlh.rule.tormentor.dash?.description,
      'en dash no bonus action': en.rule.tormentor.dash?.no_bonus_action,
      'en-x-tlh dash no bonus action': tlh.rule.tormentor.dash?.no_bonus_action,
      'en dash risk': en.rule.tormentor.dash?.risk,
      'en-x-tlh dash risk': tlh.rule.tormentor.dash?.risk,
      'en juke name': en.rule.tormentor.juke?.name,
      'en-x-tlh juke name': tlh.rule.tormentor.juke?.name,
      'en juke description': en.rule.tormentor.juke?.description,
      'en-x-tlh juke description': tlh.rule.tormentor.juke?.description,
      'en juke no reaction': en.rule.tormentor.juke?.no_reaction,
      'en-x-tlh juke no reaction': tlh.rule.tormentor.juke?.no_reaction,
      'en juke unable to move': en.rule.tormentor.juke?.unable_to_move,
      'en-x-tlh juke unable to move': tlh.rule.tormentor.juke?.unable_to_move
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
    // The risk note is INTERPOLATED: both locales carry the {{allowance}}
    // slot (double-brace, the sveltekit-i18n convention) the diagnostic's
    // params fill at render time.
    expect(en.rule.tormentor.dash?.risk).toContain('{{allowance}}');
    expect(tlh.rule.tormentor.dash?.risk).toContain('{{allowance}}');
    // The counter's chip key is DEAD with the counter — no locale carries it
    // (indexed through a record: the typed import no longer knows the key,
    // which is exactly the point).
    expect((en.rule.tormentor as Record<string, unknown>)['dash-count-effect']).toBeUndefined();
    expect((tlh.rule.tormentor as Record<string, unknown>)['dash-count-effect']).toBeUndefined();
  });
});

describe('tormentor movement panel i18n (tlh is the canary)', () => {
  it('the movement resource label and its ledger short label exist in BOTH locales', () => {
    // The creatureCapacity precedent's key family: the resources row's label
    // under play.stats.tormentor.*, its ledger short form under
    // play.ledger.short.tormentor.* (wired by RESOURCE_SHORT_LABELS).
    const strings: Record<string, string | undefined> = {
      'en stats movement': en.play.stats.tormentor?.movement,
      'en-x-tlh stats movement': tlh.play.stats.tormentor?.movement,
      'en short movement': en.play.ledger.short.tormentor?.movement,
      'en-x-tlh short movement': tlh.play.ledger.short.tormentor?.movement
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

/**
 * PR-D — FUEL + BOOST: the Helm's two bonus-action segmented records and the
 * derived speed they set. Both are the AC-mode record pattern (a free-section
 * vehicle offer with a segmented secondaryControl writing ONE permanent KEYED
 * effect on the DISTINCT recorded fact, re-applying replacing by key) priced
 * as the economy ruling demands — the player's BONUS ACTION, the generic
 * spend, illegal-but-COMMITTABLE with per-offer diagnostics. Boost adds the
 * stat block's own legality leg (a soul coin in the burner). The derived
 * speed.effective (fuel map 0/100/80 + 30 boosted) is what the movement
 * economy and the Speed chip read; the flat `speed` bake is retired, and
 * Juke's able-to-move leg refines to the derived speed.
 */
describe('set-tormentor-fuel offer', () => {
  it('is the AC-mode record shape priced as a BONUS action, with the fuel segmented control', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHelm() });
    const offer = out.availableRules.find((r) => r.rule.id === 'set-tormentor-fuel');
    expect(offer, 'the vehicle +ADD carries the fuel offer at the Helm').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    // The AC-mode filing (free section, HANDLE gear, subject) with the fuel
    // detail and the BONUS cost chip — refuelling is the player's bonus action.
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.fuel.name`);
    expect(ui.description).toBe(`${T}.fuel.description`);
    expect(ui.detailKey).toBe('vehicle/tormentor-fuel');
    expect(ui.intents).toEqual({ HANDLE: 'gear' });
    expect(ui.actionCost).toEqual(['bonus']);
    // A segmented control is ALWAYS a secondaryControl: the three fuels, the
    // values ARE the ordinals the record stores.
    expect(ui.secondaryControl).toEqual({
      type: 'segmented',
      var: 'fuel',
      prefix: 'play.choices.tormentor.fuel',
      options: [
        { value: 0, label: `${T}.fuel.none` },
        { value: 1, label: `${T}.fuel.soul-coin` },
        { value: 2, label: `${T}.fuel.demon-ichor` }
      ]
    });
    // The capture default pre-shows the CURRENT fuel (the derived current, so
    // the row opens on the fuel in force).
    expect(offer!.rule.vars).toEqual({
      fuel: { capture: true, default: { fact: `${F}.fuel.current` } }
    });
    expect(ui.primaryControl).toBeUndefined();
  });

  it('is gated structurally on the acquire AND the helm seat (when)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'set-tormentor-fuel');
    expect(raw, 'the fuel offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.when!(seatLegReader({ helm: 1 }))).toBe(true);
    expect(raw!.when!(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.when!(seatLegReader({}))).toBe(false);
    // Through the fold: acquired but not at the Helm, the offer does not exist.
    const unseated = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(unseated.availableRules.some((r) => r.rule.id === 'set-tormentor-fuel')).toBe(false);
  });

  it('legality is the bonus-action pool plus the wrecked leg', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'set-tormentor-fuel');
    // Two legs: the bonus pool and the shared wrecked leg (pinned in the
    // wrecked-legality describe below — appended last).
    expect(raw!.legalWhen).toHaveLength(2);
    const leg = raw!.legalWhen![0]!;
    const poolReader = (bonus: number): FactReader => ({
      num: (n) => (n === 'bonusActions.remaining' ? bonus : 0),
      has: () => false
    });
    expect(leg.condition(poolReader(1))).toBe(true);
    expect(leg.condition(poolReader(0))).toBe(false);
    expect(leg.diagnostics).toEqual([{ code: `${T}.fuel.no_bonus_action`, severity: 'error' }]);
  });

  it('apply advertises the bonus spend beside ONE permanent keyed effect on the DISTINCT recorded fact', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: seatedAtHelm(),
      planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-fuel', selections: { fuel: 1 } }]
    });
    // Exactly TWO advertised effects: the generic per-turn BONUS spend (the
    // dash idiom — keyless, endOfTurn) and the keyed record. The record
    // writes `fuel.recorded`, NEVER the derived `fuel.current` (the AC-mode
    // distinct-fact pattern: two live effects sum-combine one fact, so a
    // record writing the current itself could never flip a value back).
    expect(out.effects).toHaveLength(2);
    const cost = out.effects.find((e) => e.id.endsWith('#cost'));
    expect(cost!.key).toBeUndefined();
    expect(cost!.expiry).toEqual({ kind: 'endOfTurn' });
    expect(cost!.state).toEqual({ 'bonusActions.spent': 1 });
    const record = out.effects.find((e) => e.id.endsWith('effect-tormentor-fuel'))!;
    expect(record.key).toBe('tormentor-fuel');
    expect(record.expiry).toEqual({ kind: 'permanent' });
    expect(record.state).toEqual({ [`${F}.fuel.recorded`]: 1 });
    // The mount-section chip shows the live ordinal (the occupancy displayFact
    // precedent) so the fuel state is visible off the Helm too.
    expect(record.display).toEqual({
      name: `${T}.fuel-effect.name`,
      section: 'mount',
      subject: SUBJECT,
      displayFact: `${F}.fuel.current`
    });
    // The derivation follows at once (the projection folds the record).
    expect(out.facts[`${F}.fuel.current`]).toBe(1);
    expect(out.facts[`${F}.speed.effective`]).toBe(100);
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
  });

  it('a no-bonus row still commits (the override path), carrying its OWN diagnostic', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: seatedAtHelm(),
      planned: [
        { instanceId: 'i0', ruleId: 'set-tormentor-fuel', selections: { fuel: 1 } },
        { instanceId: 'i1', ruleId: 'set-tormentor-fuel', selections: { fuel: 2 } }
      ]
    });
    // The second row over-commits the BONUS action and still executes — the
    // keyed replacement stores Demon Ichor (newest-wins, never stacked) while
    // the row carries the diagnostic.
    expect(out.facts[`${F}.fuel.recorded`]).toBe(2);
    expect(out.facts[`${F}.speed.effective`]).toBe(80);
    expect(out.facts['bonusActions.remaining']).toBe(-1);
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    expect(out.planDiagnostics['i1']).toEqual([
      { code: `${T}.fuel.no_bonus_action`, severity: 'error' }
    ]);
  });
});

describe('set-tormentor-boost offer', () => {
  it('is the fuel record mirrored: [None | Demon Ichor], gated on the Helm, bonus-priced', () => {
    const out = evaluate({ modules: [module()], committed: helmFuelled() });
    const offer = out.availableRules.find((r) => r.rule.id === 'set-tormentor-boost');
    expect(offer, 'the vehicle +ADD carries the boost offer at the Helm').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.boost.name`);
    expect(ui.description).toBe(`${T}.boost.description`);
    expect(ui.detailKey).toBe('vehicle/tormentor-fuel');
    expect(ui.intents).toEqual({ HANDLE: 'gear' });
    expect(ui.actionCost).toEqual(['bonus']);
    expect(ui.secondaryControl).toEqual({
      type: 'segmented',
      var: 'boost',
      prefix: 'play.choices.tormentor.boost',
      options: [
        { value: 0, label: `${T}.boost.none` },
        { value: 1, label: `${T}.boost.demon-ichor` }
      ]
    });
    expect(offer!.rule.vars).toEqual({
      boost: { capture: true, default: { fact: `${F}.boost.current` } }
    });
  });

  it('is gated structurally on the acquire AND the helm seat (when)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'set-tormentor-boost');
    expect(raw, 'the boost offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.when!(seatLegReader({ helm: 1 }))).toBe(true);
    expect(raw!.when!(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.when!(seatLegReader({}))).toBe(false);
    const unseated = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(unseated.availableRules.some((r) => r.rule.id === 'set-tormentor-boost')).toBe(false);
  });

  it('legality is the bonus pool PLUS the soul-coin leg (and the wrecked leg)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'set-tormentor-boost');
    // Three legs: the two below plus the shared wrecked leg (pinned in the
    // wrecked-legality describe — appended last).
    expect(raw!.legalWhen).toHaveLength(3);
    const reader = (bonus: number, fuel: number): FactReader => ({
      num: (n) => (n === 'bonusActions.remaining' ? bonus : n === `${F}.fuel.current` ? fuel : 0),
      has: () => false
    });
    // Leg (a) — the player's bonus pool (shared style with Dash/fuel).
    const legA = raw!.legalWhen![0]!;
    expect(legA.condition(reader(1, 1))).toBe(true);
    expect(legA.condition(reader(0, 1))).toBe(false);
    expect(legA.diagnostics).toEqual([{ code: `${T}.boost.no_bonus_action`, severity: 'error' }]);
    // Leg (b) — the stat block's own rule: a boost only burns on a soul coin
    // (fuel.current === 1; none and demon ichor both fail).
    const legB = raw!.legalWhen![1]!;
    expect(legB.condition(reader(1, 1))).toBe(true);
    expect(legB.condition(reader(1, 0))).toBe(false);
    expect(legB.condition(reader(1, 2))).toBe(false);
    expect(legB.diagnostics).toEqual([{ code: `${T}.boost.without_soul_coin`, severity: 'error' }]);
  });

  it('apply advertises the bonus spend beside the keyed boost record on the DISTINCT recorded fact', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-boost', selections: { boost: 1 } }]
    });
    expect(out.effects).toHaveLength(2);
    const cost = out.effects.find((e) => e.id.endsWith('#cost'));
    expect(cost!.state).toEqual({ 'bonusActions.spent': 1 });
    expect(cost!.expiry).toEqual({ kind: 'endOfTurn' });
    const record = out.effects.find((e) => e.id.endsWith('effect-tormentor-boost'))!;
    expect(record.key).toBe('tormentor-boost');
    expect(record.expiry).toEqual({ kind: 'permanent' });
    expect(record.state).toEqual({ [`${F}.boost.recorded`]: 1 });
    expect(record.display).toEqual({
      name: `${T}.boost-effect.name`,
      section: 'mount',
      subject: SUBJECT,
      displayFact: `${F}.boost.current`
    });
    // Soul coin 100 + boost 30 = 130, the pool following.
    expect(out.facts[`${F}.boost.current`]).toBe(1);
    expect(out.facts[`${F}.speed.effective`]).toBe(130);
    expect(out.facts[`${F}.movement.total`]).toBe(130);
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
  });

  it('a boost-without-soul-coin row still commits, projecting the over-commit with its diagnostic', () => {
    const economy = getModule('action-economy')!;
    const out = evaluate({
      modules: [module(), economy],
      committed: seatedAtHelm(),
      planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-boost', selections: { boost: 1 } }]
    });
    // Unfuelled: the only failing leg is the soul coin — the row commits, the
    // spend lands, and the derived speed projects 30 ft. the rules would not
    // have allowed (the over-commit projection, exactly like any override).
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.boost.without_soul_coin`, severity: 'error' }
    ]);
    expect(out.facts[`${F}.boost.recorded`]).toBe(1);
    expect(out.facts[`${F}.speed.effective`]).toBe(30);
    expect(out.facts['bonusActions.remaining']).toBe(0);
  });
});

describe('fuel and boost derives (the effective speed)', () => {
  /** The effective speed at a committed fuel/boost combination. */
  const speedAt = (fuel?: number, boost?: number): number | undefined =>
    evaluate({
      modules: [module()],
      committed: [
        acquireEffect(),
        ...(fuel === undefined ? [] : [fuelRecordEffect(fuel)]),
        ...(boost === undefined ? [] : [boostRecordEffect(boost)])
      ]
    }).facts[`${F}.speed.effective`];

  it('maps the fuel: none 0, soul coin 100, demon ichor 80', () => {
    expect(speedAt()).toBe(0);
    expect(speedAt(0)).toBe(0);
    expect(speedAt(1)).toBe(100);
    expect(speedAt(2)).toBe(80);
  });

  it('adds 30 while boosted (the boost is fuel-independent arithmetic; its LEGALITY is the soul coin)', () => {
    expect(speedAt(1, 1)).toBe(130);
    expect(speedAt(2, 1)).toBe(110);
    expect(speedAt(1, 0)).toBe(100);
  });

  it('reads 0 unacquired even with records standing (gated on the acquire)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [fuelRecordEffect(1), boostRecordEffect(1)]
    });
    expect(out.facts[`${F}.active`] ?? 0).toBe(0);
    expect(out.facts[`${F}.fuel.current`]).toBe(0);
    expect(out.facts[`${F}.boost.current`]).toBe(0);
    expect(out.facts[`${F}.speed.effective`]).toBe(0);
  });
});

describe('fuel and boost ride the acquire lifecycle', () => {
  it('a re-acquire and an abandon both advertise the empty same-key evictions', () => {
    for (const ruleId of ['acquire-tormentor', 'abandon-tormentor'] as const) {
      const out = evaluate({
        modules: [module()],
        committed: [acquireEffect(), fuelRecordEffect(1), boostRecordEffect(1)],
        planned: [{ instanceId: 'i0', ruleId }]
      });
      for (const key of ['tormentor-fuel', 'tormentor-boost']) {
        const evict = out.effects.find((e) => e.id.endsWith(`evict-${key}`));
        expect(evict, `${ruleId} advertises the ${key} eviction`).toBeDefined();
        expect(evict!.key).toBe(key);
        expect(evict!.state).toBeUndefined();
      }
      expect(out.facts[`${F}.fuel.current`]).toBe(0);
      expect(out.facts[`${F}.boost.current`]).toBe(0);
      expect(out.facts[`${F}.speed.effective`]).toBe(0);
    }
  });

  it('leaving the Helm hides the offers while the records stand (seat changes never touch vehicle state)', () => {
    const out = evaluate({
      modules: [module()],
      committed: helmFuelled(),
      planned: [{ instanceId: 'i0', ruleId: 'leave-tormentor-helm-seat' }]
    });
    expect(out.availableRules.some((r) => r.rule.id === 'set-tormentor-fuel')).toBe(false);
    expect(out.availableRules.some((r) => r.rule.id === 'set-tormentor-boost')).toBe(false);
    expect(out.facts[`${F}.fuel.recorded`]).toBe(1);
    expect(out.facts[`${F}.speed.effective`]).toBe(100);
  });
});

describe('fuel and boost i18n (tlh is the canary)', () => {
  it('the offer names/descriptions, diagnostics, option labels and chip names exist in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en fuel name': en.rule.tormentor.fuel?.name,
      'en-x-tlh fuel name': tlh.rule.tormentor.fuel?.name,
      'en fuel description': en.rule.tormentor.fuel?.description,
      'en-x-tlh fuel description': tlh.rule.tormentor.fuel?.description,
      'en fuel no bonus': en.rule.tormentor.fuel?.no_bonus_action,
      'en-x-tlh fuel no bonus': tlh.rule.tormentor.fuel?.no_bonus_action,
      'en fuel none': en.rule.tormentor.fuel?.none,
      'en-x-tlh fuel none': tlh.rule.tormentor.fuel?.none,
      'en fuel soul coin': en.rule.tormentor.fuel?.['soul-coin'],
      'en-x-tlh fuel soul coin': tlh.rule.tormentor.fuel?.['soul-coin'],
      'en fuel demon ichor': en.rule.tormentor.fuel?.['demon-ichor'],
      'en-x-tlh fuel demon ichor': tlh.rule.tormentor.fuel?.['demon-ichor'],
      'en boost name': en.rule.tormentor.boost?.name,
      'en-x-tlh boost name': tlh.rule.tormentor.boost?.name,
      'en boost description': en.rule.tormentor.boost?.description,
      'en-x-tlh boost description': tlh.rule.tormentor.boost?.description,
      'en boost no bonus': en.rule.tormentor.boost?.no_bonus_action,
      'en-x-tlh boost no bonus': tlh.rule.tormentor.boost?.no_bonus_action,
      'en boost without soul coin': en.rule.tormentor.boost?.without_soul_coin,
      'en-x-tlh boost without soul coin': tlh.rule.tormentor.boost?.without_soul_coin,
      'en boost none': en.rule.tormentor.boost?.none,
      'en-x-tlh boost none': tlh.rule.tormentor.boost?.none,
      'en boost demon ichor': en.rule.tormentor.boost?.['demon-ichor'],
      'en-x-tlh boost demon ichor': tlh.rule.tormentor.boost?.['demon-ichor'],
      'en fuel chip': en.rule.tormentor['fuel-effect']?.name,
      'en-x-tlh fuel chip': tlh.rule.tormentor['fuel-effect']?.name,
      'en boost chip': en.rule.tormentor['boost-effect']?.name,
      'en-x-tlh boost chip': tlh.rule.tormentor['boost-effect']?.name,
      // The panel label and the segmented prefixes (play.* keys the module
      // references as literals, beside the rule.* family).
      'en stats fuel': en.play.stats.tormentor?.fuel,
      'en-x-tlh stats fuel': tlh.play.stats.tormentor?.fuel,
      'en choices fuel': en.play.choices.tormentor?.fuel,
      'en-x-tlh choices fuel': tlh.play.choices.tormentor?.fuel,
      'en choices boost': en.play.choices.tormentor?.boost,
      'en-x-tlh choices boost': tlh.play.choices.tormentor?.boost
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
    // The chip name templates interpolate the live ordinal ({{score}}, the
    // occupancy precedent) in BOTH locales.
    for (const name of [
      en.rule.tormentor['fuel-effect']?.name,
      en.rule.tormentor['boost-effect']?.name
    ])
      expect(name?.match(/{{[a-zA-Z]+}}/g)).toEqual(['{{score}}']);
    for (const name of [
      tlh.rule.tormentor['fuel-effect']?.name,
      tlh.rule.tormentor['boost-effect']?.name
    ])
      expect(name?.match(/{{[a-zA-Z]+}}/g)).toEqual(['{{score}}']);
  });
});

// The acquired, fuelled stat facts (every gate the declarations read, plus
// the pools the chips render).
const BOARDED = {
  [`${F}.active`]: 1,
  [`${F}.ac.effective`]: 21,
  [`${F}.hp.max`]: 60,
  [`${F}.hp.current`]: 60,
  [`${F}.fuel.current`]: 1,
  [`${F}.speed.effective`]: 100,
  [`${F}.cargo`]: 500,
  [`${F}.str.modifier`]: 3,
  [`${F}.dex.modifier`]: 2,
  [`${F}.con.modifier`]: 2,
  [`${F}.creatureCapacity.max`]: 4,
  [`${F}.creatureCapacity.used`]: 1,
  [`${F}.movement.base`]: 100,
  [`${F}.movement.total`]: 100,
  [`${F}.movement.remaining`]: 100
};

describe('module-declared panel entries', () => {
  it('top bar: a usedMax HP chip + AC/Speed/Fuel/Cargo value chips + a STR/DEX/CON ability chip, stamped with the subject', () => {
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
        // PR-D: the Speed chip reads the DERIVED effective speed (the fuel's),
        // never the retired flat bake.
        type: 'value',
        label: 'play.stats.tormentor.speed',
        fact: `${F}.speed.effective`,
        subject: SUBJECT
      },
      {
        // The Fuel chip renders the fuel's NAME, not its ordinal: a value
        // entry may carry valueLabels, a numeric-fact → i18n-key map the
        // render sites translate ("Soul Coin", never "1").
        type: 'value',
        label: 'play.stats.tormentor.fuel',
        fact: `${F}.fuel.current`,
        valueLabels: {
          0: `${T}.fuel.none`,
          1: `${T}.fuel.soul-coin`,
          2: `${T}.fuel.demon-ichor`
        },
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

  it('resources: usedMax creature-capacity and movement rows, stamped with the subject', () => {
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
        },
        {
          // The steed's movement row: the derived movement pool (spent by
          // Drive, doubled by Dash, reset each turn) renders "remaining/total"
          // ("70/100") — the vehicle's movement economy on the ledger.
          type: 'usedMax',
          label: 'play.stats.tormentor.movement',
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

/**
 * PR-E — the Clinger station: the seat infrastructure's FOURTH and FINAL
 * seat. A clinger holds on to the OUTSIDE of the vehicle, so the seat is
 * CAPACITY-FREE: the spec carries `consumesSeat: false`, the take offer
 * drops the free-seat legality leg (clinging is LEGAL at used 4/4 — the
 * pinned asymmetry against the passenger take), the derived capacity does
 * not count the fact, and the exclusivity leg keeps reading every station
 * (a clinger is one-seat-exclusive like anyone). While the seat is held, a
 * standing NOTICE carries the cling-on rule (the notice taxonomy: a
 * condition the player must know BEFORE acting — while in combat, a clinger
 * must make Dexterity checks to stay attached; own wording, no invented DC
 * or frequency). The key joins CHILD_KEYS, so the acquire lifecycle evicts
 * it like every record.
 */

/** The clinger-seat effect, through the real plan fold (acquired, then taken). */
function clingerSeatEffect(): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-clinger-seat' }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-seat-clinger'));
  expect(advertised, 'taking the seat applies exactly one named effect').toHaveLength(1);
  return advertised[0]!;
}

/** A committed acquire with the clinger seat held (stored state for later folds). */
function seatedAtClinger(): EffectInstance[] {
  return [acquireEffect(), clingerSeatEffect()];
}

describe('take-tormentor-clinger-seat offer', () => {
  it('is a vehicle free-section EQUIP offer while acquired, station-specific keys, linking the detail', () => {
    const out = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'take-tormentor-clinger-seat');
    expect(offer, 'the vehicle +ADD carries the take-clinger offer').toBeDefined();
    const ui = offer!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.take-clinger-seat.name`);
    expect(ui.description).toBe(`${T}.take-clinger-seat.description`);
    expect(ui.actionCost).toEqual([]);
    // Seat offers file with the acquire/abandon EQUIP 'vehicle' family.
    expect(ui.intents).toEqual({ EQUIP: 'vehicle' });
    // The station's one explanation hangs off the take (the clinger detail:
    // riding the outside, capacity-free, the Dex checks).
    expect(ui.detailKey).toBe('vehicle/tormentor-clinger');
    // Acquired and unseated at 0/4: legal, no diagnostics.
    expect(offer!.legal).toBe(true);
    expect(offer!.diagnostics).toEqual([]);
  });

  it('rides the shared seat helper MINUS the capacity leg: ONE legality leg, the station-generic exclusivity', () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'take-tormentor-clinger-seat'
    );
    expect(raw, 'the take-clinger offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    // The clinger takes NO seat, so there is NO free-seat leg to fail — the
    // take carries the one-seat-per-player leg ALONE, with the shared
    // station-generic diagnostic key (clingers are exclusive like everyone).
    expect(raw!.legalWhen).toHaveLength(1);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({}))).toBe(true);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ clinger: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ harpoon: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ helm: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
  });

  it('the pinned asymmetry: LEGAL at a FULL vehicle (used 4/4) where the passenger take is not', () => {
    // Recorded occupancy 4 of 4, no seat held. The clinger rides the
    // OUTSIDE — the free-seat rule does not apply to it; the passenger take
    // keeps its full diagnostic at the same facts.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), occupancyEffect(4)]
    });
    const clinger = out.availableRules.find((r) => r.rule.id === 'take-tormentor-clinger-seat');
    const passenger = out.availableRules.find((r) => r.rule.id === 'take-tormentor-passenger-seat');
    expect(clinger!.legal, 'clinging takes no seat — legal at capacity').toBe(true);
    expect(clinger!.diagnostics).toEqual([]);
    expect(passenger!.legal, 'boarding still needs a free seat').toBe(false);
    expect(passenger!.diagnostics).toEqual([{ code: `${T}.take-seat.full`, severity: 'error' }]);
  });

  it('apply advertises ONE permanent keyed effect writing exactly the station fact, with the chip', () => {
    const e = clingerSeatEffect();
    expect(e.id).toContain('effect-tormentor-seat-clinger');
    expect(e.key).toBe('tormentor-seat-clinger');
    // EXACT equality: the state writes the namespaced seat fact and NOTHING
    // else — the same contract every station's seat carries.
    expect(e.state).toEqual({ [`${F}.seats.clinger`]: 1 });
    expect(e.expiry).toEqual({ kind: 'permanent' });
    // The at-a-glance "where am I seated" chip, passenger-shaped.
    expect(e.display).toEqual({
      name: `${T}.seat-clinger-effect.name`,
      section: 'mount',
      subject: SUBJECT
    });
  });

  it('a planned-anyway take while seated still applies, carrying the exclusivity diagnostic alone', () => {
    // The player-override path: holding the passenger seat, the clinger take
    // is illegal-but-committable; the row executes as the one keyed
    // replacement carrying the SHARED already-seated diagnostic — never a
    // capacity diagnostic (there is no capacity leg to re-check).
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect(), occupancyEffect(4)],
      planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-clinger-seat' }]
    });
    expect(out.facts[`${F}.seats.clinger`]).toBe(1);
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.take-seat.already_seated`, severity: 'error' }
    ]);
  });
});

describe('the capacity derive excludes the clinger (capacity-free seat)', () => {
  it('a held clinger alone reads used 0 — committed AND merely planned', () => {
    const committed = evaluate({ modules: [module()], committed: seatedAtClinger() });
    expect(committed.facts[`${F}.seats.clinger`]).toBe(1);
    expect(committed.facts[`${F}.creatureCapacity.used`]).toBe(0);
    const planned = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-clinger-seat' }]
    });
    expect(planned.facts[`${F}.seats.clinger`]).toBe(1);
    expect(planned.facts[`${F}.creatureCapacity.used`]).toBe(0);
  });

  it('the clinger adds NO occupant beside the recorded occupancy', () => {
    const out = evaluate({
      modules: [module()],
      committed: [...seatedAtClinger(), occupancyEffect(3)]
    });
    // 3 recorded NPCs + a clinger hanging off the outside = 3 of 4, not 4.
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(3);
  });

  it('a consuming station still counts beside the clinger (the override path, both seats held)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-clinger-seat' }]
    });
    // Passenger 1 + clinger 0: the clinger never lifts the count.
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(1);
  });
});

describe('leave-tormentor-clinger-seat offer', () => {
  it("is the passenger mirror: the not-seated leg reads THIS station's seat alone", () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'leave-tormentor-clinger-seat'
    );
    expect(raw, 'the leave-clinger offer exists').toBeDefined();
    expect(typeof raw!.when).toBe('function');
    expect(raw!.legalWhen).toHaveLength(1);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ clinger: 1 }))).toBe(true);
    expect(raw!.legalWhen![0]!.condition(seatLegReader({}))).toBe(false);
    // Another station's seat does not satisfy the leg — each leave clears its own.
    expect(raw!.legalWhen![0]!.condition(seatLegReader({ passenger: 1 }))).toBe(false);
    expect(raw!.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.leave-seat.not_seated`, severity: 'error' }
    ]);
  });

  it('apply advertises the EMPTY same-key eviction — and the notice goes with the seat', () => {
    const out = evaluate({
      modules: [module()],
      committed: seatedAtClinger(),
      planned: [{ instanceId: 'i0', ruleId: 'leave-tormentor-clinger-seat' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-clinger'));
    expect(evict, 'leave advertises the seat eviction').toBeDefined();
    expect(evict!.key).toBe('tormentor-seat-clinger');
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    // The seat fact is GONE the moment the row is merely planned
    // (newest-wins), used never moved, and the clinger notice is withdrawn.
    expect(out.facts[`${F}.seats.clinger`]).toBeUndefined();
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(0);
    expect(out.annotations.some((a) => a.key === `${T}.clinger-notice`)).toBe(false);
  });

  it('a planned-anyway leave while NOT seated still executes as a no-op eviction, with its diagnostic', () => {
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'leave-tormentor-clinger-seat' }]
    });
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.leave-seat.not_seated`, severity: 'error' }
    ]);
    expect(out.effects.some((e) => e.id.endsWith('evict-tormentor-seat-clinger'))).toBe(true);
  });
});

describe('the clinger seat rides the acquire lifecycle', () => {
  it('a re-acquire and an abandon both advertise the empty same-key eviction', () => {
    for (const ruleId of ['acquire-tormentor', 'abandon-tormentor'] as const) {
      const out = evaluate({
        modules: [module()],
        committed: seatedAtClinger(),
        planned: [{ instanceId: 'i0', ruleId }]
      });
      const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-seat-clinger'));
      expect(evict, `${ruleId} advertises the clinger-seat eviction`).toBeDefined();
      expect(evict!.key).toBe('tormentor-seat-clinger');
      expect(evict!.state).toBeUndefined();
      expect(out.facts[`${F}.seats.clinger`]).toBeUndefined();
    }
  });
});

describe('clinger notice (the standing Dex-check rule)', () => {
  it('stands only while the clinger seat is held, with the vehicle as its source', () => {
    // Acquired but not clinging: NO notice — nothing to know before acting.
    const bare = evaluate({ modules: [module()], committed: [acquireEffect()] });
    expect(
      bare.annotations.some((a) => a.key === `${T}.clinger-notice`),
      'no notice while acquired and not clinging'
    ).toBe(false);
    // Clinging (committed): the notice stands (the prone/destroyed annotate
    // pattern), sourced on the vehicle.
    const clinging = evaluate({ modules: [module()], committed: seatedAtClinger() });
    const notice = clinging.annotations.find((a) => a.key === `${T}.clinger-notice`);
    expect(notice, 'a notice stands while the clinger seat is held').toBeDefined();
    expect(notice!.targets).toEqual(['notice']);
    expect(notice!.source).toBe(`${T}.effect.name`);
    expect(notice!.body).toBe(`${T}.clinger-notice.body`);
    // Merely PLANNED: the seat fact is live the moment the row is planned,
    // so the notice is too.
    const planned = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'take-tormentor-clinger-seat' }]
    });
    expect(planned.annotations.some((a) => a.key === `${T}.clinger-notice`)).toBe(true);
  });

  it('tracks the seat: leaving withdraws it, and another station never carries it', () => {
    // Leaving (the eviction merely PLANNED — newest-wins clears the fact
    // now): the seat is gone, so its notice goes with it…
    const left = evaluate({
      modules: [module()],
      committed: seatedAtClinger(),
      planned: [{ instanceId: 'i0', ruleId: 'leave-tormentor-clinger-seat' }]
    });
    expect(left.annotations.some((a) => a.key === `${T}.clinger-notice`)).toBe(false);
    // …a PASSENGER seat does not carry the clinger's notice…
    const seated = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()]
    });
    expect(seated.annotations.some((a) => a.key === `${T}.clinger-notice`)).toBe(false);
    // …and the unacquired vehicle carries no notice at all (the seat never
    // outlives the acquire).
    const unacquired = evaluate({ modules: [module()] });
    expect(unacquired.annotations.some((a) => a.key === `${T}.clinger-notice`)).toBe(false);
  });

  it('carries the notice label and body in BOTH locales (tlh is the canary)', () => {
    const strings: Record<string, string | undefined> = {
      'en notice label': en.rule.tormentor['clinger-notice'],
      'en-x-tlh notice label': tlh.rule.tormentor['clinger-notice'],
      'en notice body': en.rule.tormentor['clinger-notice.body'],
      'en-x-tlh notice body': tlh.rule.tormentor['clinger-notice.body']
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

describe('clinger seat i18n (tlh is the canary)', () => {
  it('the take/leave offer names/descriptions and the chip name exist in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en take name': en.rule.tormentor['take-clinger-seat']?.name,
      'en-x-tlh take name': tlh.rule.tormentor['take-clinger-seat']?.name,
      'en take description': en.rule.tormentor['take-clinger-seat']?.description,
      'en-x-tlh take description': tlh.rule.tormentor['take-clinger-seat']?.description,
      'en leave name': en.rule.tormentor['leave-clinger-seat']?.name,
      'en-x-tlh leave name': tlh.rule.tormentor['leave-clinger-seat']?.name,
      'en leave description': en.rule.tormentor['leave-clinger-seat']?.description,
      'en-x-tlh leave description': tlh.rule.tormentor['leave-clinger-seat']?.description,
      'en chip name': en.rule.tormentor['seat-clinger-effect']?.name,
      'en-x-tlh chip name': tlh.rule.tormentor['seat-clinger-effect']?.name
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

/**
 * The WRECKED-VEHICLE legality pass: while the destroyed wreck stands
 * (`companion.tormentor.destroyed > 0`), the vehicle's ACTIVITY offers and its
 * REPAIR recorder are ILLEGAL — ONE shared leg (the `notLockedLegal` shape)
 * appended LAST beside each offer's existing legs, with the ONE own
 * diagnostic `rule.tormentor.wrecked`. Illegal-but-COMMITTABLE throughout
 * (the engine's illegal-but-visible contract): the offers stay visible and
 * applicable, planned-anyway rows still execute carrying the diagnostic, and
 * every existing leg keeps composing. The BOUNDARY is deliberate: damage
 * recording (the blow happened — bookkeeping) and the seat offers (sitting
 * on a wreck is somebody's choice) carry NO wrecked leg.
 */

/** The shared wrecked diagnostic key (the one own key every gated offer carries). */
const WRECKED = `${T}.wrecked`;

/** The seven offers carrying the wrecked leg. */
const WRECK_GATED = [
  'fire-tormentor-harpoon',
  'drive-tormentor',
  'dash-tormentor',
  'juke-tormentor',
  'set-tormentor-fuel',
  'set-tormentor-boost',
  'record-tormentor-heal'
] as const;

/** Every other offer in the module — the explicit negative boundary. */
const WRECK_UNGATED = [
  'acquire-tormentor',
  'abandon-tormentor',
  'set-tormentor-occupancy',
  'set-tormentor-ac-mode',
  'record-tormentor-damage',
  'knock-tormentor-prone',
  'flip-tormentor-upright',
  'take-tormentor-passenger-seat',
  'leave-tormentor-passenger-seat',
  'take-tormentor-harpoon-seat',
  'leave-tormentor-harpoon-seat',
  'take-tormentor-helm-seat',
  'leave-tormentor-helm-seat',
  'take-tormentor-clinger-seat',
  'leave-tormentor-clinger-seat'
] as const;

/** A reader with only the destroyed fact set (or absent). */
function wreckReader(destroyed: number): FactReader {
  return {
    num: (n) => (n === `${F}.destroyed` ? destroyed : 0),
    has: (n) => n === `${F}.destroyed` && destroyed > 0
  };
}

describe('wrecked legality (the shared leg)', () => {
  it('each gated offer carries the wrecked leg LAST — legal whole, illegal wrecked, the ONE shared key', () => {
    for (const id of WRECK_GATED) {
      const raw = module().offer!({ selections: {} }).find((o) => o.id === id)!;
      const legs = raw.legalWhen!;
      expect(legs.length, `${id} has legs`).toBeGreaterThan(0);
      const leg = legs[legs.length - 1]!;
      expect(leg.condition(wreckReader(0)), `${id} legal while whole`).toBe(true);
      expect(leg.condition(wreckReader(1)), `${id} illegal while wrecked`).toBe(false);
      expect(leg.diagnostics, `${id} the one own key`).toEqual([
        { code: WRECKED, severity: 'error' }
      ]);
    }
  });

  it('the leg APPENDS: every gated offer keeps its existing legs in order (counts pinned)', () => {
    const counts: Record<string, number> = {
      'fire-tormentor-harpoon': 2, // no-action + wrecked
      'drive-tormentor': 3, // no-action + out-of-movement + wrecked
      'dash-tormentor': 2, // no-bonus + wrecked
      'juke-tormentor': 3, // no-reaction + unable-to-move + wrecked
      'set-tormentor-fuel': 2, // no-bonus + wrecked
      'set-tormentor-boost': 3, // no-bonus + without-soul-coin + wrecked
      'record-tormentor-heal': 1 // wrecked alone (the factory's opt-in legs)
    };
    for (const [id, n] of Object.entries(counts)) {
      const raw = module().offer!({ selections: {} }).find((o) => o.id === id)!;
      expect(raw.legalWhen, `${id} leg count`).toHaveLength(n);
    }
  });

  it('the boundary is explicit: NO other offer carries the wrecked code', () => {
    for (const id of WRECK_UNGATED) {
      const raw = module().offer!({ selections: {} }).find((o) => o.id === id)!;
      const codes = (raw.legalWhen ?? []).flatMap((leg) => leg.diagnostics.map((d) => d.code));
      expect(codes, `${id} carries no wrecked leg`).not.toContain(WRECKED);
    }
  });
});

/**
 * A committed WRECKED vehicle — the acquire, the helm or harpoon seat, and a
 * committed 60-damage record with the permanent destroyed wreck it writes
 * (the real fold: one pool-emptying blow).
 */
function wreckedVehicle(seat: 'helm' | 'harpoon'): EffectInstance[] {
  const out = evaluate({
    modules: [module()],
    committed: [acquireEffect(), seat === 'helm' ? helmSeatEffect() : harpoonSeatEffect()],
    planned: [{ instanceId: 'd1', ruleId: 'record-tormentor-damage', selections: { amount: 60 } }]
  });
  expect(out.facts[`${F}.destroyed`]).toBe(1);
  return [
    acquireEffect(),
    ...(seat === 'helm' ? [helmSeatEffect()] : [harpoonSeatEffect()]),
    ...out.effects
  ];
}

describe('wrecked legality (through the fold)', () => {
  it('the gated offers stay VISIBLE but ILLEGAL on the wreck, carrying the shared diagnostic', () => {
    // At the flinger: fire and the repair recorder. The exact-[wrecked] cases
    // pin the leg as the SOLE failure where its siblings pass; the composing
    // cases (drive/juke/boost below) pin the append beside failing siblings.
    // The economy module joins so the action pool derives (wrecked alone).
    const flinger = evaluate({
      modules: [module(), getModule('action-economy')!],
      committed: wreckedVehicle('harpoon')
    });
    const fire = flinger.availableRules.find((r) => r.rule.id === 'fire-tormentor-harpoon');
    expect(fire, 'fire stays offered on the wreck').toBeDefined();
    expect(fire!.legal).toBe(false);
    expect(fire!.diagnostics).toEqual([{ code: WRECKED, severity: 'error' }]);
    const heal = flinger.availableRules.find((r) => r.rule.id === 'record-tormentor-heal');
    expect(heal, 'the repair recorder stays offered on the wreck').toBeDefined();
    expect(heal!.legal).toBe(false);
    expect(heal!.diagnostics).toEqual([{ code: WRECKED, severity: 'error' }]);

    // At the Helm: dash and fuel fail on the wrecked leg ALONE (fresh pools);
    // drive, juke and boost compose it beside their own failing legs
    // (unfuelled: no movement, no speed; no soul coin).
    const helm = evaluate({
      modules: [module(), getModule('action-economy')!],
      committed: wreckedVehicle('helm')
    });
    const sole = ['dash-tormentor', 'set-tormentor-fuel'] as const;
    for (const id of sole) {
      const offer = helm.availableRules.find((r) => r.rule.id === id);
      expect(offer, `${id} stays offered on the wreck`).toBeDefined();
      expect(offer!.legal, `${id} illegal on the wreck`).toBe(false);
      expect(offer!.diagnostics, `${id} wrecked alone`).toEqual([
        { code: WRECKED, severity: 'error' }
      ]);
    }
    expect(helm.availableRules.find((r) => r.rule.id === 'drive-tormentor')!.diagnostics).toEqual([
      { code: `${T}.drive.out_of_movement`, severity: 'error' },
      { code: WRECKED, severity: 'error' }
    ]);
    expect(helm.availableRules.find((r) => r.rule.id === 'juke-tormentor')!.diagnostics).toEqual([
      { code: `${T}.juke.unable_to_move`, severity: 'error' },
      { code: WRECKED, severity: 'error' }
    ]);
    expect(
      helm.availableRules.find((r) => r.rule.id === 'set-tormentor-boost')!.diagnostics
    ).toEqual([
      { code: `${T}.boost.without_soul_coin`, severity: 'error' },
      { code: WRECKED, severity: 'error' }
    ]);
  });

  it('the ungated offers stay LEGAL on the wreck (bookkeeping and seating)', () => {
    const out = evaluate({ modules: [module()], committed: wreckedVehicle('helm') });
    for (const id of ['record-tormentor-damage', 'leave-tormentor-helm-seat'] as const) {
      const offer = out.availableRules.find((r) => r.rule.id === id);
      expect(offer, `${id} stays offered on the wreck`).toBeDefined();
      expect(offer!.legal, `${id} stays legal on the wreck`).toBe(true);
      expect(offer!.diagnostics, `${id} no diagnostics`).toEqual([]);
    }
  });

  it('planned-anyway rows still execute, carrying the shared diagnostic (the apply re-check)', () => {
    // Dash: the error lands BEFORE its unconditional risk note (push order),
    // the row still spends the bonus and doubles the pool.
    const dash = evaluate({
      modules: [module(), getModule('action-economy')!],
      committed: wreckedVehicle('helm'),
      planned: [{ instanceId: 'i0', ruleId: 'dash-tormentor' }]
    });
    expect(dash.planDiagnostics['i0']).toEqual([
      { code: WRECKED, severity: 'error' },
      { code: `${T}.dash.risk`, severity: 'notice', params: { allowance: 5 } }
    ]);
    expect(dash.facts['bonusActions.remaining']).toBe(0);
    // The repair: the record still lands beside the diagnostic.
    const heal = evaluate({
      modules: [module()],
      committed: wreckedVehicle('harpoon'),
      planned: [{ instanceId: 'i0', ruleId: 'record-tormentor-heal', selections: { amount: 10 } }]
    });
    expect(heal.facts[`${F}.hp.healRecorded`]).toBe(10);
    expect(heal.planDiagnostics['i0']).toEqual([{ code: WRECKED, severity: 'error' }]);
  });
});

describe('wrecked legality i18n (tlh is the canary)', () => {
  it('the shared wrecked diagnostic exists in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      en: en.rule.tormentor.wrecked,
      'en-x-tlh': tlh.rule.tormentor.wrecked
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

/**
 * CHECKS + SAVES — the vehicle's six record rollers (the Later list's "Checks
 * and Saves on the vehicle, for STR/CON/DEX"): the steed's save/skill
 * recorder pattern copied exactly (the PC-parity house rule). A free-section
 * vehicle row per ability while ACQUIRED — d20 + the BAKED modifier fact
 * (`companion.tormentor.<ability>.modifier`, 3/2/2 from the stat block; never
 * a hardcoded number) — with the saves carrying the shared pass/fail outcome
 * segmented and the save/dice labels companion-suffixed, and the checks the
 * plain dice-line (the steed skill shape) under module-local name keys (no
 * shared per-ability check label exists; the saves reuse
 * `planner.record.save.*`). Both kinds are FREE and ungated: they record
 * GM-called rolls, like the player's own record rows, and deliberately carry
 * NO wrecked leg (the wrecked pass's bookkeeping boundary — a destroyed
 * vehicle still gets called on to make saves, and the way back is people,
 * not repairs). No `apply` on either (the steed shape): rolling records
 * nothing — the roll log and the outcome capture are the record.
 */

/** The three abilities the stat block gives the vehicle. */
const CHECK_SAVE_ABILITIES = ['str', 'dex', 'con'] as const;

/** The shared outcome picker every save recorder renders (the steed's copy). */
const SAVE_OUTCOME_CONTROL = {
  type: 'segmented',
  var: 'passed',
  prefix: 'play.choices.save.outcome',
  options: [
    { value: -1, label: 'planner.record.outcome.none' },
    { value: 1, label: 'planner.record.passed' },
    { value: 0, label: 'planner.record.failed' }
  ]
} as const;

describe('tormentor save recorders (the steed save-offer copy)', () => {
  it('str/dex/con: d20 + the BAKED modifier, the shared outcome segmented, companion-suffixed labels', () => {
    const raw = module().offer!({ selections: {} });
    for (const a of CHECK_SAVE_ABILITIES) {
      const o = raw.find((x) => x.id === `tormentor-save-${a}`);
      expect(o, `tormentor-save-${a} exists`).toBeDefined();
      // Free recorders of GM-called rolls: structurally gated on the acquire
      // alone, NO legality gates, NO apply (UI-only, the steed shape).
      expect(typeof o!.when).toBe('function');
      expect(o!.legalWhen).toBeUndefined();
      expect(o!.apply).toBeUndefined();
      const ui = o!.ui as Record<string, unknown>;
      expect(ui.section).toBe('free');
      expect(ui.subject).toBe(SUBJECT);
      // The SHARED name key the player's and the steed's save rows reuse.
      expect(ui.name).toBe(`planner.record.save.${a}`);
      // Companion-suffixed save labels + the companion dice label (the steed's
      // set exactly): a self-only rider must not reach the vehicle's saves.
      expect(ui.annotationLabels).toEqual([
        'save.any.companion',
        `save.${a}.companion`,
        'dice.any.companion'
      ]);
      expect(ui.primaryControl).toEqual({
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'save' }]
      });
      expect(ui.secondaryControl).toEqual(SAVE_OUTCOME_CONTROL);
      expect(ui.intents).toEqual({ SAVE: 'vehicle' });
      expect(ui.actionCost).toEqual([]);
      // The bonus READS the baked fact — no hardcoded +3/+2/+2 anywhere.
      expect(o!.vars).toEqual({
        rollBonus: { capture: true, default: { fact: `${F}.${a}.modifier` } },
        passed: { capture: true, default: { number: -1 } }
      });
    }
  });

  it('exist through the fold while acquired and vanish with the acquire', () => {
    const acquired = evaluate({ modules: [module()], committed: [acquireEffect()] });
    for (const a of CHECK_SAVE_ABILITIES) {
      expect(
        acquired.availableRules.some((r) => r.rule.id === `tormentor-save-${a}`),
        `tormentor-save-${a} exists while acquired`
      ).toBe(true);
    }
    const unacquired = evaluate({ modules: [module()] });
    for (const a of CHECK_SAVE_ABILITIES) {
      expect(
        unacquired.availableRules.some((r) => r.rule.id === `tormentor-save-${a}`),
        `tormentor-save-${a} absent while unacquired`
      ).toBe(false);
    }
  });

  it('the dice-line bonus DERIVES from the fact: a differently-baked modifier moves the captured default', () => {
    // The repo rule (derive, never bake derived numbers): the vars reference
    // the FACT, so a re-baked stat block moves the roll with no module edit.
    // resolveValueSource is what the panel renders — the occupancy-slider
    // precedent — resolved against the real acquire (the 3/2/2 read) and
    // against a synthetic bake at different numbers.
    const resolvedAt = (committed: EffectInstance[]): number | undefined => {
      const out = evaluate({ modules: [module()], committed });
      const offer = out.availableRules.find((r) => r.rule.id === 'tormentor-save-str');
      expect(offer, 'the str save exists').toBeDefined();
      const vars = offer!.rule.vars as Record<string, VarDefinition>;
      return resolveValueSource({ var: 'rollBonus' }, out.facts, vars) as number | undefined;
    };
    // The real acquire: STR 16 → +3.
    expect(resolvedAt([acquireEffect()])).toBe(3);
    // A synthetic bake at STR 22 (and DEX 8): the SAME row rolls +6 — the
    // number follows the fact, never the module.
    expect(
      resolvedAt([
        {
          id: 'test-modifier-bake',
          state: { [`${F}.active`]: 1, [`${F}.str.modifier`]: 6 },
          expiry: { kind: 'permanent' }
        }
      ])
    ).toBe(6);
  });

  it('a rolled row commits NOTHING (UI-only, the steed shape)', () => {
    // The steed's recorders carry no apply; the outcome capture and the roll
    // log are the record. A planned row must advertise no effects and carry no
    // diagnostics — recording a roll is not an action.
    const out = evaluate({
      modules: [module()],
      committed: [acquireEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'tormentor-save-dex', selections: { passed: 1 } }]
    });
    expect(out.effects).toEqual([]);
    expect(out.planDiagnostics['i0'] ?? []).toEqual([]);
    // Nothing about the vehicle moved.
    expect(out.facts[`${F}.active`]).toBe(1);
    expect(out.facts[`${F}.hp.current`]).toBe(60);
  });
});

describe('tormentor check recorders (the steed skill-offer copy)', () => {
  it('str/dex/con: d20 + the BAKED modifier, the companion dice label, module-local names', () => {
    const raw = module().offer!({ selections: {} });
    for (const a of CHECK_SAVE_ABILITIES) {
      const o = raw.find((x) => x.id === `tormentor-check-${a}`);
      expect(o, `tormentor-check-${a} exists`).toBeDefined();
      // The same free-record contract as the saves.
      expect(typeof o!.when).toBe('function');
      expect(o!.legalWhen).toBeUndefined();
      expect(o!.apply).toBeUndefined();
      const ui = o!.ui as Record<string, unknown>;
      expect(ui.section).toBe('free');
      expect(ui.subject).toBe(SUBJECT);
      // No shared per-ability check label exists (planner.record.check is a
      // plain string), so the check names are THIS group's own keys.
      expect(ui.name).toBe(`${T}.check-${a}.name`);
      // The steed skill shape: the companion dice label alone.
      expect(ui.annotationLabels).toEqual(['dice.any.companion']);
      expect(ui.primaryControl).toEqual({
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'rollBonus' }, purpose: 'check' }]
      });
      expect(ui.secondaryControl).toBeUndefined();
      expect(ui.intents).toEqual({ CHECK: 'vehicle' });
      expect(ui.actionCost).toEqual([]);
      expect(o!.vars).toEqual({
        rollBonus: { capture: true, default: { fact: `${F}.${a}.modifier` } }
      });
    }
  });

  it('exist through the fold while acquired and vanish with the acquire', () => {
    const acquired = evaluate({ modules: [module()], committed: [acquireEffect()] });
    const unacquired = evaluate({ modules: [module()] });
    for (const a of CHECK_SAVE_ABILITIES) {
      expect(
        acquired.availableRules.some((r) => r.rule.id === `tormentor-check-${a}`),
        `tormentor-check-${a} exists while acquired`
      ).toBe(true);
      expect(
        unacquired.availableRules.some((r) => r.rule.id === `tormentor-check-${a}`),
        `tormentor-check-${a} absent while unacquired`
      ).toBe(false);
    }
  });
});

describe('checks and saves on a wreck (the bookkeeping boundary)', () => {
  it('every roller stays LEGAL while the destroyed wreck stands — no wrecked leg', () => {
    // The wrecked pass gates ACTIVITY offers and repairs; recording a
    // GM-called check or save is bookkeeping, like damage recording (a
    // destroyed vehicle is still called on to make saves). The negative pin:
    // the rows stay legal with no diagnostics beside a standing wreck.
    const destroyed = evaluate({
      modules: [module()],
      committed: [
        acquireEffect(),
        {
          id: 'effect-tormentor-destroyed',
          key: 'tormentor-destroyed',
          state: { [`${F}.destroyed`]: 1 },
          expiry: { kind: 'permanent' }
        }
      ]
    });
    expect(destroyed.facts[`${F}.destroyed`]).toBe(1);
    for (const id of [
      'tormentor-save-str',
      'tormentor-save-dex',
      'tormentor-save-con',
      'tormentor-check-str',
      'tormentor-check-dex',
      'tormentor-check-con'
    ]) {
      const offer = destroyed.availableRules.find((r) => r.rule.id === id);
      expect(offer, `${id} stays offered on the wreck`).toBeDefined();
      expect(offer!.legal, `${id} stays legal on the wreck`).toBe(true);
      expect(offer!.diagnostics, `${id} carries no diagnostics`).toEqual([]);
    }
  });
});

describe('checks and saves i18n (tlh is the canary)', () => {
  it('the check names exist in BOTH locales; the saves reuse the shared save keys', () => {
    const strings: Record<string, string | undefined> = {
      'en check str name': en.rule.tormentor['check-str']?.name,
      'en-x-tlh check str name': tlh.rule.tormentor['check-str']?.name,
      'en check dex name': en.rule.tormentor['check-dex']?.name,
      'en-x-tlh check dex name': tlh.rule.tormentor['check-dex']?.name,
      'en check con name': en.rule.tormentor['check-con']?.name,
      'en-x-tlh check con name': tlh.rule.tormentor['check-con']?.name,
      // The saves reuse the shared planner.record.save.* keys (the steed
      // precedent) — pinned here so the reuse cannot silently rot.
      'en shared save str': en.planner.record.save?.str,
      'en-x-tlh shared save str': tlh.planner.record.save?.str,
      'en shared save dex': en.planner.record.save?.dex,
      'en-x-tlh shared save dex': tlh.planner.record.save?.dex,
      'en shared save con': en.planner.record.save?.con,
      'en-x-tlh shared save con': tlh.planner.record.save?.con,
      // The new SAVE/CHECK 'vehicle' sub-buckets the add picker groups under.
      'en save vehicle bucket': (en.play.verbBuckets.SAVE as Record<string, string>)?.vehicle,
      'en-x-tlh save vehicle bucket': (tlh.play.verbBuckets.SAVE as Record<string, string>)
        ?.vehicle,
      'en check vehicle bucket': (en.play.verbBuckets.CHECK as Record<string, string>)?.vehicle,
      'en-x-tlh check vehicle bucket': (tlh.play.verbBuckets.CHECK as Record<string, string>)
        ?.vehicle
    };
    for (const [where, value] of Object.entries(strings))
      expect(value, where).toEqual(expect.any(String));
  });
});

/**
 * Seat-sourced cover (cover.md PR-2). Each station's cover degree is SPEC
 * DATA on the seat, and the factory derives the vehicle's best held seat onto
 * the shared player-level fact `cover.seat` with combine max — the player-side
 * cover module maxes the manual record with it in `cover.effective` (that
 * side is pinned in cover.test.ts; the seam itself, on a fixture vehicle, in
 * infernal-vehicle.test.ts). The Tormentor's data (tormentor2.png): Helm
 * three-quarters (2), Harpoon Flinger half (1), Passenger and Clinger none
 * (open air). The contribution reads the SEAT FACT alone — no acquire gate, no
 * lifecycle wiring — so leaving the seat or abandoning the vehicle drops it
 * for free (the yaml scenarios cover-seat-* pin those paths through the
 * offers).
 */
describe('seat cover contribution (spec data per station)', () => {
  const SEAT = 'cover.seat';

  it('the Helm grants THREE-QUARTERS: cover.seat reads 2 while the seat is held', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHelm() });
    expect(out.facts[SEAT]).toBe(2);
  });

  it('the Harpoon Flinger grants HALF: cover.seat reads 1 while the seat is held', () => {
    const out = evaluate({ modules: [module()], committed: seatedAtHarpoon() });
    expect(out.facts[SEAT]).toBe(1);
  });

  it('the Passenger seat and the Clinger station grant NOTHING (open air)', () => {
    const passenger = evaluate({
      modules: [module()],
      committed: [acquireEffect(), seatPlannedEffect()]
    });
    expect(passenger.facts[SEAT]).toBe(0);
    expect(evaluate({ modules: [module()], committed: seatedAtClinger() }).facts[SEAT]).toBe(0);
  });

  it('acquired with no seat held contributes 0 — the seat fact is the whole input', () => {
    expect(evaluate({ modules: [module()], committed: [acquireEffect()] }).facts[SEAT]).toBe(0);
  });

  it('the contribution is emitted with combine max (the multi-vehicle contract)', () => {
    const contribution = module().derive!({ selections: {} }).find((c) => c.fact === SEAT);
    expect(contribution, 'the module contributes the shared seat-cover fact').toBeDefined();
    expect(contribution!.combine).toBe('max');
  });
});
