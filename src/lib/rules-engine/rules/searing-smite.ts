import {
  defineRule,
  preparedSpellCount,
  type Annotation,
  type ActionResult,
  type Contribution,
  type Diagnostic,
  type EffectInstance,
  type FactReader,
  type RuleModule
} from '../builder';

const LEVELS = [1, 2, 3, 4, 5] as const;
const S = 'rule.spell-searing-smite.offer-searing-smite';
const R = 'rule.spell-searing-smite';
const FIRE = 'fire';
/** The burn marker's authored effect id (annotate matches it by id suffix). */
const BURN_EFFECT_ID = 'effect-searing-smite';

/**
 * Searing Smite — a Level 1 bonus-action smite cast immediately after hitting
 * with a Melee weapon or an Unarmed Strike (+1d6 fire on the hit; 1d6/turn burn
 * and a CON save to end, living on the TARGET). Resource mechanics exactly like
 * Thunderous Smite — prepare path + a L1–5 slot cascade + a cast that spends a
 * bonus action, the turn spell, and a slot — with one deliberate difference:
 * SRD 5.2 gives Searing Smite a FLAT 1-minute duration (the paladin spell table
 * shows Special = "—"), so this is NOT concentration. The cast raises
 * `effect-searing-smite`, a 10-round marker carrying the per-turn fire dice
 * (a literal display value — "Nd6 fire/turn" for a slot-N cast, so stacked
 * burns on several targets each show their own dice); the hit's extra fire
 * damage is a dice-line rider, and the target's
 * saves are untracked world state — a successful save ends the spell early, so
 * the user dismisses the chip (the Thunderous Smite push precedent for the
 * parts that live on the target).
 */
