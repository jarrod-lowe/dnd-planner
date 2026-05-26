import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

function loadRules(filename: string) {
  const yamlPath = path.resolve(process.cwd(), `data/rule-groups/dnd-5e-2024/${filename}`);
  const content = fs.readFileSync(yamlPath, 'utf-8');
  const sharedDefsPath = path.resolve(process.cwd(), 'data/rule-groups/_shared/definitions.yaml');
  const sharedDefs = fs.readFileSync(sharedDefsPath, 'utf-8');
  const data = yaml.load(sharedDefs + '\n' + content) as {
    ruleGroups: {
      rules: {
        id: string;
        activities?: {
          type: string;
          rule?: { ui?: Record<string, unknown> };
        }[];
      }[];
    }[];
  };
  return data.ruleGroups[0].rules;
}

function getIntentOfOfferRule(
  rules: ReturnType<typeof loadRules>,
  offerRuleId: string
): Record<string, string> | undefined {
  const rule = rules.find((r) => r.id === offerRuleId);
  if (!rule) return undefined;
  const activities = rule.activities ?? [];
  const offer = activities.find((a) => a.type === 'offerRule');
  if (!offer?.rule?.ui) return undefined;
  return offer.rule.ui.intents as Record<string, string> | undefined;
}

function loadTranslations(locale: string) {
  const p = path.resolve(process.cwd(), `src/lib/i18n/${locale}/common.json`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

describe('sub-bucket intents', () => {
  describe('grapple and shove use ATTACK:brawl', () => {
    const grappleRules = loadRules('grapple.yaml');
    const shoveRules = loadRules('shove.yaml');

    it('grapple-action has intents { ATTACK: brawl }', () => {
      expect(getIntentOfOfferRule(grappleRules, 'action-grapple-offer')).toEqual({
        ATTACK: 'brawl'
      });
    });

    it('shove-action has intents { ATTACK: brawl }', () => {
      expect(getIntentOfOfferRule(shoveRules, 'action-shove-offer')).toEqual({
        ATTACK: 'brawl'
      });
    });
  });

  describe('movement actions use MOVE:travel', () => {
    const movementRules = loadRules('movement.yaml');

    it('move-walk has intents { MOVE: travel }', () => {
      expect(getIntentOfOfferRule(movementRules, 'action-move-walk-offer')).toEqual({
        MOVE: 'travel'
      });
    });

    it('move-rough-terrain has intents { MOVE: travel }', () => {
      expect(getIntentOfOfferRule(movementRules, 'action-move-rough-terrain-offer')).toEqual({
        MOVE: 'travel'
      });
    });

    it('move-swim has intents { MOVE: travel }', () => {
      expect(getIntentOfOfferRule(movementRules, 'action-move-swim-offer')).toEqual({
        MOVE: 'travel'
      });
    });

    it('move-swim-costly has intents { MOVE: travel }', () => {
      expect(getIntentOfOfferRule(movementRules, 'action-move-swim-costly-offer')).toEqual({
        MOVE: 'travel'
      });
    });

    it('move-fly has intents { MOVE: travel }', () => {
      expect(getIntentOfOfferRule(movementRules, 'action-move-fly-offer')).toEqual({
        MOVE: 'travel'
      });
    });
  });

  describe('dash uses MOVE:dash', () => {
    const dashRules = loadRules('dash.yaml');

    it('dash-action has intents { MOVE: dash }', () => {
      expect(getIntentOfOfferRule(dashRules, 'action-dash-offer')).toEqual({
        MOVE: 'dash'
      });
    });
  });
});

describe('sub-bucket translation keys', () => {
  const en = loadTranslations('en');
  const tlh = loadTranslations('en-x-tlh');

  describe('ATTACK:brawl exists in translations', () => {
    it('en has verbBuckets.ATTACK.brawl = "Brawl"', () => {
      expect(en.play.verbBuckets.ATTACK.brawl).toBe('Brawl');
    });

    it('en-x-tlh has verbBuckets.ATTACK.brawl = "BRAWL"', () => {
      expect(tlh.play.verbBuckets.ATTACK.brawl).toBe('BRAWL');
    });
  });

  describe('MOVE:travel replaces MOVE:walk', () => {
    it('en has verbBuckets.MOVE.travel = "Travel"', () => {
      expect(en.play.verbBuckets.MOVE.travel).toBe('Travel');
    });

    it('en-x-tlh has verbBuckets.MOVE.travel = "TRAVEL"', () => {
      expect(tlh.play.verbBuckets.MOVE.travel).toBe('TRAVEL');
    });

    it('en does NOT have verbBuckets.MOVE.walk', () => {
      expect(en.play.verbBuckets.MOVE.walk).toBeUndefined();
    });

    it('en-x-tlh does NOT have verbBuckets.MOVE.walk', () => {
      expect(tlh.play.verbBuckets.MOVE.walk).toBeUndefined();
    });
  });

  describe('MOVE:dash replaces MOVE:hustle', () => {
    it('en has verbBuckets.MOVE.dash = "Dash"', () => {
      expect(en.play.verbBuckets.MOVE.dash).toBe('Dash');
    });

    it('en-x-tlh has verbBuckets.MOVE.dash = "DASH"', () => {
      expect(tlh.play.verbBuckets.MOVE.dash).toBe('DASH');
    });

    it('en does NOT have verbBuckets.MOVE.hustle', () => {
      expect(en.play.verbBuckets.MOVE.hustle).toBeUndefined();
    });

    it('en-x-tlh does NOT have verbBuckets.MOVE.hustle', () => {
      expect(tlh.play.verbBuckets.MOVE.hustle).toBeUndefined();
    });
  });
});

describe('skill check intents', () => {
  const skillChecks = loadRules('skill-checks.yaml');

  it('acrobatics check uses CHECK:skill', () => {
    expect(getIntentOfOfferRule(skillChecks, 'roll-skill-acrobatics-offer')).toEqual({
      CHECK: 'skill'
    });
  });

  it('athletics check uses CHECK:skill', () => {
    expect(getIntentOfOfferRule(skillChecks, 'roll-skill-athletics-offer')).toEqual({
      CHECK: 'skill'
    });
  });

  it('stealth check uses CHECK:skill', () => {
    expect(getIntentOfOfferRule(skillChecks, 'roll-skill-stealth-offer')).toEqual({
      CHECK: 'skill'
    });
  });
});

describe('per-stat saving throw intents', () => {
  const coreEvents = loadRules('core-events.yaml');

  const stats = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  stats.forEach((stat) => {
    it(`${stat} saving throw uses SAVE:you`, () => {
      expect(getIntentOfOfferRule(coreEvents, `offer-record-save-${stat}`)).toEqual({
        SAVE: 'you'
      });
    });
  });

  it('generic record-save offer no longer exists', () => {
    const rule = coreEvents.find((r) => r.id === 'offer-record-save');
    expect(rule).toBeUndefined();
  });
});

describe('proficiency dot translation keys', () => {
  const en = loadTranslations('en');
  const tlh = loadTranslations('en-x-tlh');

  it('en has play.topBar.proficientDotHalf', () => {
    expect(en.play.topBar.proficientDotHalf).toBe('○');
  });

  it('en has play.topBar.proficientDotFull', () => {
    expect(en.play.topBar.proficientDotFull).toBe('●');
  });

  it('en has play.topBar.proficientDotDouble', () => {
    expect(en.play.topBar.proficientDotDouble).toBe('◉');
  });

  it('en-x-tlh has play.topBar.proficientDotHalf', () => {
    expect(tlh.play.topBar.proficientDotHalf).toBe('○');
  });

  it('en-x-tlh has play.topBar.proficientDotFull', () => {
    expect(tlh.play.topBar.proficientDotFull).toBe('●');
  });

  it('en-x-tlh has play.topBar.proficientDotDouble', () => {
    expect(tlh.play.topBar.proficientDotDouble).toBe('◉');
  });
});
