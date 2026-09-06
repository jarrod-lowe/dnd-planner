import {
  defineRule,
  loadoutEffectState,
  type ActionResult,
  type Diagnostic,
  type LoadoutConfig,
  type LoadoutItem,
  type RuleModule
} from '../builder';

const L = 'rule.dnd-5e-2024.loadout';
const NO_HANDS = `${L}.set-loadout-offer.no-hands`;
const NOT_PROFICIENT = `${L}.set-loadout-offer.not-proficient`;

/** The shield's own facts — the one item whose training the loadout checks. */
const SHIELD_EQUIPPED = 'armor.shield.equipped';
const SHIELD_PROFICIENT = 'armor.shield.proficient';

/**
 * Loadout (house rule) — what is in your hands, set as one whole configuration.
 *
 * The per-item don offers this replaces each gated on `build.locked === 0`, so
 * changing hands mid-combat meant unlocking the build, dismissing the equip chips
 * and re-donning. `set-loadout` instead commits ONE permanent effect under the
 * shared key `loadout`: same-key effects do not stack (the newest evicts the
 * older), so a swap is atomic and needs no offer-side removal API. The effect
 * writes the facts the items themselves declare (`weapon.<id>.equipped`,
 * `armor.shield.equipped`, `ac.shieldBonus`, the versatile grip) plus the total
 * `hands.spent`, so every attack `when` gate and the AC rule keep working
 * unchanged.
 *
 * The house-rule part is the price: swapping is FREE and always legal, because
 * the table this is built for ignores the Utilize/Interact cost of changing
 * weapons. Hence no build-lock gate and `actionCost: ['free']`.
 *
 * The list of legal configurations is NOT here — it is `enumerateLoadouts`, a
 * pure function over the modules a character has assigned (loadout.ts). This
 * module only commits the chosen one, which is why adding a new weapon needs no
 * change to it. Foundational, so no search `meta`.
 */

/** Nothing held — what an absent or unreadable selection means. */
const EMPTY: LoadoutConfig = {
  id: 'empty',
  hands: 0,
  handsFree: 0,
  items: [],
  freeHandKey: `${L}.hands-free.name`
};

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((n) => typeof n === 'number')
  );
}

/**
 * Read the chosen configuration back out of the persisted selection.
 *
 * A selection is JSON that outlived the evaluation that produced it, so this
 * re-derives everything it can rather than trusting it: the hand total is summed
 * from the items, and an item with no id, no hand cost or a non-numeric state map
 * is dropped. An unreadable selection degrades to empty hands, never to a throw.
 */
function readConfig(selections: Record<string, unknown> | undefined): LoadoutConfig {
  const raw = selections?.loadout as Partial<LoadoutConfig> | undefined;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return EMPTY;

  const items: LoadoutItem[] = [];
  for (const entry of raw.items as unknown[]) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<LoadoutItem>;
    if (typeof item.id !== 'string' || typeof item.hands !== 'number') continue;
    if (!isNumberRecord(item.state)) continue;
    items.push({
      id: item.id,
      nameKey: typeof item.nameKey === 'string' ? item.nameKey : '',
      hands: item.hands,
      twoHanded: item.twoHanded === true,
      ...(typeof item.gripKey === 'string' ? { gripKey: item.gripKey } : {}),
      state: item.state
    });
  }

  const hands = items.reduce((total, item) => total + item.hands, 0);
  return {
    id: typeof raw.id === 'string' ? raw.id : 'empty',
    hands,
    handsFree: 0,
    items,
    freeHandKey: EMPTY.freeHandKey
  };
}

const loadout: RuleModule = {
  id: 'loadout',
  offer: () => [
    {
      id: 'set-loadout',
      ui: {
        section: 'equip',
        name: `${L}.set-loadout.name`,
        description: `${L}.set-loadout.description`,
        intents: { EQUIP: 'loadout' },
        // Free by house rule: the apply spends nothing, so this is the whole cost.
        actionCost: ['free'],
        primaryControl: { type: 'loadout', var: 'loadout' }
      },
      // Deliberately NO build-lock gate: changing hands is a play-time action.
      //
      // The one gate it does carry is the shield-training WARNING inherited from
      // the deleted don-shield offer — a shield you have no training with grants
      // you nothing. Warning severity, so it is illegal-but-visible in the catalog
      // (a failed gate of any severity reads illegal) while never stopping the
      // swap: the `apply` copy below is a warning too, and the plan fold only
      // blocks a planned row on an ERROR from `apply`.
      //
      // The gate reads the RESULTING state (a shield is in hand), because a
      // `legalWhen` condition sees facts and not the pending selection; `apply`
      // reads the chosen configuration directly, so the row that establishes the
      // loadout is flagged at the moment it is planned.
      legalWhen: [
        {
          condition: (f) => f.num(SHIELD_EQUIPPED) !== 1 || f.num(SHIELD_PROFICIENT) === 1,
          diagnostics: [{ code: NOT_PROFICIENT, severity: 'warning' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const config = readConfig(selections);
        const diagnostics: Diagnostic[] = [];
        if (config.hands > f.num('hands.max')) {
          diagnostics.push({ code: NO_HANDS, severity: 'error' });
        }
        const holdsShield = config.items.some((item) => item.state[SHIELD_EQUIPPED] === 1);
        if (holdsShield && f.num(SHIELD_PROFICIENT) !== 1) {
          diagnostics.push({ code: NOT_PROFICIENT, severity: 'warning' });
        }
        return {
          advertise: [
            {
              id: 'effect-loadout',
              // The shared key is the mechanism: the newest loadout evicts the
              // previous one, so a swap needs no unequip step.
              key: 'loadout',
              state: loadoutEffectState(config),
              // On the strip: removing the chip empties your hands.
              display: { name: `${L}.effect-loadout.name` },
              expiry: { kind: 'permanent' }
            }
          ],
          diagnostics
        };
      }
    }
  ]
};

export default defineRule(loadout);
