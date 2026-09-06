import type { EquipDef, RuleModule } from './types';

/**
 * The loadout enumerator.
 *
 * `set-loadout` sets the WHOLE hand configuration at once, so the unit of choice
 * is the configuration, not the item. This file turns the modules a character has
 * assigned (those declaring `RuleModule.equip`) into the ordered list of legal
 * whole-hand configurations the offer can be pointed at.
 *
 * Pure and registry-driven: it reads nothing but the modules handed to it, so the
 * UI (which already resolves a character's groups to modules) and the tests get
 * the same list from the same input, independent of module order.
 */

const L = 'rule.dnd-5e-2024.loadout';
const EMPTY = `${L}.empty.name`;
const FREE_HAND = `${L}.hands-free.name`;
const GRIP_ONE_HANDED = `${L}.grip.one-handed`;
const GRIP_TWO_HANDED = `${L}.grip.two-handed`;

/** One held item within a configuration. */
export interface LoadoutItem {
  /** The rule-group id of the module that declared the item. */
  id: string;
  /** i18n key for the item's chip name. */
  nameKey: string;
  /** Hands this item occupies in THIS configuration (2 for a versatile 2H grip). */
  hands: number;
  /** Whether this configuration grips the item two-handed. */
  twoHanded: boolean;
  /** i18n key for the grip chip — versatile items only, where the grip is a choice. */
  gripKey?: string;
  /** The facts set while the item is held in this configuration. */
  state: Record<string, number>;
}

/** One whole legal hand configuration. */
export interface LoadoutConfig {
  /** Deterministic id: `empty`, `dagger`, `spear:2h`, `dagger+shield`. */
  id: string;
  /** Hands the configuration occupies. */
  hands: number;
  /** Hands left free — load-bearing (somatic components, Grapple, Lay on Hands). */
  handsFree: number;
  items: LoadoutItem[];
  /**
   * i18n key for a free-hand chip — render one per `handsFree`. A free hand is
   * load-bearing (somatic components, Grapple, Lay on Hands), so the picker shows
   * it rather than leaving it implied.
   */
  freeHandKey: string;
  /** i18n key naming the configuration when it holds nothing. */
  emptyKey?: string;
}

/** One way of holding one item: its base grip, plus a two-handed grip if versatile. */
interface Grip {
  moduleId: string;
  /** The grip's id segment — `dagger`, `spear`, `spear:2h`. */
  key: string;
  hands: number;
  twoHanded: boolean;
  equip: EquipDef;
}

function gripsOf(module: RuleModule): Grip[] {
  const equip = module.equip;
  if (!equip) return [];
  const base: Grip = {
    moduleId: module.id,
    key: module.id,
    hands: equip.hands,
    twoHanded: false,
    equip
  };
  if (!equip.versatile) return [base];
  return [base, { ...base, key: `${module.id}:2h`, hands: equip.hands + 1, twoHanded: true }];
}

/** A grip may be taken twice (one per hand) only for a stackable item's base grip. */
const repeatable = (g: Grip): boolean => g.equip.stackable === true && !g.twoHanded;

function toItem(g: Grip): LoadoutItem {
  return {
    id: g.moduleId,
    nameKey: g.equip.nameKey,
    hands: g.hands,
    twoHanded: g.twoHanded,
    ...(g.equip.versatile ? { gripKey: g.twoHanded ? GRIP_TWO_HANDED : GRIP_ONE_HANDED } : {}),
    state: g.twoHanded
      ? { ...g.equip.state, ...(g.equip.twoHandedState ?? {}) }
      : { ...g.equip.state }
  };
}

/**
 * Every legal whole-hand configuration for the given modules, ordered by hands
 * used then id (so the list is stable however the modules arrive). Pinning the
 * current configuration to the top is a UI concern, not this function's.
 */
export function enumerateLoadouts(modules: RuleModule[], maxHands = 2): LoadoutConfig[] {
  const grips = [...modules]
    .filter((m) => m.equip)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .flatMap(gripsOf);

  const configs: LoadoutConfig[] = [];

  const emit = (chosen: Grip[], handsUsed: number): void => {
    configs.push({
      id: chosen.length === 0 ? 'empty' : chosen.map((g) => g.key).join('+'),
      hands: handsUsed,
      handsFree: maxHands - handsUsed,
      items: chosen.map(toItem),
      freeHandKey: FREE_HAND,
      ...(chosen.length === 0 ? { emptyKey: EMPTY } : {})
    });
  };

  // Depth-first over the grips in index order: `start` keeps each multiset
  // reachable exactly once (no permutations, no duplicates), and a repeatable
  // grip stays available at its own index so a second copy can be taken.
  const walk = (start: number, chosen: Grip[], handsUsed: number): void => {
    emit(chosen, handsUsed);
    for (let i = start; i < grips.length; i++) {
      const g = grips[i];
      if (handsUsed + g.hands > maxHands) continue;
      // One item per module, unless the module says a second copy may be held.
      if (chosen.some((c) => c.moduleId === g.moduleId) && !repeatable(g)) continue;
      walk(repeatable(g) ? i : i + 1, [...chosen, g], handsUsed + g.hands);
    }
  };
  walk(0, [], 0);

  return configs.sort((a, b) => a.hands - b.hands || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The `state` of the single keyed effect a configuration commits: every held
 * item's facts, plus the hands it spends. Effects sharing `key: 'loadout'` do not
 * stack — the newest evicts the older — which is what makes a swap atomic without
 * any offer-side effect-removal API.
 */
export function loadoutEffectState(config: LoadoutConfig): Record<string, number> {
  const state: Record<string, number> = { 'hands.spent': config.hands };
  for (const item of config.items) Object.assign(state, item.state);
  return state;
}
