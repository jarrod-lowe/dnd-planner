import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import type { EngineInput, EngineOutput, Rule, Facts } from '$lib/rules-engine';
import { resolveInitialSelections } from '$lib/play/resolveInitialSelections';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scenariosDir = join(__dirname, 'yaml-scenarios');
const ruleGroupsJsonPath =
  process.env.RULE_GROUPS_JSON ||
  join(__dirname, '..', '..', '..', 'build', 'test-rule-groups.json');

// --- Types for test config ---

interface AssertConfig {
  facts?: Record<string, unknown>;
  offers?: {
    exists?: string[];
    notExists?: string[];
    legal?: string[];
    illegal?: string[];
  };
  effects?: {
    exists?: string[];
    notExists?: string[];
  };
  offerVars?: {
    id: string;
    vars: Record<string, unknown>;
  }[];
  offerUi?: {
    id: string;
    ui: Record<string, unknown>;
  }[];
  status?: {
    ok?: boolean;
    legal?: boolean;
    applicable?: boolean;
  };
}

interface EvaluateStep {
  evaluate: Record<string, never>;
  assert?: AssertConfig;
}

interface AddOfferStep {
  addOffer: {
    id: string;
    selections?: Record<string, unknown>;
  };
  assert?: AssertConfig;
}

interface RemoveFromPlanStep {
  removeFromPlan: {
    id: string;
  };
  assert?: AssertConfig;
}

interface UpdateSelectionsStep {
  updateSelections: {
    id: string;
    selections: Record<string, unknown>;
  };
  assert?: AssertConfig;
}

interface EndTurnStep {
  endTurn: Record<string, never>;
  assert?: AssertConfig;
}

interface RemoveEffectStep {
  removeEffect: {
    id: string;
  };
  assert?: AssertConfig;
}

type Step =
  | EvaluateStep
  | AddOfferStep
  | RemoveFromPlanStep
  | UpdateSelectionsStep
  | EndTurnStep
  | RemoveEffectStep;

interface TestConfig {
  name: string;
  description?: string;
  ruleGroups: string[];
  initialFacts?: Facts;
  initialEffects?: Rule[];
  steps: Step[];
}

// --- Assertion helpers ---

function assertFacts(actual: Facts, expected: Record<string, unknown>, stepDesc: string): void {
  for (const [key, value] of Object.entries(expected)) {
    // In the auto-clear facts model, unset facts are undefined (equivalent to 0)
    const actualValue = actual[key] ?? 0;
    expect(actualValue, `${stepDesc}: fact "${key}"`).toEqual(value);
  }
}

function assertOffers(
  availableRules: EngineOutput['availableRules'],
  expected: NonNullable<AssertConfig['offers']>,
  stepDesc: string
): void {
  for (const id of expected.exists ?? []) {
    const entry = availableRules.find((ar) => ar.rule.id === id);
    expect(entry, `${stepDesc}: offer "${id}" should exist`).toBeDefined();
  }
  for (const id of expected.notExists ?? []) {
    const found = availableRules.some((ar) => ar.rule.id === id);
    expect(!found, `${stepDesc}: offer "${id}" should NOT exist`).toBe(true);
  }
  for (const id of expected.legal ?? []) {
    const entry = availableRules.find((ar) => ar.rule.id === id);
    expect(entry, `${stepDesc}: offer "${id}" should exist`).toBeDefined();
    expect(entry!.legal, `${stepDesc}: offer "${id}" should be legal`).toBe(true);
  }
  for (const id of expected.illegal ?? []) {
    const entry = availableRules.find((ar) => ar.rule.id === id);
    expect(entry, `${stepDesc}: offer "${id}" should exist but be illegal`).toBeDefined();
    expect(entry!.legal, `${stepDesc}: offer "${id}" should be illegal`).toBe(false);
  }
}

function assertStatus(
  actual: EngineOutput['status'],
  expected: NonNullable<AssertConfig['status']>,
  stepDesc: string
): void {
  for (const [key, value] of Object.entries(expected)) {
    expect(actual[key as keyof typeof actual], `${stepDesc}: status.${key}`).toBe(value);
  }
}

function assertOfferVars(
  availableRules: EngineOutput['availableRules'],
  expected: NonNullable<AssertConfig['offerVars']>,
  stepDesc: string
): void {
  for (const { id, vars } of expected) {
    const entry = availableRules.find((ar) => ar.rule.id === id);
    expect(entry, `${stepDesc}: offerVars "${id}" should exist`).toBeDefined();
    for (const [varName, varValue] of Object.entries(vars)) {
      const actualVar = entry!.rule.vars?.[varName];
      expect(actualVar, `${stepDesc}: offerVars "${id}" var "${varName}"`).toEqual(varValue);
    }
  }
}

