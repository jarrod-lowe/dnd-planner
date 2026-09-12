import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import heroicInspiration from '$lib/rules-engine/rules/heroic-inspiration';

/**
 * Both Heroic Inspiration offers open the same rules-mode reference text: the
 * SRD 5.2 Rules Glossary entry, published from the rule group's `detail` block.
 * Without the `detailKey` the panels render with no rules flip at all.
 */

const DETAIL_KEY = 'rule/heroic-inspiration';

const offers = heroicInspiration.offer!({ selections: {} });
const byId = new Map(offers.map((o) => [o.id, o]));

describe('heroic inspiration offers — detail key', () => {
  for (const id of ['grant-hi', 'use-hi'] as const) {
    it(`${id} points at the Heroic Inspiration detail`, () => {
      const offer = byId.get(id);
      if (!offer?.ui) throw new Error(`offer ${id} with a ui payload expected`);
      expect(offer.ui.detailKey).toBe(DETAIL_KEY);
    });
  }

  it('the rule group publishes a detail under that key', () => {
    const file = path.resolve(
      process.cwd(),
      'data/rule-groups/dnd-5e-2024/heroic-inspiration.yaml'
    );
    const data = yaml.load(fs.readFileSync(file, 'utf-8')) as {
      ruleGroups: {
        id: string;
        detail?: { key: string; source: string; translations: Record<string, { body: string }> };
      }[];
    };
    const group = data.ruleGroups.find((g) => g.id === 'heroic-inspiration');
    expect(group?.detail?.key).toBe(DETAIL_KEY);
    expect(group?.detail?.source).toBe('srd52');
    expect(group?.detail?.translations.en.body).toContain('reroll any die');
  });
});
