import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

// PanelRenderer's roll handler reaches toast.custom on import; the prepare
// picker never rolls, but the module still has to resolve.
vi.mock('svelte-sonner', () => ({ toast: { custom: vi.fn() } }));

import PanelSpellPrepare from '$lib/components/play/panel-renderer/PanelSpellPrepare.svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import { enumeratePreparableSpells } from '$lib/rules-engine/preparedSpells';
import type { PrepareDef, RuleModule } from '$lib/rules-engine/types';
import type { SpellPrepareControl } from '$lib/components/play/panel-renderer/types';
import type { AvailableRuleEntry } from '$lib/rules-view';

/**
 * Fixture spell roster: three L1 spells and two L2 spells, in no particular
 * module order. The name keys are deliberately crossed with the spell ids
 * (spellId `wrath` carries the key sorting first, `bless` the key sorting
 * second, …) so a row list in translated order differs from the enumerator's
 * id order — sorting by anything but the TRANSLATED name fails visibly. The
 * mock i18n resolves unstubbed keys to themselves, which is exactly what the
 * crossed keys rely on. `wrath` is granted always-prepared through facts.
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

const bySpellId = (spellId: string): PrepareDef => {
  const found = defs.find((d) => d.spellId === spellId);
  if (!found) throw new Error(`fixture has no spell "${spellId}"`);
  return found;
};

const fieldsets = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('fieldset.spell-prepare__level'));

const boxes = (container: HTMLElement): HTMLInputElement[] =>
  Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));

const boxFor = (container: HTMLElement, spellId: string): HTMLInputElement => {
  const box = container.querySelector<HTMLInputElement>(
    `input[type="checkbox"][data-spell-id="${spellId}"]`
  );
  if (!box) throw new Error(`no rendered checkbox for "${spellId}"`);
  return box;
};

const counter = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector<HTMLElement>('.spell-prepare__counter');
  if (!el) throw new Error('no rendered counter');
  return el;
};

describe('PanelSpellPrepare rows', () => {
  it('renders one fieldset with a legend per spell level', () => {
    const { container } = render(PanelSpellPrepare, { props: baseProps });
    expect(fieldsets(container).map((f) => f.querySelector('legend')?.textContent?.trim())).toEqual(
      ['Level 1', 'Level 2']
    );
    // Each fieldset holds exactly its own level's spells.
    expect(fieldsets(container)[0].querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(fieldsets(container)[1].querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
  });

  it('orders rows alphabetically by translated name within each level', () => {
    const { container } = render(PanelSpellPrepare, { props: baseProps });
    const levelOne = Array.from(
      fieldsets(container)[0].querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    );
    // anger < favour < slumber — the crossed keys, not the ids (bless, sleep, wrath).
    expect(levelOne.map((b) => b.dataset.spellId)).toEqual(['wrath', 'bless', 'sleep']);
    const levelTwo = Array.from(
      fieldsets(container)[1].querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    );
    expect(levelTwo.map((b) => b.dataset.spellId)).toEqual(['aid', 'calm']);
  });

  it('renders a native checkbox per preparable spell', () => {
    const { container } = render(PanelSpellPrepare, { props: baseProps });
    expect(boxes(container)).toHaveLength(defs.length);
    expect(boxes(container).every((b) => b instanceof HTMLInputElement)).toBe(true);
  });

  it('reports the whole PrepareDef when a spell is checked', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelSpellPrepare, {
      props: { ...baseProps, onSelectionChange }
    });
    await fireEvent.click(boxFor(container, 'sleep'));
    expect(onSelectionChange).toHaveBeenCalledWith({ prepared: [bySpellId('sleep')] });
  });

  it('removes exactly that spell def when a checked spell is unchecked', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelSpellPrepare, {
      props: {
        ...baseProps,
        selections: { prepared: [bySpellId('bless'), bySpellId('sleep')] },
        onSelectionChange
      }
    });
    await fireEvent.click(boxFor(container, 'bless'));
    expect(onSelectionChange).toHaveBeenCalledWith({ prepared: [bySpellId('sleep')] });
  });
});

describe('PanelSpellPrepare counter', () => {
  it('counts selections excluding always-prepared spells', () => {
    const { container } = render(PanelSpellPrepare, {
      props: {
        ...baseProps,
        facts: {
          'spellcasting.prepared.max': 3,
          'spell.l1.wrath.alwaysPrepared': 1
        },
        // wrath rides along in the selection but is free.
        selections: { prepared: [bySpellId('bless'), bySpellId('sleep'), bySpellId('wrath')] }
      }
    });
    expect(counter(container).textContent?.trim()).toBe('2 / 3 prepared');
  });

  it('keeps the counter legal at the cap', () => {
    const { container } = render(PanelSpellPrepare, {
      props: {
        ...baseProps,
        selections: { prepared: [bySpellId('bless'), bySpellId('sleep'), bySpellId('aid')] }
      }
    });
    expect(counter(container).textContent?.trim()).toBe('3 / 3 prepared');
    expect(counter(container).classList.contains('spell-prepare__counter--illegal')).toBe(false);
  });

  it('marks the counter with the illegal treatment when over the cap', () => {
    const { container } = render(PanelSpellPrepare, {
      props: {
        ...baseProps,
        selections: {
          prepared: [bySpellId('bless'), bySpellId('sleep'), bySpellId('aid'), bySpellId('calm')]
        }
      }
    });
    expect(counter(container).textContent?.trim()).toBe('4 / 3 prepared');
    expect(counter(container).classList.contains('spell-prepare__counter--illegal')).toBe(true);
  });

  it('links the group to its counter via aria-describedby', () => {
    const { container } = render(PanelSpellPrepare, { props: baseProps });
    const group = container.querySelector<HTMLElement>('[role="group"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute('aria-label')).toBe('Prepared spells');
    expect(group?.getAttribute('aria-describedby')).toBe(counter(container).id);
  });
});

describe('PanelSpellPrepare always-prepared rows', () => {
  it('renders granted spells checked, disabled and hinted', () => {
    const { container } = render(PanelSpellPrepare, {
      props: {
        ...baseProps,
        facts: {
          'spellcasting.prepared.max': 3,
          'spell.l1.wrath.alwaysPrepared': 1
        }
      }
    });
    const granted = boxFor(container, 'wrath');
    expect(granted.checked).toBe(true);
    expect(granted.disabled).toBe(true);
    expect(granted.closest('label')?.textContent).toContain('Always prepared');
    // A preparable spell stays operable beside it.
    expect(boxFor(container, 'bless').disabled).toBe(false);
  });
});

describe('PanelSpellPrepare accessibility', () => {
  it('keeps every editable checkbox in the native tab order', () => {
    const { container } = render(PanelSpellPrepare, { props: baseProps });
    const all = boxes(container);
    expect(all.every((b) => !b.disabled)).toBe(true);
    // No roving tabindex and nothing taken out of reach: native checkboxes
    // are keyboard operable (Space) exactly as authored.
    expect(all.filter((b) => b.hasAttribute('tabindex'))).toHaveLength(0);
  });

  it('disables every checkbox when not editable', () => {
    const { container } = render(PanelSpellPrepare, {
      props: { ...baseProps, editable: false }
    });
    expect(boxes(container).every((b) => b.disabled)).toBe(true);
  });
});

describe('PanelRenderer spell-prepare wiring', () => {
  const entry: AvailableRuleEntry = {
    rule: {
      id: 'set-prepared-spells',
      activities: [],
      ui: {
        name: 'rule.dnd-5e-2024.prepared-spells.set-prepared-spells.name',
        section: 'configuration',
        primaryControl: { type: 'spell-prepare', var: 'prepared' }
      }
    },
    legal: true,
    applicable: true,
    diagnostics: []
  };

  it('renders the picker for a spell-prepare primaryControl', () => {
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, modules, facts: baseProps.facts }
    });
    expect(fieldsets(container).map((f) => f.querySelector('legend')?.textContent?.trim())).toEqual(
      ['Level 1', 'Level 2']
    );
  });

  it('passes selection changes up through onSelectionChange', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelRenderer, {
      props: {
        entry,
        editable: true,
        modules,
        facts: baseProps.facts,
        onSelectionChange
      }
    });
    await fireEvent.click(boxFor(container, 'sleep'));
    expect(onSelectionChange).toHaveBeenCalledWith({ prepared: [bySpellId('sleep')] });
  });

  it('renders no picker when the character has no preparable spells', () => {
    const itemOnly: RuleModule[] = [
      { id: 'dagger', equip: { hands: 1, nameKey: 'rule.test.dagger.name', state: {} } }
    ];
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, modules: itemOnly, facts: baseProps.facts }
    });
    expect(container.querySelector('fieldset')).toBeNull();
    expect(container.querySelector('.spell-prepare__counter')).toBeNull();
  });
});
