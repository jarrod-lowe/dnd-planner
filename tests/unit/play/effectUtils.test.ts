import { describe, it, expect } from 'vitest';
import {
	getDurationState,
	getEffectKind,
	isConcentrationEffect,
	getConcentrationEffectName,
	getChipState,
	isHiddenEffect,
	getEffectDisplayValue,
	getEffectLevel,
	getBaseEffectId
} from '$lib/play/effectUtils';
import type { Rule } from '$lib/rules-engine';
import type { Facts } from '$lib/rules-engine';

const concActivity = {
	id: 'conc-dec',
	type: 'numberIncrement' as const,
	target: { fact: 'concentration.remaining' },
	source: { number: 1 },
	subtract: true
};

const selfAdvertiseActivity = {
	id: 'self-adv',
	type: 'advertiseEffect' as const,
	self: true
};

describe('getBaseEffectId', () => {
	it('strips numeric suffix from effect ID', () => {
		expect(getBaseEffectId('effect-steed-3')).toBe('effect-steed');
	});

	it('strips suffix from multi-hyphen effect ID', () => {
		expect(getBaseEffectId('effect-steed-hp-damage-12')).toBe('effect-steed-hp-damage');
	});

	it('returns unchanged ID when no numeric suffix', () => {
		expect(getBaseEffectId('effect-bless')).toBe('effect-bless');
	});

	it('handles ID with only a counter suffix', () => {
		expect(getBaseEffectId('foo-0')).toBe('foo');
	});
});

describe('getDurationState', () => {
	it('returns null for rules without ui', () => {
		const rule: Rule = { id: 'test', activities: [] };
		expect(getDurationState(rule)).toBeNull();
	});

	it('returns null for rules without countDown/duration', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { section: 'ongoing', name: 'test.name' }
		};
		expect(getDurationState(rule)).toBeNull();
	});

	it('returns duration state for timed effects', () => {
		const rule: Rule = {
			id: 'effect-bless',
			activities: [],
			ui: { countDown: 10, duration: 10 }
		};
		const state = getDurationState(rule);
		expect(state).toEqual({ remaining: 10, total: 10, nearExpiry: false });
	});

	it('detects near-expiry when countDown is 1', () => {
		const rule: Rule = {
			id: 'effect-bless',
			activities: [],
			ui: { countDown: 1, duration: 10 }
		};
		const state = getDurationState(rule);
		expect(state).toEqual({ remaining: 1, total: 10, nearExpiry: true });
	});

	it('returns null when only countDown is present', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { countDown: 5 }
		};
		expect(getDurationState(rule)).toBeNull();
	});

	it('returns null when only duration is present', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { duration: 10 }
		};
		expect(getDurationState(rule)).toBeNull();
	});
});

describe('getEffectKind', () => {
	it('returns SENSE for section senses', () => {
		const rule: Rule = {
			id: 'effect-divine-sense',
			activities: [],
			ui: { section: 'senses', name: 'test.name' }
		};
		expect(getEffectKind(rule)).toBe('SENSE');
	});

	it('returns ITEM for section configuration', () => {
		const rule: Rule = {
			id: 'effect-shield',
			activities: [],
			ui: { section: 'configuration', name: 'test.name' }
		};
		expect(getEffectKind(rule)).toBe('ITEM');
	});

	it('returns CONC for effect with concentration activity', () => {
		const rule: Rule = {
			id: 'effect-bless',
			activities: [concActivity],
			ui: { section: 'ongoing', name: 'test.name' }
		};
		expect(getEffectKind(rule)).toBe('CONC');
	});

	it('returns ONGOING for section ongoing without concentration', () => {
		const rule: Rule = {
			id: 'effect-divine-favour',
			activities: [selfAdvertiseActivity],
			ui: { section: 'ongoing', name: 'test.name' }
		};
		expect(getEffectKind(rule)).toBe('ONGOING');
	});

	it('returns ONGOING as default for unknown section', () => {
		const rule: Rule = {
			id: 'effect-unknown',
			activities: [],
			ui: { section: 'other', name: 'test.name' }
		};
		expect(getEffectKind(rule)).toBe('ONGOING');
	});

	it('returns ONGOING for rule without ui', () => {
		const rule: Rule = { id: 'test', activities: [] };
		expect(getEffectKind(rule)).toBe('ONGOING');
	});

	it('returns BUILD for rule with Stats group', () => {
		const rule: Rule = { id: 'effect-strength', activities: [], group: ['str-values', 'Stats'] };
		expect(getEffectKind(rule)).toBe('BUILD');
	});

	it('returns BUILD for rule with Proficiency group', () => {
		const rule: Rule = {
			id: 'effect-str-save-proficiency',
			activities: [],
			group: ['Proficiency']
		};
		expect(getEffectKind(rule)).toBe('BUILD');
	});

	it('returns BUILD for rule with only Stats group', () => {
		const rule: Rule = { id: 'effect-increase-str', activities: [], group: ['Stats'] };
		expect(getEffectKind(rule)).toBe('BUILD');
	});

	it('CONC takes priority over BUILD', () => {
		const rule: Rule = {
			id: 'effect-conc-stat',
			activities: [concActivity],
			group: ['Stats']
		};
		expect(getEffectKind(rule)).toBe('CONC');
	});

	it('returns CONC for nested concentration in generateRule', () => {
		const rule: Rule = {
			id: 'effect-complex',
			activities: [
				{
					id: 'gen-rule',
					type: 'generateRule',
					rule: {
						id: 'nested-rule',
						activities: [concActivity]
					}
				}
			],
			ui: { section: 'ongoing', name: 'test.name' }
		};
		expect(getEffectKind(rule)).toBe('CONC');
	});
});

