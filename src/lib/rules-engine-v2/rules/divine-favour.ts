import {
  defineRule,
  preparedSpellOffers,
  type ActionResult,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type RuleModule
} from '../builder';

const DF = 'rule.spell-divine-favour';
const O = `${DF}.offer-divine-favour`;
const USE = `${DF}.offer-use-divine-favour`;
const RADIANT = 'radiant';

/**
 * Divine Favour — the pre-M3 parity spike. A bonus-action self-buff: for ~1
 * minute your weapon attacks deal +1d4 radiant. Chosen because it exercises the
 * full contract in one rule:
 *  - two offers (cast + a free per-attack "use" damage rider),
 *  - an annotation on weapon attacks while active,
 *  - three effect lifetimes — the per-turn cost (`endOfTurn`), the spent L1 slot
 *    (`untilLongRest`), and the buff itself (`turns`, the duration).
 *
 * `divineFavour.active` is contributed by the buff EFFECT (not derived), so it
 * lights up the same turn (the fold re-derives with advertised effects) and
 * persists across turns until the buff ages out.
 *
 * `prepared` is an input fact for the spike (the prepare/unprepare offers are M3
 * proper).
 *
 * The buff ends when the EARLIEST condition fires — 10 rounds OR any rest — via
 * a multi-predicate `expiry` (M3 step 0), matching v1's buff re-advertise guard
 * `when rest.short == 0 && rest.long == 0`. (This rest-cancellation was the gap
 * the spike was chosen to surface; the single-predicate `Expiry` couldn't
 * express it.)
 */
const divineFavour: RuleModule = {
  id: 'spell-divine-favour',
  meta: {
    name: `${O}.name`,
    description: `${O}.description`,
    keywords: `${O}.keywords`,
    requires: ['spellcasting']
  },
  derive: () => [
    {
      // L1 only, no upcasting.
      fact: 'divineFavour.eligibleSlotsRemaining',
      value: (f) => f.num('spellcasting.slots.level1.remaining')
    }
  ],
  offer: () => [
    ...preparedSpellOffers({
      spellId: 'divine-favour',
      i18nPrefix: 'rule.spell-divine-favour',
      preparedFact: 'spell.l1.divineFavour.prepared',
      alwaysPreparedFact: 'spell.l1.divineFavour.alwaysPrepared',
      intentLevel: 'L1'
    }),
    {
      id: 'cast-divine-favour',
      when: (f) => f.num('spell.l1.divineFavour.prepared') === 1,
      ui: {
        section: 'bonus-action-spell',
        name: `${O}.name`,
        description: `${O}.description`,
        detailKey: 'spell/divine-favour',
        intents: { ATTACK: 'spells' },
        // Fixed L1 cast (no upcasting), so the slot tag is static, unlike Divine
        // Smite's slider — mirrors v1's `actionCost: [bonus, L1]`.
        actionCost: ['bonus', 'L1']
      },
      legalWhen: [
        {
          condition: (f) => f.num('divineFavour.active') === 0,
          diagnostics: [{ code: `${O}.already_active`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: `${O}.no_bonus_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${O}.no_spellcasting`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('divineFavour.eligibleSlotsRemaining') > 0,
          diagnostics: [{ code: `${O}.no_slots`, severity: 'error' }]
        }
      ],
      apply: (f: FactReader): ActionResult => {
        const advertise: EffectInstance[] = [
          // Per-turn spend: bonus action + the one-spell-per-turn resource.
          {
            id: 'cost',
            state: { 'bonusActions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          },
          // The L1 slot, spent until a long rest. Unkeyed so it stacks like
          // Divine Smite's slot — each cast spends its own slot. (id matches the
          // v1 effect: scenarios assert effect-divine-favour-l1.)
          {
            id: 'effect-divine-favour-l1',
            state: { 'spellcasting.slots.level1.spent': 1 },
            expiry: { kind: 'untilLongRest' }
          },
          // The buff: lights divineFavour.active for the duration. Ends when the
          // EARLIEST fires — 10 rounds OR any rest. Keyed so re-casting refreshes
          // the duration rather than stacking active to 2 (newest-wins dedupe at
          // sheet-build and endTurn).
          {
            // id matches the v1 effect (scenarios assert effect-divine-favour).
            id: 'effect-divine-favour',
            key: 'divine-favour-buff',
            state: { 'divineFavour.active': 1 },
            display: { name: 'rule.spell-divine-favour.effect-divine-favour.name' },
            expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('divineFavour.active') > 0)
          diagnostics.push({ code: `${O}.already_active`, severity: 'error' });
        if (f.num('bonusActions.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_bonus_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_spellcasting`, severity: 'error' });
        if (f.num('spellcasting.slots.level1.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_slots`, severity: 'error' });
        return { advertise, diagnostics };
      }
    },
    {
      // Free per-attack damage rider while the buff is up. No cost, repeatable.
      // No `when` gate (matches v1's offer-use-divine-favour): always offered,
      // illegal-but-visible until the buff is active AND an attack was made.
      id: 'use-divine-favour',
      ui: {
        section: 'free',
        name: `${DF}.use-divine-favour.name`,
        description: `${DF}.use-divine-favour.description`,
        primaryControl: {
          type: 'dice-line',
          dice: [{ sides: 4, damageType: { string: RADIANT }, purpose: 'damage' }]
        },
        intents: { ATTACK: 'spells' },
        actionCost: []
      },
      legalWhen: [
        {
          condition: (f) => f.num('divineFavour.active') > 0,
          diagnostics: [{ code: `${USE}.not_active`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('attack.last.activation.action') >= 1,
          diagnostics: [{ code: `${USE}.no_attack`, severity: 'error' }]
        }
      ],
      apply: (): ActionResult => ({ advertise: [] })
    }
  ],
  // Surface "+1d4 radiant available" on weapon attacks while the buff is up.
  annotate: (f: FactReader) =>
    f.num('divineFavour.active') > 0
      ? [{ key: `${DF}.annotation`, targets: ['attack.weapon'] }]
      : []
};

export default defineRule(divineFavour);
