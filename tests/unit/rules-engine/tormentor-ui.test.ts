import { describe, it, expect } from 'vitest';
import { evaluate, type RuleModule } from '$lib/rules-engine';
import { getModule, isRegistered } from '$lib/rules-engine/registry';
import { lazyRuleGroupIds } from '$lib/rules-engine/lazy';
import { deriveTopBarEntries, deriveResourceEntries } from '$lib/play/derivePanels';
import type { EffectInstance } from '$lib/rules-engine';
import en from '$lib/i18n/en/common.json';
import tlh from '$lib/i18n/en-x-tlh/common.json';

/**
 * Tormentor — the rule group owning the whole VEHICLE and every seat it has so
 * far (seats change during play, so they are not separate groups). Only the
 * Damage Control pseudo-seat exists yet, as its own SUBJECT
 * (`tormentor-damage-control`): boarding is a PLAYER action (an ungated
 * free-section offer with NO station subject) whose apply advertises one
 * permanent KEYED effect baking the display-only stat block into
 * `companion.tormentorDamageControl.*` facts. Having boarded makes the
 * STATION's +ADD panel available: the de-board offer carries the station
 * subject and replaces the board effect by key (the steed dismiss pattern).
 * The effect display carries `section: 'mount'` plus a `detailKey` — the first
 * mount chip that FLIPS to a stat-block detail — and the module declares its
 * subject's top-bar entries as data (`panels`), so the vehicle surfaces
 * without any play-layer change.
 */

const ID = 'tormentor';
const T = 'rule.tormentor';
const SUBJECT = 'tormentor-damage-control';
const F = 'companion.tormentorDamageControl';

/** The module under test, via the registry (fails loud + clear before GREEN). */
function module(): RuleModule {
  const m = getModule(ID);
  if (!m) throw new Error(`${ID} is not registered in the registry`);
  return m;
}

/** The board effect, through the real plan fold (apply → advertise). */
function boardEffect(): EffectInstance {
  const out = evaluate({
    modules: [module()],
    planned: [{ instanceId: 'i0', ruleId: 'board-tormentor' }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-damage-control'));
  expect(advertised, 'board applies exactly one named effect').toHaveLength(1);
  return advertised[0]!;
}

describe('tormentor registration', () => {
  it('is registered in the registry AND the lazy chunk map', () => {
    expect(isRegistered(ID)).toBe(true);
    expect(lazyRuleGroupIds()).toContain(ID);
  });
});

describe('board offer ui', () => {
  it('is an ungated free-section PLAYER offer: no station subject, linking the detail', () => {
    const offers = module().offer!({ selections: {} });
    expect(offers.map((o) => o.id)).toEqual([
      'board-tormentor',
      'set-tormentor-occupancy',
      'knock-tormentor-prone',
      'flip-tormentor-upright',
      'deboard-tormentor'
    ]);
    const ui = offers[0]!.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    // Boarding is a PLAYER action: the offer must NOT carry the station
    // subject, or it would file under the station's +ADD panel instead of the
    // player's — a panel that does not exist until the board effect does.
    expect(ui.subject).toBeUndefined();
    expect(ui.name).toBe(`${T}.board.name`);
    expect(ui.description).toBe(`${T}.board.description`);
    expect(ui.detailKey).toBe('vehicle/tormentor-damage-control');
    expect(ui.actionCost).toEqual([]);
    expect(ui.intents).toEqual({ HANDLE: 'gear' });
    // Ungated: no structural `when`, no legality gates (multiple boardings are
    // illegal-but-possible this pass; diagnostics deferred).
    expect(offers[0]!.when).toBeUndefined();
    expect(offers[0]!.legalWhen).toBeUndefined();
  });
});

describe('de-board offer', () => {
  it('sits in the STATION panel under the subject, free section, while boarded', () => {
    const out = evaluate({ modules: [module()], committed: [boardEffect()] });
    const deboard = out.availableRules.find((r) => r.rule.id === 'deboard-tormentor');
    expect(deboard, 'the station +ADD carries the de-board offer').toBeDefined();
    const ui = deboard!.rule.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
    expect(ui.name).toBe(`${T}.deboard.name`);
    expect(ui.description).toBe(`${T}.deboard.description`);
    expect(ui.actionCost).toEqual([]);
    expect(ui.intents).toEqual({ HANDLE: 'gear' });
  });

  it('is gated structurally on active (when) with no legality gates', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'deboard-tormentor')!;
    // `when` (not `legalWhen`): unboarded, the de-board action does not exist
    // at all — there is nothing to show as illegal.
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
  });

  it('is absent while unboarded (structural gate on active)', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'deboard-tormentor')).toBe(false);
  });

  it('apply replaces the board effect by key, clearing every baked fact', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'deboard-tormentor' }]
    });
    // One advertised marker sharing the board key — the steed dismiss pattern:
    // newest same-key effect evicts the older, so the facts go with it.
    const advertised = out.effects.filter((e) =>
      e.id.endsWith('effect-deboard-tormentor-damage-control')
    );
    expect(advertised).toHaveLength(1);
    expect(advertised[0]!.key).toBe('tormentor-damage-control');
    expect(advertised[0]!.expiry).toEqual({ kind: 'permanent' });
    // Hidden bookkeeping: no display, or a chip would linger on the strip.
    expect(advertised[0]!.display).toBeUndefined();
    // …and it EVICTS the occupancy record with the board effect (the steed
    // dismiss/child-eviction pattern): a stateless same-key marker.
    const evict = out.effects.find((e) => e.key === 'tormentor-occupancy');
    expect(evict, 'de-board advertises the occupancy eviction').toBeDefined();
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    // The baked facts are GONE (absent — unset facts read as 0 downstream, and
    // the panel gates key on presence, so the subject's chips all withdraw).
    expect(out.facts[`${F}.active`]).toBeUndefined();
    expect(out.facts[`${F}.ac.value`]).toBeUndefined();
    expect(out.facts[`${F}.hp.max`]).toBeUndefined();
  });
});

