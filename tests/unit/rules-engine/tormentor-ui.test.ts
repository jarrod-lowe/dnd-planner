import { describe, it, expect } from 'vitest';
import { evaluate, type FactReader, type RuleModule } from '$lib/rules-engine';
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
      'set-tormentor-ac-mode',
      'record-tormentor-damage',
      'record-tormentor-heal',
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
    expect(out.facts[`${F}.hp.base`]).toBeUndefined();
    expect(out.facts[`${F}.damageThreshold`]).toBeUndefined();
    // hp.max/hp.current are DERIVED now (the steed shape): the contributions
    // stay registered, so unboarded they settle to 0 rather than vanishing —
    // the top-bar gate keys on `active`, which IS gone, so the chip withdraws.
    expect(out.facts[`${F}.hp.max`]).toBe(0);
    expect(out.facts[`${F}.hp.current`]).toBe(0);
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
      // AC mode (pass 4): the board selection is baked as the 0/1 MODE fact —
      // the flat ac.value bake is GONE (AC is derived as ac.effective below, so
      // a legacy persisted board's stale ac.value is inert, never a conflict).
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

  it('owns every station record as a dependent (raw mount-chip removal cascades)', () => {
    // Raw chip removal runs through playStore's removeEffect, which evicts the
    // removed effect's declared dependents by key (the generic mechanism is
    // pinned in playStore.test.ts). What THIS pins is the declaration: every
    // record effect key, so removing the mount chip can never strand a recorded
    // occupancy, a prone record, an HP record or a destroyed wreck under a
    // de-boarded vehicle.
    expect(boardEffect().dependents).toEqual([
      'tormentor-occupancy',
      'tormentor-ac-mode',
      'tormentor-prone',
      'tormentor-hp-damage',
      'tormentor-hp-heal',
      'tormentor-destroyed'
    ]);
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

// The boarded stat facts (every gate the declarations read, plus the pool the
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
        label: 'play.stats.tormentor-damage-control.hp',
        total: `${F}.hp.max`,
        remaining: `${F}.hp.current`,
        subject: SUBJECT
      },
      {
        type: 'value',
        label: 'play.stats.tormentor-damage-control.ac',
        fact: `${F}.ac.effective`,
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
 * legs). Recorded from the station's +ADD and flipped upright by an empty
 * same-key eviction; the BOARD is each offer's one structural gate (`when`),
 * while the prone state itself is a LEGALITY gate (illegal-but-visible, the
 * plan.ts contract — illegal rows stay applicable with diagnostics and still
 * execute; no Speed leg, the vehicle has no movement economy), evicted with
 * the board, and carried as a NOTICE while prone (the Life-Bond annotate
 * pattern gated on the prone fact — PC-prone parity: the condition triggers
 * its notice).
 */

/** A reader for the boarded vehicle at the given prone state (gate pins). */
function readerAt(prone: number): FactReader {
  return {
    num: (n) => (n === `${F}.prone` ? prone : n === `${F}.active` ? 1 : 0),
    has: (n) => n === `${F}.prone` || n === `${F}.active`
  };
}

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
  it('is a station free-section offer while boarded, LEGAL while upright', () => {
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
    // Boarded and upright: legal, no diagnostics.
    expect(offer!.legal).toBe(true);
    expect(offer!.diagnostics).toEqual([]);
  });

  it('is gated structurally on boarded ONLY (when); the prone state is a legality gate', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'knock-tormentor-prone')!;
    // `when` like the other station actions: unboarded, recording a prone for
    // a vehicle nobody rides does not exist at all. The ALREADY-PRONE state is
    // `legalWhen`, never `when` (the engine's illegal-but-visible contract —
    // the PC's drop-prone structural gate was the deviation, corrected): while
    // prone the offer stays visible and applicable, flagged illegal with its
    // diagnostic, and a planned-anyway row still executes.
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toHaveLength(1);
    // The structural gate is the board alone: it holds while prone.
    expect(raw.when!(readerAt(1))).toBe(true);
    // …and the legality leg is the already-prone one.
    expect(raw.legalWhen![0]!.condition(readerAt(0))).toBe(true);
    expect(raw.legalWhen![0]!.condition(readerAt(1))).toBe(false);
    expect(raw.legalWhen![0]!.diagnostics).toEqual([
      { code: `${T}.knocked-prone.already_prone`, severity: 'error' }
    ]);
  });

  it('is absent while unboarded', () => {
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
      committed: [boardEffect(), proneEffect()]
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

  it('a planned-anyway re-record while ILLEGAL still applies, carrying its diagnostic', () => {
    // The plan.ts contract (the player-override path): an illegal planned row
    // EXECUTES — the keyed replacement re-advertises the one record
    // (newest-wins, so still a single prone fact) while the row carries the
    // already-prone diagnostic, instead of the closed structural gate
    // silently doing nothing.
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), proneEffect()],
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
  it('is gated structurally on boarded ONLY (when); prone is a legality gate, both states visible', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'flip-tormentor-upright')!;
    // `when` is the board alone (like the knock — the mirror structural gate
    // was the deviation): while UPRIGHT the offer stays visible and applicable
    // but is flagged ILLEGAL with its not-prone diagnostic (the engine's
    // illegal-but-visible contract, the get-up shape).
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
    // Boarded and upright: the flip EXISTS (nothing hides it) and is illegal.
    const upright = evaluate({ modules: [module()], committed: [boardEffect()] });
    const uprightFlip = upright.availableRules.find((r) => r.rule.id === 'flip-tormentor-upright');
    expect(uprightFlip, 'the flip is offered while upright').toBeDefined();
    expect(uprightFlip!.legal).toBe(false);
    expect(uprightFlip!.diagnostics).toEqual([
      { code: `${T}.flip-upright.not_prone`, severity: 'error' }
    ]);
    // Boarded and prone (the record planned this very turn): flippable now.
    const prone = evaluate({
      modules: [module()],
      committed: [boardEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'knock-tormentor-prone' }]
    });
    const proneFlip = prone.availableRules.find((r) => r.rule.id === 'flip-tormentor-upright');
    expect(proneFlip).toBeDefined();
    expect(proneFlip!.legal).toBe(true);
    expect(proneFlip!.diagnostics).toEqual([]);
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

  it('a planned-anyway flip while upright still executes as a no-op eviction, with its diagnostic', () => {
    // The get-up-while-standing precedent: the illegal row still runs, so the
    // empty same-key eviction lands beside nothing to evict (a fact no-op) and
    // the row carries the not-prone diagnostic — the override path never
    // silently swallows the plan.
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect()],
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

/**
 * Pass 3 — damageable HP: the flat display-only `hp.max` baked fact gives way
 * to the steed-shaped pool (base baked on the board effect; max/current/
 * modifier derived), recorded from the STATION's +ADD by damage and heal
 * recorders whose ONE keyed untilLongRest effect carries the running total
 * (the steed recorder idiom). The stat block's damage threshold is a BAKED
 * FACT, and the builder's generic `damageThresholdGate` gates the damage
 * apply: a blow below the fact records NOTHING and flags the row with the
 * below-threshold diagnostic while the OFFER stays legal (the apply-level
 * gate, the dash idiom — the engine's illegal-but-visible contract is not
 * needed; nothing is illegal, the blow just bounces off). Damage that brings
 * hp.current to 0 ALSO advertises a permanent keyed `tormentor-destroyed`
 * wreck (the steed lethal-check placement, but NO auto-unboard: the board
 * effect persists so the wreck stays inspectable) with a standing NOTICE
 * gated on the destroyed fact. Re-boarding/de-boarding evict the HP records
 * and the wreck with everything else.
 */

/** The HP record effect ids/keys the station recorders advertise. */
const HP_DAMAGE_EFFECT = 'effect-tormentor-hp-damage';
const HP_HEAL_EFFECT = 'effect-tormentor-hp-heal';
const DESTROYED_EFFECT = 'effect-tormentor-destroyed';

/** Plan ONE damage row at `amount` on a committed board (the real plan fold). */
function planDamage(amount: number) {
  return evaluate({
    modules: [module()],
    committed: [boardEffect()],
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
    committed: [boardEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'record-tormentor-damage', selections: { amount: 60 } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith(DESTROYED_EFFECT));
  expect(advertised, 'a destroying blow advertises exactly one wreck').toHaveLength(1);
  return advertised[0]!;
}

describe('vehicle HP pool derives', () => {
  it('derives the steed-shaped pool from the baked base while boarded', () => {
    const out = evaluate({ modules: [module()], committed: [boardEffect()] });
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
      committed: [boardEffect(), damageRecordEffect(30)],
      planned: [{ instanceId: 'i0', ruleId: 'record-tormentor-heal', selections: { amount: 10 } }]
    });
    expect(healed.facts[`${F}.hp.modifier.current`]).toBe(-20);
    expect(healed.facts[`${F}.hp.current`]).toBe(40);
  });

  it('reads 0 while unboarded (contributions stay registered, gated on active)', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.facts[`${F}.hp.max`]).toBe(0);
    expect(out.facts[`${F}.hp.current`]).toBe(0);
  });
});

