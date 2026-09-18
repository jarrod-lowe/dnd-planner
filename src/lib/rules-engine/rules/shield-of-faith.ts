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
const S = 'rule.spell-shield-of-faith.offer-shield-of-faith';
const SLOTS = 'shieldOfFaith';

/**
 * Shield of Faith — a Level 1 bonus-action concentration ward (+2 AC for 10
 * minutes). Same shape as Bless: prepare path + L1–5 slot cascade + a cast that
 * spends a bonus action, the turn spell, and a slot, holding concentration via
 * `effect-shield-of-faith` (`[untilShortRest]`, `concentration.spent` = 1). Ten
 * minutes is impractical to count in combat rounds, so the ward carries until
 * the user dismisses it or any rest (always 10+ minutes) ends it; it blocks a
 * second concentration spell meanwhile.
 *
 * The buff also contributes `ac.miscBonus` 2 (the effect's state, not a derive),
 * so the `ac` group's sum raises the sheet AC while the ward lives — visible the
 * same turn via the fold. SRD 5.2 targets "a creature of your choice within
 * range"; the app tracks only the character's own AC, so the cast carries a
 * Self/Ally target control (Self by default). Casting on an ally still spends
 * the bonus action, the turn spell, the slot, and concentration — but writes no
 * `ac.miscBonus`, since the +2 lives on the ally (untracked world state, like
 * the Protection from Evil and Good ward).
 */
const shieldOfFaith: RuleModule = {
  id: 'spell-shield-of-faith',
  prepare: {
    spellId: 'shield-of-faith',
    level: 1,
    nameKey: `${S}.name`,
    preparedFact: 'spell.l1.shieldOfFaith.prepared',
    alwaysPreparedFact: 'spell.l1.shieldOfFaith.alwaysPrepared'
  },
  meta: {
    name: `${S}.name`,
    description: `${S}.description`,
    keywords: `${S}.keywords`,
    requires: ['spellcasting', 'concentration', 'prepared-spells']
  },
  derive: () => {
    const c: Contribution[] = [
      preparedSpellCount({
        preparedFact: 'spell.l1.shieldOfFaith.prepared',
        alwaysPreparedFact: 'spell.l1.shieldOfFaith.alwaysPrepared'
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
      id: 'cast-shield-of-faith',
      when: (f) => f.num('spell.l1.shieldOfFaith.prepared') === 1,
      ui: {
        section: 'bonus-action-spell',
        name: `${S}.name`,
        description: `${S}.description`,
        detailKey: 'spell/shield-of-faith',
        // No save DC line: the ward forces no saving throw (it raises AC).
        secondaryControl: {
          type: 'segmented',
          var: 'target',
          // Names the fieldset (aria-labelledby) and shows a visible "Target:"
          // label — the grapple/shove convention.
          prefix: 'play.choices.shield-of-faith.target',
          options: [
            { value: 1, label: `${S}.targetSelf` },
            { value: 0, label: `${S}.targetAlly` }
          ]
        },
        intents: { DEFEND: 'ward' },
        actionCost: ['bonus', 'conc', 'L1']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: `${SLOTS}.lowestAvailableSlotLevel` } },
        // 1 = ward yourself (the +2 lands on your AC); 0 = ward an ally (the +2
        // is theirs — untracked — so no self AC, but the spend and concentration
        // still apply).
        target: { capture: true, default: { number: 1 } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: `${S}.no_bonus_action`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${S}.no_spellcasting`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('concentration.remaining') > 0,
          diagnostics: [{ code: `${S}.already_concentrating`, severity: 'error' }]
        },
        {
          condition: (f) => f.num(`${SLOTS}.eligibleSlotsRemaining`) > 0,
          diagnostics: [{ code: `${S}.no_slots`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num(`${SLOTS}.lowestAvailableSlotLevel`);
        const onSelf = (typeof selections.target === 'number' ? selections.target : 1) === 1;
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'bonusActions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          },
          // The ward: holds concentration and — when self-cast — raises AC for
          // the duration or until any rest. An ally's ward holds concentration
          // but writes no self AC. Keyed so a failed concentration check's
          // eviction (an empty same-key effect) replaces it, releasing the
          // slot and (via the same effect) the AC bonus.
          {
            id: 'effect-shield-of-faith',
            key: CONCENTRATION_SPELL_KEY,
            state: { 'concentration.spent': 1, ...(onSelf ? { 'ac.miscBonus': 2 } : {}) },
            display: {
              name: 'rule.spell-shield-of-faith.effect-shield-of-faith.name'
            },
            expiry: [{ kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('bonusActions.remaining') <= 0)
          diagnostics.push({ code: `${S}.no_bonus_action`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${S}.no_spellcasting`, severity: 'error' });
        if (f.num('concentration.remaining') <= 0)
          diagnostics.push({ code: `${S}.already_concentrating`, severity: 'error' });
        if (level >= 1 && level <= 5) {
          advertise.push({
            id: `effect-shield-of-faith-slot-l${level}`,
            state: { [`spellcasting.slots.level${level}.spent`]: 1 },
            expiry: { kind: 'untilLongRest' }
          });
          if (f.num(`spellcasting.slots.level${level}.remaining`) <= 0)
            diagnostics.push({ code: `${S}.no_slots`, severity: 'error' });
        } else {
          diagnostics.push({ code: `${S}.no_slots`, severity: 'error' });
        }
        return { advertise, diagnostics };
      }
    }
  ]
};

export default defineRule(shieldOfFaith);
