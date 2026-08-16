import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import IntentTopBar from '$lib/components/play/IntentTopBar.svelte';
import type { Character } from '$lib/character/types';
import type { TopBarEntry, UiEntry } from '$lib/play/extractTopBar';
import type { Facts } from '$lib/rules-view';

// i18n mock - returns key as text
const translations: Record<string, string> = {
  'auth.userMenu': 'User menu',
  'play.backToSelection': 'Back',
  'species.human': 'Human',
  'play.topBar.hp': 'HP',
  'play.topBar.ac': 'AC',
  'play.topBar.speed': 'Speed',
  'play.topBar.conc': 'Conc',
  'play.topBar.concActive': 'Active',
  'play.topBar.concNone': 'None',
  'play.topBar.abilities': 'Abilities',
  'play.topBar.viewPlayer': 'Player',
  'play.stats.str': 'STR',
  'play.stats.dex': 'DEX',
  'play.stats.con': 'CON',
  'play.stats.int': 'INT',
  'play.stats.wis': 'WIS',
  'play.stats.cha': 'CHA'
};

vi.mock('$lib/i18n', () => ({
  t: readable((key: string, params?: Record<string, unknown>) => {
    if (key === 'play.topBar.hpValue' && params) return `${params.current}/${params.max}`;
    return translations[key] ?? key;
  }),
  locale: {
    ...readable('en'),
    set: vi.fn()
  },
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en', 'en-x-tlh']
}));

vi.mock('$lib/components/UserDropdown.svelte', () => ({
  default: vi.fn()
}));

