import { describe, it, expect } from 'vitest';
import {
	executeNumberSet,
	executeNumberIncrement,
	executeNumberCopy,
	executeNumberSum,
	executeNumberFunction,
	executeEmitEvent,
	executeGenerateRule
} from '$lib/rules-engine/activities';
import type {
	WorkingState,
	NumberSetActivity,
	NumberIncrementActivity,
	NumberCopyActivity,
	NumberSumActivity,
	NumberFunctionActivity,
	EmitEventActivity,
	GenerateRuleActivity,
	RuleContext,
	Rule
} from '$lib/rules-engine/types';

function createEmptyState(): WorkingState {
	return {
		facts: {},
		events: new Set(),
		generatedRules: { early: [], normal: [], safeguard: [] },
		offeredRules: [],
		appliedRuleIds: [],
		appliedActivityIds: []
	};
}

describe('executeNumberSet', () => {
	it('sets a fact to a number value', () => {
		const activity: NumberSetActivity = {
			id: 'test-1',
			type: 'number_set',
			target: 'hp.current',
			number: 42
		};

		const state = createEmptyState();

		executeNumberSet(activity, state);

		expect(state.facts['hp.current']).toBe(42);
	});

	it('overwrites an existing value', () => {
		const activity: NumberSetActivity = {
			id: 'test-1',
			type: 'number_set',
			target: 'hp.current',
			number: 100
		};

		const state = createEmptyState();
		state.facts['hp.current'] = 50;

		executeNumberSet(activity, state);

		expect(state.facts['hp.current']).toBe(100);
	});
});

describe('executeNumberIncrement', () => {
	it('increments an existing fact by a positive number', () => {
		const activity: NumberIncrementActivity = {
			id: 'test-1',
			type: 'number_increment',
			target: 'hp.current',
			number: 5
		};

		const state = createEmptyState();
		state.facts['hp.current'] = 10;

		executeNumberIncrement(activity, state);

		expect(state.facts['hp.current']).toBe(15);
	});

	it('treats missing fact as 0 before incrementing', () => {
		const activity: NumberIncrementActivity = {
			id: 'test-1',
			type: 'number_increment',
			target: 'hp.current',
			number: 5
		};

		const state = createEmptyState();

		executeNumberIncrement(activity, state);

		expect(state.facts['hp.current']).toBe(5);
	});

	it('decrements with a negative number', () => {
		const activity: NumberIncrementActivity = {
			id: 'test-1',
			type: 'number_increment',
			target: 'hp.current',
			number: -3
		};

		const state = createEmptyState();
		state.facts['hp.current'] = 10;

		executeNumberIncrement(activity, state);

		expect(state.facts['hp.current']).toBe(7);
	});

	it('caps result at max value when max is specified', () => {
		const activity: NumberIncrementActivity = {
			id: 'test-1',
			type: 'number_increment',
			target: 'hp.current',
			number: 10,
			max: 'hp.max'
		};

		const state = createEmptyState();
		state.facts['hp.current'] = 5;
		state.facts['hp.max'] = 12;

		executeNumberIncrement(activity, state);

		expect(state.facts['hp.current']).toBe(12);
	});
});

describe('executeNumberCopy', () => {
	it('copies a value from source to target', () => {
		const activity: NumberCopyActivity = {
			id: 'test-1',
			type: 'number_copy',
			target: 'hp.temp',
			source: 'hp.current'
		};

		const state = createEmptyState();
		state.facts['hp.current'] = 25;

		executeNumberCopy(activity, state);

		expect(state.facts['hp.temp']).toBe(25);
	});
});

describe('executeNumberSum', () => {
	it('sums multiple facts into target', () => {
		const activity: NumberSumActivity = {
			id: 'test-1',
			type: 'number_sum',
			target: 'hp.max',
			args: ['hp.base', 'hp.bonus']
		};

		const state = createEmptyState();
		state.facts['hp.base'] = 10;
		state.facts['hp.bonus'] = 3;

		executeNumberSum(activity, state);

		expect(state.facts['hp.max']).toBe(13);
	});

	it('treats missing facts as 0', () => {
		const activity: NumberSumActivity = {
			id: 'test-1',
			type: 'number_sum',
			target: 'hp.max',
			args: ['hp.base', 'hp.bonus']
		};

		const state = createEmptyState();
		state.facts['hp.base'] = 10;
		// hp.bonus is missing

		executeNumberSum(activity, state);

		expect(state.facts['hp.max']).toBe(10);
	});
});

describe('executeNumberFunction', () => {
	it('calls statToModifier and stores result in target', () => {
		const activity: NumberFunctionActivity = {
			id: 'test-1',
			type: 'number_function',
			target: 'str.modifier',
			function: 'statToModifier',
			args: ['str.value']
		};

		const state = createEmptyState();
		state.facts['str.value'] = 18;

		executeNumberFunction(activity, state);

		expect(state.facts['str.modifier']).toBe(4);
	});
});

