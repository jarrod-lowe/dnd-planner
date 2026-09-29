import type { Verb } from '$lib/rules-view';

export const VERB_ORDER: Verb[] = [
  'ATTACK',
  'AID',
  'CONTROL',
  'DEFEND',
  'MOVE',
  'INSPECT',
  'HANDLE',
  'REACT',
  'HEALTH',
  'SAVE',
  'CHECK',
  'REST',
  'NOTE',
  'CONDITION',
  'STAT',
  'PROFICIENCY',
  'PREPARE',
  'EQUIP'
];

/**
 * Pinned sub-bucket display order for verbs whose buckets are a curated
 * taxonomy rather than an open set — CONDITION's five functional buckets
 * (tests/unit/play/condition-verb-buckets.test.ts). Verbs absent here (and
 * buckets not named within a pinned verb) keep first-encounter order, which
 * follows module registration.
 */
export const SUB_BUCKET_ORDER: Partial<Record<Verb, string[]>> = {
  CONDITION: ['senses', 'held', 'helpless', 'compelled', 'weakened']
};

export const PLAN_VERBS: Verb[] = [
  'ATTACK',
  'AID',
  'CONTROL',
  'DEFEND',
  'MOVE',
  'INSPECT',
  'HANDLE',
  'REACT'
];

export const RECORD_VERBS: Verb[] = ['HEALTH', 'SAVE', 'CHECK', 'REST', 'NOTE', 'CONDITION'];

export const BUILD_VERBS: Verb[] = ['STAT', 'PROFICIENCY', 'PREPARE', 'EQUIP'];

export function getVerbGroup(verb: Verb): 'plan' | 'record' | 'build' {
  if (RECORD_VERBS.includes(verb)) return 'record';
  if (BUILD_VERBS.includes(verb)) return 'build';
  return 'plan';
}