describe('isConcentrationEffect', () => {
	it('returns true when activity decrements concentration.remaining', () => {
		const rule: Rule = {
			id: 'effect-bless',
			activities: [concActivity]
		};
		expect(isConcentrationEffect(rule)).toBe(true);
	});

	it('returns false for non-concentration effects', () => {
		const rule: Rule = {
			id: 'effect-divine-sense',
			activities: [selfAdvertiseActivity]
		};
		expect(isConcentrationEffect(rule)).toBe(false);
	});

	it('returns false for rule with no activities', () => {
		const rule: Rule = { id: 'test', activities: [] };
		expect(isConcentrationEffect(rule)).toBe(false);
	});
});

describe('getConcentrationEffectName', () => {
	it('returns i18n key of the concentration effect', () => {
		const effects: Rule[] = [
			{
				id: 'effect-divine-sense',
				activities: [],
				ui: { section: 'senses', name: 'test.sense' }
			},
			{
				id: 'effect-bless',
				activities: [concActivity],
				ui: { section: 'ongoing', name: 'test.bless' }
			}
		];
		expect(getConcentrationEffectName(effects)).toBe('test.bless');
	});

	it('returns null when no concentration effect exists', () => {
		const effects: Rule[] = [
			{
				id: 'effect-divine-sense',
				activities: [],
				ui: { section: 'senses', name: 'test.sense' }
			}
		];
		expect(getConcentrationEffectName(effects)).toBeNull();
	});

	it('returns null for empty effects array', () => {
		expect(getConcentrationEffectName([])).toBeNull();
	});
});

describe('getChipState', () => {
	it('returns expiring when nearExpiry is true', () => {
		const rule: Rule = {
			id: 'effect-bless',
			activities: [concActivity],
			ui: { countDown: 1, duration: 10, section: 'ongoing', name: 'test' }
		};
		const facts: Facts = {};
		expect(getChipState(rule, facts)).toBe('expiring');
	});

	it('returns pending when concentration effect and damage taken', () => {
		const rule: Rule = {
			id: 'effect-bless',
			activities: [concActivity],
			ui: { countDown: 8, duration: 10, section: 'ongoing', name: 'test' }
		};
		const facts: Facts = { 'concentration.damage-taken': 1 };
		expect(getChipState(rule, facts)).toBe('pending');
	});

	it('returns rest for normal ongoing effect', () => {
		const rule: Rule = {
			id: 'effect-divine-sense',
			activities: [],
			ui: { section: 'senses', name: 'test' }
		};
		const facts: Facts = {};
		expect(getChipState(rule, facts)).toBe('rest');
	});

	it('returns rest for concentration effect without damage', () => {
		const rule: Rule = {
			id: 'effect-bless',
			activities: [concActivity],
			ui: { countDown: 8, duration: 10, section: 'ongoing', name: 'test' }
		};
		const facts: Facts = {};
		expect(getChipState(rule, facts)).toBe('rest');
	});

	it('prefers expiring over pending when both conditions are true', () => {
		const rule: Rule = {
			id: 'effect-bless',
			activities: [concActivity],
			ui: { countDown: 1, duration: 10, section: 'ongoing', name: 'test' }
		};
		const facts: Facts = { 'concentration.damage-taken': 1 };
		expect(getChipState(rule, facts)).toBe('expiring');
	});
});

