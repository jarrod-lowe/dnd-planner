import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lazyRuleGroupIds } from '$lib/rules-engine-v2/lazy';

/**
 * v2 delivery coverage — the safety net for the runtime cutover.
 *
 * At play time the store resolves each of a character's assigned rule-group ids to
 * a v2 module chunk via `loadModules`; unknown ids are silently skipped. So every
 * DEPLOYED rule group that actually has rules MUST resolve to a module, or a real
 * character assigned that group would quietly lose its rules under v2.
 *
 * Groups with no rules are exempt: the spell-list groups (e.g. `paladin-spells-l2`,
 * `cleric-spells-l1`) are dependency aggregators whose `requires` pull in the real
 * spell modules at assign time, and the `*-detail` entries are the rules-mode detail
 * catalog — none contributes anything to evaluation, so skipping them is harmless.
 *
 * Reads the generated rule-group data (`build/test-rule-groups.json`); runs via
 * `make test-rules` / `make test-unit`, which regenerate it from the YAML first.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath =
  process.env.RULE_GROUPS_JSON ||
  join(__dirname, '..', '..', '..', 'build', 'test-rule-groups.json');

interface RuleGroupData {
  requires?: string[];
  rules: unknown[];
}

/** The deployed id is the bare rule-group id (the JSON key is `category/id`). */
const bareId = (key: string): string => key.split('/').pop() ?? key;

describe.skipIf(!existsSync(jsonPath))('v2 delivery coverage', () => {
  const data = JSON.parse(readFileSync(jsonPath, 'utf-8')) as Record<string, RuleGroupData>;
  const loaders = new Set(lazyRuleGroupIds());

  it('every deployed rule group with rules resolves to a v2 module chunk', () => {
    const unported = Object.entries(data)
      .filter(([, v]) => (v.rules?.length ?? 0) > 0)
      .map(([key]) => bareId(key))
      .filter((id) => !loaders.has(id));
    expect(unported, `rule groups with rules but no v2 module: ${unported.join(', ')}`).toEqual([]);
  });

  it('only empty (no-rule) groups are skipped by the loader', () => {
    // Anything the loader skips must be a 0-rule aggregator/detail group, else
    // "full coverage" would be a lie the moment such a group gains a rule.
    const skippedWithRules = Object.entries(data)
      .filter(([key]) => !loaders.has(bareId(key)))
      .filter(([, v]) => (v.rules?.length ?? 0) > 0)
      .map(([key]) => bareId(key));
    expect(skippedWithRules).toEqual([]);
  });
});
