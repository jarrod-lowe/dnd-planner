import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import StatsColumn from '$lib/components/play/StatsColumn.svelte';
import type { StatEntry } from '$lib/play/extractStats';
import type { Facts } from '$lib/rules-engine';

describe('StatsColumn (config-driven)', () => {
  const valueStat: StatEntry = {
    name: 'play.stats.initiative',
    type: 'value',
    fact: 'initiative.value',
    section: 'stats'
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
    const facts: Facts = { 'initiative.value': 3 };
    const { getByText } = render(StatsColumn, {
      props: { stats: [valueStat], facts }
    });
    expect(getByText('play.stats.initiative')).toBeTruthy();
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
    const facts: Facts = { 'initiative.value': 1, 'actions.max': 1, 'actions.remaining': 1 };
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
      section: 'stats'
    };
    const statB: StatEntry = {
      name: 'play.stats.beta',
      type: 'value',
      fact: 'b',
      section: 'stats'
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
    const facts: Facts = { 'initiative.value': 1 };
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
    const facts: Facts = { 'initiative.value': 1, 'actions.max': 1, 'actions.remaining': 1 };
    const { container } = render(StatsColumn, {
      props: { stats: [valueStat, usedMaxStat], facts }
    });
    // i18n mock returns key, fallback capitalizes section name
    const titles = container.querySelectorAll('.stats-column__section-title');
    const titleTexts = Array.from(titles).map((el) => el.textContent);
    expect(titleTexts).toContain('Stats');
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
    const facts: Facts = { 'initiative.value': 1 };
    const { container } = render(StatsColumn, {
      props: { stats: [valueStat], facts }
    });
    const button = container.querySelector('button[aria-expanded]');
    expect(button).toBeTruthy();
    expect(button?.getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking section header toggles aria-expanded', async () => {
    const facts: Facts = { 'initiative.value': 1 };
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

  it('renders ability score with score/modifier/save format', () => {
    const abilityStat: StatEntry = {
      name: 'play.stats.str',
      type: 'value',
      fact: 'str.value',
      modifierFact: 'str.modifier',
      saveFact: 'str.save',
      section: 'stats'
    };
    const facts: Facts = { 'str.value': 15, 'str.modifier': 2, 'str.save': 2 };
    const { getByText } = render(StatsColumn, {
      props: { stats: [abilityStat], facts }
    });
    expect(getByText('play.stats.str')).toBeTruthy();
    expect(getByText('15/+2/+2')).toBeTruthy();
  });

  it('renders ability score with negative modifier and save', () => {
    const abilityStat: StatEntry = {
      name: 'play.stats.int',
      type: 'value',
      fact: 'int.value',
      modifierFact: 'int.modifier',
      saveFact: 'int.save',
      section: 'stats'
    };
    const facts: Facts = { 'int.value': 8, 'int.modifier': -1, 'int.save': -1 };
    const { getByText } = render(StatsColumn, {
      props: { stats: [abilityStat], facts }
    });
    expect(getByText('8/-1/-1')).toBeTruthy();
  });

  it('renders plain value stat unchanged when modifierFact absent', () => {
    const plainStat: StatEntry = {
      name: 'play.stats.speed',
      type: 'value',
      fact: 'speed.value',
      section: 'stats'
    };
    const facts: Facts = { 'speed.value': 5 };
    const { container } = render(StatsColumn, {
      props: { stats: [plainStat], facts }
    });
    expect(container.querySelector('.stats-column__value')?.textContent).toBe('5');
  });

  it('renders hitDie stat with used/total d-size format', () => {
    const hitDieStat: StatEntry = {
      name: 'play.stats.hitDie',
      type: 'hitDie',
      total: 'hitDie.d10.total',
      remaining: 'hitDie.d10.remaining',
      dieSize: 10,
      section: 'resources'
    };
    const facts: Facts = { 'hitDie.d10.total': 3, 'hitDie.d10.remaining': 1 };
    const { container, getByText } = render(StatsColumn, {
      props: { stats: [hitDieStat], facts }
    });
    expect(getByText('play.stats.hitDie')).toBeTruthy();
    expect(container.querySelector('.stats-column__value')?.textContent).toBe(
      'play.stats.hitDieValue'
    );
  });

  it('hides hitDie stat when total is 0', () => {
    const hitDieStat: StatEntry = {
      name: 'play.stats.hitDie',
      type: 'hitDie',
      total: 'hitDie.d6.total',
      remaining: 'hitDie.d6.remaining',
      dieSize: 6,
      section: 'resources'
    };
    const facts: Facts = { 'hitDie.d6.total': 0, 'hitDie.d6.remaining': 0 };
    const { container } = render(StatsColumn, {
      props: { stats: [hitDieStat], facts }
    });
    expect(container.querySelector('.stats-column__item')).toBeNull();
    expect(container.textContent).toContain('play.stats.todo');
  });

  it('hides hitDie stat when total fact is missing', () => {
    const hitDieStat: StatEntry = {
      name: 'play.stats.hitDie',
      type: 'hitDie',
      total: 'hitDie.d8.total',
      remaining: 'hitDie.d8.remaining',
      dieSize: 8,
      section: 'resources'
    };
    const facts: Facts = {};
    const { container } = render(StatsColumn, {
      props: { stats: [hitDieStat], facts }
    });
    expect(container.textContent).toContain('play.stats.todo');
  });

  it('renders multiple hitDie stats with different die sizes without duplicate key errors', () => {
    const d10Stat: StatEntry = {
      name: 'play.stats.hitDie',
      nameParams: { dieSize: 10 },
      type: 'hitDie',
      total: 'hitDie.d10.total',
      remaining: 'hitDie.d10.remaining',
      dieSize: 10,
      section: 'resources'
    };
    const d12Stat: StatEntry = {
      name: 'play.stats.hitDie',
      nameParams: { dieSize: 12 },
      type: 'hitDie',
      total: 'hitDie.d12.total',
      remaining: 'hitDie.d12.remaining',
      dieSize: 12,
      section: 'resources'
    };
    const facts: Facts = {
      'hitDie.d10.total': 3,
      'hitDie.d10.remaining': 1,
      'hitDie.d12.total': 2,
      'hitDie.d12.remaining': 2
    };
    const { container } = render(StatsColumn, {
      props: { stats: [d10Stat, d12Stat], facts }
    });
    const items = container.querySelectorAll('.stats-column__item');
    expect(items.length).toBe(2);
  });
});