describe('isHiddenEffect', () => {
	it('returns false for rule without ui', () => {
		const rule: Rule = { id: 'test', activities: [] };
		expect(isHiddenEffect(rule)).toBe(false);
	});

	it('returns false when ui has no hidden field', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { section: 'ongoing', name: 'test.name' }
		};
		expect(isHiddenEffect(rule)).toBe(false);
	});

	it('returns false when hidden is false', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { hidden: false, name: 'test.name' }
		};
		expect(isHiddenEffect(rule)).toBe(false);
	});

	it('returns true when hidden is true', () => {
		const rule: Rule = {
			id: 'effect-strength',
			activities: [],
			ui: { hidden: true, name: 'test.strength' }
		};
		expect(isHiddenEffect(rule)).toBe(true);
	});

	it('returns false when hidden is a non-boolean truthy value', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { hidden: 'true', name: 'test.name' }
		};
		expect(isHiddenEffect(rule)).toBe(false);
	});
});

describe('getEffectDisplayValue', () => {
	it('returns null for rule without ui', () => {
		const rule: Rule = { id: 'test', activities: [] };
		expect(getEffectDisplayValue(rule, {})).toBeNull();
	});

	it('returns null for rule without displayFact', () => {
		const rule: Rule = { id: 'test', activities: [], ui: { name: 'test.name' } };
		expect(getEffectDisplayValue(rule, {})).toBeNull();
	});

	it('returns null when the fact is undefined', () => {
		const rule: Rule = {
			id: 'effect-str',
			activities: [],
			ui: { displayFact: 'str.value', name: 'test.name' }
		};
		expect(getEffectDisplayValue(rule, {})).toBeNull();
	});

	it('returns stringified fact value when displayFact is set and fact exists', () => {
		const rule: Rule = {
			id: 'effect-str',
			activities: [],
			ui: { displayFact: 'str.value', name: 'test.name' }
		};
		expect(getEffectDisplayValue(rule, { 'str.value': 16 })).toBe('16');
	});

	it('returns stringified selection value when displaySelection is set and selection exists', () => {
		const rule: Rule = {
			id: 'effect-damage',
			activities: [],
			ui: { displaySelection: 'amount', name: 'test.name' },
			selections: { amount: 5 }
		};
		expect(getEffectDisplayValue(rule, {})).toBe('5');
	});

	it('prefers displayFact over displaySelection when both are set', () => {
		const rule: Rule = {
			id: 'effect-test',
			activities: [],
			ui: { displayFact: 'str.value', displaySelection: 'amount', name: 'test.name' },
			selections: { amount: 5 }
		};
		expect(getEffectDisplayValue(rule, { 'str.value': 16 })).toBe('16');
	});

	it('returns null when displaySelection is set but selection is undefined', () => {
		const rule: Rule = {
			id: 'effect-damage',
			activities: [],
			ui: { displaySelection: 'amount', name: 'test.name' },
			selections: {}
		};
		expect(getEffectDisplayValue(rule, {})).toBeNull();
	});
});

describe('getEffectLevel', () => {
	it('returns null for rule without ui', () => {
		const rule: Rule = { id: 'test', activities: [] };
		expect(getEffectLevel(rule, {})).toBeNull();
	});

	it('returns null for rule without levelFact', () => {
		const rule: Rule = { id: 'test', activities: [], ui: { name: 'test.name' } };
		expect(getEffectLevel(rule, {})).toBeNull();
	});

	it('returns null when the fact is undefined', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { levelFact: 'skill.athletics.proficiency', name: 'test.name' }
		};
		expect(getEffectLevel(rule, {})).toBeNull();
	});

	it('returns 1 for single proficiency', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { levelFact: 'skill.athletics.proficiency', name: 'test.name' }
		};
		expect(getEffectLevel(rule, { 'skill.athletics.proficiency': 1 })).toBe(1);
	});

	it('returns 2 for expertise', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { levelFact: 'skill.athletics.proficiency', name: 'test.name' }
		};
		expect(getEffectLevel(rule, { 'skill.athletics.proficiency': 2 })).toBe(2);
	});

	it('returns 0.5 for half-proficiency', () => {
		const rule: Rule = {
			id: 'test',
			activities: [],
			ui: { levelFact: 'skill.athletics.proficiency', name: 'test.name' }
		};
		expect(getEffectLevel(rule, { 'skill.athletics.proficiency': 0.5 })).toBe(0.5);
	});
});
