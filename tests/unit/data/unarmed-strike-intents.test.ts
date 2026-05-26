import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Tests that unarmed strike is no longer in the weapons expansion
 * and has brawl intents in its standalone rule group.
 */
describe('unarmed strike brawl intents', () => {
  const attacksPath = path.resolve(process.cwd(), 'data/rule-groups/dnd-5e-2024/attacks.yaml');
  let rules: { id: string; activities?: unknown[] }[];

  beforeAll(() => {
    const content = fs.readFileSync(attacksPath, 'utf-8');
    const sharedDefsPath = path.resolve(process.cwd(), 'data/rule-groups/_shared/definitions.yaml');
    const sharedDefs = fs.readFileSync(sharedDefsPath, 'utf-8');
    const data = yaml.load(sharedDefs + '\n' + content) as {
      ruleGroups: {
        rules: { id: string; activities?: unknown[] }[];
      }[];
    };
    rules = data.ruleGroups[0].rules;
  });

  function getIntentOfOfferRule(offerRuleId: string): Record<string, string> | undefined {
    const rule = rules.find((r) => r.id === offerRuleId);
    if (!rule) return undefined;
    const activities = rule.activities as {
      type: string;
      rule?: { ui?: Record<string, unknown> };
    }[];
    const offer = activities.find((a) => a.type === 'offerRule');
    if (!offer?.rule?.ui) return undefined;
    return offer.rule.ui.intents as Record<string, string> | undefined;
  }

  it('unarmed strike action offer has ATTACK:brawl intent', () => {
    expect(getIntentOfOfferRule('unarmed-strike-use-action-offer')).toEqual({
      ATTACK: 'brawl'
    });
  });

  it('unarmed strike reaction offer has DEFEND:brawl intent', () => {
    expect(getIntentOfOfferRule('unarmed-strike-use-reaction-offer')).toEqual({
      DEFEND: 'brawl'
    });
  });
});

describe('unarmed strike removed from weapons expansion', () => {
  const weaponsPath = path.resolve(process.cwd(), 'data/rule-sources/weapons.yaml');

  it('unarmed-strike is not in weapons definitions', () => {
    const content = fs.readFileSync(weaponsPath, 'utf-8');
    const data = yaml.load(content) as {
      definitions: { id: string }[];
    };
    const ids = data.definitions.map((d) => d.id);
    expect(ids).not.toContain('unarmed-strike');
  });
});
