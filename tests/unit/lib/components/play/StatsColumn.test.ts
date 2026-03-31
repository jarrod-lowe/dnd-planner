import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StatsColumn from '$lib/components/play/StatsColumn.svelte';
import type { StatEntry } from '$lib/play/extractStats';
import type { Facts } from '$lib/rules-engine';

describe('StatsColumn (config-driven)', () => {
  const valueStat: StatEntry = {
    name: 'play.stats.turnCounter',
    type: 'value',
    fact: 'turn.counter',
    section: 'turn'
  };

  const modifierStat: StatEntry = {
    name: 'play.stats.proficiency',
    type: 'modifier',
    fact: 'proficiency.bonus',
    section: 'abilities'
  };

  const usedMaxStat: StatEntry = {
    name: 'play.stats.actions',
    type: 'usedMax',
    total: 'actions.max',
    remaining: 'actions.remaining',
    section: 'resources'
  };

  it('renders value stat with plain fact value', () => {
    const facts: Facts = { 'turn.counter': 3 };
    const { getByText } = render(StatsColumn, {
      props: { stats: [valueStat], facts }
    });
    expect(getByText('play.stats.turnCounter')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('renders modifier stat with positive sign prefix', () => {
    const facts: Facts = { 'proficiency.bonus': 2 };
    const { getByText } = render(StatsColumn, {
      props: { stats: [modifierStat], facts }
    });
    expect(getByText('play.stats.proficiency')).toBeTruthy();
    expect(getByText('+2')).toBeTruthy();
  });

  it('renders negative modifier with minus sign', () => {
    const facts: Facts = { 'proficiency.bonus': -1 };
    const { getByText } = render(StatsColumn, {
      props: { stats: [modifierStat], facts }
    });
    expect(getByText('-1')).toBeTruthy();
  });

  it('renders usedMax stat with usedMax template', () => {
    const facts: Facts = { 'actions.max': 1, 'actions.remaining': 0 };
    const { container, getByText } = render(StatsColumn, {
      props: { stats: [usedMaxStat], facts }
    });
    expect(getByText('play.stats.actions')).toBeTruthy();
    expect(container.textContent).toContain('play.stats.usedMax');
  });

  it('hides usedMax stat when total is 0', () => {
    const zeroStat: StatEntry = {
      name: 'play.stats.hidden',
      type: 'usedMax',
      total: 'x.max',
      remaining: 'x.remaining',
      section: 'resources'
    };
    const facts: Facts = { 'x.max': 0, 'x.remaining': 0 };
    const { container } = render(StatsColumn, {
      props: { stats: [zeroStat], facts }
    });
    expect(container.querySelector('.stats-column__item')).toBeNull();
    expect(container.textContent).toContain('play.stats.todo');
  });

  it('hides usedMax stat when total fact is missing', () => {
    const zeroStat: StatEntry = {
      name: 'play.stats.hidden',
      type: 'usedMax',
      total: 'x.max',
      remaining: 'x.remaining',
      section: 'resources'
    };
    const facts: Facts = {};
    const { container } = render(StatsColumn, {
      props: { stats: [zeroStat], facts }
    });
    expect(container.textContent).toContain('play.stats.todo');
  });

  it('shows TODO when no stats are visible', () => {
    const { container } = render(StatsColumn, {
      props: { stats: [], facts: {} }
    });
    expect(container.querySelector('.stats-column__todo')).toBeTruthy();
    expect(container.querySelector('.stats-column__todo')?.textContent).toBe('play.stats.todo');
  });

  it('groups stats by section', () => {
    const facts: Facts = { 'turn.counter': 1, 'actions.max': 1, 'actions.remaining': 1 };
    const { container } = render(StatsColumn, {
      props: { stats: [valueStat, usedMaxStat], facts }
    });
    const sections = container.querySelectorAll('.stats-column__section');
    expect(sections.length).toBe(2);
  });

  it('sorts stats alphabetically within section', () => {
    const statA: StatEntry = {
      name: 'play.stats.alpha',
      type: 'value',
      fact: 'a',
      section: 'turn'
    };
    const statB: StatEntry = {
      name: 'play.stats.beta',
      type: 'value',
      fact: 'b',
      section: 'turn'
    };
    const facts: Facts = { a: 1, b: 2 };
    const { container } = render(StatsColumn, {
      props: { stats: [statB, statA], facts }
    });
    const items = container.querySelectorAll('.stats-column__item');
    expect(items[0].textContent).toContain('play.stats.alpha');
    expect(items[1].textContent).toContain('play.stats.beta');
  });

  it('has proper accessibility structure', () => {
    const facts: Facts = { 'turn.counter': 1 };
    const { container } = render(StatsColumn, {
      props: { stats: [valueStat], facts }
    });
    const items = container.querySelectorAll('.stats-column__item');
    expect(items.length).toBeGreaterThan(0);
    items.forEach((item) => {
      expect(item.querySelector('.stats-column__label')).toBeTruthy();
      expect(item.querySelector('.stats-column__value')).toBeTruthy();
    });
  });

  it('renders nameParams for i18n interpolation', () => {
    const spellSlotStat: StatEntry = {
      name: 'play.stats.spellLevel',
      nameParams: { level: 1 },
      type: 'usedMax',
      total: 'slots.1.total',
      remaining: 'slots.1.remaining',
      section: 'magic'
    };
    const facts: Facts = { 'slots.1.total': 4, 'slots.1.remaining': 3 };
    const { container } = render(StatsColumn, {
      props: { stats: [spellSlotStat], facts }
    });
    // The i18n mock returns keys, so the rendered label includes the key
    // We verify the stat item renders at all (i.e. it's not hidden)
    expect(container.querySelector('.stats-column__item')).toBeTruthy();
  });

  it('hides value stat when fact is missing', () => {
    const facts: Facts = {};
    const { container } = render(StatsColumn, {
      props: { stats: [valueStat], facts }
    });
    expect(container.querySelector('.stats-column__item')).toBeNull();
    expect(container.textContent).toContain('play.stats.todo');
  });

  it('renders section title for each visible section', () => {
    const facts: Facts = { 'turn.counter': 1, 'actions.max': 1, 'actions.remaining': 1 };
    const { container } = render(StatsColumn, {
      props: { stats: [valueStat, usedMaxStat], facts }
    });
    // i18n mock returns key, fallback capitalizes section name
    const titles = container.querySelectorAll('.stats-column__section-title');
    const titleTexts = Array.from(titles).map((el) => el.textContent);
    expect(titleTexts).toContain('Turn');
    expect(titleTexts).toContain('Resources');
  });

  it('section title fallback capitalizes unknown section name', () => {
    const customStat: StatEntry = {
      name: 'play.stats.custom',
      type: 'value',
      fact: 'custom.val',
      section: 'arcana'
    };
    const facts: Facts = { 'custom.val': 5 };
    const { getByText } = render(StatsColumn, {
      props: { stats: [customStat], facts }
    });
    expect(getByText('Arcana')).toBeTruthy();
  });

  it('section header is a collapsible button with aria-expanded', () => {
    const facts: Facts = { 'turn.counter': 1 };
    const { container } = render(StatsColumn, {
      props: { stats: [valueStat], facts }
    });
    const button = container.querySelector('button[aria-expanded]');
    expect(button).toBeTruthy();
    expect(button?.getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking section header toggles aria-expanded', async () => {
    const facts: Facts = { 'turn.counter': 1 };
    const { container } = render(StatsColumn, {
      props: { stats: [valueStat], facts }
    });
    // Initially expanded
    const button = container.querySelector('button[aria-expanded="true"]');
    expect(button).toBeTruthy();
    // Click to collapse
    await fireEvent.click(button!);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
  });
});
