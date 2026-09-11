import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelLoadout from '$lib/components/play/panel-renderer/PanelLoadout.svelte';
import { enumerateLoadouts, type LoadoutConfig } from '$lib/rules-engine/loadout';
import type { LoadoutControl } from '$lib/components/play/panel-renderer/types';
import type { RuleModule } from '$lib/rules-engine/types';

/**
 * Same fixture roster as tests/unit/svelte/PanelLoadout.test.ts: a stackable
 * one-hander, a versatile one-hander and a shield.
 */
const dagger: RuleModule = {
  id: 'dagger',
  equip: {
    hands: 1,
    stackable: true,
    nameKey: 'rule.test.dagger.name',
    state: { 'weapon.dagger.equipped': 1 }
  }
};

const spear: RuleModule = {
  id: 'spear',
  equip: {
    hands: 1,
    versatile: true,
    stackable: true,
    nameKey: 'rule.test.spear.name',
    state: { 'weapon.spear.equipped': 1 },
    twoHandedState: { 'weapon.spear.twoHanded': 1 }
  }
};

const shield: RuleModule = {
  id: 'shield',
  equip: {
    hands: 1,
    nameKey: 'rule.test.shield.name',
    state: { 'armor.shield.equipped': 1, 'ac.shieldBonus': 2 }
  }
};

const modules: RuleModule[] = [spear, shield, dagger];
const configs = enumerateLoadouts(modules);

const control: LoadoutControl = { type: 'loadout', var: 'loadout' };

const baseProps = {
  control,
  editable: true,
  modules,
  selections: {} as Record<string, unknown>
};

const byId = (id: string): LoadoutConfig => {
  const found = configs.find((c) => c.id === id);
  if (!found) throw new Error(`fixture has no configuration "${id}"`);
  return found;
};

const interactiveSelector = 'button, [role="radiogroup"], [role="radio"], [tabindex]';

describe('PanelLoadout summary short form', () => {
  it('renders the rowLabel plain text for the selected configuration', () => {
    const { container } = render(PanelLoadout, {
      props: { ...baseProps, selections: { loadout: byId('dagger+shield') }, summary: true }
    });
    expect(container.textContent).toContain('rule.test.dagger.name');
    expect(container.textContent).toContain('rule.test.shield.name');
    expect(container.textContent).toContain('no hands free');
  });

  it('does not render item/grip/free chips in summary mode', () => {
    const { container } = render(PanelLoadout, {
      props: { ...baseProps, selections: { loadout: byId('spear:2h') }, summary: true }
    });
    expect(container.querySelectorAll('.loadout-picker__chip')).toHaveLength(0);
  });

  it('renders nothing when no configuration is selected', () => {
    const { container } = render(PanelLoadout, {
      props: { ...baseProps, selections: {}, summary: true }
    });
    expect(container.textContent?.trim()).toBe('');
  });

  it('renders no interactive elements in summary mode', () => {
    const { container } = render(PanelLoadout, {
      props: { ...baseProps, selections: { loadout: byId('dagger') }, summary: true }
    });
    expect(container.querySelectorAll(interactiveSelector)).toHaveLength(0);
  });
});
