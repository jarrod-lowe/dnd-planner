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
const P = 'rule.spell-protection-from-evil-and-good.offer-protection-from-evil-and-good';
const SLOTS = 'protection-from-evil-and-good';

/**
 * Protection from Evil and Good — a Level 1 action concentration ward. Same shape
 * as Bless: prepare path + L1–5 slot cascade + a cast that spends an action, the
 * turn spell, and a slot, holding concentration via `effect-protection-...`
 * (`[untilShortRest]`, `concentration.spent` = 1). Ten minutes is impractical to
 * count in combat rounds, so the ward carries until the user dismisses it or any
 * rest (always 10+ minutes) ends it; it blocks a second concentration spell
 * meanwhile.
 */
const protectionFromEvilAndGood: RuleModule = {
  id: 'spell-protection-from-evil-and-good',
  prepare: {
    spellId: 'protection-from-evil-and-good',
    level: 1,
    nameKey: `${P}.name`,
    preparedFact: 'spell.l1.protectionFromEvilAndGood.prepared',
    alwaysPreparedFact: 'spell.l1.protectionFromEvilAndGood.alwaysPrepared'
  },
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['spellcasting', 'concentration', 'prepared-spells']
  },
  derive: () => {
    const c: Contribution[] = [
      preparedSpellCount({
        preparedFact: 'spell.l1.protectionFromEvilAndGood.prepared',
        alwaysPreparedFact: 'spell.l1.protectionFromEvilAndGood.alwaysPrepared'
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
      id: 'cast-protection-from-evil-and-good',
      when: (f) => f.num('spell.l1.protectionFromEvilAndGood.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${P}.name`,
        description: `${P}.description`,
        detailKey: 'spell/protection-from-evil-and-good',
        // No save DC line: the ward forces no saving throw (attackers suffer
        // disadvantage; the target can't be Charmed/Frightened by such creatures).
        intents: { DEFEND: 'ward' },
        actionCost: ['action', 'conc', 'L1']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: `${SLOTS}.lowestAvailableSlotLevel` } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: `${P}.no_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${P}.no_spellcasting`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('concentration.remaining') > 0,
          diagnostics: [{ code: `${P}.already_concentrating`, severity: 'error' }]
        },
        {
          condition: (f) => f.num(`${SLOTS}.eligibleSlotsRemaining`) > 0,
          diagnostics: [{ code: `${P}.no_slots`, severity: 'error' }]
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
          // Keyed so a failed concentration check's eviction (an empty
          // same-key effect) replaces it, releasing the slot.
          {
            id: 'effect-protection-from-evil-and-good',
            key: CONCENTRATION_SPELL_KEY,
            state: { 'concentration.spent': 1 },
            display: {
              name: 'rule.spell-protection-from-evil-and-good.effect-protection-from-evil-and-good.name'
            },
            expiry: [{ kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${P}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${P}.no_spellcasting`, severity: 'error' });
        if (f.num('concentration.remaining') <= 0)
          diagnostics.push({ code: `${P}.already_concentrating`, severity: 'error' });
        if (level >= 1 && level <= 5) {
          advertise.push({
            id: `effect-protection-from-evil-and-good-slot-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${P}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${P}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(protectionFromEvilAndGood);
