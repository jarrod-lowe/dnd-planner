import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '$lib/play/panelCondition';
import type { Condition, Facts } from '$lib/rules-engine/types';

describe('evaluateCondition', () => {
  describe('FactExistenceCondition', () => {
    it('returns true when fact exists with truthy value', () => {
      const condition: Condition = { fact: 'hp.current' };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns false when fact does not exist', () => {
      const condition: Condition = { fact: 'hp.current' };
      const facts: Facts = {};
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });

    it('returns false when fact value is 0', () => {
      const condition: Condition = { fact: 'hp.current' };
      const facts: Facts = { 'hp.current': 0 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });
  });

  describe('FactComparisonCondition', () => {
    it('returns true when equals comparison matches', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'equals',
        value: 10
      };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns false when equals comparison does not match', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'equals',
        value: 10
      };
      const facts: Facts = { 'hp.current': 5 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });

    it('returns true when greaterThan comparison matches', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'greaterThan',
        value: 0
      };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns true when lessThan comparison matches', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'lessThan',
        value: 20
      };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns true when notEquals comparison matches', () => {
      const condition: Condition = {
        fact: 'hp.current',
        operator: 'notEquals',
        value: 0
      };
      const facts: Facts = { 'hp.current': 10 };
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });
  });

  describe('FactComparisonCondition with missing facts', () => {
    it('returns true when equals 0 and fact is absent', () => {
      const condition: Condition = {
        fact: 'str.value',
        operator: 'equals',
        value: 0
      };
      const facts: Facts = {};
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns false when equals 10 and fact is absent', () => {
      const condition: Condition = {
        fact: 'str.value',
        operator: 'equals',
        value: 10
      };
      const facts: Facts = {};
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });

    it('returns false when greaterThan 0 and fact is absent', () => {
      const condition: Condition = {
        fact: 'str.value',
        operator: 'greaterThan',
        value: 0
      };
      const facts: Facts = {};
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });

    it('returns false when notEquals 0 and fact is absent', () => {
      const condition: Condition = {
        fact: 'str.value',
        operator: 'notEquals',
        value: 0
      };
      const facts: Facts = {};
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });
  });

  describe('EventCondition', () => {
    it('returns true when event was emitted', () => {
      const condition: Condition = { event: 'attack' };
      const facts: Facts = {};
      const events = new Set<string>(['attack']);

      expect(evaluateCondition(condition, facts, events)).toBe(true);
    });

    it('returns false when event was not emitted', () => {
      const condition: Condition = { event: 'attack' };
      const facts: Facts = {};
      const events = new Set<string>(['defend']);

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });

    it('returns false when no events emitted', () => {
      const condition: Condition = { event: 'attack' };
      const facts: Facts = {};
      const events = new Set<string>();

      expect(evaluateCondition(condition, facts, events)).toBe(false);
    });
  });
});
