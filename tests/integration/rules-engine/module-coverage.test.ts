import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lazyRuleGroupIds } from '$lib/rules-engine/lazy';

/**
 * module delivery coverage — the safety net for the runtime cutover.
 *
 * At play time the store resolves each of a character's assigned rule-group ids to
 * a module chunk via `loadModules`; unknown ids are silently skipped (the
 * `missing` list is discarded — catalog-only groups are expected misses). So this
 * test is the ONLY tripwire for a deployed group whose module was forgotten: every
 * group in the deployed catalog must either resolve to a module or be explicitly
 * allowlisted as catalog-only.
 *
 * Catalog-only groups contribute nothing to evaluation: the spell-list groups
 * (`paladin-spells-l2`, `cleric-spells-l1`, …) are dependency aggregators whose
 * `requires` pull in the real spell modules at assign time, and the `*-detail`
 * entries are the rules-mode detail catalog.
 *
 * Reads the generated rule-group data (`build/test-rule-groups.json`); runs via
 * `make test-unit`, which regenerates it from the YAML first.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath =
  process.env.RULE_GROUPS_JSON ||
  join(__dirname, '..', '..', '..', 'build', 'test-rule-groups.json');

/**
 * Deployed groups that intentionally have no module. Adding a group here is a
 * deliberate act — anything deployed but neither loadable nor listed fails below.
 */
const CATALOG_ONLY = new Set([
  // Spell-list dependency aggregators (requires-only).
  'bard-spells-l1',
  'bard-spells-l2',
  'cleric-spells-l1',
  'cleric-spells-l2',
  'druid-spells-l1',
  'druid-spells-l2',
  'paladin-spells-l2',
  'sorcerer-spells-l1',
  'sorcerer-spells-l2',
  'warlock-spells-l1',
  'warlock-spells-l2',
  'wizard-spells-l1',
  'wizard-spells-l2',
  // Rules-mode detail catalog entries.
  'fell-glare-detail',
  'fey-step-detail',
  'healing-touch-detail',
  'otherworldly-slam-detail'
]);

/** The deployed id is the bare rule-group id (the JSON key is `category/id`). */
const bareId = (key: string): string => key.split('/').pop() ?? key;

// `describe.skipIf` still invokes the factory to collect the (skipped) tests, so
// the fixture read must be guarded: on a clean checkout where the JSON has not
// been generated, an unguarded readFileSync throws ENOENT during collection and
// fails `pnpm test` before any test runs. Read only when the fixture exists; the
// empty fallback is never asserted because the suite is skipped in that case.
const hasFixture = existsSync(jsonPath);
const data: Record<string, unknown> = hasFixture
  ? (JSON.parse(readFileSync(jsonPath, 'utf-8')) as Record<string, unknown>)
  : {};

describe.skipIf(!hasFixture)('module delivery coverage', () => {
  const deployed = Object.keys(data).map(bareId);
  const loaders = new Set(lazyRuleGroupIds());

  it('every deployed rule group resolves to a rule module or is explicitly catalog-only', () => {
    const unported = deployed.filter((id) => !loaders.has(id) && !CATALOG_ONLY.has(id));
    expect(
      unported,
      `deployed groups with no module and no catalog-only entry: ${unported.join(', ')}`
    ).toEqual([]);
  });

  it('the catalog-only allowlist stays accurate', () => {
    // A listed group that gained a module must leave the list (else a regression
    // in its loader entry would pass silently)…
    const listedButLoadable = [...CATALOG_ONLY].filter((id) => loaders.has(id));
    expect(listedButLoadable, `allowlisted but loadable: ${listedButLoadable.join(', ')}`).toEqual(
      []
    );
    // …and a listed group that is no longer deployed is stale.
    const deployedSet = new Set(deployed);
    const stale = [...CATALOG_ONLY].filter((id) => !deployedSet.has(id));
    expect(stale, `allowlisted but not deployed: ${stale.join(', ')}`).toEqual([]);
  });
});