describe('record-tormentor-damage offer', () => {
  it('is a station free-section HEALTH slider while boarded, gated on the board ONLY', () => {
    const out = evaluate({ modules: [module()], committed: [boardEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'record-tormentor-damage');
    expect(offer, 'the station +ADD carries the damage recorder').toBeDefined();
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
    expect(offer!.rule.vars).toEqual({ amount: { capture: true, default: { number: 0 } } });
    // LEGAL with no legality gates: the threshold is an apply-level gate (the
    // dash idiom) — the offer is always applicable, the blow may just bounce.
    expect(offer!.legal).toBe(true);
    const raw = module().offer!({ selections: {} }).find(
      (o) => o.id === 'record-tormentor-damage'
    )!;
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
  });

  it('is absent while unboarded', () => {
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

  it('sub-threshold damage records NOTHING and flags the row (the offer stays legal)', () => {
    const out = planDamage(9);
    // No record effect, no fact change — the blow bounces off the armor plate.
    expect(out.effects.filter((e) => e.id.endsWith(HP_DAMAGE_EFFECT))).toHaveLength(0);
    expect(out.facts[`${F}.hp.damageRecorded`]).toBeUndefined();
    expect(out.facts[`${F}.hp.current`]).toBe(60);
    // …and the row carries the below-threshold diagnostic from the apply fold.
    expect(out.planDiagnostics['i0']).toEqual([
      { code: `${T}.record-damage.below_threshold`, severity: 'error' }
    ]);
  });

  it('threshold and above record the FULL amount (the threshold is a floor, not a cap)', () => {
    expect(planDamage(10).facts[`${F}.hp.damageRecorded`]).toBe(10);
    expect(planDamage(60).facts[`${F}.hp.damageRecorded`]).toBe(60);
  });
});

describe('record-tormentor-heal offer', () => {
  it("is the damage recorder's mirror: station free-section HEALTH slider, no detailKey", () => {
    const out = evaluate({ modules: [module()], committed: [boardEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'record-tormentor-heal');
    expect(offer, 'the station +ADD carries the heal recorder').toBeDefined();
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
    expect(offer!.rule.vars).toEqual({ amount: { capture: true, default: { number: 0 } } });
  });

  it('records the running heal CAPPED at the net missing HP (the steed idiom)', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), damageRecordEffect(30)],
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
    // …and the BOARD persists (NO auto-unboard — the steed lethal-check
    // placement deliberately stops short of retiring the vehicle): the wreck
    // stays inspectable and the crew can de-board.
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
      committed: [boardEffect(), damageRecordEffect(60), destroyedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'record-tormentor-damage', selections: { amount: 10 } }]
    });
    expect(out.facts[`${F}.destroyed`]).toBe(1);
    expect(out.effects.filter((e) => e.key === 'tormentor-destroyed')).toHaveLength(1);
  });
});