describe('board effect', () => {
  it('bakes the display-only stat block as one permanent keyed effect', () => {
    const e = boardEffect();
    expect(e.id).toBe('i0#0#effect-tormentor-damage-control');
    expect(e.key).toBe('tormentor-damage-control');
    expect(e.expiry).toEqual({ kind: 'permanent' });
    expect(e.state).toEqual({
      [`${F}.active`]: 1,
      [`${F}.ac.value`]: 21,
      [`${F}.hp.max`]: 60,
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

  it('owns the occupancy and prone records as dependents (raw mount-chip removal cascades)', () => {
    // Raw chip removal runs through playStore's removeEffect, which evicts the
    // removed effect's declared dependents by key (the generic mechanism is
    // pinned in playStore.test.ts). What THIS pins is the declaration: the
    // occupancy and prone effect keys, so removing the mount chip can never
    // strand a recorded occupancy or a prone record under a de-boarded vehicle.
    expect(boardEffect().dependents).toEqual(['tormentor-occupancy', 'tormentor-prone']);
  });

  it('displays as a mount chip on its subject that FLIPS to the detail', () => {
    // The steed's mount chip never carried a detailKey; this is the first.
    // The bridge copies display.detailKey onto the effect chip's ui, which is
    // what ActiveStateStrip's flip path reads.
    expect(boardEffect().display).toEqual({
      name: `${T}.effect.name`,
      section: 'mount',
      subject: SUBJECT,
      detailKey: 'vehicle/tormentor-damage-control'
    });
  });
});

describe('occupancy offer', () => {
  it('is a station free-section slider offer while boarded (steed HP-modifier shape)', () => {
    const out = evaluate({ modules: [module()], committed: [boardEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'set-tormentor-occupancy');
    expect(offer, 'the station +ADD carries the occupancy offer').toBeDefined();
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
    // Opens at the CURRENT occupancy: the derived used (1 unrecorded, the
    // boarder; the recorded value once set).
    expect(offer!.rule.vars).toEqual({
      occupancy: { capture: true, default: { fact: `${F}.creatureCapacity.used` } }
    });
  });

  it('is gated structurally on active (when) with no legality gates', () => {
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'set-tormentor-occupancy'
    )!;
    // `when`, like de-board: unboarded the station action does not exist at
    // all. Over-capacity occupancy is illegal-but-possible (no legalWhen) —
    // diagnostics are deferred with boarding's.
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
  });

  it('is absent while unboarded', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'set-tormentor-occupancy')).toBe(false);
  });

  it('apply advertises ONE permanent keyed effect storing the selection, with a live-value chip', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect()],
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

describe('creature capacity derive', () => {
  /** Evaluate boarded, with an occupancy row planned at `n` (omitted: none). */
  const usedAt = (n?: number): number | undefined =>
    evaluate({
      modules: [module()],
      committed: [boardEffect()],
      planned:
        n === undefined
          ? []
          : [{ instanceId: 'i0', ruleId: 'set-tormentor-occupancy', selections: { occupancy: n } }]
    }).facts[`${F}.creatureCapacity.used`];

  it('defaults to 1 while boarded (the boarder counts)', () => {
    expect(usedAt()).toBe(1);
  });

  it('reads the recorded occupancy', () => {
    expect(usedAt(3)).toBe(3);
    // 0 is a RECORD (the vehicle emptied), not the unset default.
    expect(usedAt(0)).toBe(0);
  });

  it('clamps the stored value to 0..max (the slider bound is UI-only)', () => {
    expect(usedAt(99)).toBe(4);
    expect(usedAt(-2)).toBe(0);
  });

  it('reads 0 while unboarded (the board default is not a free occupant)', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.facts[`${F}.creatureCapacity.used`]).toBe(0);
  });
});

// The boarded stat facts (every gate the declarations read).
const BOARDED = {
  [`${F}.active`]: 1,
  [`${F}.ac.value`]: 21,
  [`${F}.hp.max`]: 60,
  [`${F}.speed`]: 100,
  [`${F}.cargo`]: 500,
  [`${F}.str.modifier`]: 3,
  [`${F}.dex.modifier`]: 2,
  [`${F}.con.modifier`]: 2,
  [`${F}.creatureCapacity.max`]: 4,
  [`${F}.creatureCapacity.used`]: 1
};

describe('module-declared panel entries', () => {
  it('top bar: HP/AC/Speed/Cargo value chips + a STR/DEX/CON ability chip, stamped with the subject', () => {
    expect(deriveTopBarEntries(BOARDED, [module()]).filter((e) => e.subject === SUBJECT)).toEqual([
      {
        type: 'value',
        label: 'play.stats.tormentor-damage-control.hp',
        fact: `${F}.hp.max`,
        subject: SUBJECT
      },
      {
        type: 'value',
        label: 'play.stats.tormentor-damage-control.ac',
        fact: `${F}.ac.value`,
        subject: SUBJECT
      },
      {
        type: 'value',
        label: 'play.stats.tormentor-damage-control.speed',
        fact: `${F}.speed`,
        subject: SUBJECT
      },
      {
        // Cargo capacity: display-only like the rest of the stat block.
        type: 'value',
        label: 'play.stats.tormentor-damage-control.cargo',
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
          label: 'play.stats.tormentor-damage-control.creatureCapacity',
          total: `${F}.creatureCapacity.max`,
          remaining: `${F}.creatureCapacity.used`,
          subject: SUBJECT
        }
      ]
    );
  });

  it('holds every entry back while unboarded (the gate fact is absent)', () => {
    expect(deriveTopBarEntries({}, [module()]).some((e) => e.subject === SUBJECT)).toBe(false);
  });
});

/**
 * Pass 2 — vehicle prone + Prone Deficiency: STATE TRACKING ONLY. The fact is
 * namespaced (`companion.tormentorDamageControl.prone`) under its own keyed
 * effect, never the player-global `condition.prone` (the builder's
 * `proneEffect()` would flip the PLAYER's attack flags, notice and movement
 * legs). Recorded from the station's +ADD gated exactly like the PC's
 * drop-prone (structurally absent while already prone; no Speed leg — the
 * vehicle has no movement economy), flipped upright by an empty same-key
 * eviction, evicted with the board, and carried as a NOTICE while prone (the
 * Life-Bond annotate pattern gated on the prone fact — PC-prone parity: the
 * condition triggers its notice).
 */

/** The prone record, through the real plan fold (boarded, then knocked). */
function proneEffect(): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [boardEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-prone'));
  expect(advertised, 'knocked-prone applies exactly one named effect').toHaveLength(1);
  return advertised[0]!;
}

describe('knocked-prone offer', () => {
  it('is a station free-section offer while boarded, with no legality gates', () => {
    const out = evaluate({ modules: [module()], committed: [boardEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'knock-tormentor-prone');
    expect(offer, 'the station +ADD carries the knocked-prone offer').toBeDefined();
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
    // boarding offers use.
    expect(ui.intents).toEqual({ CONDITION: 'held' });
  });

  it("is gated structurally on boarded-AND-upright (when), PC drop-prone's gate", () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'knock-tormentor-prone')!;
    // `when` like the other station actions: unboarded, recording a prone for
    // a vehicle nobody rides does not exist at all. PC-prone parity (user
    // feedback): the player's drop-prone is `when: condition.prone === 0`, so
    // the knock adds the same already-prone leg on the namespaced fact. No
    // `legalWhen`: the only PC leg beyond the prone gate is Speed, and a
    // vehicle has no movement economy.
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
  });

  it('is absent while unboarded', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'knock-tormentor-prone')).toBe(false);
  });

  it("is absent while already prone (drop-prone's structural gate — PC parity)", () => {
    // PC-prone parity (user feedback): the player's drop-prone does not exist
    // while the condition is held, and neither does the vehicle's knock — the
    // recorder cannot re-fire while the vehicle is down. Its mirror,
    // flip-upright, is the offer that exists now.
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), proneEffect()]
    });
    expect(out.availableRules.some((r) => r.rule.id === 'knock-tormentor-prone')).toBe(false);
    expect(out.availableRules.some((r) => r.rule.id === 'flip-tormentor-upright')).toBe(true);
    // The gate hides the offer; it does not touch the committed state.
    expect(out.facts[`${F}.prone`]).toBe(1);
  });

  it('apply advertises ONE permanent keyed effect writing exactly the namespaced fact', () => {
    const e = proneEffect();
    expect(e.key).toBe('tormentor-prone');
    // EXACT equality: the state writes the namespaced fact and NOTHING else —
    // no player-global legs ride along (pinned again, behaviourally, below).
    expect(e.state).toEqual({ [`${F}.prone`]: 1 });
    // Permanent, not the player's untilShortRest: a rest does not right a
    // vehicle — only Flip Upright (or the board lifecycle) clears it.
    expect(e.expiry).toEqual({ kind: 'permanent' });
  });

  it('the effect displays as a station chip under the subject that FLIPS to the prone detail', () => {
    // Same flip path as the board chip: the bridge copies display.detailKey
    // onto the chip's ui, so tapping the Prone chip opens the vehicle's own
    // condition text (not the player's condition/prone detail).
    expect(proneEffect().display).toEqual({
      name: `${T}.prone-effect.name`,
      section: 'mount',
      subject: SUBJECT,
      detailKey: 'vehicle/tormentor-prone'
    });
  });

  it('a planned-anyway re-record while prone does not execute (the closed when gate)', () => {
    // The engine's structural-`when` contract (plan.ts): a planned row whose
    // gate is closed does not execute — the UI cannot build this row anymore
    // (the offer is absent), but a stale plan carried over the commit must not
    // advertise a second record either. The committed record stands alone.
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), proneEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
    });
    const keyed = out.effects.filter((e) => e.key === 'tormentor-prone');
    expect(keyed).toHaveLength(0);
    expect(out.facts[`${F}.prone`]).toBe(1);
  });
});

