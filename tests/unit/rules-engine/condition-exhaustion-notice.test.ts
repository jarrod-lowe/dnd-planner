import { describe, it, expect } from 'vitest';
import { evaluate, endTurn, NOTICE_TARGET } from '$lib/rules-engine';
import type { Facts, PlannedRef } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';
import speciesHuman from '$lib/rules-engine/rules/species-human';
import movement from '$lib/rules-engine/rules/movement';
import conditionExhaustion from '$lib/rules-engine/rules/condition-exhaustion';

/**
 * The Exhaustion notice's interpolated standing effects
 * (docs/plans/ideas/condition-exhaustion.md): the body carries the live level,
 * the −2 × level D20 Test reduction and the −5 × level Speed reduction, and
 * FLIPS to the body-dead variant at the maximum (SRD 5.2: "You die if your
 * Exhaustion level is 6"). The YAML runner's annotation grammar can assert
 * existence/targets but not `values` or which `body` key, so both are pinned
 * here against the module's annotate output, and the body templates are
 * pinned to exactly the {{level}}/{{roll}}/{{speed}} params in both locales
 * (the hold-person double-brace syntax). The keyed-effect count pin lives
 * here too: endTurn's dedupe keeps ONE 'exhaustion' effect (the newest), so
 * the committed counter never grows a stale duplicate.
 */
const CE = 'rule.dnd-5e-2024.condition-exhaustion';
const ALL = [speciesHuman, movement, conditionExhaustion];
const FACTS: Facts = {};
const record = (instanceId: string): PlannedRef => ({ instanceId, ruleId: 'record-exhaustion' });

type GroupNode = Record<string, string | undefined>;
type CategoryNode = Record<string, GroupNode>;

const node = (catalog: unknown, key: string): string | undefined =>
  ((catalog as { rule: Record<string, CategoryNode> }).rule['dnd-5e-2024'] ?? {})[
    'condition-exhaustion'
  ]?.[key];

const noticeOf = (planned: PlannedRef[]) => {
  const out = evaluate({ modules: ALL, inputFacts: FACTS, planned });
  return out.annotations.find((a) => a.key === `${CE}.notice`);
};

describe('condition-exhaustion annotate — notice values and the dead flip', () => {
  it('interpolates the level-1 standing effects', () => {
    const notice = noticeOf([record('c1')])!;
    expect(notice, 'notice exists at level 1').toBeDefined();
    expect(notice.targets).toEqual([NOTICE_TARGET]);
    expect(notice.body, 'the living body below the maximum').toBe(`${CE}.notice.body`);
    expect(notice.values).toEqual({ level: 1, roll: -2, speed: -5 });
  });

  it('interpolates the level-2 standing effects (two same-turn records)', () => {
    const notice = noticeOf([record('c1'), record('c2')])!;
    expect(notice.body).toBe(`${CE}.notice.body`);
    expect(notice.values, 'the counter, not a stack: −2/−5 × the FOLDED level').toEqual({
      level: 2,
      roll: -4,
      speed: -10
    });
  });

  it('flips to the dead body at level 6 and keeps the numbers live', () => {
    const notice = noticeOf([
      record('c1'),
      record('c2'),
      record('c3'),
      record('c4'),
      record('c5'),
      record('c6')
    ])!;
    expect(notice.body, 'the death flag').toBe(`${CE}.notice.body-dead`);
    expect(notice.values).toEqual({ level: 6, roll: -12, speed: -30 });
  });

  it('both body templates interpolate exactly level/roll/speed — in both locales', () => {
    for (const catalog of [enCommon, tlhCommon]) {
      for (const key of ['notice.body', 'notice.body-dead']) {
        const body = node(catalog, key);
        expect(body, `${key} template exists`).toBeDefined();
        // {{param}} double-brace (sveltekit-i18n), and exactly these three.
        expect(body?.match(/{{[a-zA-Z]+}}/g)).toEqual(['{{level}}', '{{roll}}', '{{speed}}']);
      }
    }
  });

  it('endTurn commits ONE keyed level effect — the newest, at the folded level', () => {
    const out = evaluate({
      modules: ALL,
      inputFacts: FACTS,
      planned: [record('c1'), record('c2')]
    });
    const committed = endTurn([], out.effects);
    const levels = committed
      .filter((e) => e.id.includes('effect-exhaustion'))
      .map((e) => e.state?.['condition.exhaustion']);
    expect(levels, 'dedupeByKey keeps a single same-key effect').toEqual([2]);
  });
});