const mockCharacter: Character = {
  characterId: 'char-123',
  userId: 'user-1',
  name: 'Aragorn',
  species: 'human',
  class: 'paladin',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

// Mock Element.prototype.animate for JSDOM
if (!Element.prototype.animate) {
  Element.prototype.animate = vi.fn().mockReturnValue({
    finished: Promise.resolve(),
    cancel: vi.fn()
  });
}

describe('IntentTopBar', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  function renderComponent(
    topBarEntries: TopBarEntry[] = [],
    facts: Facts = {},
    extraProps: Record<string, unknown> = {}
  ) {
    mount(IntentTopBar, {
      target: container,
      props: {
        character: mockCharacter,
        topBarEntries,
        facts,
        email: 'test@example.com',
        onLogout: vi.fn(),
        ...extraProps
      }
    });
  }

  it('renders no chips when topBarEntries is empty', () => {
    renderComponent([]);
    const chips = container.querySelectorAll('.intent-top-bar__chip');
    expect(chips.length).toBe(0);
  });

  it('renders HP chip from hp entry with facts', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.topBar.hp',
          total: 'hp.max',
          remaining: 'hp.current'
        } satisfies UiEntry
      ],
      { 'hp.current': 28, 'hp.max': 35 }
    );
    const hpChip = container.querySelector('.intent-top-bar__chip--hp');
    expect(hpChip).toBeTruthy();
    expect(hpChip?.textContent).toContain('28/35');
    const hpBar = container.querySelector('.intent-top-bar__hp-bar');
    expect(hpBar).toBeTruthy();
  });

  it('does not render HP chip when fact values are missing', () => {
    renderComponent(
      [
        {
          type: 'usedMax',
          label: 'play.topBar.hp',
          total: 'hp.max',
          remaining: 'hp.current'
        } satisfies UiEntry
      ],
      {}
    );
    const hpChip = container.querySelector('.intent-top-bar__chip--hp');
    expect(hpChip).toBeFalsy();
  });

  it('renders value chip from value entry with facts', () => {
    renderComponent(
      [
        {
          type: 'value',
          label: 'play.topBar.ac',
          fact: 'ac.value'
        } satisfies UiEntry
      ],
      { 'ac.value': 16 }
    );
    const chips = container.querySelectorAll('.intent-top-bar__chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('16');
    expect(chips[0].textContent).toContain('AC');
  });

  it('renders multiple value chips', () => {
    renderComponent(
      [
        {
          type: 'value',
          label: 'play.topBar.ac',
          fact: 'ac.value'
        },
        {
          type: 'value',
          label: 'play.topBar.speed',
          fact: 'character.movement.remaining'
        }
      ] satisfies TopBarEntry[],
      { 'ac.value': 16, 'character.movement.remaining': 30 }
    );
    const chips = container.querySelectorAll('.intent-top-bar__chip');
    expect(chips.length).toBe(2);
  });

  it('stacks value chips two-line via --stack modifier', () => {
    renderComponent(
      [{ type: 'value', label: 'play.topBar.ac', fact: 'ac.value' } satisfies UiEntry],
      { 'ac.value': 16 }
    );
    const chip = container.querySelector('.intent-top-bar__chip');
    expect(chip?.classList.contains('intent-top-bar__chip--stack')).toBe(true);
  });

  it('stacks hp and conc chips; abilities chip stays unstacked', () => {
    renderComponent(
      [
        { type: 'usedMax', label: 'play.topBar.hp', total: 'hp.max', remaining: 'hp.current' },
        {
          type: 'concentration',
          label: 'play.topBar.conc',
          activeLabel: 'play.topBar.concActive',
          noneLabel: 'play.topBar.concNone'
        },
        {
          type: 'ability',
          label: 'play.topBar.abilities',
          abilities: [{ name: 'play.stats.str', fact: 'str.modifier' }]
        }
      ] satisfies TopBarEntry[],
      { 'hp.current': 28, 'hp.max': 35, 'str.modifier': 3 }
    );
    expect(
      container
        .querySelector('.intent-top-bar__chip--hp')
        ?.classList.contains('intent-top-bar__chip--stack')
    ).toBe(true);
    expect(
      container
        .querySelector('.intent-top-bar__chip--conc')
        ?.classList.contains('intent-top-bar__chip--stack')
    ).toBe(true);
    expect(
      container
        .querySelector('.intent-top-bar__chip--abilities')
        ?.classList.contains('intent-top-bar__chip--stack')
    ).toBe(false);
  });

  it('renders concentration chip from concentration entry', () => {
    renderComponent(
      [
        {
          type: 'concentration',
          label: 'play.topBar.conc',
          activeLabel: 'play.topBar.concActive',
          noneLabel: 'play.topBar.concNone'
        } satisfies UiEntry
      ],
      {},
      { concentrationEffectName: undefined }
    );
    const concChip = container.querySelector('.intent-top-bar__chip--conc');
    expect(concChip).toBeTruthy();
    expect(concChip?.textContent).toContain('None');
  });

  it('renders concentration chip as active with concentrationEffectName', () => {
    renderComponent(
      [
        {
          type: 'concentration',
          label: 'play.topBar.conc',
          activeLabel: 'play.topBar.concActive',
          noneLabel: 'play.topBar.concNone'
        } satisfies UiEntry
      ],
      {},
      { concentrationEffectName: 'Bless' }
    );
    const concChip = container.querySelector('.intent-top-bar__chip--conc-active');
    expect(concChip).toBeTruthy();
    expect(concChip?.textContent).toContain('Bless');
  });

  it('renders abilities chip as a non-interactive div with two-line columns', () => {
    renderComponent(
      [
        {
          type: 'ability',
          label: 'play.topBar.abilities',
          abilities: [
            { name: 'play.stats.str', fact: 'str.modifier', saveFact: 'str.save' },
            { name: 'play.stats.dex', fact: 'dex.modifier', saveFact: 'dex.save' }
          ]
        } satisfies UiEntry
      ],
      { 'str.modifier': 3, 'dex.modifier': 1, 'str.save': 5, 'dex.save': 3 }
    );
    const abilityChip = container.querySelector('.intent-top-bar__chip--abilities');
    expect(abilityChip).toBeTruthy();
    // Must be a div, not an interactive button
    expect(abilityChip?.tagName).toBe('DIV');
    // Each ability should appear in its own column
    const cols = abilityChip?.querySelectorAll('.intent-top-bar__ability-col');
    expect(cols?.length).toBe(2);
    // Name on top, stat below
    expect(cols?.[0].querySelector('.intent-top-bar__ability-name')?.textContent).toBe('STR');
    expect(cols?.[0].querySelector('.intent-top-bar__ability-stat')?.textContent?.trim()).toBe(
      '+3/+5'
    );
    expect(cols?.[1].querySelector('.intent-top-bar__ability-name')?.textContent).toBe('DEX');
    expect(cols?.[1].querySelector('.intent-top-bar__ability-stat')?.textContent?.trim()).toBe(
      '+1/+3'
    );
    // No expand/collapse section
    expect(container.querySelector('.intent-top-bar__abilities-detail')).toBeNull();
  });

  it('renders chips in canonical order (hp, value, concentration, ability)', () => {
    renderComponent(
      [
        {
          type: 'ability',
          label: 'play.topBar.abilities',
          abilities: [{ name: 'play.stats.str', fact: 'str.modifier' }]
        },
        {
          type: 'usedMax',
          label: 'play.topBar.hp',
          total: 'hp.max',
          remaining: 'hp.current'
        },
        {
          type: 'concentration',
          label: 'play.topBar.conc',
          activeLabel: 'play.topBar.concActive',
          noneLabel: 'play.topBar.concNone'
        },
        {
          type: 'value',
          label: 'play.topBar.ac',
          fact: 'ac.value'
        }
      ] satisfies TopBarEntry[],
      {
        'hp.current': 28,
        'hp.max': 35,
        'ac.value': 16,
        'str.modifier': 3
      }
    );
    const chips = container.querySelectorAll(
      '.intent-top-bar__chip--hp, .intent-top-bar__chip:not(.intent-top-bar__chip--hp):not(.intent-top-bar__chip--conc):not(.intent-top-bar__chip--abilities), .intent-top-bar__chip--conc, .intent-top-bar__chip--abilities'
    );
    // First chip should be HP
    expect(chips[0].classList.contains('intent-top-bar__chip--hp')).toBe(true);
  });
});