describe('flip-upright offer', () => {
  it('exists only while boarded AND prone (a structural when, not a legality gate)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'flip-tormentor-upright')!;
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
    // Boarded but upright: nothing to flip — the offer does not exist.
    const upright = evaluate({ modules: [module()], committed: [boardEffect()] });
    expect(upright.availableRules.some((r) => r.rule.id === 'flip-tormentor-upright')).toBe(false);
    // Boarded and prone (the record planned this very turn): flippable now.
    const prone = evaluate({
      modules: [module()],
      committed: [boardEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
    });
    expect(prone.availableRules.some((r) => r.rule.id === 'flip-tormentor-upright')).toBe(true);
  });

  it('sits in the station panel, free section, while prone', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect()],
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
    // offers sit under the Conditions grouping in the station +ADD. (The
    // PLAYER's Get Up is a MOVE 'rise' offer because it spends movement; the
    // free vehicle flip is not a movement action.)
    expect(ui.intents).toEqual({ CONDITION: 'held' });
  });

  it('apply advertises the EMPTY same-key eviction (the get-up idiom)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), proneEffect()],
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
});

describe('prone never touches the player-global condition', () => {
  it('condition.prone and its attack flags stay unset by this module', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect()],
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

describe('prone eviction rides the board lifecycle', () => {
  it('a re-board advertises the empty same-key eviction beside the board effect', () => {
    // A keyed replacement alone does not fire dependents, so the re-board
    // resets prone explicitly (the occupancy re-board pattern): a fresh board
    // starts upright.
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), proneEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'board-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-prone'));
    expect(evict, 're-board advertises the prone eviction').toBeDefined();
    expect(evict!.state).toBeUndefined();
    expect(out.facts[`${F}.prone`]).toBeUndefined();
  });

  it('de-board advertises the same eviction while clearing every baked fact', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), proneEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'deboard-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-prone'));
    expect(evict, 'de-board advertises the prone eviction').toBeDefined();
    expect(evict!.state).toBeUndefined();
    expect(out.facts[`${F}.prone`]).toBeUndefined();
    expect(out.facts[`${F}.active`]).toBeUndefined();
  });
});

