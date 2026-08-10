import type { Verb } from '$lib/rules-view';

export const VERB_ORDER: Verb[] = [
  'ATTACK',
  'AID',
  'CONTROL',
  'DEFEND',
  'MOVE',
  'INSPECT',
  'HANDLE',
  'HEALTH',
  'SAVE',
  'CHECK',
  'REST',
  'NOTE',
  'STAT',
  'PROFICIENCY',
  'PREPARE',
  'EQUIP'
];

export const PLAN_VERBS: Verb[] = [
  'ATTACK',
  'AID',
  'CONTROL',
  'DEFEND',
  'MOVE',
  'INSPECT',
  'HANDLE'
];

export const RECORD_VERBS: Verb[] = ['HEALTH', 'SAVE', 'CHECK', 'REST', 'NOTE'];

export const BUILD_VERBS: Verb[] = ['STAT', 'PROFICIENCY', 'PREPARE', 'EQUIP'];

export function getVerbGroup(verb: Verb): 'plan' | 'record' | 'build' {
  if (RECORD_VERBS.includes(verb)) return 'record';
  if (BUILD_VERBS.includes(verb)) return 'build';
  return 'plan';
}
