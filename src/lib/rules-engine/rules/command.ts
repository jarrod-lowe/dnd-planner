import {
  defineRule,
  preparedSpellCount,
  preparedSpellOffers,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const LEVELS = [1, 2, 3, 4, 5] as const;
const O = 'rule.spell-command.offer-command';
const SLOTS = 'command';

/**
 * Command — a Level 1 action spell with a WIS save. Like create-and-destroy-water
 * (no concentration, instant — no lingering effect), but castable from any L1–5
 * slot (upcast targets more creatures), so it carries the slot cascade. The cast
 * spends an action, the turn's spell, and one slot; no `effect-command` persists.
 */
const command: RuleModule = {
  id: 'spell-command',
  meta: {
    name: `${O}.name`,
    description: `${O}.description`,
    keywords: `${O}.keywords`,
    requires: ['spellcasting']
  },
  derive: () => {
    const c: Contribution[] = [
      preparedSpellCount({
        preparedFact: 'spell.l1.command.prepared',
        alwaysPreparedFact: 'spell.l1.command.alwaysPrepared'
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
    ...preparedSpellOffers({
      spellId: 'command',
      i18nPrefix: 'rule.spell-command',
      preparedFact: 'spell.l1.command.prepared',
      alwaysPreparedFact: 'spell.l1.command.alwaysPrepared',
      intentLevel: 'L1'
    }),
    {
      id: 'cast-command',
      when: (f) => f.num('spell.l1.command.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${O}.name`,
        description: `${O}.description`,
        detailKey: 'spell/command',
        showDC: true,
        information: [
          {
            type: 'text',
            label: 'play.information.saveDc',
            labelValues: {
              saveType: { fact: 'spellcasting.saveAbility' },
              dc: { fact: 'spellcasting.saveDC' }
            }
          }
        ],
        intents: { CONTROL: 'single' },
        actionCost: ['action', 'L1']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: `${SLOTS}.lowestAvailableSlotLevel` } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('actions.remaining') > 0,
          diagnostics: [{ code: `${O}.no_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${O}.no_spellcasting`, severity: 'error' }]
        },
        {
          condition: (f) => f.num(`${SLOTS}.eligibleSlotsRemaining`) > 0,
          diagnostics: [{ code: `${O}.no_slots`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num(`${SLOTS}.lowestAvailableSlotLevel`);
        // No concentration and no lingering effect — just the per-turn spend and
        // the slot (persisted until a long rest).
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'actions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${O}.no_spellcasting`, severity: 'error' });
        if (level >= 1 && level <= 5) {
          advertise.push({
            id: `effect-command-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${O}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${O}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(command);