function assertOfferUi(
  availableRules: EngineOutput['availableRules'],
  expected: NonNullable<AssertConfig['offerUi']>,
  stepDesc: string
): void {
  for (const { id, ui } of expected) {
    const entry = availableRules.find((ar) => ar.rule.id === id);
    expect(entry, `${stepDesc}: offerUi "${id}" should exist`).toBeDefined();
    for (const [uiKey, uiValue] of Object.entries(ui)) {
      const actualValue = entry!.rule.ui?.[uiKey as string];
      expect(actualValue, `${stepDesc}: offerUi "${id}" ui.${uiKey}`).toEqual(uiValue);
    }
  }
}

function assertEffects(
  effects: Rule[],
  expected: NonNullable<AssertConfig['effects']>,
  stepDesc: string
): void {
  for (const id of expected.exists ?? []) {
    const found = effects.some((r) => matchesEffectId(r.id, id));
    expect(found, `${stepDesc}: effect "${id}" should exist`).toBe(true);
  }
  for (const id of expected.notExists ?? []) {
    const found = effects.some((r) => matchesEffectId(r.id, id));
    expect(!found, `${stepDesc}: effect "${id}" should NOT exist`).toBe(true);
  }
}

/**
 * Match effect IDs by base ID. The engine appends a counter suffix to
 * advertised effects (e.g., "effect-divine-sense" becomes "effect-divine-sense-2").
 * This matches both exact IDs and counter-suffixed variants.
 */
function matchesEffectId(actualId: string, baseId: string): boolean {
  if (actualId === baseId) return true;
  // Match "{baseId}-{number}" (counter-suffixed)
  if (actualId.startsWith(baseId + '-')) {
    const suffix = actualId.slice(baseId.length + 1);
    return /^\d+$/.test(suffix);
  }
  return false;
}

function runAssertions(
  output: EngineOutput,
  assert: AssertConfig,
  stepDesc: string,
  effects: Rule[]
): void {
  if (assert.facts) {
    assertFacts(output.facts, assert.facts, stepDesc);
  }
  if (assert.offers) {
    assertOffers(output.availableRules, assert.offers, stepDesc);
  }
  if (assert.effects) {
    assertEffects(effects, assert.effects, stepDesc);
  }
  if (assert.offerVars) {
    assertOfferVars(output.availableRules, assert.offerVars, stepDesc);
  }
  if (assert.offerUi) {
    assertOfferUi(output.availableRules, assert.offerUi, stepDesc);
  }
  if (assert.status) {
    assertStatus(output.status, assert.status, stepDesc);
  }
}

// --- Load rule groups from JSON ---

interface RuleGroupData {
  rules: Rule[];
}

function loadRuleGroupsData(): Record<string, RuleGroupData> {
  return JSON.parse(readFileSync(ruleGroupsJsonPath, 'utf-8'));
}

function loadRuleGroups(groupIds: string[]): Rule[] {
  const ruleGroupsData = loadRuleGroupsData();
  const rules: Rule[] = [];
  for (const groupId of groupIds) {
    const data = ruleGroupsData[groupId];
    if (!data) {
      const available = Object.keys(ruleGroupsData).join(', ');
      throw new Error(`Rule group "${groupId}" not found in JSON. Available: [${available}]`);
    }
    rules.push(...data.rules);
  }
  return rules;
}

// --- Test harness ---

interface PlannedItem {
  instanceId: string;
  originalOfferId: string;
  rule: Rule;
}

class TestHarness {
  standing: Rule[];
  plannedItems: PlannedItem[] = [];
  effects: Rule[];
  facts: Facts;
  lastOutput: EngineOutput | null = null;
  instanceCounter = 0;

  constructor(standing: Rule[], initialFacts: Facts, initialEffects: Rule[]) {
    this.standing = standing;
    this.facts = { ...initialFacts };
    this.effects = [...initialEffects];
  }

  private buildInput(): EngineInput {
    return {
      schemaVersion: 1,
      rules: {
        standing: this.standing,
        planned: this.plannedItems.map((item) => item.rule),
        effects: this.effects
      },
      state: {
        facts: {}
      }
    };
  }

  doEvaluate(): EngineOutput {
    const output = evaluate(this.buildInput());
    this.facts = output.facts;
    this.lastOutput = output;
    return output;
  }

