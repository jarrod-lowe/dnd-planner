import {
  CONCENTRATION_SPELL_KEY,
  defineRule,
  preparedSpellCount,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const LEVELS = [1, 2, 3, 4, 5] as const;
const D = 'rule.spell-detect-evil-and-good.offer-detect-evil-and-good';
const SLOTS = 'detectEvilAndGood';

/**
 * Detect Evil and Good — a Level 1 action concentration divination. The same
 * shape as Protection from Evil and Good: prepare path + L1–5 slot cascade + a
 * cast that spends an action, the turn spell, and a slot, holding concentration
 * via `effect-detect-evil-and-good` (`[untilShortRest]`,
 * `concentration.spent` = 1). Ten minutes is impractical to count in combat
 * rounds, so the sensing carries until the user dismisses it or any rest
 * (always 10+ minutes) ends it; a second concentration spell (legal per
 * SRD 5.2) replaces it via the shared key.
 *
 * Everything the spell senses — Aberrations, Celestials, Elementals, Fey,
 * Fiends, and Undead within 30 feet, plus Hallow — is world state the app does
 * not track, so the effect is a pure concentration-holding duration marker
 * (the Protection precedent: descriptive, not modelled).
 */
const detectEvilAndGood: RuleModule = {
  id: 'spell-detect-evil-and-good',
  prepare: {
    spellId: 'detect-evil-and-good',
    level: 1,
    nameKey: `${D}.name`,
    preparedFact: 'spell.l1.detectEvilAndGood.prepared',
    alwaysPreparedFact: 'spell.l1.detectEvilAndGood.alwaysPrepared'
  },
  meta: {
    name: `${D}.name`,
    description: `${D}.description`,
    keywords: `${D}.keywords`,
    requires: ['spellcasting', 'concentration', 'prepared-spells']
  },
  derive: () => {
    const c: Contribution[] = [
      preparedSpellCount({
        preparedFact: 'spell.l1.detectEvilAndGood.prepared',
        alwaysPreparedFact: 'spell.l1.detectEvilAndGood.alwaysPrepared'
      }),
      {
        fact: `${SLOTS}.eligibleSlotsRemaining`,
        value: (f) =>
          LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
      },
      {
        fact: `${SLOTS}.lowestAvailableSlotLevel`,
        value: (f) => {
          for (const n of LEVELS) if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
          return 0;
        }
      }
    ];
    return c;
  },
  offer: () => [
    {
      id: 'cast-detect-evil-and-good',
      when: (f) => f.num('spell.l1.detectEvilAndGood.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${D}.name`,
        description: `${D}.description`,
        detailKey: 'spell/detect-evil-and-good',
        // No save DC line: the spell forces no saving throw (it only senses).
        intents: { INSPECT: 'sense' },
        actionCost: ['action', 'conc', 'L1']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: `${SLOTS}.lowestAvailableSlotLevel` } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: `${D}.no_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${D}.no_spellcasting`, severity: 'error' }]
        },
        // No concentration gate: SRD 5.2 makes the recast legal — it dismisses
        // the current hold via the shared CONCENTRATION_SPELL_KEY (newest wins).
        {
          condition: (f) => f.num(`${SLOTS}.eligibleSlotsRemaining`) > 0,
          diagnostics: [{ code: `${D}.no_slots`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num(`${SLOTS}.lowestAvailableSlotLevel`);
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'actions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          },
          // The senses: a pure concentration-holding duration marker; ends on
          // dismissal or any rest (10 minutes is not counted in rounds). Keyed
          // so a failed concentration check's eviction (an empty same-key
          // effect) replaces it, releasing the slot.
          {
            id: 'effect-detect-evil-and-good',
            key: CONCENTRATION_SPELL_KEY,
            state: { 'concentration.spent': 1 },
            display: {
              name: 'rule.spell-detect-evil-and-good.effect-detect-evil-and-good.name'
            },
            expiry: [{ kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${D}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${D}.no_spellcasting`, severity: 'error' });
        if (level >= 1 && level <= 5) {
          advertise.push({
            id: `effect-detect-evil-and-good-slot-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${D}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${D}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(detectEvilAndGood);
