import { describe, it, expect } from 'vitest';
import type { Facts } from '$lib/rules-view';
import type { EffectInstance } from '$lib/rules-engine';

/** An end-of-turn action spend (what attack/heal/etc. advertise). */
function endOfTurnEffect(id: string, state?: Record<string, number>): EffectInstance {
	const base: EffectInstance = { id, expiry: { kind: 'endOfTurn' } };
	return state === undefined ? base : { ...base, state };
}

/** A long-rest-scoped spend (not currently used by actions, but the filter supports it). */
function longRestEffect(id: string, state: Record<string, number>): EffectInstance {
	return { id, state, expiry: { kind: 'untilLongRest' } };
}

/** The rest flag effects — same shape as slotLevels tests. */
function restFlag(fact: 'rest.long' | 'rest.short'): EffectInstance {
	return { id: 'rest', state: { [fact]: 1 }, expiry: { kind: 'endOfTurn' } };
}

describe('deriveActionPools', () => {
	it('returns an empty array when there are no pool facts at all', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = { 'hp.max': 35, 'hp.current': 28 };
		expect(deriveActionPools(facts, [])).toEqual([]);
	});

	it('reports three default pools with nothing spent', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = {
			'actions.max': 1,
			'bonusActions.max': 1,
			'reactions.max': 1
		};
		const result = deriveActionPools(facts, []);
		expect(result).toEqual([
			{ key: 'actions', total: 1, open: 1, thisTurn: 0, spent: 0 },
			{ key: 'bonusActions', total: 1, open: 1, thisTurn: 0, spent: 0 },
			{ key: 'reactions', total: 1, open: 1, thisTurn: 0, spent: 0 }
		]);
	});

	it('counts one action spent by an advertised effect as this turn', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = {
			'actions.max': 1,
			'actions.spent': 1, // Projected total (prior turns + this turn)
			'bonusActions.max': 1,
			'reactions.max': 1
		};
		const advertised = [endOfTurnEffect('attack', { 'actions.spent': 1 })];
		const result = deriveActionPools(facts, advertised);
		expect(result).toEqual([
			{ key: 'actions', total: 1, open: 0, thisTurn: 1, spent: 1 },
			{ key: 'bonusActions', total: 1, open: 1, thisTurn: 0, spent: 0 },
			{ key: 'reactions', total: 1, open: 1, thisTurn: 0, spent: 0 }
		]);
	});

	it('counts a committed-only spend as spent but not as this turn', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = {
			'actions.max': 1,
			'actions.spent': 1,
			'bonusActions.max': 1,
			'reactions.max': 1
		};
		const result = deriveActionPools(facts, []);
		expect(result).toEqual([
			{ key: 'actions', total: 1, open: 0, thisTurn: 0, spent: 1 },
			{ key: 'bonusActions', total: 1, open: 1, thisTurn: 0, spent: 0 },
			{ key: 'reactions', total: 1, open: 1, thisTurn: 0, spent: 0 }
		]);
	});

	it('reports a negative open for an over-budget plan (deliberate — do not clamp)', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = {
			'actions.max': 1,
			'actions.spent': 3, // Projected total: 1 (committed) + 2 (this turn)
			'bonusActions.max': 1,
			'reactions.max': 1
		};
		const advertised = [
			endOfTurnEffect('attack-1', { 'actions.spent': 1 }),
			endOfTurnEffect('attack-2', { 'actions.spent': 1 })
		];
		const result = deriveActionPools(facts, advertised);
		expect(result).toEqual([
			{ key: 'actions', total: 1, open: -2, thisTurn: 2, spent: 3 },
			{ key: 'bonusActions', total: 1, open: 1, thisTurn: 0, spent: 0 },
			{ key: 'reactions', total: 1, open: 1, thisTurn: 0, spent: 0 }
		]);
	});

	it('reads prefixed facts for companion steed pools', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = {
			'companion.steed.actions.max': 1,
			'companion.steed.actions.spent': 0,
			'companion.steed.bonusActions.max': 1,
			'companion.steed.bonusActions.spent': 0
		};
		const result = deriveActionPools(facts, [], 'companion.steed.', ['actions', 'bonusActions']);
		expect(result).toEqual([
			{ key: 'actions', total: 1, open: 1, thisTurn: 0, spent: 0 },
			{ key: 'bonusActions', total: 1, open: 1, thisTurn: 0, spent: 0 }
		]);
	});

	it('filters out a pool whose max is 0 or absent', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = {
			'actions.max': 1,
			'bonusActions.max': 0,
			// reactions.max absent
			'remaining.max': 1
		};
		const result = deriveActionPools(facts, []);
		expect(result).toEqual([
			{ key: 'actions', total: 1, open: 1, thisTurn: 0, spent: 0 }
		]);
	});

	it('ignores effects with no matching state key', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = {
			'actions.max': 1,
			'bonusActions.max': 1,
			'reactions.max': 1
		};
		const advertised = [
			endOfTurnEffect('stateless'),
			endOfTurnEffect('unrelated', { 'hp.current': -3, 'divinity.spent': 1 }),
			endOfTurnEffect('other-pool-shaped', { 'actions.max': 1 })
		];
		const result = deriveActionPools(facts, advertised);
		expect(result).toEqual([
			{ key: 'actions', total: 1, open: 1, thisTurn: 0, spent: 0 },
			{ key: 'bonusActions', total: 1, open: 1, thisTurn: 0, spent: 0 },
			{ key: 'reactions', total: 1, open: 1, thisTurn: 0, spent: 0 }
		]);
	});

	it('does NOT count an untilLongRest spend when rest.long is recorded', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = {
			'actions.max': 1,
			'actions.spent': 0,
			'rest.long': 1
		};
		const advertised = [
			longRestEffect('some-long-rest-action', { 'actions.spent': 1 }),
			restFlag('rest.long')
		];
		const result = deriveActionPools(facts, advertised);
		expect(result).toEqual([
			{ key: 'actions', total: 1, open: 1, thisTurn: 0, spent: 0 }
		]);
	});

	it('DOES count an endOfTurn spend even when rest.long is recorded', async () => {
		const { deriveActionPools } = await import('$lib/play/actionPools');
		const facts: Facts = {
			'actions.max': 1,
			'actions.spent': 1, // endOfTurn spends are NOT restored by rest
			'rest.long': 1
		};
		const advertised = [
			endOfTurnEffect('attack', { 'actions.spent': 1 }),
			restFlag('rest.long')
		];
		const result = deriveActionPools(facts, advertised);
		expect(result).toEqual([
			{ key: 'actions', total: 1, open: 0, thisTurn: 1, spent: 1 }
		]);
	});
});
