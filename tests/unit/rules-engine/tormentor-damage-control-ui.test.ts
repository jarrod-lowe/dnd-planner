import { describe, it, expect } from 'vitest';
import { evaluate, type RuleModule } from '$lib/rules-engine';
import { getModule, isRegistered } from '$lib/rules-engine/registry';
import { lazyRuleGroupIds } from '$lib/rules-engine/lazy';
import { deriveTopBarEntries, deriveResourceEntries } from '$lib/play/derivePanels';
import type { EffectInstance } from '$lib/rules-engine';

/**
 * Tormentor (Damage Control) — the first VEHICLE subject. Boarding is an
 * ungated free-section offer whose apply advertises one permanent KEYED
 * effect (the steed `steedEffect` pattern) baking the display-only stat
 * block into `companion.tormentorDamageControl.*` facts. The effect display
 * carries `section: 'mount'` plus a `detailKey` — the first mount chip that
 * FLIPS to a stat-block detail (the steed's chip never had one) — and the
 * module declares its subject's top-bar entries as data (`panels`), so the
 * vehicle surfaces without any play-layer change.
 */

const ID = 'vehicle-tormentor-damage-control';
const T = 'rule.vehicle-tormentor-damage-control';
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

describe('tormentor (damage control) registration', () => {
  it('is registered in the registry AND the lazy chunk map', () => {
    expect(isRegistered(ID)).toBe(true);
    expect(lazyRuleGroupIds()).toContain(ID);
  });
});

describe('board offer ui', () => {
  it('is an ungated free-section offer on its own subject, linking the detail', () => {
    const offers = module().offer!({ selections: {} });
    expect(offers.map((o) => o.id)).toEqual(['board-tormentor']);
    const ui = offers[0]!.ui as Record<string, unknown>;
    expect(ui.section).toBe('free');
    expect(ui.subject).toBe(SUBJECT);
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
      [`${F}.con.modifier`]: 2
    });
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

// The boarded stat facts (every gate the declarations read).
const BOARDED = {
  [`${F}.active`]: 1,
  [`${F}.ac.value`]: 21,
  [`${F}.hp.max`]: 60,
  [`${F}.speed`]: 100,
  [`${F}.cargo`]: 500,
  [`${F}.str.modifier`]: 3,
  [`${F}.dex.modifier`]: 2,
  [`${F}.con.modifier`]: 2
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

  it('no resource entries yet (creature capacity is the next pass)', () => {
    expect(deriveResourceEntries(BOARDED, [module()]).filter((e) => e.subject === SUBJECT)).toEqual(
      []
    );
  });

  it('holds every entry back while unboarded (the gate fact is absent)', () => {
    expect(deriveTopBarEntries({}, [module()]).some((e) => e.subject === SUBJECT)).toBe(false);
  });
});