describe('prone-deficiency notice', () => {
  it('stands only while the vehicle is PRONE, with the vehicle as its source', () => {
    // Boarded but upright: NO notice — the notice is the condition's, not the
    // board's (PC-prone parity: the player's Prone notice stands only while
    // prone, and a merely-boarded vehicle has nothing to warn about).
    const upright = evaluate({ modules: [module()], committed: [boardEffect()] });
    expect(
      upright.annotations.some((a) => a.key === `${T}.notice`),
      'no notice while boarded and upright'
    ).toBe(false);
    // Prone: the notice stands (the Life-Bond annotate pattern), sourced on
    // the vehicle.
    const prone = evaluate({
      modules: [module()],
      committed: [boardEffect(), proneEffect()]
    });
    const notice = prone.annotations.find((a) => a.key === `${T}.notice`);
    expect(notice, 'a notice stands while the vehicle is prone').toBeDefined();
    expect(notice!.targets).toEqual(['notice']);
    expect(notice!.source).toBe(`${T}.effect.name`);
    expect(notice!.body).toBe(`${T}.notice.body`);
  });

  it('tracks the prone state: flipping upright or de-boarding withdraws it', () => {
    // Flipped upright (the eviction merely PLANNED — newest-wins clears the
    // fact now): the condition is gone, so its notice goes with it…
    const flipped = evaluate({
      modules: [module()],
      committed: [boardEffect(), proneEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'flip-tormentor-upright' }]
    });
    expect(flipped.annotations.some((a) => a.key === `${T}.notice`)).toBe(false);
    // …and the unboarded vehicle carries no notice at all (the prone record
    // never outlives the board).
    const unboarded = evaluate({ modules: [module()] });
    expect(unboarded.annotations.some((a) => a.key === `${T}.notice`)).toBe(false);
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