describe('IntentTopBar — subject filtering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  const playerHpEntry: UiEntry = {
    type: 'usedMax',
    label: 'play.topBar.hp',
    total: 'hp.max',
    remaining: 'hp.current'
  };

  const steedHpEntry: UiEntry = {
    type: 'usedMax',
    label: 'play.stats.steed.hp',
    total: 'companion.steed.hp.max',
    remaining: 'companion.steed.hp.current',
    subject: 'steed'
  };

  const steedAcEntry: UiEntry = {
    type: 'value',
    label: 'play.stats.steed.ac',
    fact: 'companion.steed.ac.value',
    subject: 'steed'
  };

  const allEntries: TopBarEntry[] = [playerHpEntry, steedHpEntry, steedAcEntry];

  const allFacts = {
    'hp.current': 28,
    'hp.max': 35,
    'companion.steed.hp.current': 10,
    'companion.steed.hp.max': 15,
    'companion.steed.ac.value': 12
  };

  it('shows player entries when activeSubject is undefined', () => {
    mount(IntentTopBar, {
      target: container,
      props: {
        character: mockCharacter,
        topBarEntries: allEntries,
        facts: allFacts,
        email: 'test@example.com',
        onLogout: vi.fn(),
        activeSubject: undefined
      }
    });
    const hpChip = container.querySelector('.intent-top-bar__chip--hp');
    expect(hpChip).toBeTruthy();
    expect(hpChip?.textContent).toContain('28/35');
    // Steed entries should NOT appear
    const allChips = container.querySelectorAll('.intent-top-bar__chip');
    expect(allChips.length).toBe(1);
  });

  it('shows steed entries when activeSubject is steed', () => {
    mount(IntentTopBar, {
      target: container,
      props: {
        character: mockCharacter,
        topBarEntries: allEntries,
        facts: allFacts,
        email: 'test@example.com',
        onLogout: vi.fn(),
        activeSubject: 'steed'
      }
    });
    const hpChip = container.querySelector('.intent-top-bar__chip--hp');
    expect(hpChip).toBeTruthy();
    expect(hpChip?.textContent).toContain('10/15');
    // Also steed AC chip
    const allChips = container.querySelectorAll('.intent-top-bar__chip');
    expect(allChips.length).toBe(2);
    // Player HP should NOT appear
    expect(container.textContent).not.toContain('28/35');
  });

  it('shows no chips when activeSubject does not match any entries', () => {
    mount(IntentTopBar, {
      target: container,
      props: {
        character: mockCharacter,
        topBarEntries: allEntries,
        facts: allFacts,
        email: 'test@example.com',
        onLogout: vi.fn(),
        activeSubject: 'familiar'
      }
    });
    const chips = container.querySelectorAll('.intent-top-bar__chip');
    expect(chips.length).toBe(0);
  });
});
