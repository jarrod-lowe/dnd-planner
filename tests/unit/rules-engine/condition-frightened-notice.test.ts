import { describe, it, expect } from 'vitest';
import { evaluate, evaluateOffers, NOTICE_TARGET } from '$lib/rules-engine';
import type { Facts, PlannedRef } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';
import conditionFrightened from '$lib/rules-engine/rules/condition-frightened';

/**
 * The Frightened notice's STATE FLIP (docs/plans/ideas/condition-frightened.md):
 * one standing notice while condition.frightened > 0 whose body key AND
 * addsToPlan action both flip on the line-of-sight toggle — the notice IS the
 * toggle's home, its button the tap target (the first notice-bearing
 * addsToPlan in the repo). The YAML grammar can assert existence/targets only,
 * so the bodies, the labelKeys and the offer ids are pinned here against the
 * module's annotate output, and the body templates + both button accessible
 * names are pinned present in BOTH locales (labelKey is the a11y contract: a
 * screen reader must announce WHICH WAY the control toggles).
 */
const CF = 'rule.dnd-5e-2024.condition-frightened';
const ALL = [conditionFrightened];
const FACTS: Facts = {};

const ref = (instanceId: string, ruleId: string): PlannedRef => ({ instanceId, ruleId });

const record = ref('c1', 'record-frightened');
const hide = ref('c2', 'source-out-of-sight');
const reveal = ref('c3', 'source-back-in-sight');

const noticeOf = (planned: PlannedRef[]) => {
  const out = evaluate({ modules: ALL, inputFacts: FACTS, planned });
  return out.annotations.find((a) => a.key === `${CF}.notice`);
};

type GroupNode = Record<string, string | undefined>;
type CategoryNode = Record<string, GroupNode>;

const node = (catalog: unknown, key: string): string | undefined =>
  ((catalog as { rule: Record<string, CategoryNode> }).rule['dnd-5e-2024'] ?? {})[
    'condition-frightened'
  ]?.[key];

describe('condition-frightened annotate — the notice flips with the LoS toggle', () => {
  it('visible: the standing body names the source-out-of-sight action', () => {
    const notice = noticeOf([record])!;
    expect(notice, 'notice exists while frightened').toBeDefined();
    expect(notice.targets).toEqual([NOTICE_TARGET]);
    expect(notice.source).toBe(`${CF}.effect-frightened.name`);
    expect(notice.body).toBe(`${CF}.notice.body`);
    expect(notice.addsToPlan).toEqual({
      offer: 'source-out-of-sight',
      labelKey: `${CF}.notice.action-hide`
    });
  });

  it('hidden: the body and the button flip to the reveal side', () => {
    const notice = noticeOf([record, hide])!;
    expect(notice, "the notice stands on the can't-approach channel").toBeDefined();
    expect(notice.body).toBe(`${CF}.notice.body-hidden`);
    expect(notice.addsToPlan).toEqual({
      offer: 'source-back-in-sight',
      labelKey: `${CF}.notice.action-reveal`
    });
  });

  it('revealed again: the round trip returns to the visible flip', () => {
    const notice = noticeOf([record, hide, reveal])!;
    expect(notice.body).toBe(`${CF}.notice.body`);
    expect(notice.addsToPlan).toEqual({
      offer: 'source-out-of-sight',
      labelKey: `${CF}.notice.action-hide`
    });
  });

  it('no notice while not frightened', () => {
    expect(noticeOf([])).toBeUndefined();
    expect(noticeOf([hide])).toBeUndefined();
  });

  it('both body templates and both button accessible names exist — in both locales', () => {
    for (const catalog of [enCommon, tlhCommon]) {
      for (const key of ['notice.body', 'notice.body-hidden']) {
        const body = node(catalog, key);
        expect(body, `${key} template exists`).toBeDefined();
        expect(body?.length, `${key} is non-empty`).toBeGreaterThan(0);
      }
      for (const key of ['notice.action-hide', 'notice.action-reveal']) {
        const label = node(catalog, key);
        expect(label, `${key} accessible name exists`).toBeDefined();
        expect(label?.length, `${key} is non-empty`).toBeGreaterThan(0);
      }
    }
  });

  it('the module declares all three offers the notice can name', () => {
    const offers = evaluateOffers(ALL, FACTS).map((o) => o.id);
    expect(offers).toContain('record-frightened');
    expect(offers).toContain('source-out-of-sight');
    expect(offers).toContain('source-back-in-sight');
  });
});