describe('executeEmitEvent', () => {
	it('adds event to state events set', () => {
		const activity: EmitEventActivity = {
			id: 'test-1',
			type: 'emit_event',
			event: 'attack'
		};

		const state = createEmptyState();

		executeEmitEvent(activity, state);

		expect(state.events.has('attack')).toBe(true);
	});

	it('can add multiple different events', () => {
		const activity1: EmitEventActivity = {
			id: 'test-1',
			type: 'emit_event',
			event: 'attack'
		};
		const activity2: EmitEventActivity = {
			id: 'test-2',
			type: 'emit_event',
			event: 'damage'
		};

		const state = createEmptyState();

		executeEmitEvent(activity1, state);
		executeEmitEvent(activity2, state);

		expect(state.events.has('attack')).toBe(true);
		expect(state.events.has('damage')).toBe(true);
		expect(state.events.size).toBe(2);
	});
});

function createEmptyContext(phase: 'early' | 'normal' | 'safeguard' = 'normal'): RuleContext {
	return {
		input: {} as never,
		workingState: createEmptyState(),
		groups: new Map(),
		currentPhase: phase,
		allRules: []
	};
}

describe('executeGenerateRule', () => {
	it('adds generated rule to the appropriate phase array', () => {
		const generatedRule: Rule = {
			id: 'generated-1',
			phase: 'safeguard',
			activities: []
		};

		const activity: GenerateRuleActivity = {
			id: 'test-1',
			type: 'generate_rule',
			rule: generatedRule
		};

		const context = createEmptyContext('normal');

		executeGenerateRule(activity, context);

		expect(context.workingState.generatedRules.safeguard).toContain(generatedRule);
	});

	it('defaults phase to normal when not specified', () => {
		const generatedRule: Rule = {
			id: 'generated-1',
			// phase not specified
			activities: []
		};

		const activity: GenerateRuleActivity = {
			id: 'test-1',
			type: 'generate_rule',
			rule: generatedRule
		};

		const context = createEmptyContext('early');

		executeGenerateRule(activity, context);

		expect(context.workingState.generatedRules.normal).toContain(generatedRule);
	});

	it('can add to normal phase from early', () => {
		const generatedRule: Rule = {
			id: 'generated-1',
			phase: 'normal',
			activities: []
		};

		const activity: GenerateRuleActivity = {
			id: 'test-1',
			type: 'generate_rule',
			rule: generatedRule
		};

		const context = createEmptyContext('early');

		executeGenerateRule(activity, context);

		expect(context.workingState.generatedRules.normal).toContain(generatedRule);
	});

	it('can add to safeguard phase from normal', () => {
		const generatedRule: Rule = {
			id: 'generated-1',
			phase: 'safeguard',
			activities: []
		};

		const activity: GenerateRuleActivity = {
			id: 'test-1',
			type: 'generate_rule',
			rule: generatedRule
		};

		const context = createEmptyContext('normal');

		executeGenerateRule(activity, context);

		expect(context.workingState.generatedRules.safeguard).toContain(generatedRule);
	});

	it('throws when safeguard phase tries to generate any rule', () => {
		const generatedRule: Rule = {
			id: 'generated-1',
			phase: 'safeguard',
			activities: []
		};

		const activity: GenerateRuleActivity = {
			id: 'test-1',
			type: 'generate_rule',
			rule: generatedRule
		};

		const context = createEmptyContext('safeguard');

		expect(() => executeGenerateRule(activity, context)).toThrow(
			'Cannot generate rule for earlier or same phase'
		);
	});

	it('throws when normal phase tries to generate early rule', () => {
		const generatedRule: Rule = {
			id: 'generated-1',
			phase: 'early',
			activities: []
		};

		const activity: GenerateRuleActivity = {
			id: 'test-1',
			type: 'generate_rule',
			rule: generatedRule
		};

		const context = createEmptyContext('normal');

		expect(() => executeGenerateRule(activity, context)).toThrow(
			'Cannot generate rule for earlier or same phase'
		);
	});

	it('throws when normal phase tries to generate normal rule', () => {
		const generatedRule: Rule = {
			id: 'generated-1',
			phase: 'normal',
			activities: []
		};

		const activity: GenerateRuleActivity = {
			id: 'test-1',
			type: 'generate_rule',
			rule: generatedRule
		};

		const context = createEmptyContext('normal');

		expect(() => executeGenerateRule(activity, context)).toThrow(
			'Cannot generate rule for earlier or same phase'
		);
	});

	it('throws when early phase tries to generate early rule', () => {
		const generatedRule: Rule = {
			id: 'generated-1',
			phase: 'early',
			activities: []
		};

		const activity: GenerateRuleActivity = {
			id: 'test-1',
			type: 'generate_rule',
			rule: generatedRule
		};

		const context = createEmptyContext('early');

		expect(() => executeGenerateRule(activity, context)).toThrow(
			'Cannot generate rule for earlier or same phase'
		);
	});
});
