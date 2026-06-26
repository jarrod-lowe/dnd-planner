import { describe, it, expect } from 'vitest';
import { evaluate, endTurn, resolveModules } from '$lib/rules-engine-v2';
import type {
  Diagnostic,
  EffectInstance,
  EngineInput,
  EngineOutput,
  Facts,
  PlannedRef,
  RuleModule
} from '$lib/rules-engine-v2';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

/**
 * M1 / W5 — the parity harness (the acceptance gate).
 *
 * Each scenario's `test.yaml` already encodes v1's expected output, so it is the
 * oracle. This runner maps a scenario's `ruleGroups` to v2 modules via the
 * registry, drives the same steps through the v2 `evaluate()`, and runs the same
 * assertions.
 *
 * M1 coverage is bounded by what is ported: a scenario runs only when *every*
 * group resolves to a v2 module (and it does not depend on an offer/feature not
 * yet ported — the SKIP_BY_NAME list). Everything else is skipped and counted, so
 * coverage grows automatically as M3 ports more groups. Wired into `make test`
 * via the tests/integration include.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenariosDir = join(__dirname, 'yaml-scenarios');

// Groups are ported, but these scenarios exercise offers/setters not yet ported
// as v2 modules (ability-score and HP-modifier setters land in M3). Skipped with
// a reason rather than silently, so the gap is visible and counted.
const SKIP_BY_NAME: Record<string, string> = {
  'hp-paladin-level1': 'set-constitution offer not ported (M3)',
  'hp-with-modifiers': 'set-hp-modifier-* offers not ported (M3)',
  'hp-modifier-no-stacking': 'set-hp-modifier-max offer not ported (M3)'
};

// The scenarios expected to run on v2 today. Asserted as an exact set so that a
// regression (a module dropping out of the registry) fails loudly instead of
// quietly shrinking coverage.
const EXPECTED_RUNNABLE = [
  'bonus-action-init',
  'paladin-spell-slots',
  'spellcasting-base-reset'
].sort();

// --- Test config types (subset of the v1 runner's schema we drive) ---

interface AssertConfig {
  facts?: Record<string, unknown>;
  offers?: { exists?: string[]; notExists?: string[]; legal?: string[]; illegal?: string[] };
  effects?: { exists?: string[]; notExists?: string[] };
  offerVars?: { id: string; vars: Record<string, unknown> }[];
  offerUi?: { id: string; ui: Record<string, unknown> }[];
  annotations?: { exists?: string[]; notExists?: string[] };
  status?: { ok?: boolean; legal?: boolean; applicable?: boolean };
  planErrors?: { id: string; index?: number; errors: string[] }[];
}

interface TestConfig {
  name: string;
  description?: string;
  ruleGroups: string[];
  initialFacts?: Facts;
  initialEffects?: unknown[];
  steps: Record<string, unknown>[];
}

// --- Assertion helpers (adapted to the v2 EngineOutput shape) ---

function assertFacts(actual: Facts, expected: Record<string, unknown>, where: string): void {
  for (const [key, value] of Object.entries(expected)) {
    expect(actual[key] ?? 0, `${where}: fact "${key}"`).toEqual(value);
  }
}

function assertOffers(
  rules: EngineOutput['availableRules'],
  expected: NonNullable<AssertConfig['offers']>,
  where: string
): void {
  for (const id of expected.exists ?? [])
    expect(
      rules.find((r) => r.rule.id === id),
      `${where}: offer "${id}" exists`
    ).toBeDefined();
  for (const id of expected.notExists ?? [])
    expect(
      rules.some((r) => r.rule.id === id),
      `${where}: offer "${id}" absent`
    ).toBe(false);
  for (const id of expected.legal ?? []) {
    const e = rules.find((r) => r.rule.id === id);
    expect(e, `${where}: offer "${id}" exists`).toBeDefined();
    expect(e!.legal, `${where}: offer "${id}" legal`).toBe(true);
  }
  for (const id of expected.illegal ?? []) {
    const e = rules.find((r) => r.rule.id === id);
    expect(e, `${where}: offer "${id}" exists`).toBeDefined();
    expect(e!.legal, `${where}: offer "${id}" illegal`).toBe(false);
  }
}

function assertOfferVars(
  rules: EngineOutput['availableRules'],
  expected: NonNullable<AssertConfig['offerVars']>,
  where: string
): void {
  for (const { id, vars } of expected) {
    const e = rules.find((r) => r.rule.id === id);
    expect(e, `${where}: offerVars "${id}" exists`).toBeDefined();
    for (const [k, v] of Object.entries(vars))
      expect(e!.rule.vars?.[k], `${where}: offerVars "${id}".${k}`).toEqual(v);
  }
}

function assertOfferUi(
  rules: EngineOutput['availableRules'],
  expected: NonNullable<AssertConfig['offerUi']>,
  where: string
): void {
  for (const { id, ui } of expected) {
    const e = rules.find((r) => r.rule.id === id);
    expect(e, `${where}: offerUi "${id}" exists`).toBeDefined();
    for (const [k, v] of Object.entries(ui))
      expect(e!.rule.ui?.[k], `${where}: offerUi "${id}".${k}`).toEqual(v);
  }
}

function assertAnnotations(
  actual: EngineOutput['annotations'],
  expected: NonNullable<AssertConfig['annotations']>,
  where: string
): void {
  for (const key of expected.exists ?? [])
    expect(
      actual.some((a) => a.key === key),
      `${where}: annotation "${key}" exists`
    ).toBe(true);
  for (const key of expected.notExists ?? [])
    expect(
      actual.some((a) => a.key === key),
      `${where}: annotation "${key}" absent`
    ).toBe(false);
}

function assertStatus(
  actual: EngineOutput['status'],
  expected: NonNullable<AssertConfig['status']>,
  where: string
): void {
  for (const [k, v] of Object.entries(expected))
    expect(actual[k as keyof typeof actual], `${where}: status.${k}`).toBe(v);
}

/** Effect IDs are namespaced in v2 (`instance#i#id`); match by the base id segment. */
function matchesEffectId(actualId: string, baseId: string): boolean {
  if (actualId === baseId) return true;
  return actualId.split('#').includes(baseId) || actualId.startsWith(baseId + '-');
}