describe('destroyed notice', () => {
  it('stands only while the vehicle is destroyed, with the vehicle as its source', () => {
    const whole = evaluate({ modules: [module()], committed: [boardEffect()] });
    expect(
      whole.annotations.some((a) => a.key === `${T}.destroyed-notice`),
      'no destroyed notice on a whole vehicle'
    ).toBe(false);
    const wrecked = evaluate({
      modules: [module()],
      committed: [boardEffect(), destroyedEffect()]
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
      committed: [boardEffect(), proneEffect(), destroyedEffect()]
    });
    const keys = out.annotations.filter((a) => a.targets.includes('notice')).map((a) => a.key);
    expect(keys).toEqual(expect.arrayContaining([`${T}.notice`, `${T}.destroyed-notice`]));
  });
});

describe('HP records and the wreck ride the board lifecycle', () => {
  it('a re-board advertises the empty same-key evictions beside the board effect', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), damageRecordEffect(20), destroyedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'board-tormentor' }]
    });
    for (const key of ['tormentor-hp-damage', 'tormentor-hp-heal', 'tormentor-destroyed']) {
      const evict = out.effects.find((e) => e.id.endsWith(`evict-${key}`));
      expect(evict, `re-board advertises the ${key} eviction`).toBeDefined();
      expect(evict!.key).toBe(key);
      expect(evict!.state).toBeUndefined();
      expect(evict!.expiry).toEqual({ kind: 'permanent' });
    }
    // A fresh board starts whole: no damage banked, no wreck, no notice.
    expect(out.facts[`${F}.hp.damageRecorded`]).toBeUndefined();
    expect(out.facts[`${F}.destroyed`]).toBeUndefined();
    expect(out.facts[`${F}.hp.current`]).toBe(60);
    expect(out.annotations.some((a) => a.key === `${T}.destroyed-notice`)).toBe(false);
  });

  it('de-board advertises the same evictions while clearing every baked fact', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), damageRecordEffect(20), destroyedEffect()],
      planned: [{ instanceId: 'i0', ruleId: 'deboard-tormentor' }]
    });
    for (const key of ['tormentor-hp-damage', 'tormentor-hp-heal', 'tormentor-destroyed']) {
      expect(
        out.effects.find((e) => e.id.endsWith(`evict-${key}`)),
        `de-board advertises the ${key} eviction`
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

  it('the below-threshold diagnostic, destroyed chip and destroyed notice exist in BOTH locales', () => {
    const strings: Record<string, string | undefined> = {
      'en below-threshold diagnostic': en.rule.tormentor['record-damage']?.below_threshold,
      'en-x-tlh below-threshold diagnostic': tlh.rule.tormentor['record-damage']?.below_threshold,
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
 *   secondaryControl in PanelRenderer) defaulting to Moving, and the board
 *   effect bakes the selection as the 0/1 `acMotionless` mode fact. The board
 *   effect NO LONGER bakes a flat `ac.value`.
 * - AC is DERIVED as `ac.effective` (19 motionless, else 21, gated on active) —
 *   a deliberately NEW fact name: legacy persisted boards bake flat ac.value,
 *   and nothing may derive ac.value or the sheet's input/contribution overlap
 *   would throw on every evaluation (the pass-3 hp.max lesson). The stale
 *   legacy ac.value is simply inert, and a legacy board derives 21 (Moving)
 *   with the station record working on top of it — no load-seam migration.
 * - The station's +ADD carries an always-present (while boarded) "AC Mode"
 *   record offer — the occupancy intent class, applied IMMEDIATELY — with the
 *   same segmented control pre-showing the CURRENT mode. Its ONE permanent
 *   keyed effect (`tormentor-ac-mode`) stores the mode as the DISTINCT
 *   `acMotionless.recorded` fact: the engine sum-combines two live effects
 *   writing one fact, so a record writing `acMotionless` itself could never
 *   flip a Motionless board back to Moving (1 + 0 still reads 1). The derive
 *   prefers the record when present (the occupancy has-preference idiom), so
 *   the record overrides the board bake in BOTH directions.
 * - The mode key joins CHILD_KEYS: re-board/de-board evict the record, and a
 *   fresh board resets to the board SELECTION.
 */
describe('board offer AC-mode control', () => {
  it('carries a [Moving | Motionless] segmented SECONDARY control defaulting to Moving (creatureType precedent)', () => {
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'board-tormentor')!;
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
    const moving = boardEffect();
    expect(moving.state?.[`${F}.acMotionless`]).toBe(0);
    expect(moving.state?.[`${F}.ac.value`]).toBeUndefined();
    // Motionless selected: the selection flows into the effect state exactly
    // the way creatureType flows into the steed effect.
    const out = evaluate({
      modules: [module()],
      planned: [{ instanceId: 'i0', ruleId: 'board-tormentor', selections: { mode: 1 } }]
    });
    const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-damage-control'));
    expect(advertised).toHaveLength(1);
    expect(advertised[0]!.state?.[`${F}.acMotionless`]).toBe(1);
    expect(advertised[0]!.state?.[`${F}.ac.value`]).toBeUndefined();
  });
});

/** A committed board effect at the given board-time mode (the real plan fold). */
function boardEffectAt(mode: number): EffectInstance {
  const out = evaluate({
    modules: [module()],
    planned: [{ instanceId: 'i0', ruleId: 'board-tormentor', selections: { mode } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-damage-control'));
  expect(advertised, 'boarding at a mode advertises exactly one board effect').toHaveLength(1);
  return advertised[0]!;
}

/** The AC-mode record a station row at `mode` advertises (exactly one). */
function acModeEffect(mode: number): EffectInstance {
  const out = evaluate({
    modules: [module()],
    committed: [boardEffect()],
    planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-ac-mode', selections: { mode } }]
  });
  const advertised = out.effects.filter((e) => e.id.endsWith('effect-tormentor-ac-mode'));
  expect(advertised, `an AC-mode row at ${mode} advertises exactly one record`).toHaveLength(1);
  return advertised[0]!;
}

describe('ac.effective derive', () => {
  it('reads 21 boarded-and-moving, 19 boarded-and-motionless, 0 unboarded', () => {
    const moving = evaluate({ modules: [module()], committed: [boardEffect()] });
    expect(moving.facts[`${F}.ac.effective`]).toBe(21);
    expect(moving.facts[`${F}.acMotionless.current`]).toBe(0);
    const motionless = evaluate({ modules: [module()], committed: [boardEffectAt(1)] });
    expect(motionless.facts[`${F}.ac.effective`]).toBe(19);
    expect(motionless.facts[`${F}.acMotionless.current`]).toBe(1);
    const unboarded = evaluate({ modules: [module()] });
    expect(unboarded.facts[`${F}.ac.effective`]).toBe(0);
  });

  it('the station record overrides the board bake in BOTH directions (never summed)', () => {
    // The edge a same-fact write could never survive: a MOTIONLESS board plus a
    // recorded MOVING must read 21 — sum-combining 1 + 0 would still read 1,
    // which is why the record is a distinct fact the derive prefers.
    const backToMoving = evaluate({
      modules: [module()],
      committed: [boardEffectAt(1), acModeEffect(0)]
    });
    expect(backToMoving.facts[`${F}.acMotionless`]).toBe(1);
    expect(backToMoving.facts[`${F}.acMotionless.recorded`]).toBe(0);
    expect(backToMoving.facts[`${F}.acMotionless.current`]).toBe(0);
    expect(backToMoving.facts[`${F}.ac.effective`]).toBe(21);
    const toMotionless = evaluate({
      modules: [module()],
      committed: [boardEffectAt(0), acModeEffect(1)]
    });
    expect(toMotionless.facts[`${F}.acMotionless.current`]).toBe(1);
    expect(toMotionless.facts[`${F}.ac.effective`]).toBe(19);
  });

  it('a LEGACY persisted board (flat ac.value, no acMotionless) evaluates and derives 21', () => {
    // The pre-pass-4 board shape, as persisted on a test character: the flat
    // ac.value bake is an INPUT no module derives or reads any more, so it is
    // inert rather than a two-writer conflict, and the missing mode fact reads
    // as the Moving default.
    const legacy: EffectInstance = {
      id: 'effect-tormentor-damage-control',
      key: 'tormentor-damage-control',
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
    // The station record works on a legacy board (dismiss + re-add is the
    // accepted migration; the record needs no mode fact to exist).
    expect(out.availableRules.some((r) => r.rule.id === 'set-tormentor-ac-mode')).toBe(true);
  });
});

describe('set-tormentor-ac-mode offer', () => {
  it('is a station free-section record offer while boarded, segmented pre-showing the CURRENT mode', () => {
    const out = evaluate({ modules: [module()], committed: [boardEffect()] });
    const offer = out.availableRules.find((r) => r.rule.id === 'set-tormentor-ac-mode');
    expect(offer, 'the station +ADD carries the AC-mode offer').toBeDefined();
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
    // Opens at the CURRENT mode (recorded value once set, board bake otherwise).
    expect(offer!.rule.vars).toEqual({
      mode: { capture: true, default: { fact: `${F}.acMotionless.current` } }
    });
    // Always applicable while boarded: no legality gates (the mode is a fact,
    // not a resource).
    expect(offer!.legal).toBe(true);
    const raw = module().offer!({ selections: {} }).find((o) => o.id === 'set-tormentor-ac-mode')!;
    expect(typeof raw.when).toBe('function');
    expect(raw.legalWhen).toBeUndefined();
  });

  it('is absent while unboarded (structural gate on the board)', () => {
    const out = evaluate({ modules: [module()] });
    expect(out.availableRules.some((r) => r.rule.id === 'set-tormentor-ac-mode')).toBe(false);
  });

  it('apply advertises ONE permanent keyed effect storing the mode as the distinct recorded fact', () => {
    const e = acModeEffect(1);
    expect(e.id).toContain('effect-tormentor-ac-mode');
    expect(e.key).toBe('tormentor-ac-mode');
    // The RECORDED fact, not the board-baked acMotionless: the engine
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
      committed: [boardEffect(), acModeEffect(1)],
      planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-ac-mode', selections: { mode: 0 } }]
    });
    expect(out.facts[`${F}.acMotionless.recorded`]).toBe(0);
    expect(out.facts[`${F}.ac.effective`]).toBe(21);
    // …and the reverse on a Moving record: 19 the moment the row is planned.
    const reverse = evaluate({
      modules: [module()],
      committed: [boardEffect(), acModeEffect(0)],
      planned: [{ instanceId: 'i0', ruleId: 'set-tormentor-ac-mode', selections: { mode: 1 } }]
    });
    expect(reverse.facts[`${F}.ac.effective`]).toBe(19);
  });
});

describe('the AC-mode record rides the board lifecycle', () => {
  it('a re-board evicts the record and resets the mode to the board SELECTION', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffectAt(1), acModeEffect(0)],
      planned: [{ instanceId: 'i0', ruleId: 'board-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-ac-mode'));
    expect(evict, 're-board advertises the AC-mode eviction').toBeDefined();
    expect(evict!.key).toBe('tormentor-ac-mode');
    expect(evict!.state).toBeUndefined();
    expect(evict!.expiry).toEqual({ kind: 'permanent' });
    // The fresh board (no selection) resets to Moving: 21, no record.
    expect(out.facts[`${F}.acMotionless.recorded`]).toBeUndefined();
    expect(out.facts[`${F}.ac.effective`]).toBe(21);
    // A re-board SELECTING Motionless stands: 19.
    const selected = evaluate({
      modules: [module()],
      committed: [boardEffectAt(0), acModeEffect(0)],
      planned: [{ instanceId: 'i0', ruleId: 'board-tormentor', selections: { mode: 1 } }]
    });
    expect(selected.facts[`${F}.acMotionless`]).toBe(1);
    expect(selected.facts[`${F}.ac.effective`]).toBe(19);
  });

  it('de-board evicts the record with the board', () => {
    const out = evaluate({
      modules: [module()],
      committed: [boardEffect(), acModeEffect(1)],
      planned: [{ instanceId: 'i0', ruleId: 'deboard-tormentor' }]
    });
    const evict = out.effects.find((e) => e.id.endsWith('evict-tormentor-ac-mode'));
    expect(evict, 'de-board advertises the AC-mode eviction').toBeDefined();
    expect(evict!.state).toBeUndefined();
    expect(out.facts[`${F}.acMotionless.recorded`]).toBeUndefined();
    expect(out.facts[`${F}.ac.effective`]).toBe(0);
  });
});

describe('pass 4 i18n (tlh is the canary)', () => {
  it('the mode labels exist in BOTH locales, shared by the board and station controls', () => {
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
