import { describe, it, expect } from 'vitest';
import { getRulesForPhase, processRulesInOrder, executePhase } from '$lib/rules-engine/phases';
import type { RuleContext, Rule } from '$lib/rules-engine/types';

function createEmptyContext(): RuleContext {
	return {
		input: {
			schemaVersion: 1,
			rules: {
				standing: [],
				planned: [],
				effects: []
			},
			state: {
				facts: {}
			}
		},
		workingState: {
			facts: {},
			events: new Set(),
			generatedRules: { early: [], normal: [], safeguard: [] },
			offeredRules: [],
			appliedRuleIds: [],
			appliedActivityIds: []
		},
		groups: new Map(),
		currentPhase: 'normal',
		allRules: []
	};
}

describe('getRulesForPhase', () => {
	it('returns empty array when no rules for phase', () => {
		const context = createEmptyContext();

		const rules = getRulesForPhase(context, 'normal');

		expect(rules).toHaveLength(0);
	});

	it('includes standing rules matching the phase', () => {
		const rule1: Rule = {
			id: 'rule-1',
			phase: 'normal',
			activities: []
		};
		const context = createEmptyContext();
		context.input.rules.standing = [rule1];

		const rules = getRulesForPhase(context, 'normal');

		expect(rules).toContain(rule1);
	});

	it('includes planned rules matching the phase', () => {
		const rule1: Rule = {
			id: 'rule-1',
			phase: 'early',
			activities: []
		};
		const context = createEmptyContext();
		context.input.rules.planned = [rule1];

		const rules = getRulesForPhase(context, 'early');

		expect(rules).toContain(rule1);
	});

	it('includes effects rules matching the phase', () => {
		const rule1: Rule = {
			id: 'rule-1',
			phase: 'safeguard',
			activities: []
		};
		const context = createEmptyContext();
		context.input.rules.effects = [rule1];

		const rules = getRulesForPhase(context, 'safeguard');

		expect(rules).toContain(rule1);
	});

	it('includes generated rules for the phase', () => {
		const rule1: Rule = {
			id: 'generated-1',
			phase: 'normal',
			activities: []
		};
		const context = createEmptyContext();
		context.workingState.generatedRules.normal = [rule1];

		const rules = getRulesForPhase(context, 'normal');

		expect(rules).toContain(rule1);
	});

	it('excludes rules from different phases', () => {
		const earlyRule: Rule = { id: 'early-1', phase: 'early', activities: [] };
		const normalRule: Rule = { id: 'normal-1', phase: 'normal', activities: [] };

		const context = createEmptyContext();
		context.input.rules.standing = [earlyRule, normalRule];

		const rules = getRulesForPhase(context, 'early');

		expect(rules).toContain(earlyRule);
		expect(rules).not.toContain(normalRule);
	});

	it('includes rules with undefined phase as normal', () => {
		const rule1: Rule = {
			id: 'rule-1',
			// phase not specified
			activities: []
		};
		const context = createEmptyContext();
		context.input.rules.standing = [rule1];

		const rules = getRulesForPhase(context, 'normal');

		expect(rules).toContain(rule1);
	});
});

