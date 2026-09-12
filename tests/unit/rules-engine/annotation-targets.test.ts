import { describe, it, expect } from 'vitest';
import { getModule, registeredRuleGroupIds } from '$lib/rules-engine/registry';
import type { FactReader, Offer, RuleModule } from '$lib/rules-engine';

/**
 * ISSUES.md 1.9 ("Life Bond annotation targets a label no panel carries") is a
 * silent failure: a rider aimed at an unknown label simply never renders. This
 * guard closes that hole for every module at once.
 *
 * Annotations are gated on facts, so the modules are probed with a permissive
 * reader (every fact present and equal to 1) to surface as many annotations as
 * possible. That is best-effort by construction — it catches typos and
 * renamed labels, which is the failure this is for.
 */
const permissiveReader: FactReader = { num: () => 1, has: () => true };

function modules(): RuleModule[] {
  return registeredRuleGroupIds()
    .map((id) => getModule(id))
    .filter((m): m is RuleModule => m !== undefined);
}

function offersOf(m: RuleModule): Offer[] {
  return m.offer ? m.offer({ selections: {} }) : [];
}

function labelsOf(offer: Offer): string[] {
  const labels = (offer.ui as Record<string, unknown> | undefined)?.annotationLabels;
  if (!Array.isArray(labels)) return [];
  return labels.filter((l): l is string => typeof l === 'string');
}

/** The control types that put rollable dice on a panel. */
const DICE_CONTROLS = new Set(['dice-line', 'hit-dice']);

/**
 * Whether an offer's `ui` puts dice on the panel anywhere — `primaryControl`,
 * `secondaryControl`, or a control tucked inside authored extras (the greataxe's
 * Cleave line arrives via `actionUiExtra`). Searched structurally rather than by
 * a fixed list of keys so a new control slot cannot hide a roller.
 */
function rollsDice(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(rollsDice);
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.type === 'string' && DICE_CONTROLS.has(record.type)) return true;
  return Object.values(record).some(rollsDice);
}

describe('annotation targets', () => {
  it('every target a module annotates is carried by at least one panel', () => {
    const all = modules();
    const carried = new Set<string>();
    for (const m of all) for (const o of offersOf(m)) for (const l of labelsOf(o)) carried.add(l);

    const orphans: string[] = [];
    for (const m of all) {
      if (!m.annotate) continue;
      for (const annotation of m.annotate(permissiveReader))
        for (const target of annotation.targets)
          if (!carried.has(target)) orphans.push(`${m.id} → ${target}`);
    }

    expect(orphans, `annotation targets no panel carries: ${orphans.join(', ')}`).toEqual([]);
  });

  it('every offer an annotation adds is a real offer', () => {
    const all = modules();
    const offerIds = new Set<string>();
    for (const m of all) for (const o of offersOf(m)) offerIds.add(o.id);

    const orphans: string[] = [];
    for (const m of all) {
      if (!m.annotate) continue;
      for (const annotation of m.annotate(permissiveReader)) {
        const adds = annotation.addsToPlan;
        // `again` names no offer — it resolves to whichever panel the
        // annotation renders on, so there is nothing to check here; the
        // orphan-target test above already pins that those panels exist.
        if (adds === undefined || adds === 'again') continue;
        // A tap on an annotation naming an offer that does not exist is a
        // dead button — the store finds nothing to plan and silently does
        // nothing. Same silent-failure class as an orphaned target label.
        if (!offerIds.has(adds.offer)) orphans.push(`${m.id} → ${adds.offer}`);
      }
    }

    expect(orphans, `annotations adding unknown offers: ${orphans.join(', ')}`).toEqual([]);
  });

  /**
   * SRD 5.2, Heroic Inspiration: "you can expend it to reroll ANY die
   * immediately after rolling it". The reminder finds a panel through
   * `dice.any`, so every panel that rolls dice must carry the label or the
   * reminder silently skips it — which is exactly how the six save recorders
   * came to be missed. The label is hand-attached per offer, so this guard is
   * what stops the next roller being born without it.
   *
   * A companion's panel carries the `.companion` form instead: the steed's dice
   * are the steed's rolls, so a self-only rider must opt in to reach them (the
   * same scoping the steed's `save.*.companion` labels already use).
   */
  it('every panel that rolls dice carries a dice.any label', () => {
    const missing: string[] = [];
    for (const m of modules()) {
      for (const o of offersOf(m)) {
        if (!rollsDice(o.ui)) continue;
        const wanted = o.ui?.subject === 'steed' ? 'dice.any.companion' : 'dice.any';
        if (!labelsOf(o).includes(wanted)) missing.push(`${m.id} → ${o.id} (wants ${wanted})`);
      }
    }

    expect(missing, `dice panels with no dice.any label: ${missing.join(', ')}`).toEqual([]);
  });

  /**
   * The exact lists matter in both directions: `save.*` must stay unsuffixed on
   * the player's row and suffixed on the steed's (a self-only rider must not
   * leak onto the mount), and the dice label must be present but must take the
   * matching form — plain on the player's roll, `.companion` on the steed's.
   * The save rows previously asserted *only* the two save labels; that pinned
   * the very omission this branch fixes, so the list grows by the dice label
   * rather than the assertion being loosened.
   */
  it('the six save recorders carry save labels, and steed saves carry companion labels', () => {
    const core = getModule('core-events');
    expect(core, 'core-events module is registered').toBeDefined();
    const wisSave = offersOf(core!).find((o) => o.id === 'record-save-wis');
    expect(wisSave, 'record-save-wis offer exists').toBeDefined();
    expect(labelsOf(wisSave!)).toEqual(['save.any', 'save.wis', 'dice.any']);

    const steed = getModule('spell-find-steed');
    expect(steed, 'spell-find-steed module is registered').toBeDefined();
    const steedWisSave = offersOf(steed!).find((o) => o.id === 'steed-save-wis');
    expect(steedWisSave, 'steed-save-wis offer exists').toBeDefined();
    expect(labelsOf(steedWisSave!)).toEqual([
      'save.any.companion',
      'save.wis.companion',
      'dice.any.companion'
    ]);
  });
});
