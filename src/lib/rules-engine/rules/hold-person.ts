import {
  defineRule,
  preparedSpellCount,
  type ActionResult,
  type Annotation,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type RuleModule
} from '../builder';

const LEVELS = [2, 3, 4, 5] as const;
const P = 'rule.spell-hold-person.offer-hold-person';
const R = 'rule.spell-hold-person';
const SLOTS = 'hold-person';

/**
 * Hold Person — a Level 2 action concentration spell (paralyse a humanoid). Same
 * shape as Calm Emotions: L2 slot cascade + prepared path, holding concentration
 * via `effect-hold-person` (`[turns 10, untilShortRest]`). The marker also
 * carries `holdPerson.active` in its state (the `ssmite.burnDice` precedent):
 * the fact lives exactly as long as the effect, so dismissing the chip removes
 * it (and, via the same effect's `concentration.spent`, releases the hold).
 */
const holdPerson: RuleModule = {
  id: 'spell-hold-person',
  prepare: {
    spellId: 'hold-person',
    level: 2,
    nameKey: `${P}.name`,
    preparedFact: 'spell.l2.holdPerson.prepared',
    alwaysPreparedFact: 'spell.l2.holdPerson.alwaysPrepared'
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
        preparedFact: 'spell.l2.holdPerson.prepared',
        alwaysPreparedFact: 'spell.l2.holdPerson.alwaysPrepared'
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
      id: 'cast-hold-person',
      when: (f) => f.num('spell.l2.holdPerson.prepared') === 1,
      ui: {
        section: 'action-spell',
        name: `${P}.name`,
        description: `${P}.description`,
        detailKey: 'spell/hold-person',
        showDC: true,
        // Hold Person forces a fixed Wisdom save on the target (not the caster's
        // spell save ability), so the label names WIS.
        information: [
          {
            type: 'text',
            label: 'play.information.saveDcWis',
            labelValues: { dc: { fact: 'spellcasting.saveDC' } }
          }
        ],
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          notches: LEVELS.map((n) => ({
            value: n,
            enabled: { fact: `spellcasting.slots.level${n}.total` }
          })),
          valueFormat: 'spellLevel'
        },
        intents: { CONTROL: 'single' },
        actionCost: ['action', 'conc', 'L2']
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
          {
            id: 'effect-hold-person',
            state: { 'concentration.spent': 1, 'holdPerson.active': 1 },
            display: { name: 'rule.spell-hold-person.effect-hold-person.name' },
            expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('actions.remaining') <= 0)
          diagnostics.push({ code: `${P}.no_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${P}.no_spellcasting`, severity: 'error' });
        if (f.num('concentration.remaining') <= 0)
          diagnostics.push({ code: `${P}.already_concentrating`, severity: 'error' });
        if (level >= 2 && level <= 5) {
          advertise.push({
            id: `effect-hold-person-slot-l${level}`,
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
  ],
  // While a target is held (`holdPerson.active` — written only by the committed
  // effect marker), a NOTICE carries the repeat-save rule: each held target
  // re-rolls a WIS save against the spell save DC at the end of its turn. The
  // DC interpolates from `spellcasting.saveDC`. 'notice' == NOTICE_TARGET; rule
  // modules may import only the builder, so the reserved label is a literal
  // here (see feat-sentinel) and the unit test pins it to the exported
  // constant.
  annotate: (f): Annotation[] =>
    f.num('holdPerson.active') > 0
      ? [
          {
            key: `${R}.notice`,
            targets: ['notice'],
            source: `${P}.name`,
            body: `${R}.notice.body`,
            values: { dc: f.num('spellcasting.saveDC') }
          }
        ]
      : []
};

export default defineRule(holdPerson);
