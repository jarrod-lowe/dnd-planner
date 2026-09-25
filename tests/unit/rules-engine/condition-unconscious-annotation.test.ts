import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import type { PlannedRef } from '$lib/rules-engine';
import conditionUnconscious from '$lib/rules-engine/rules/condition-unconscious';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';

/**
 * The drop-held reminder as a PANEL annotation on the record row (user-directed
 * 2026-09-25). SRD 5.2 Inert: "you drop whatever you're holding" — knot 1
 * option (a): guidance text + manual Set Loadout, no loadout mutation. The
 * NOTICE body already carries the sentence while unconscious; this annotation
 * is the PRE-ACTION guidance point — it rides the record-unconscious row via
 * its `condition.unconscious.record` annotationLabel so the player sees the
 * drop-held instruction exactly when planning the record, BEFORE the condition
 * exists. UNCONDITIONAL by design: the row is the guidance point (the
 * concentration recorder idiom — `damage.any` on record-damage), so the
 * annotation emits at every state, awake or not; the standing notice stays the
 * while-unconscious channel and is unchanged.
 */
const CU = 'rule.dnd-5e-2024.condition-unconscious';
const KEY = `${CU}.annotation`;

/** The annotationLabel the record-unconscious panel declares. */
const RECORD_PANEL_LABEL = 'condition.unconscious.record';

const record = (instanceId: string): PlannedRef => ({
  instanceId,
  ruleId: 'record-unconscious'
});

type GroupNode = Record<string, string | undefined>;
type CategoryNode = Record<string, GroupNode>;

const labelOf = (catalog: unknown): string | undefined =>
  ((catalog as { rule: Record<string, CategoryNode> }).rule['dnd-5e-2024'] ?? {})[
    'condition-unconscious'
  ]?.['annotation'];

describe('condition-unconscious annotate — drop-held reminder on the record row', () => {
  it('emits the loadout annotation unconditionally — the row is the pre-action guidance point', () => {
    // Awake, nothing planned: the notice must stay off (it is the
    // while-unconscious channel), yet the row annotation is live — the player
    // planning the record sees the drop-held instruction before acting.
    const out = evaluate({ modules: [conditionUnconscious], inputFacts: {}, planned: [] });
    const ann = out.annotations.find((a) => a.key === KEY);
    expect(ann, 'annotation exists while awake').toBeDefined();
    expect(ann!.targets).toEqual([RECORD_PANEL_LABEL]);
    expect(out.annotations.find((a) => a.key === `${CU}.notice`)).toBeUndefined();
  });

  it('keeps the annotation beside the notice once unconscious — both channels live', () => {
    const out = evaluate({
      modules: [conditionUnconscious],
      inputFacts: {},
      planned: [record('c1')]
    });
    expect(out.facts['condition.unconscious'], 'unconscious in this state').toBe(1);
    const ann = out.annotations.find((a) => a.key === KEY);
    expect(ann, 'row annotation still live').toBeDefined();
    expect(ann!.targets).toEqual([RECORD_PANEL_LABEL]);
    // The notice is unchanged: same key, still notice-targeted.
    const notice = out.annotations.find((a) => a.key === `${CU}.notice`);
    expect(notice, 'notice unchanged while unconscious').toBeDefined();
    expect(notice!.targets).toEqual([NOTICE_TARGET]);
    expect(notice!.body).toBe(`${CU}.notice.body`);
  });

  it("targets the label the record-unconscious panel's ui declares", () => {
    // annotationLabels sit on `ui`, NEVER inside a control (a nested array
    // compiles and silently matches nothing — RULE_GROUP_GUIDE §7). This offer
    // has no control, so the pin is also the shape guard.
    const offer = conditionUnconscious.offer!({ selections: {} }).find(
      (o) => o.id === 'record-unconscious'
    );
    expect(offer, 'record-unconscious offer exists').toBeDefined();
    const labels = (offer!.ui as Record<string, unknown> | undefined)?.annotationLabels;
    expect(labels, 'record-unconscious carries annotationLabels').toBeDefined();
    expect(labels).toContain(RECORD_PANEL_LABEL);
  });

  it('carries the label text in both locales', () => {
    for (const catalog of [enCommon, tlhCommon]) {
      const label = labelOf(catalog);
      expect(label, 'label text exists').toBeDefined();
      // Advisory text, no interpolation params.
      expect(label?.match(/{{[a-zA-Z]+}}/g)).toBeNull();
    }
  });
});