function assertEffects(
  committed: EffectInstance[],
  expected: NonNullable<AssertConfig['effects']>,
  where: string
): void {
  for (const id of expected.exists ?? [])
    expect(
      committed.some((e) => matchesEffectId(e.id, id)),
      `${where}: effect "${id}" exists`
    ).toBe(true);
  for (const id of expected.notExists ?? [])
    expect(
      committed.some((e) => matchesEffectId(e.id, id)),
      `${where}: effect "${id}" absent`
    ).toBe(false);
}

function assertPlanErrors(
  planDiagnostics: Record<string, Diagnostic[]>,
  planned: PlannedRef[],
  expected: NonNullable<AssertConfig['planErrors']>,
  where: string
): void {
  for (const { id, index = 0, errors } of expected) {
    const instances = planned.filter((p) => p.ruleId === id);
    expect(instances.length > index, `${where}: planned "${id}"[${index}] exists`).toBe(true);
    const codes = (planDiagnostics[instances[index]!.instanceId] ?? []).map((d) => d.code);
    expect(codes, `${where}: planned "${id}"[${index}] errors`).toEqual(errors);
  }
}

function runAssertions(
  out: EngineOutput,
  committed: EffectInstance[],
  planned: PlannedRef[],
  assert: AssertConfig,
  where: string
): void {
  if (assert.facts) assertFacts(out.facts, assert.facts, where);
  if (assert.offers) assertOffers(out.availableRules, assert.offers, where);
  if (assert.offerVars) assertOfferVars(out.availableRules, assert.offerVars, where);
  if (assert.offerUi) assertOfferUi(out.availableRules, assert.offerUi, where);
  if (assert.annotations) assertAnnotations(out.annotations, assert.annotations, where);
  if (assert.status) assertStatus(out.status, assert.status, where);
  if (assert.effects) assertEffects(committed, assert.effects, where);
  if (assert.planErrors) assertPlanErrors(out.planDiagnostics, planned, assert.planErrors, where);
}

// --- v2 harness: drives scenario steps through evaluate() ---

class V2Harness {
  private planned: PlannedRef[] = [];
  private committed: EffectInstance[];
  private last: EngineOutput | null = null;
  private counter = 0;

  constructor(
    private modules: RuleModule[],
    private inputFacts: Facts,
    initialEffects: EffectInstance[]
  ) {
    this.committed = [...initialEffects];
  }

  private build(): EngineInput {
    return {
      modules: this.modules,
      inputFacts: this.inputFacts,
      planned: this.planned,
      committed: this.committed
    };
  }

  get committedEffects(): EffectInstance[] {
    return this.committed;
  }
  get plannedRefs(): PlannedRef[] {
    return this.planned;
  }

