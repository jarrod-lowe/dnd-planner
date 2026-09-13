import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelSpellPrepare from '$lib/components/play/panel-renderer/PanelSpellPrepare.svelte';
import { enumeratePreparableSpells } from '$lib/rules-engine/preparedSpells';
import type { RuleModule } from '$lib/rules-engine/types';
import type { SpellPrepareControl } from '$lib/components/play/panel-renderer/types';

/**
 * Same fixture roster as tests/unit/svelte/PanelSpellPrepare.test.ts: three L1
 * spells and two L2 spells, with name keys crossed against the spell ids so
 * translated order differs from id order. `wrath` is granted always-prepared
 * through facts.
 */
const bless: RuleModule = {
  id: 'spell-bless',
  prepare: {
    spellId: 'bless',
    level: 1,
    nameKey: 'rule.test.favour.name',
    preparedFact: 'spell.l1.bless.prepared',
    alwaysPreparedFact: 'spell.l1.bless.alwaysPrepared'
  }
};

const sleep: RuleModule = {
  id: 'spell-sleep',
  prepare: {
    spellId: 'sleep',
    level: 1,
    nameKey: 'rule.test.slumber.name',
    preparedFact: 'spell.l1.sleep.prepared',
    alwaysPreparedFact: 'spell.l1.sleep.alwaysPrepared'
  }
};

const wrath: RuleModule = {
  id: 'spell-wrath',
  prepare: {
    spellId: 'wrath',
    level: 1,
    nameKey: 'rule.test.anger.name',
    preparedFact: 'spell.l1.wrath.prepared',
    alwaysPreparedFact: 'spell.l1.wrath.alwaysPrepared'
  }
};

const calm: RuleModule = {
  id: 'spell-calm',
  prepare: {
    spellId: 'calm',
    level: 2,
    nameKey: 'rule.test.serene.name',
    preparedFact: 'spell.l2.calm.prepared',
    alwaysPreparedFact: 'spell.l2.calm.alwaysPrepared'
  }
};

const aid: RuleModule = {
  id: 'spell-aid',
  prepare: {
    spellId: 'aid',
    level: 2,
    nameKey: 'rule.test.helper.name',
    preparedFact: 'spell.l2.aid.prepared',
    alwaysPreparedFact: 'spell.l2.aid.alwaysPrepared'
  }
};

const modules: RuleModule[] = [wrath, calm, bless, aid, sleep];
const defs = enumeratePreparableSpells(modules);

const control: SpellPrepareControl = { type: 'spell-prepare', var: 'prepared' };

const baseProps = {
  control,
  editable: true,
  modules,
  facts: { 'spellcasting.prepared.max': 3 } as Record<string, number>,
  selections: {} as Record<string, unknown>
};

const bySpellId = (spellId: string) => {
  const found = defs.find((d) => d.spellId === spellId);
  if (!found) throw new Error(`fixture has no spell "${spellId}"`);
  return found;
};

const interactiveSelector = 'button, input, select, [role="group"], fieldset, [tabindex]';

describe('PanelSpellPrepare summary short form', () => {
  it('renders the counter plain text, counting the selection', () => {
    const { container } = render(PanelSpellPrepare, {
      props: {
        ...baseProps,
        selections: { prepared: [bySpellId('bless'), bySpellId('sleep')] },
        summary: true
      }
    });
    expect(container.textContent?.trim()).toBe('2 / 3 prepared');
  });

  it('renders the counter even with nothing selected yet', () => {
    const { container } = render(PanelSpellPrepare, {
      props: { ...baseProps, summary: true }
    });
    expect(container.textContent?.trim()).toBe('0 / 3 prepared');
  });

  it('keeps the illegal treatment on an over-cap counter', () => {
    const { container } = render(PanelSpellPrepare, {
      props: {
        ...baseProps,
        selections: {
          prepared: [bySpellId('bless'), bySpellId('sleep'), bySpellId('aid'), bySpellId('calm')]
        },
        summary: true
      }
    });
    expect(container.textContent?.trim()).toBe('4 / 3 prepared');
    expect(container.querySelector('.spell-prepare__counter--illegal')).not.toBeNull();
  });

  it('renders no rows, fieldsets or interactive elements in summary mode', () => {
    const { container } = render(PanelSpellPrepare, {
      props: {
        ...baseProps,
        selections: { prepared: [bySpellId('bless')] },
        summary: true
      }
    });
    expect(container.querySelectorAll(interactiveSelector)).toHaveLength(0);
    expect(container.querySelectorAll('.spell-prepare__row')).toHaveLength(0);
  });
});
