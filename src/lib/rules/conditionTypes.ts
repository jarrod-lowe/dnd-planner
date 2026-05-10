import type { ComparisonOperator } from '$lib/rules-engine/types';

export interface FactCondition {
  fact: string;
  operator: ComparisonOperator;
  value: number;
}

export interface OrCondition {
  type: 'or';
  clauses: RuleGroupCondition[];
}

export type RuleGroupCondition = FactCondition | OrCondition;