  evaluate(): EngineOutput {
    this.last = evaluate(this.build());
    return this.last;
  }

  addOffer(id: string, selections?: Record<string, unknown>): EngineOutput {
    this.planned.push({ instanceId: `instance-${this.counter++}`, ruleId: id, selections });
    return this.evaluate();
  }

  removeFromPlan(id: string): EngineOutput {
    const i = this.planned.findIndex((p) => p.ruleId === id);
    if (i === -1) throw new Error(`No planned item with offer id "${id}"`);
    this.planned.splice(i, 1);
    return this.evaluate();
  }

  updateSelections(id: string, selections: Record<string, unknown>): EngineOutput {
    const item = this.planned.find((p) => p.ruleId === id);
    if (!item) throw new Error(`No planned item with offer id "${id}"`);
    item.selections = { ...selections };
    return this.evaluate();
  }

  endTurn(longRest: boolean): EngineOutput {
    this.committed = endTurn(this.committed, this.last?.effects ?? [], { longRest });
    this.planned = [];
    return this.evaluate();
  }

  removeEffect(id: string): EngineOutput {
    this.committed = this.committed.filter((e) => !matchesEffectId(e.id, id));
    return this.evaluate();
  }
}

/** The step verb (the one key that isn't `assert`). */
function stepKeyOf(step: Record<string, unknown>): string {
  const key = Object.keys(step).find((k) => k !== 'assert');
  if (!key) throw new Error('Unknown step type');
  return key;
}

/** Assertions live either nested under the step verb or as a sibling key. */
function assertOf(step: Record<string, unknown>): AssertConfig | undefined {
  const data = step[stepKeyOf(step)] as Record<string, unknown> | undefined;
  return (data?.assert ?? step.assert) as AssertConfig | undefined;
}

function runStep(harness: V2Harness, step: Record<string, unknown>): EngineOutput {
  const key = stepKeyOf(step);
  const data = (step[key] ?? {}) as Record<string, unknown>;
  switch (key) {
    case 'evaluate':
      return harness.evaluate();
    case 'addOffer':
      return harness.addOffer(data.id as string, data.selections as Record<string, unknown>);
    case 'removeFromPlan':
      return harness.removeFromPlan(data.id as string);
    case 'updateSelections':
      return harness.updateSelections(
        data.id as string,
        data.selections as Record<string, unknown>
      );
    case 'endTurn':
      return harness.endTurn(Boolean(data.longRest));
    case 'removeEffect':
      return harness.removeEffect(data.id as string);
    default:
      throw new Error(`Unknown step type "${key}"`);
  }
}

// --- Discover scenarios and classify run vs skip ---

const scenarioNames = existsSync(scenariosDir)
  ? readdirSync(scenariosDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
  : [];

function loadConfig(name: string): TestConfig {
  return yaml.load(readFileSync(join(scenariosDir, name, 'test.yaml'), 'utf-8')) as TestConfig;
}

/** Why a scenario is skipped, or null if it should run. */
function skipReason(config: TestConfig, name: string): string | null {
  if (SKIP_BY_NAME[name]) return SKIP_BY_NAME[name];
  const { missing } = resolveModules(config.ruleGroups ?? []);
  if (missing.length > 0) return `unported groups: ${missing.join(', ')}`;
  if (config.initialEffects && config.initialEffects.length > 0)
    return 'initialEffects use the v1 rule format';
  return null;
}

const runnable: string[] = [];
const skipped: string[] = [];
for (const name of scenarioNames) {
  if (skipReason(loadConfig(name), name) === null) runnable.push(name);
  else skipped.push(name);
}

describe('yaml scenarios — v2 parity', () => {
  it(`coverage: ${runnable.length} runnable, ${skipped.length} skipped (grows as M3 ports)`, () => {
    expect(runnable.slice().sort()).toEqual(EXPECTED_RUNNABLE);
  });

  for (const name of scenarioNames) {
    const config = loadConfig(name);
    const reason = skipReason(config, name);
    if (reason) {
      it.skip(`${name} — skipped: ${reason}`, () => {});
      continue;
    }
    it(name, () => {
      const { modules } = resolveModules(config.ruleGroups);
      const harness = new V2Harness(modules, config.initialFacts ?? {}, []);
      config.steps.forEach((step, i) => {
        const out = runStep(harness, step);
        const assert = assertOf(step);
        if (assert)
          runAssertions(out, harness.committedEffects, harness.plannedRefs, assert, `Step ${i}`);
      });
    });
  }
});
