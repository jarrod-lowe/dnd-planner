import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import featSentinel from '$lib/rules-engine/rules/feat-sentinel';

/**
 * Sentinel's three reminders split by WHEN they matter. Disengage and
 * ally-hit retaliation are standing facts — they stay NOTICES (reserved
 * label only, source eyebrow + body sentence). "Speed reduced to 0" is
 * post-hoc: it only matters AFTER the player plans an Opportunity Attack,
 * so it rides the reaction panels via their 'attack.reaction'
 * annotationLabels (attached to every reaction offer — see builder.ts and
 * rules/attacks.ts) instead of the notices strip. Panel annotations render
 * the label only ($t(annotation.key) in PanelRenderer), so the panel rider
 * carries no body key.
 *
 * The rule module cannot import these constants (rule modules import only
 * the builder), so its literals are pinned here: 'notice' to NOTICE_TARGET,
 * 'attack.reaction' to the reaction panels' declared label.
 */
const S = 'rule.dnd-5e-2024.feat-sentinel';

/** The annotationLabels entry every reaction-section offer declares. */
const REACTION_PANEL_LABEL = 'attack.reaction';

describe('feat-sentinel annotate — notices + reaction rider', () => {
  it('emits exactly three annotations: two notices, one reaction-panel rider', () => {
    const out = evaluate({ modules: [featSentinel], inputFacts: {}, planned: [] });
    expect(out.annotations.map((a) => a.key).sort()).toEqual([
      `${S}.notice-disengage`,
      `${S}.notice-retaliate`,
      `${S}.notice-speed`
    ]);

    const notices = out.annotations.filter((a) => a.targets.includes(NOTICE_TARGET));
    expect(notices.map((a) => a.key).sort()).toEqual([
      `${S}.notice-disengage`,
      `${S}.notice-retaliate`
    ]);
    for (const a of notices) {
      expect(a.targets, `${a.key} targets only the notice label`).toEqual([NOTICE_TARGET]);
    }

    // Exactly one panel-targeted annotation, and it is the post-hoc speed
    // rider aimed at the reaction panels' label.
    const riders = out.annotations.filter((a) => !a.targets.includes(NOTICE_TARGET));
    expect(riders.map((a) => a.key)).toEqual([`${S}.notice-speed`]);
    for (const a of riders) {
      expect(a.targets, `${a.key} rides the reaction panel label`).toEqual([REACTION_PANEL_LABEL]);
    }
  });

  it('notices carry source + body; the panel rider is label-only', () => {
    const out = evaluate({ modules: [featSentinel], inputFacts: {}, planned: [] });
    for (const suffix of ['notice-disengage', 'notice-retaliate']) {
      const ann = out.annotations.find((a) => a.key === `${S}.${suffix}`);
      expect(ann, `${S}.${suffix} exists`).toBeDefined();
      expect(ann!.source).toBe(`${S}.name`);
      expect(ann!.body).toBe(`${S}.${suffix}.body`);
    }

    const speed = out.annotations.find((a) => a.key === `${S}.notice-speed`);
    expect(speed, `${S}.notice-speed exists`).toBeDefined();
    expect(speed!.source).toBe(`${S}.name`);
    // Panels render $t(annotation.key) only, so a body key — and its
    // translation — would be dead weight.
    expect(speed!.body).toBeUndefined();
  });
});