const searingSmite: RuleModule = {
  id: 'spell-searing-smite',
  prepare: {
    spellId: 'searing-smite',
    level: 1,
    nameKey: `${S}.name`,
    preparedFact: 'spell.l1.searingSmite.prepared',
    alwaysPreparedFact: 'spell.l1.searingSmite.alwaysPrepared'
  },
  meta: {
    name: `${S}.name`,
    description: `${S}.description`,
    keywords: `${S}.keywords`,
    requires: ['spellcasting', 'prepared-spells']
  },
  derive: () => {
    const c: Contribution[] = [
      preparedSpellCount({
        preparedFact: 'spell.l1.searingSmite.prepared',
        alwaysPreparedFact: 'spell.l1.searingSmite.alwaysPrepared'
      }),
      {
        fact: 'ssmite.eligibleSlotsRemaining',
        value: (f) =>
          LEVELS.reduce((s, n) => s + f.num(`spellcasting.slots.level${n}.remaining`), 0)
      },
      {
        fact: 'ssmite.lowestAvailableSlotLevel',
        value: (f) => {
          for (const n of LEVELS) if (f.num(`spellcasting.slots.level${n}.remaining`) > 0) return n;
          return 0;
        }
      },
      // Smite handles L1-5 even for a multiclass full caster.
      {
        fact: 'ssmite.maxCastLevel',
        value: (f) => Math.min(f.num('spellcasting.maxSlotLevel'), 5)
      },
      {
        // 1d6 at L1, +1 die per level above 1 (so N dice at slot level N); 0 if none.
        fact: 'ssmite.defaultDieCount',
        value: (f) => f.num('ssmite.lowestAvailableSlotLevel')
      }
    ];
    return c;
  },
  offer: () => [
    {
      id: 'cast-searing-smite',
      when: (f) => f.num('spell.l1.searingSmite.prepared') === 1,
      ui: {
        section: 'bonus-action-spell',
        name: `${S}.name`,
        description: `${S}.description`,
        detailKey: 'spell/searing-smite',
        dieSides: 6,
        showDC: true,
        saveType: 'CON',
        primaryControl: {
          type: 'slider',
          var: 'slotLevel',
          min: { number: 1 },
          max: { fact: 'ssmite.maxCastLevel' },
          valueFormat: 'spellLevel'
        },
        // The secondary control rolls the hit's extra fire dice, so Heroic
        // Inspiration's "reroll any die" reminder belongs on this panel.
        annotationLabels: ['dice.any'],
        secondaryControl: {
          type: 'dice-line',
          dice: [
            {
              sides: 6,
              count: { var: 'slotLevel', min: 1 },
              damageType: { string: FIRE },
              purpose: 'damage'
            }
          ]
        },
        information: [
          {
            type: 'text',
            // The TARGET makes a CON save each turn against the ongoing burn (the
            // ui.saveType flag above); the DC value is the spell save DC.
            label: 'play.information.saveDcCon',
            labelValues: { dc: { fact: 'spellcasting.saveDC' } }
          }
        ],
        intents: { ATTACK: 'spells' },
        actionCost: ['bonus', 'L1']
      },
      vars: {
        slotLevel: { capture: true, default: { fact: 'ssmite.lowestAvailableSlotLevel' } },
        dieCount: { capture: true, default: { fact: 'ssmite.defaultDieCount' } }
      },
      legalWhen: [
        {
          condition: (f) => f.num('bonusActions.remaining') > 0,
          diagnostics: [{ code: `${S}.no_bonus_action`, severity: 'error' }]
        },
        {
          // A MELEE attack, not the Attack action — the same trigger and the
          // same gate as Divine/Thunderous Smite, for the same reason: an
          // opportunity attack and a Light off-hand swing are melee hits that
          // take no Attack action, while Grapple, Shove and a thrown hit take
          // the Attack action and are not melee hits. See `attackKindState`.
          condition: (f) => f.num('attack.last.melee') >= 1,
          diagnostics: [{ code: `${S}.no_attack`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('ssmite.eligibleSlotsRemaining') > 0,
          diagnostics: [{ code: `${S}.no_slots`, severity: 'error' }]
        },
        {
          condition: (f) => f.num('spellcasting.remaining') > 0,
          diagnostics: [{ code: `${S}.no_spellcasting`, severity: 'error' }]
        }
      ],
      apply: (f, selections): ActionResult => {
        const level =
          typeof selections.slotLevel === 'number'
            ? selections.slotLevel
            : f.num('ssmite.lowestAvailableSlotLevel');
        const advertise: EffectInstance[] = [
          {
            id: 'cost',
            state: { 'bonusActions.spent': 1, 'spellcasting.spent': 1 },
            expiry: { kind: 'endOfTurn' }
          },
          // The burn: a 10-round marker (flat 1-minute duration — NOT
          // concentration) carrying the per-turn fire dice. The chip shows
          // "Nd6 fire/turn" for the slot the smite was cast at; a successful
          // target save ends the spell early, so the user dismisses it.
          {
            id: BURN_EFFECT_ID,
            state: { 'ssmite.burnDice': level },
            display: {
              name: 'rule.spell-searing-smite.effect-searing-smite.name',
              // The literal per-effect amount, NOT a displayFact: burns on
              // several targets stack as separate chips, and the summed fact
              // would show the total on every chip.
              value: level
            },
            expiry: [{ kind: 'turns', remaining: 10 }, { kind: 'untilShortRest' }]
          }
        ];
        const diagnostics: Diagnostic[] = [];
        if (f.num('bonusActions.remaining') <= 0)
          diagnostics.push({ code: `${S}.no_bonus_action`, severity: 'error' });
        if (f.num('attack.last.melee') < 1)
          diagnostics.push({ code: `${S}.no_attack`, severity: 'error' });
        if (f.num('spellcasting.remaining') <= 0)
          diagnostics.push({ code: `${S}.no_spellcasting`, severity: 'error' });
        if (level >= 1 && level <= 5) {
          advertise.push({
            id: `effect-searing-smite-slot-l${level}`,
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
  ],
  // "Searing Smite available" on melee/unarmed attack panels, mirroring Thunderous
  // and Divine Smite. The gate is the cast offer's `when` plus its four legality
  // conditions, exactly — which is what lets the reminder hand the player the row
  // (`addsToPlan`) instead of only telling them about it.
  //
  // While burns are live, each raises its own NOTICE reminding the player of
  // that burning target's turn-start ritual. The DC interpolates from
  // `spellcasting.saveDC`; the dice are deliberately NOT in the string —
  // `ssmite.burnDice` folds `combine: 'sum'`, so burns on several targets
  // would read as one wrong number.
  annotate: (f: FactReader, committed: EffectInstance[]) => {
    const annotations: Annotation[] = [];
    if (
      f.num('spell.l1.searingSmite.prepared') === 1 &&
      f.num('bonusActions.remaining') > 0 &&
      f.num('attack.last.melee') >= 1 &&
      f.num('ssmite.eligibleSlotsRemaining') > 0 &&
      f.num('spellcasting.remaining') > 0
    ) {
      annotations.push({
        key: `${R}.annotation`,
        targets: ['attack.melee', 'attack.unarmed'],
        addsToPlan: { offer: 'cast-searing-smite' }
      });
    }
    // ONE NOTICE PER BURN: the spell is flat 1-minute (NOT concentration), so
    // burns on several targets are legal, and each burns on its own target's
    // turn — enumerate the live burn effects (matched by their committed-id
    // suffix; the slot spends are `…-slot-lN` and do not match) and emit a
    // notice id'd by each effect's instance id, rolling only THAT burn's dice
    // (the effect's literal `display.value`, the slot level it was cast at —
    // the same number its chip shows). The summed `ssmite.burnDice` fact is no
    // longer read here: it folds burns across targets into one number, which
    // is exactly the wrong shape for per-target reminders. The player rolls
    // the dice (the target's save is the target's), so the notice strip mounts
    // a roller per notice.
    for (const effect of committed) {
      if (!effect.id.endsWith(`#${BURN_EFFECT_ID}`)) continue;
      const notice: Annotation = {
        id: effect.id,
        key: `${R}.notice-burning`,
        // 'notice' == NOTICE_TARGET; rule modules may import only the builder,
        // so the reserved label is a literal here (see feat-sentinel) and the
        // unit test pins it to the exported constant.
        targets: ['notice'],
        source: `${S}.name`,
        body: `${R}.notice-burning.body`,
        values: { dc: f.num('spellcasting.saveDC') }
      };
      // The burn always authors `display.value` (its own die count). Should a
      // future burn omit it, the notice still fires — it just carries no roll
      // rather than guessing a count.
      const dice = effect.display?.value;
      if (dice !== undefined) {
        notice.roll = { sides: 6, count: dice, damageType: FIRE, purpose: 'damage' };
      }
      annotations.push(notice);
    }
    return annotations;
  }
};

export default defineRule(searingSmite);
