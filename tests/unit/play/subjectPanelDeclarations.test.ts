import { describe, it, expect } from 'vitest';
import { deriveTopBarEntries, deriveResourceEntries } from '$lib/play/derivePanels';
import findSteed from '$lib/rules-engine/rules/find-steed';
import type { RuleModule } from '$lib/rules-engine';

/**
 * Module-declared subject panel entries: a rule module declares its subject's
 * top-bar / resource entries as DATA (`panels` on the module), and the
 * derivePanels aggregation surfaces them generically — an entry appears when
 * its gate holds in the evaluated facts, stamped with the declared subject.
 * No per-subject knowledge lives in derivePanels; adding a companion (the
 * Tormentor) is a declaration, not a UI-catalog change.
 */

// A synthetic module declaring entries for a fixture subject — proves the
// aggregation is generic (derivePanels has never heard of 'fixture').
const fixtureModule: RuleModule = {
  id: 'fixture-declarer',
  panels: [
    {
      subject: 'fixture',
      panel: 'topBar',
      gate: 'fixture.hp.max',
      entry: {
        type: 'usedMax',
        label: 'play.topBar.hp',
        total: 'fixture.hp.max',
        remaining: 'fixture.hp.current'
      }
    },
    {
      // creature-type style: only the matching fact VALUE surfaces the entry.
      subject: 'fixture',
      panel: 'topBar',
      gate: { fact: 'fixture.form', equals: 2 },
      entry: { type: 'value', label: 'play.topBar.ac', fact: 'fixture.ac' }
    },
    {
      // steed action-pools style: a disjunction of pool maxima.
      subject: 'fixture',
      panel: 'resources',
      gate: { any: ['fixture.actions.max', 'fixture.bonusActions.max'] },
      entry: { type: 'value', label: 'play.stats.actions', fact: 'fixture.actions.open' }
    }
  ]
};

describe('module-declared subject entries — generic aggregation', () => {
  it('surfaces a presence-gated entry on its declared panel, stamped with the subject', () => {
    const facts = { 'fixture.hp.max': 5, 'fixture.hp.current': 4 };
    const top = deriveTopBarEntries(facts, [fixtureModule]).filter((e) => e.subject === 'fixture');
    expect(top).toEqual([
      {
        type: 'usedMax',
        label: 'play.topBar.hp',
        total: 'fixture.hp.max',
        remaining: 'fixture.hp.current',
        subject: 'fixture'
      }
    ]);
    // Panel separation: a topBar declaration never leaks into resources.
    expect(
      deriveResourceEntries(facts, [fixtureModule]).filter((e) => e.subject === 'fixture')
    ).toEqual([]);
  });

  it('emits nothing for a subject whose module is not loaded', () => {
    const facts = { 'fixture.hp.max': 5, 'fixture.hp.current': 4 };
    expect(deriveTopBarEntries(facts).some((e) => e.subject === 'fixture')).toBe(false);
  });

  it('holds back a presence-gated entry when its gate fact is absent', () => {
    expect(deriveTopBarEntries({}, [fixtureModule]).some((e) => e.subject === 'fixture')).toBe(
      false
    );
  });

  it('surfaces a value-gated entry only when the fact equals the declared value', () => {
    const matching = { 'fixture.form': 2, 'fixture.ac': 21 };
    expect(
      deriveTopBarEntries(matching, [fixtureModule]).some(
        (e) => e.subject === 'fixture' && e.label === 'play.topBar.ac'
      )
    ).toBe(true);
    // The wrong creature type, and an absent fact, both hold the entry back.
    const wrongType = { 'fixture.form': 1, 'fixture.ac': 21 };
    expect(
      deriveTopBarEntries(wrongType, [fixtureModule]).some(
        (e) => e.label === 'play.topBar.ac' && e.subject === 'fixture'
      )
    ).toBe(false);
    const noFact = { 'fixture.ac': 21 };
    expect(
      deriveTopBarEntries(noFact, [fixtureModule]).some(
        (e) => e.label === 'play.topBar.ac' && e.subject === 'fixture'
      )
    ).toBe(false);
  });

  it('surfaces an any-gated entry when either listed fact is present', () => {
    const actionsOnly = { 'fixture.actions.max': 1 };
    expect(
      deriveResourceEntries(actionsOnly, [fixtureModule]).some(
        (e) => e.subject === 'fixture' && e.type === 'value'
      )
    ).toBe(true);
    const bonusOnly = { 'fixture.bonusActions.max': 1 };
    expect(
      deriveResourceEntries(bonusOnly, [fixtureModule]).some((e) => e.subject === 'fixture')
    ).toBe(true);
    expect(deriveResourceEntries({}, [fixtureModule]).some((e) => e.subject === 'fixture')).toBe(
      false
    );
  });
});