describe('processRulesInOrder', () => {
	it('executes applicable rules', () => {
		const rule: Rule = {
			id: 'rule-1',
			activities: [{ id: 'act-1', type: 'number_set', target: 'test.value', number: 42 }]
		};

		const context = createEmptyContext();
		const rules = [rule];

		processRulesInOrder(rules, context);

		expect(context.workingState.facts['test.value']).toBe(42);
	});

	it('skips rules with failing when conditions', () => {
		const rule: Rule = {
			id: 'rule-1',
			when: [{ fact: 'nonexistent' }],
			activities: [{ id: 'act-1', type: 'number_set', target: 'test.value', number: 42 }]
		};

		const context = createEmptyContext();
		const rules = [rule];

		processRulesInOrder(rules, context);

		expect(context.workingState.facts['test.value']).toBeUndefined();
	});

	it('waits for after dependencies before executing', () => {
		const initRule: Rule = {
			id: 'init-rule',
			group: ['init'],
			activities: [{ id: 'act-1', type: 'number_set', target: 'init.done', number: 1 }]
		};
		const dependentRule: Rule = {
			id: 'dependent-rule',
			after: [{ group: 'init' }],
			activities: [{ id: 'act-2', type: 'number_set', target: 'dependent.done', number: 2 }]
		};

		const context = createEmptyContext();
		context.groups.set('init', {
			name: 'init',
			phase: 'normal',
			ruleIds: ['init-rule'],
			settled: false,
			executedRuleIds: [],
			skippedRuleIds: []
		});

		const rules = [dependentRule, initRule];

		processRulesInOrder(rules, context);

		// Both should execute
		expect(context.workingState.facts['init.done']).toBe(1);
		expect(context.workingState.facts['dependent.done']).toBe(2);
	});

	it('handles empty rules array', () => {
		const context = createEmptyContext();
		const rules: Rule[] = [];

		expect(() => processRulesInOrder(rules, context)).not.toThrow();
	});

	it('executes rules in multiple iterations until all processed', () => {
		// Create a chain: rule1 -> rule2 -> rule3
		const rule1: Rule = {
			id: 'rule-1',
			group: ['g1'],
			activities: [{ id: 'a1', type: 'number_set', target: 'v1', number: 1 }]
		};
		const rule2: Rule = {
			id: 'rule-2',
			after: [{ group: 'g1' }],
			group: ['g2'],
			activities: [{ id: 'a2', type: 'number_set', target: 'v2', number: 2 }]
		};
		const rule3: Rule = {
			id: 'rule-3',
			after: [{ group: 'g2' }],
			activities: [{ id: 'a3', type: 'number_set', target: 'v3', number: 3 }]
		};

		const context = createEmptyContext();
		context.groups.set('g1', {
			name: 'g1',
			phase: 'normal',
			ruleIds: ['rule-1'],
			settled: false,
			executedRuleIds: [],
			skippedRuleIds: []
		});
		context.groups.set('g2', {
			name: 'g2',
			phase: 'normal',
			ruleIds: ['rule-2'],
			settled: false,
			executedRuleIds: [],
			skippedRuleIds: []
		});

		const rules = [rule3, rule2, rule1]; // Reverse order to test dependency resolution

		processRulesInOrder(rules, context);

		expect(context.workingState.facts['v1']).toBe(1);
		expect(context.workingState.facts['v2']).toBe(2);
		expect(context.workingState.facts['v3']).toBe(3);
	});
});

describe('executePhase', () => {
	it('executes rules for the specified phase', () => {
		const rule: Rule = {
			id: 'rule-1',
			phase: 'normal',
			activities: [{ id: 'act-1', type: 'number_set', target: 'test.value', number: 42 }]
		};

		const context = createEmptyContext();
		context.input.rules.standing = [rule];

		executePhase('normal', context);

		expect(context.workingState.facts['test.value']).toBe(42);
	});

	it('sets currentPhase in context', () => {
		const rule: Rule = {
			id: 'rule-1',
			phase: 'early',
			activities: []
		};

		const context = createEmptyContext();
		context.input.rules.standing = [rule];

		executePhase('early', context);

		expect(context.currentPhase).toBe('early');
	});

	it('includes generated rules from earlier phases', () => {
		const generatedRule: Rule = {
			id: 'generated-1',
			phase: 'normal',
			activities: [{ id: 'act-1', type: 'number_set', target: 'generated.value', number: 99 }]
		};

		const context = createEmptyContext();
		context.workingState.generatedRules.normal = [generatedRule];

		executePhase('normal', context);

		expect(context.workingState.facts['generated.value']).toBe(99);
	});
});
