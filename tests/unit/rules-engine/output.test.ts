import { describe, it, expect } from 'vitest';
import {
  getPersistableEffects,
  buildStatus,
  buildNextInput,
  buildOutput
} from '$lib/rules-engine/output';
import type { WorkingState, Rule, Diagnostics, EngineInput } from '$lib/rules-engine/types';

function createEmptyWorkingState(): WorkingState {
  return {
    facts: {},
    events: new Set(),
    generatedRules: { early: [], normal: [], safeguard: [] },
    offeredRules: [],
    appliedRuleIds: [],
    appliedActivityIds: []
  };
}

describe('getPersistableEffects', () => {
  it('returns empty array when no generated rules', () => {
    const workingState = createEmptyWorkingState();

    const effects = getPersistableEffects(workingState);

    expect(effects).toHaveLength(0);
  });

  it('includes safeguard phase generated rules', () => {
    const safeguardRule: Rule = {
      id: 'generated-1',
      phase: 'safeguard',
      activities: []
    };

    const workingState = createEmptyWorkingState();
    workingState.generatedRules.safeguard = [safeguardRule];

    const effects = getPersistableEffects(workingState);

    expect(effects).toContain(safeguardRule);
  });

  it('includes normal phase generated rules', () => {
    const normalRule: Rule = {
      id: 'generated-1',
      phase: 'normal',
      activities: []
    };

    const workingState = createEmptyWorkingState();
    workingState.generatedRules.normal = [normalRule];

    const effects = getPersistableEffects(workingState);

    expect(effects).toContain(normalRule);
  });

  it('includes early phase generated rules', () => {
    const earlyRule: Rule = {
      id: 'generated-1',
      phase: 'early',
      activities: []
    };

    const workingState = createEmptyWorkingState();
    workingState.generatedRules.early = [earlyRule];

    const effects = getPersistableEffects(workingState);

    expect(effects).toContain(earlyRule);
  });

  it('combines safeguard rules from multiple phases', () => {
    const safeguard1: Rule = { id: 'sg-1', phase: 'safeguard', activities: [] };
    const safeguard2: Rule = { id: 'sg-2', phase: 'safeguard', activities: [] };

    const workingState = createEmptyWorkingState();
    workingState.generatedRules.safeguard = [safeguard1, safeguard2];

    const effects = getPersistableEffects(workingState);

    expect(effects).toHaveLength(2);
    expect(effects).toContain(safeguard1);
    expect(effects).toContain(safeguard2);
  });
});

describe('buildStatus', () => {
  it('returns ok: true when no errors in diagnostics', () => {
    const workingState = createEmptyWorkingState();
    const diagnostics: Diagnostics = {
      errors: [],
      warnings: [],
      notices: []
    };

    const status = buildStatus(workingState, diagnostics);

    expect(status.ok).toBe(true);
  });

  it('returns ok: false when errors exist in diagnostics', () => {
    const workingState = createEmptyWorkingState();
    const diagnostics: Diagnostics = {
      errors: [{ code: 'ERR001', severity: 'error', message: 'Something went wrong' }],
      warnings: [],
      notices: []
    };

    const status = buildStatus(workingState, diagnostics);

    expect(status.ok).toBe(false);
  });

  it('returns legal: true and applicable: true by default', () => {
    const workingState = createEmptyWorkingState();
    const diagnostics: Diagnostics = {
      errors: [],
      warnings: [],
      notices: []
    };

    const status = buildStatus(workingState, diagnostics);

    expect(status.legal).toBe(true);
    expect(status.applicable).toBe(true);
  });
});

function createEngineInput(overrides?: Partial<EngineInput>): EngineInput {
  return {
    schemaVersion: 1,
    rules: {
      standing: [],
      planned: [],
      effects: []
    },
    state: {
      facts: {}
    },
    ...overrides
  };
}

describe('buildNextInput', () => {
  it('copies schemaVersion from input', () => {
    const input = createEngineInput({ schemaVersion: 1 });
    const workingState = createEmptyWorkingState();

    const next = buildNextInput(input, workingState);

    expect(next.schemaVersion).toBe(1);
  });

  it('copies standing rules from input', () => {
    const standingRule: Rule = { id: 'standing-1', activities: [] };
    const input = createEngineInput({
      rules: { standing: [standingRule], planned: [], effects: [] }
    });
    const workingState = createEmptyWorkingState();

    const next = buildNextInput(input, workingState);

    expect(next.rules.standing).toEqual([standingRule]);
  });

  it('preserves planned rules', () => {
    const plannedRule: Rule = { id: 'planned-1', activities: [] };
    const input = createEngineInput({
      rules: { standing: [], planned: [plannedRule], effects: [] }
    });
    const workingState = createEmptyWorkingState();

    const next = buildNextInput(input, workingState);

    expect(next.rules.planned).toEqual([plannedRule]);
  });

  it('uses input facts as base facts (not projected facts)', () => {
    const input = createEngineInput({
      state: { facts: { 'hp.max': 10 } }
    });
    const workingState = createEmptyWorkingState();
    // Simulate that evaluation modified workingState.facts
    workingState.facts = { 'hp.max': 10, 'hp.current': 8 };

    const next = buildNextInput(input, workingState);

    // next.state.facts should be the original input facts, not the modified ones
    expect(next.state.facts).toEqual({ 'hp.max': 10 });
  });
});

describe('buildOutput', () => {
  it('includes projected facts from workingState', () => {
    const input = createEngineInput();
    const workingState = createEmptyWorkingState();
    workingState.facts = { 'hp.current': 8, 'hp.max': 10 };

    const output = buildOutput(input, workingState);

    expect(output.facts).toEqual({ 'hp.current': 8, 'hp.max': 10 });
  });

  it('includes empty collections for v1', () => {
    const input = createEngineInput();
    const workingState = createEmptyWorkingState();

    const output = buildOutput(input, workingState);

    expect(output.collections).toEqual({});
  });

  it('includes available rules from workingState', () => {
    const input = createEngineInput();
    const workingState = createEmptyWorkingState();
    const offeredRule = {
      rule: { id: 'offered-1', activities: [] },
      legal: true,
      applicable: true,
      diagnostics: []
    };
    workingState.offeredRules = [offeredRule];

    const output = buildOutput(input, workingState);

    expect(output.availableRules).toHaveLength(1);
    expect(output.availableRules[0]).toEqual(offeredRule);
  });

  it('includes trace from workingState', () => {
    const input = createEngineInput();
    const workingState = createEmptyWorkingState();
    workingState.appliedRuleIds = ['rule-1', 'rule-2'];
    workingState.appliedActivityIds = ['act-1'];

    const output = buildOutput(input, workingState);

    expect(output.trace.appliedRuleIds).toEqual(['rule-1', 'rule-2']);
    expect(output.trace.appliedActivityIds).toEqual(['act-1']);
    expect(output.trace.providedCapabilities).toEqual([]);
    expect(output.trace.emittedEvents).toEqual([]);
  });

  it('includes next input from buildNextInput', () => {
    const input = createEngineInput({
      state: { facts: { 'hp.max': 10 } }
    });
    const workingState = createEmptyWorkingState();

    const output = buildOutput(input, workingState);

    expect(output.next.schemaVersion).toBe(1);
    expect(output.next.state.facts).toEqual({ 'hp.max': 10 });
  });
});
