import { vi } from 'vitest';

// Mock Web Animations API for Svelte transitions in jsdom
if (!Element.prototype.animate) {
  Element.prototype.animate = vi.fn().mockReturnValue({
    finished: Promise.resolve(),
    cancel: vi.fn(),
    pause: vi.fn(),
    play: vi.fn(),
    reverse: vi.fn(),
    finish: vi.fn()
  });
}

// Mock sveltekit-i18n to prevent actual loader calls during tests
vi.mock('sveltekit-i18n', () => {
  // Minimal set of translation templates used by unit tests
  const translations: Record<string, string> = {
    'play.information.saveDc': '{{saveType}} Save DC {{dc}}',
    'play.information.aidBonus': '+{{hp}} HP',
    'play.quickSearch.matchCount': '{{count}} matches',
    'play.quickSearch.more': '+{{count}} more · keep typing',
    'play.hitDice.poolLabel': 'd{{sides}} hit dice, {{remaining}} of {{total}} unspent',
    'play.hitDice.slotLabel': 'd{{sides}} hit die {{slot}} of {{total}}',
    'play.hitDice.slotSpentLabel': 'd{{sides}} hit die {{slot}} of {{total}} (spent)',
    'play.hitDice.slotRolledLabel':
      'd{{sides}} hit die {{slot}} of {{total}}, rolled {{roll}}, heals {{heal}} hp',
    'play.hitDice.slotSpentRolledLabel':
      'd{{sides}} hit die {{slot}} of {{total}} (spent), rolled {{roll}}, heals {{heal}} hp, tap to clear',
    'play.hitDice.bonusLabel': 'Each die: CON {{bonus}}',
    'play.loadout.handsFree.none': 'no hands free',
    'play.loadout.handsFree.one': '1 hand free',
    'play.loadout.handsFree.many': '{{count}} hands free',
    'play.spellPrepare.groupLabel': 'Prepared spells',
    'play.spellPrepare.level': 'Level {{level}}',
    'play.spellPrepare.counter': '{{count}} / {{max}} prepared',
    'play.spellPrepare.alwaysPrepared': 'Always prepared',
    // Deliberately spelled differently from the raw rule-authored tokens
    // ('hp', 'ft') they translate: a component that skips
    // `formatUnitValue`/`unitLabel` and concatenates `control.unit` raw
    // would render the untranslated token and fail these assertions, rather
    // than passing by coincidence. Patterns carry the value interpolation
    // themselves (see `unitLabel.ts`), matching the real locale files; the
    // `compact.ft` override stays closed up (no space) to match the real
    // English pattern used by a dice-line's distance ("5FEET"), while the
    // default `ft` pattern is spaced ("20 FEET") like every other site.
    'play.units.hp': '{{value}} HIT_POINTS',
    'play.units.ft': '{{value}} FEET',
    'play.units.compact.ft': '{{value}}FEET',
    'play.annotation.addToPlan': 'Add to plan: {{annotation}}',
    // Short notch-row labels under slider tracks. Deliberately unlike the real
    // English 'Free' / 'L{{level}}' (same convention as the units above) so a
    // component that skips $t and hardcodes English fails the assertions.
    'play.slider.freeShort': 'FREE',
    'play.slider.levelShort': 'LVL{{level}}',
    // A label-with-values template (the concentration save DC reminder is the
    // production user): panel annotations interpolate $t(key, values) exactly
    // as the notices strip interpolates bodies.
    'play.annotations.concentration-save':
      'Concentration save — DC {{dc}} Constitution save to keep the spell.'
  };

  return {
    default: class MockI18n {
      t = {
        subscribe: vi.fn(
          (fn: (value: (key: string, params?: Record<string, string>) => string) => void) => {
            fn((key: string, params?: Record<string, string>) => {
              const template = translations[key] ?? key;
              if (!params) return template;
              return Object.entries(params).reduce(
                (text, [k, v]) => text.replaceAll(`{{${k}}}`, v),
                template
              );
            });
            return { unsubscribe: vi.fn() };
          }
        )
      };
      locale = {
        subscribe: vi.fn((fn: (value: string) => void) => {
          fn('en');
          return { unsubscribe: vi.fn() };
        }),
        set: vi.fn()
      };
      loading = {
        subscribe: vi.fn((fn: (value: boolean) => void) => {
          fn(false);
          return { unsubscribe: vi.fn() };
        })
      };
      initialized = {
        subscribe: vi.fn((fn: (value: boolean) => void) => {
          fn(true);
          return { unsubscribe: vi.fn() };
        })
      };
    }
  };
});
