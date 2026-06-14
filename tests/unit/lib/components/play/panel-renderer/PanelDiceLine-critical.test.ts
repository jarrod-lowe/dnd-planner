import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import PanelRenderer from '$lib/components/play/PanelRenderer.svelte';
import type { AvailableRuleEntry, Rule } from '$lib/rules-engine';

// d20 to-hit + d12+3 slashing damage. Damage chip is index 1.
const createAttackEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'greataxe',
    description: 'Greataxe',
    activities: [],
    ui: {
      section: 'action-attack',
      name: 'rule.attacks.greataxe.name',
      primaryControl: {
        type: 'dice-line',
        ranges: { var: 'ranges' },
        dice: [
          { sides: 20, bonus: { var: 'hitBonus' }, purpose: 'to-hit' },
          {
            sides: { var: 'damageDie' },
            bonus: { var: 'damageBonus' },
            damageType: { string: 'slashing' },
            purpose: 'damage'
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

// 2d8 healing — a non-d20, non-damage die that must NOT get the crit selector.
const createHealingEntry = (): AvailableRuleEntry => ({
  rule: {
    id: 'prayer-of-healing',
    description: 'Prayer of Healing',
    activities: [],
    ui: {
      section: 'action-spell',
      name: 'Prayer of Healing',
      primaryControl: {
        type: 'dice-line',
        dice: [{ sides: 8, count: 2, unit: 'hp', purpose: 'healing' }]
      }
    }
  } as Rule,
  legal: true,
  applicable: true,
  diagnostics: []
});

// Simulate a 300ms long-press on a chip, which opens the roll-mode popover.
async function longPress(chip: Element): Promise<void> {
  await fireEvent.pointerDown(chip);
  vi.advanceTimersByTime(300);
  await tick();
}

describe('PanelDiceLine - critical damage selector', () => {
  it('shows Normal and the 💥 critical symbol (not advantage/disadvantage) on a damage chip', async () => {
    vi.useFakeTimers();
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await longPress(chips[1]); // damage chip

    const items = Array.from(container.querySelectorAll('.panel-renderer__popover-item'));
    const text = items.map((b) => b.textContent ?? '').join(' ');
    expect(items.length).toBe(2);
    expect(text).not.toContain('Advantage');
    expect(text).not.toContain('Disadvantage');
    // The Critical item shows the crit symbol AND the word (both via i18n) — the
    // dropdown is the one place the word appears (chip/toast use the symbol alone).
    const critItem = items.find((b) =>
      b.getAttribute('aria-label')?.includes('play.choices.attack.critical')
    );
    expect(critItem).toBeTruthy();
    expect(critItem!.textContent).toContain('play.choices.attack.criticalSymbol');
    expect(critItem!.textContent).toContain('play.choices.attack.critical');
  });

  it('still shows advantage/normal/disadvantage on a d20 chip', async () => {
    vi.useFakeTimers();
    const entry = createAttackEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await longPress(chips[0]); // d20 to-hit chip

    const items = container.querySelectorAll('.panel-renderer__popover-item');
    expect(items.length).toBe(3);
  });

  it('does not show Critical on a healing chip', async () => {
    vi.useFakeTimers();
    const entry = createHealingEntry();
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chip = container.querySelector('.panel-renderer__die-chip')!;
    await longPress(chip);

    const text = container.textContent ?? '';
    expect(text).not.toContain('play.choices.attack.critical');
  });

  it('doubles the dice count on Critical without changing the bonus', async () => {
    vi.useFakeTimers();
    const entry = createAttackEntry();
    const onRoll = vi.fn();
    // floor(0.5 * 12) + 1 = 7 per die; crit rolls 2 dice => 14 + 3 = 17
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await longPress(chips[1]);

    const critItem = Array.from(container.querySelectorAll('.panel-renderer__popover-item')).find(
      (b) => b.getAttribute('aria-label')?.includes('play.choices.attack.critical')
    )!;
    await fireEvent.click(critItem);

    expect(onRoll).toHaveBeenCalledTimes(1);
    const [result] = onRoll.mock.calls[0];
    expect(result.critical).toBe(true);
    expect(result.count).toBe(2);
    expect(result.rolls).toEqual([7, 7]);
    expect(result.bonus).toBe(3); // modifier not doubled
    expect(result.total).toBe(17);
  });

  it('rolls the base count on Normal selection', async () => {
    vi.useFakeTimers();
    const entry = createAttackEntry();
    const onRoll = vi.fn();
    // floor(0.5 * 12) + 1 = 7 => 7 + 3 = 10 (single die)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await longPress(chips[1]);

    const normalItem = Array.from(container.querySelectorAll('.panel-renderer__popover-item')).find(
      (b) => (b.textContent ?? '').includes('play.choices.attack.normal')
    )!;
    await fireEvent.click(normalItem);

    const [result] = onRoll.mock.calls[0];
    expect(result.critical).toBeUndefined();
    expect(result.total).toBe(10);
  });

  it('resets to normal after a critical roll', async () => {
    vi.useFakeTimers();
    const entry = createAttackEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    // Roll a crit.
    await longPress(chips[1]);
    const critItem = Array.from(container.querySelectorAll('.panel-renderer__popover-item')).find(
      (b) => b.getAttribute('aria-label')?.includes('play.choices.attack.critical')
    )!;
    await fireEvent.click(critItem);
    expect(onRoll.mock.calls.at(-1)![0].critical).toBe(true);

    // A subsequent normal tap rolls base dice. The long-press guard swallows the
    // first chip click (it follows the long-press), so the second click rolls.
    await fireEvent.click(chips[1]);
    await fireEvent.click(chips[1]);

    const [lastResult] = onRoll.mock.calls.at(-1)!;
    expect(lastResult.critical).toBeUndefined();
    expect(lastResult.total).toBe(10); // base: 7 + 3, not doubled
  });

  it('shows the CRIT badge and crit-damage class on the rolled damage chip', async () => {
    vi.useFakeTimers();
    const entry = createAttackEntry();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {} }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await longPress(chips[1]);
    const critItem = Array.from(container.querySelectorAll('.panel-renderer__popover-item')).find(
      (b) => b.getAttribute('aria-label')?.includes('play.choices.attack.critical')
    )!;
    await fireEvent.click(critItem);

    const damageChip = chips[1];
    expect(damageChip.classList.contains('panel-renderer__die-chip--crit-damage')).toBe(true);
    const badge = damageChip.querySelector('.panel-renderer__crit-badge');
    expect(badge).toBeTruthy();
    // The accessible name should also announce the critical status.
    expect(damageChip.getAttribute('aria-label')).toContain('play.choices.attack.critical');
  });

  it('does not mark a normal damage roll as critical', async () => {
    const entry = createAttackEntry();
    const onRoll = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { container } = render(PanelRenderer, {
      props: { entry, editable: true, facts: {}, onRoll }
    });
    const chips = container.querySelectorAll('.panel-renderer__die-chip');
    await fireEvent.click(chips[1]); // plain tap = normal

    const [result] = onRoll.mock.calls[0];
    expect(result.critical).toBeUndefined();
    expect(chips[1].classList.contains('panel-renderer__die-chip--crit-damage')).toBe(false);
    expect(container.querySelector('.panel-renderer__crit-badge')).toBeNull();
  });
});
