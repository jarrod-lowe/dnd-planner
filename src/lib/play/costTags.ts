import type { ActionCostTag, Rule } from '$lib/rules-view';

/**
 * A planned rule's cost tags resolved against its captured slot-level
 * selection: the authored `Lx` tag re-labelled to the level the cast will
 * actually spend (`0` → the class feature's free use).
 */
export interface ResolvedCostTags {
  tags: ActionCostTag[];
  /**
   * Present when the spell auto-upcast above its authored base tag and the
   * rule offers no slider the player could have chosen the level with —
   * e.g. Sanctuary burning an L2 slot because L1 is exhausted. Spells with a
   * slot-level slider never flag: the player picked the level deliberately.
   */
  upcast?: { base: number; level: number };
}

const L_TAG = /^L([1-5])$/;

function hasSlotLevelSlider(ui: Record<string, unknown> | undefined): boolean {
  if (!ui) return false;
  for (const slot of ['primaryControl', 'secondaryControl'] as const) {
    const control = ui[slot] as { type?: string; var?: string } | undefined;
    if (control?.type === 'slider' && control.var === 'slotLevel') return true;
  }
  return false;
}

export function resolveCostTags(rule: Rule): ResolvedCostTags {
  const ui = rule.ui as Record<string, unknown> | undefined;
  const tags = (ui?.actionCost as ActionCostTag[] | undefined) ?? [];
  const slotLevel = rule.selections?.slotLevel;
  if (typeof slotLevel !== 'number') return { tags };

  const baseTag = tags.find((tag) => L_TAG.test(tag));
  const base = baseTag ? Number(baseTag.slice(1)) : undefined;
  const relabel =
    slotLevel === 0
      ? ('free' as ActionCostTag)
      : slotLevel >= 1 && slotLevel <= 5
        ? (`L${slotLevel}` as ActionCostTag)
        : undefined;
  const resolvedTags = relabel ? tags.map((tag) => (L_TAG.test(tag) ? relabel : tag)) : tags;

  const upcast =
    relabel !== undefined &&
    relabel !== 'free' &&
    base !== undefined &&
    slotLevel > base &&
    !hasSlotLevelSlider(ui)
      ? { base, level: slotLevel }
      : undefined;

  return upcast ? { tags: resolvedTags, upcast } : { tags: resolvedTags };
}