// The steed's faked stat facts: every gate the declarations read, with the
// fiend creature type (Fell Glare) selected and all three ability pools baked.
const STEED_FACTS = {
  'companion.steed.hp.max': 30,
  'companion.steed.hp.current': 25,
  'companion.steed.ac.value': 14,
  'companion.steed.movement.total': 60,
  'companion.steed.movement.remaining': 45,
  'companion.steed.str.modifier': 4,
  'companion.steed.actions.max': 1,
  'companion.steed.actions.spent': 0,
  'companion.steed.bonusActions.max': 1,
  'companion.steed.bonusActions.spent': 0,
  'companion.steed.creatureType': 2, // fiend → Fell Glare
  'companion.steed.healingTouch.total': 1,
  'companion.steed.feyStep.total': 1,
  'companion.steed.fellGlare.total': 1,
  'companion.steed.fellGlare.remaining': 1
};

/** The steed's six ability columns (no proficiencyFact: no save proficiencies). */
const STEED_ABILITIES = (['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((a) => ({
  name: `play.stats.${a}`,
  fact: `companion.steed.${a}.modifier`,
  saveFact: `companion.steed.${a}.save`
}));

describe('module-declared subject entries — steed migration pin', () => {
  it('emits exactly the top-bar entries the hardcoded STEED catalog produced', () => {
    expect(
      deriveTopBarEntries(STEED_FACTS, [findSteed]).filter((e) => e.subject === 'steed')
    ).toEqual([
      {
        type: 'usedMax',
        label: 'play.topBar.hp',
        total: 'companion.steed.hp.max',
        remaining: 'companion.steed.hp.current',
        subject: 'steed'
      },
      {
        type: 'value',
        label: 'play.topBar.ac',
        fact: 'companion.steed.ac.value',
        subject: 'steed'
      },
      {
        type: 'value',
        label: 'play.topBar.speed',
        fact: 'companion.steed.movement.total',
        subject: 'steed'
      },
      {
        type: 'ability',
        label: 'play.topBar.abilities',
        abilities: STEED_ABILITIES,
        subject: 'steed'
      }
    ]);
  });

  it('emits exactly the resource entries the hardcoded deriveSteedResources produced', () => {
    expect(
      deriveResourceEntries(STEED_FACTS, [findSteed]).filter((e) => e.subject === 'steed')
    ).toEqual([
      {
        type: 'usedMax',
        label: 'play.stats.steed.hp',
        total: 'companion.steed.hp.max',
        remaining: 'companion.steed.hp.current',
        subject: 'steed'
      },
      {
        type: 'usedMax',
        label: 'play.stats.steed.movement',
        total: 'companion.steed.movement.total',
        remaining: 'companion.steed.movement.remaining',
        subject: 'steed'
      },
      {
        type: 'actionPools',
        label: 'play.stats.steed.actions',
        factPrefix: 'companion.steed.',
        pools: [
          {
            key: 'actions',
            label: 'play.stats.steed.actions',
            shortLabel: 'play.ledger.short.steed.actions',
            tile: 'play.economy.tile.actions'
          },
          {
            key: 'bonusActions',
            label: 'play.stats.steed.bonusActions',
            shortLabel: 'play.ledger.short.steed.bonusActions',
            tile: 'play.economy.tile.bonusActions'
          }
        ],
        subject: 'steed'
      },
      {
        type: 'usedMax',
        label: 'play.stats.steed.fellGlare',
        total: 'companion.steed.fellGlare.total',
        remaining: 'companion.steed.fellGlare.remaining',
        subject: 'steed'
      }
    ]);
  });
});
