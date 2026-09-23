import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// The panel's rolls funnel through the shared toast helper; mocking it turns
// the roll key (4th argument) into the observable — the same
// delegation-proving idiom as NoticeStrip.test.ts. The key itself is the
// behaviour under test: stable for the same die on the same control of the
// same item, distinct whenever any of those changes.
vi.mock('$lib/components/play/panel-renderer/diceRollToast', () => ({
  showDiceRollToast: vi.fn()
}));

import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import { showDiceRollToast } from '$lib/components/play/panel-renderer/diceRollToast';
import type { AvailableRuleEntry, Rule } from '$lib/rules-view';

// A two-die dice-line (to-hit d20 + d12 damage), mirroring the attack entry
// from PanelDiceLine-onRoll.test.ts: the two die indexes must key apart.
const createDiceLineEntry = (id: string): AvailableRuleEntry => ({
  rule: {
    id,
    description: 'Greataxe',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        ranges: { var: 'ranges' },
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' } },
          {
            sides: { var: 'damageDie' },
            bonus: { var: 'damageBonus' },
            damageType: { string: 'slashing' }
          }
        ]
      }
    },
    vars: {
      ranges: { default: { array: [{ distance: 5, type: 'melee' }] } },
      hitBonus: { default: { number: 5 } },
      damageDie: { default: { number: 12 } },
      damageBonus: { default: { number: 3 } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// Mirrors the control authored on `record-short-rest` (see
// PanelHitDice.test.ts): pools per die size resolved from `hitDie.*` facts.
const hitDiceControl = {
  type: 'hit-dice' as const,
  unit: 'hp',
  bonus: { fact: 'con.modifier' },
  pools: [6, 8, 10, 12].map((sides) => ({
    sides,
    total: { fact: `hitDie.d${sides}.total` },
    remaining: { fact: `hitDie.d${sides}.remaining` }
  }))
};

const createHitDiceEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'record-short-rest',
    description: 'Short Rest',
    activities: [],
    ui: {
      section: 'rest',
      name: 'planner.record.rest.short',
      primaryControl: hitDiceControl
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// Two open pools (d8 and d10, two slots each) so slot indexes restart across
// pools — exactly the collision a pool-qualified key must avoid.
const hitDiceFacts = (): Record<string, number> => ({
  'con.modifier': 2,
  'hp.modifier.current': -20,
  'hitDie.d6.total': 0,
  'hitDie.d6.remaining': 0,
  'hitDie.d8.total': 2,
  'hitDie.d8.remaining': 2,
  'hitDie.d10.total': 2,
  'hitDie.d10.remaining': 2,
  'hitDie.d12.total': 0,
  'hitDie.d12.remaining': 0
});

// A dice-line primary beside a dice-line secondary (no `enabled` gate, so the
// secondary renders immediately) — the two controls' dice must key apart.
const createDualDiceLineEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'dual-panel',
    description: 'Dual Panel',
    activities: [],
    ui: {
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      },
      secondaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      },
      vars: { hitBonus: { default: { number: 5 } } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// A dice-line primary beside a HIT-DICE secondary, so the secondary wiring of
// the slot roller is covered too.
const createSecondaryHitDiceEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'rest-with-rider',
    description: 'Rest With Rider',
    activities: [],
    ui: {
      name: 'planner.record.rest.short',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 20, bonus: { var: 'hitBonus' } }]
      },
      secondaryControl: hitDiceControl,
      vars: { hitBonus: { default: { number: 5 } } }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

/** The roll key of every toast fired so far, in order. */
function rollKeys(): (string | undefined)[] {
  return vi.mocked(showDiceRollToast).mock.calls.map((call) => call[3]);
}

/** The slot-th chip of a hit-dice pool, re-queried so a re-render cannot
 *  leave the test clicking a stale node. */
function poolChip(container: HTMLElement, sides: number, slot: number): HTMLButtonElement {
  const chips = container.querySelectorAll<HTMLButtonElement>(
    `.panel-renderer__hit-dice-pool[data-die-sides="${sides}"] .panel-renderer__die-chip`
  );
  return chips[slot];
}

describe('PanelRenderer - roll-log key', () => {
  beforeEach(() => {
    vi.mocked(showDiceRollToast).mockClear();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keys a dice-line roll by item, control position and die index', async () => {
    const { container } = render(PanelRenderer, {
      props: { entry: createDiceLineEntry('greataxe'), editable: true, facts: {} }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[0]);
    await fireEvent.click(chips[1]);

    // The same panel's two dice key apart by die index; the key is opaque
    // (never rendered, never translated).
    expect(rollKeys()).toEqual(['greataxe:primary:die:0', 'greataxe:primary:die:1']);
  });

  it('reuses the key when the same die is re-rolled', async () => {
    const { container } = render(PanelRenderer, {
      props: { entry: createDiceLineEntry('greataxe'), editable: true, facts: {} }
    });
    const chip = container.querySelector('.panel-renderer__die-chip')!;
    await fireEvent.click(chip);
    await fireEvent.click(chip);

    // Identical keys are what lets the second log entry replace the first.
    expect(rollKeys()).toEqual(['greataxe:primary:die:0', 'greataxe:primary:die:0']);
  });

  it('keys the same die on a different item differently', async () => {
    const axe = render(PanelRenderer, {
      props: { entry: createDiceLineEntry('greataxe'), editable: true, facts: {} }
    });
    const bow = render(PanelRenderer, {
      props: { entry: createDiceLineEntry('shortbow'), editable: true, facts: {} }
    });
    await fireEvent.click(axe.container.querySelector('.panel-renderer__die-chip')!);
    await fireEvent.click(bow.container.querySelector('.panel-renderer__die-chip')!);

    expect(rollKeys()).toEqual(['greataxe:primary:die:0', 'shortbow:primary:die:0']);
  });

  it('keys two rows of the same offer apart by plan instance', async () => {
    // Extra Attack plans the same greataxe offer twice: each row's view entry
    // carries the OFFER's rule id (the engine re-resolves the offer per row),
    // so only the plan item's instance id tells the two rows' dice apart.
    const first = render(PanelRenderer, {
      props: {
        entry: createDiceLineEntry('greataxe'),
        editable: true,
        facts: {},
        instanceId: 'inst-1'
      }
    });
    const second = render(PanelRenderer, {
      props: {
        entry: createDiceLineEntry('greataxe'),
        editable: true,
        facts: {},
        instanceId: 'inst-2'
      }
    });
    await fireEvent.click(first.container.querySelector('.panel-renderer__die-chip')!);
    await fireEvent.click(second.container.querySelector('.panel-renderer__die-chip')!);

    expect(rollKeys()).toEqual(['inst-1:primary:die:0', 'inst-2:primary:die:0']);
  });

  it('reuses the instance-scoped key when the same die is re-rolled', async () => {
    const { container } = render(PanelRenderer, {
      props: {
        entry: createDiceLineEntry('greataxe'),
        editable: true,
        facts: {},
        instanceId: 'inst-1'
      }
    });
    const chip = container.querySelector('.panel-renderer__die-chip')!;
    await fireEvent.click(chip);
    await fireEvent.click(chip);

    // Same instance, same die: identical keys, so a re-roll still replaces.
    expect(rollKeys()).toEqual(['inst-1:primary:die:0', 'inst-1:primary:die:0']);
  });

  it('keys a hit-dice slot roll by pool size and slot index', async () => {
    const { container } = render(PanelRenderer, {
      props: { entry: createHitDiceEntry(), editable: true, facts: hitDiceFacts() }
    });

    // Slot indexes restart per pool: d8 slot 0 and d10 slot 0 are different
    // dice, so the pool's die size belongs in the key alongside the slot.
    await fireEvent.click(poolChip(container, 8, 0));
    await fireEvent.click(poolChip(container, 10, 0));
    await fireEvent.click(poolChip(container, 8, 1));

    expect(rollKeys()).toEqual([
      'record-short-rest:primary:slot:d8:0',
      'record-short-rest:primary:slot:d10:0',
      'record-short-rest:primary:slot:d8:1'
    ]);
  });

  it("keys the secondary control's dice apart from the primary's", async () => {
    const { container } = render(PanelRenderer, {
      props: { entry: createDualDiceLineEntry(), editable: true, facts: {} }
    });
    const primaryChip = container.querySelector(
      '.panel-renderer__control:not(.panel-renderer__control--secondary) .panel-renderer__die-chip'
    )!;
    const secondaryChip = container.querySelector(
      '.panel-renderer__control--secondary .panel-renderer__die-chip'
    )!;
    await fireEvent.click(primaryChip);
    await fireEvent.click(secondaryChip);

    expect(rollKeys()).toEqual(['dual-panel:primary:die:0', 'dual-panel:secondary:die:0']);
  });

  it("keys the secondary control's hit-dice slots by pool and slot too", async () => {
    const { container } = render(PanelRenderer, {
      props: { entry: createSecondaryHitDiceEntry(), editable: true, facts: hitDiceFacts() }
    });
    await fireEvent.click(poolChip(container, 8, 0));

    expect(rollKeys()).toEqual(['rest-with-rider:secondary:slot:d8:0']);
  });
});
