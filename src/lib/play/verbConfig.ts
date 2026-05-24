import type { Verb } from '$lib/rules-engine';

export const VERB_ORDER: Verb[] = [
  'ATTACK',
  'AID',
  'CONTROL',
  'DEFEND',
  'MOVE',
  'INSPECT',
  'HANDLE',
  'DAMAGE',
  'HEAL',
  'SAVE',
  'CHECK',
  'REST',
  'NOTE',
  'STAT',
  'PROFICIENCY'
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

export const RECORD_VERBS: Verb[] = ['DAMAGE', 'HEAL', 'SAVE', 'CHECK', 'REST', 'NOTE'];

export const BUILD_VERBS: Verb[] = ['STAT', 'PROFICIENCY'];

export const VERB_STRIPE_COLORS: Record<Verb, string> = {
  ATTACK: 'var(--md-sys-color-primary)',
  AID: 'var(--md-sys-color-secondary)',
  CONTROL: 'var(--md-sys-color-tertiary)',
  DEFEND: 'var(--md-sys-color-outline)',
  MOVE: 'var(--md-sys-color-primary-fixed-dim)',
  INSPECT: 'var(--md-sys-color-secondary-fixed-dim)',
  HANDLE: 'var(--md-sys-color-tertiary-fixed-dim)',
  DAMAGE: 'var(--md-sys-color-error)',
  HEAL: 'var(--md-sys-color-primary)',
  SAVE: 'var(--md-sys-color-secondary)',
  CHECK: 'var(--md-sys-color-tertiary)',
  REST: 'var(--md-sys-color-on-surface-variant)',
  NOTE: 'var(--md-sys-color-on-surface-variant)',
  STAT: 'var(--md-sys-color-on-surface-variant)',
  PROFICIENCY: 'var(--md-sys-color-on-surface-variant)'
};

export function isBuildVerb(verb: Verb): boolean {
  return BUILD_VERBS.includes(verb);
}

export function getVerbGroup(verb: Verb): 'plan' | 'record' | 'build' {
  if (RECORD_VERBS.includes(verb)) return 'record';
  if (BUILD_VERBS.includes(verb)) return 'build';
  return 'plan';
}