  doAddOffer(offerId: string, selections?: Record<string, unknown>): EngineOutput {
    if (!this.lastOutput) {
      throw new Error('Must evaluate before adding offers');
    }

    const offered = this.lastOutput.availableRules.find((ar) => ar.rule.id === offerId);
    if (!offered) {
      const availableIds = this.lastOutput.availableRules.map((ar) => ar.rule.id).join(', ');
      throw new Error(`Offer "${offerId}" not found. Available: [${availableIds}]`);
    }

    const rule = structuredClone(offered.rule);
    const instanceId = `instance-${this.instanceCounter++}`;
    const originalOfferId = rule.id;

    // Resolve capture vars from current facts
    const resolvedSelections = resolveInitialSelections(rule, this.facts);
    rule.selections = { ...resolvedSelections, ...selections };
    rule.id = instanceId;

    this.plannedItems.push({ instanceId, originalOfferId, rule });
    return this.doEvaluate();
  }

  doRemoveFromPlan(offerId: string): EngineOutput {
    const index = this.plannedItems.findIndex((item) => item.originalOfferId === offerId);
    if (index === -1) {
      throw new Error(`No planned item with offer ID "${offerId}"`);
    }
    this.plannedItems.splice(index, 1);
    return this.doEvaluate();
  }

  doUpdateSelections(offerId: string, selections: Record<string, unknown>): EngineOutput {
    const item = this.plannedItems.find((item) => item.originalOfferId === offerId);
    if (!item) {
      throw new Error(`No planned item with offer ID "${offerId}"`);
    }
    item.rule.selections = { ...selections };
    return this.doEvaluate();
  }

  doEndTurn(): EngineOutput {
    // Use output.next.rules.effects — the engine's computed set of effects
    // that should persist. This correctly excludes effects that stopped
    // self-advertising (e.g., spell effects on long rest).
    if (this.lastOutput) {
      this.effects = [...this.lastOutput.next.rules.effects];
    }
    // Clear planned items
    this.plannedItems = [];
    return this.doEvaluate();
  }

  doRemoveEffect(effectId: string): EngineOutput {
    this.effects = this.effects.filter((rule) => !matchesEffectId(rule.id, effectId));
    return this.doEvaluate();
  }
}

// --- Auto-discover and run scenarios ---

const scenarios = existsSync(scenariosDir)
  ? readdirSync(scenariosDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
  : [];

describe('yaml rules scenarios', () => {
  for (const scenarioName of scenarios) {
    it(scenarioName, () => {
      const configPath = join(scenariosDir, scenarioName, 'test.yaml');
      const config: TestConfig = yaml.load(readFileSync(configPath, 'utf-8')) as TestConfig;

      const standingRules = loadRuleGroups(config.ruleGroups);
      const harness = new TestHarness(
        standingRules,
        config.initialFacts ?? {},
        config.initialEffects ?? []
      );

      for (let i = 0; i < config.steps.length; i++) {
        const step = config.steps[i] as Record<string, unknown>;
        const stepDesc = `Step ${i}`;

        // Extract the step key and its nested data (including assertions)
        const stepKey = Object.keys(step).find((k) => k !== 'assert');
        if (!stepKey) throw new Error(`${stepDesc}: Unknown step type`);
        const stepData = step[stepKey] as Record<string, unknown> | null;
        const assert = (stepData?.assert ?? step.assert) as AssertConfig | undefined;

        if (stepKey === 'evaluate') {
          const output = harness.doEvaluate();
          if (assert) {
            runAssertions(output, assert, stepDesc, harness.effects);
          }
        } else if (stepKey === 'addOffer') {
          const addOfferData = stepData as { id: string; selections?: Record<string, unknown> };
          const output = harness.doAddOffer(addOfferData.id, addOfferData.selections);
          if (assert) {
            runAssertions(output, assert, stepDesc, harness.effects);
          }
        } else if (stepKey === 'removeFromPlan') {
          const removeData = stepData as { id: string };
          const output = harness.doRemoveFromPlan(removeData.id);
          if (assert) {
            runAssertions(output, assert, stepDesc, harness.effects);
          }
        } else if (stepKey === 'updateSelections') {
          const updateData = stepData as { id: string; selections: Record<string, unknown> };
          const output = harness.doUpdateSelections(updateData.id, updateData.selections);
          if (assert) {
            runAssertions(output, assert, stepDesc, harness.effects);
          }
        } else if (stepKey === 'endTurn') {
          const output = harness.doEndTurn();
          if (assert) {
            runAssertions(output, assert, stepDesc, harness.effects);
          }
        } else if (stepKey === 'removeEffect') {
          const removeEffectData = stepData as { id: string };
          const output = harness.doRemoveEffect(removeEffectData.id);
          if (assert) {
            runAssertions(output, assert, stepDesc, harness.effects);
          }
        } else {
          throw new Error(`${stepDesc}: Unknown step type "${stepKey}"`);
        }
      }
    });
  }
});
