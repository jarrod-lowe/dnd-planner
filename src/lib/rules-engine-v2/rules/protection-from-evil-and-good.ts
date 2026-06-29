import {
  defineRule,
  preparedSpellOffers,
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
 * (`[turns 10, untilShortRest]`, `concentration.spent` = 1) so it ends on the
 * duration or any rest and blocks a second concentration spell meanwhile.
 */
const protectionFromEvilAndGood: RuleModule = {
  id: 'spell-protection-from-evil-and-good',
  meta: {
    name: `${P}.name`,
    description: `${P}.description`,
    keywords: `${P}.keywords`,
    requires: ['spellcasting', 'concentration']
  },
  derive: () => {
    const c: Contribution[] = [
      {
        fact: `${SLOTS}.eligibleSlotsRemaining`,
        value: (f) => LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
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
    ...preparedSpellOffers({
      spellId: 'protection-from-evil-and-good',
      i18nPrefix: 'rule.spell-protection-from-evil-and-good',
      preparedFact: 'spell.l1.protectionFromEvilAndGood.prepared',
      alwaysPreparedFact: 'spell.l1.protectionFromEvilAndGood.alwaysPrepared',
      intentLevel: 'L1'
    }),
    {
      id: 'cast-protection-from-evil-and-good',
      when: (f) => f.num('spell.l1.protectionFromEvilAndGood.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${P}.name`,
        description: `${P}.description`,
        detailKey: 'spell/protection-from-evil-and-good',
        showDC: true,
        information: [
          {
            type: 'text',
            label: 'play.information.saveDc',
            labelValues: { saveType: { fact: 'spellcasting.saveAbility' }, dc: { fact: 'spellcasting.saveDC' } }
          }
        ],
        intents: { DEFEND: 'ward' },
        actionCost: ['action', 'conc', 'L1']
      },
      vars: { slotLevel: { capture: true, default: { fact: `${SLOTS}.lowestAvailableSlotLevel` } } },
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
          { id: 'cost', state: { 'actions.spent': 1, 'spellcasting.spent': 1 }, expiry: { kind: 'endOfTurn' } },
          {
            id: 'effect-protection-from-evil-and-good',
            state: { 'concentration.spent': 1 },
            expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0) diagnostics.push({ code: `${P}.no_action`, severity: 'error' });
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
