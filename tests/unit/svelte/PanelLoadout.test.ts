import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PanelLoadout from '$lib/components/play/panel-renderer/PanelLoadout.svelte';
import { enumerateLoadouts, type LoadoutConfig } from '$lib/rules-engine/loadout';
import type { LoadoutControl } from '$lib/components/play/panel-renderer/types';
import type { RuleModule } from '$lib/rules-engine/types';

/**
 * Fixture roster: a stackable one-hander, a versatile one-hander and a shield.
 * Enough to cover every shape the picker has to render — a plain item, a grip
 * choice, a two-item configuration, doubled copies and empty hands — without
 * pulling the real weapon modules (and their registry) into a component test.
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

const rows = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'));

const rowFor = (container: HTMLElement, id: string): HTMLElement => {
  const row = container.querySelector<HTMLElement>(`[role="radio"][data-loadout-id="${id}"]`);
  if (!row) throw new Error(`no rendered row for "${id}"`);
  return row;
};

describe('PanelLoadout rows', () => {
  it('renders one row per legal configuration', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    expect(rows(container)).toHaveLength(configs.length);
    // Guards the fixture itself: empty, three one-handers, and the two-hand
    // combinations including the versatile 2H grip.
    expect(configs.length).toBe(10);
  });

  it('renders one item chip per held item, named by the item own name key', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    const row = rowFor(container, 'dagger+shield');
    const chips = Array.from(row.querySelectorAll('.loadout-picker__chip--item'));
    expect(chips.map((c) => c.textContent?.trim())).toEqual([
      'rule.test.dagger.name',
      'rule.test.shield.name'
    ]);
  });

  it('renders a grip chip only for a versatile item', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    const twoHanded = rowFor(container, 'spear:2h');
    expect(twoHanded.querySelector('.loadout-picker__chip--grip')?.textContent?.trim()).toBe(
      'rule.dnd-5e-2024.loadout.grip.two-handed'
    );
    const oneHanded = rowFor(container, 'spear');
    expect(oneHanded.querySelector('.loadout-picker__chip--grip')?.textContent?.trim()).toBe(
      'rule.dnd-5e-2024.loadout.grip.one-handed'
    );
    expect(rowFor(container, 'dagger').querySelector('.loadout-picker__chip--grip')).toBeNull();
  });

  it('renders one free-hand chip per free hand', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    expect(rowFor(container, 'empty').querySelectorAll('.loadout-picker__chip--free')).toHaveLength(
      2
    );
    expect(
      rowFor(container, 'dagger').querySelectorAll('.loadout-picker__chip--free')
    ).toHaveLength(1);
    expect(
      rowFor(container, 'dagger+shield').querySelectorAll('.loadout-picker__chip--free')
    ).toHaveLength(0);
  });

  it('names the empty configuration with its own key rather than an item chip', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    const row = rowFor(container, 'empty');
    expect(row.querySelectorAll('.loadout-picker__chip--item')).toHaveLength(0);
    expect(row.querySelector('.loadout-picker__chip--empty')?.textContent?.trim()).toBe(
      'rule.dnd-5e-2024.loadout.empty.name'
    );
  });

  it('pins the current loadout first', () => {
    const { container } = render(PanelLoadout, {
      props: { ...baseProps, selections: { loadout: byId('spear:2h') } }
    });
    expect(rows(container)[0].dataset.loadoutId).toBe('spear:2h');
    // Everything else keeps the enumerator ordering, minus the pinned entry.
    expect(rows(container).map((r) => r.dataset.loadoutId)).toEqual([
      'spear:2h',
      ...configs.filter((c) => c.id !== 'spear:2h').map((c) => c.id)
    ]);
  });

  it('keeps the enumerator ordering when nothing is selected yet', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    expect(rows(container).map((r) => r.dataset.loadoutId)).toEqual(configs.map((c) => c.id));
  });

  it('reports the whole configuration verbatim when a row is chosen', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelLoadout, { props: { ...baseProps, onSelectionChange } });
    await fireEvent.click(rowFor(container, 'dagger+dagger'));
    expect(onSelectionChange).toHaveBeenCalledWith({ loadout: byId('dagger+dagger') });
  });

  it('renders non-interactive rows when not editable', () => {
    const { container } = render(PanelLoadout, {
      props: { ...baseProps, editable: false, selections: { loadout: byId('dagger') } }
    });
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(rows(container)).toHaveLength(configs.length);
    expect(rowFor(container, 'dagger').getAttribute('aria-checked')).toBe('true');
  });
});

describe('PanelLoadout accessibility', () => {
  it('groups the rows in a labelled radiogroup', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    const group = container.querySelector('[role="radiogroup"]');
    expect(group).not.toBeNull();
    expect(group?.getAttribute('aria-label')).toBe('play.loadout.groupLabel');
  });

  it('marks exactly the selected row aria-checked', () => {
    const { container } = render(PanelLoadout, {
      props: { ...baseProps, selections: { loadout: byId('dagger') } }
    });
    const checked = rows(container).filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked.map((r) => r.dataset.loadoutId)).toEqual(['dagger']);
  });

  it('gives every row a text accessible name, not just chips', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    // The chips are decorative; a screen reader must still hear the items,
    // the grip and how many hands are left.
    const label = rowFor(container, 'spear:2h').getAttribute('aria-label') ?? '';
    expect(label).toContain('rule.test.spear.name');
    expect(label).toContain('rule.dnd-5e-2024.loadout.grip.two-handed');
    const empty = rowFor(container, 'empty').getAttribute('aria-label') ?? '';
    expect(empty).toContain('rule.dnd-5e-2024.loadout.empty.name');
  });

  it('announces the hands left over in the accessible name', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    expect(rowFor(container, 'dagger').getAttribute('aria-label')).toContain('1 hand free');
    expect(rowFor(container, 'empty').getAttribute('aria-label')).toContain('2 hands free');
    expect(rowFor(container, 'dagger+shield').getAttribute('aria-label')).toContain(
      'no hands free'
    );
  });

  it('hides the decorative chips from assistive technology', () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    const chips = rowFor(container, 'dagger').querySelector('.loadout-picker__chips');
    expect(chips?.getAttribute('aria-hidden')).toBe('true');
  });

  it('exposes a single tab stop (roving tabindex) on the selected row', () => {
    const { container } = render(PanelLoadout, {
      props: { ...baseProps, selections: { loadout: byId('spear') } }
    });
    const tabbable = rows(container).filter((r) => r.getAttribute('tabindex') === '0');
    expect(tabbable.map((r) => r.dataset.loadoutId)).toEqual(['spear']);
    expect(rows(container).filter((r) => r.getAttribute('tabindex') === '-1')).toHaveLength(
      configs.length - 1
    );
  });

  it('moves selection and focus to the next row on ArrowDown', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelLoadout, { props: { ...baseProps, onSelectionChange } });
    const all = rows(container);
    all[0].focus();
    await fireEvent.keyDown(all[0], { key: 'ArrowDown' });
    expect(onSelectionChange).toHaveBeenCalledWith({ loadout: byId(all[1].dataset.loadoutId!) });
    expect(document.activeElement).toBe(all[1]);
  });

  it('wraps backwards from the first row on ArrowUp', async () => {
    const onSelectionChange = vi.fn();
    const { container } = render(PanelLoadout, { props: { ...baseProps, onSelectionChange } });
    const all = rows(container);
    all[0].focus();
    await fireEvent.keyDown(all[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(all[all.length - 1]);
    expect(onSelectionChange).toHaveBeenCalledWith({
      loadout: byId(all[all.length - 1].dataset.loadoutId!)
    });
  });

  it('jumps to the first and last rows on Home and End', async () => {
    const { container } = render(PanelLoadout, { props: baseProps });
    const all = rows(container);
    all[2].focus();
    await fireEvent.keyDown(all[2], { key: 'End' });
    expect(document.activeElement).toBe(all[all.length - 1]);
    await fireEvent.keyDown(all[all.length - 1], { key: 'Home' });
    expect(document.activeElement).toBe(all[0]);
  });

  it('does not reorder the list while arrowing through it', async () => {
    // Re-pinning on every keystroke would move rows out from under the finger.
    const { container } = render(PanelLoadout, { props: baseProps });
    const before = rows(container).map((r) => r.dataset.loadoutId);
    const all = rows(container);
    all[0].focus();
    await fireEvent.keyDown(all[0], { key: 'ArrowDown' });
    expect(rows(container).map((r) => r.dataset.loadoutId)).toEqual(before);
  });

  it('leaves rows out of the tab order and unkeyed when not editable', () => {
    const { container } = render(PanelLoadout, { props: { ...baseProps, editable: false } });
    expect(rows(container).some((r) => r.hasAttribute('tabindex'))).toBe(false);
  });
});
