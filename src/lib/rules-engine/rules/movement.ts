import {
  defineRule,
  type ActionResult,
  type Diagnostic,
  type FactReader,
  type LegalWhen,
  type Offer,
  type RuleModule
} from '../builder';

const MV = 'rule.dnd-5e-2024.movement';

/** Consume `distance × mult` from movement.remaining (an endOfTurn spend). */
function spendMovement(
  f: FactReader,
  selections: Record<string, unknown>,
  defaultFact: string,
  mult: number,
  outOfMovementCode: string,
  cannot: Recheck[] = []
): ActionResult {
  const distance =
    typeof selections.distance === 'number' ? selections.distance : f.num(defaultFact);
  const cost = distance * mult;
  const diagnostics: Diagnostic[] = [];
  if (f.num('character.movement.remaining') < cost)
    diagnostics.push({ code: outOfMovementCode, severity: 'error' });
  for (const check of cannot)
    if (!check.can(f)) diagnostics.push({ code: check.code, severity: 'error' });
  return {
    advertise: [
      { id: 'move', state: { 'character.movement.spent': cost }, expiry: { kind: 'endOfTurn' } }
    ],
    diagnostics
  };
}

/** An apply-time legality re-check (one `cannot` entry of spendMovement). */
interface Recheck {
  code: string;
  can: (f: FactReader) => boolean;
}

interface MoveCfg {
  id: string;
  nameKey: string;
  when?: (f: FactReader) => boolean;
  packBehind?: string;
  defaultDistanceFact: string;
  maxDistanceFact: string;
  mult: 1 | 2;
  legalWhen: LegalWhen[];
  outOfMovementCode: string;
  cannot?: Recheck[];
}

function moveOffer(cfg: MoveCfg): Offer {
  return {
    id: cfg.id,
    when: cfg.when,
    ui: {
      section: 'move',
      name: `${MV}.${cfg.nameKey}.name`,
      description: `${MV}.${cfg.nameKey}.description`,
      ...(cfg.packBehind ? { packBehind: cfg.packBehind } : {}),
      primaryControl: {
        type: 'slider',
        var: 'distance',
        max: { var: 'maxDistance' },
        step: 5,
        unit: 'ft'
      },
      intents: { MOVE: 'travel' },
      actionCost: ['move']
    },
    vars: {
      distance: { capture: true, default: { fact: cfg.defaultDistanceFact } },
      maxDistance: { default: { fact: cfg.maxDistanceFact } }
    },
    legalWhen: cfg.legalWhen,
    apply: (f, selections) =>
      spendMovement(
        f,
        selections,
        cfg.defaultDistanceFact,
        cfg.mult,
        cfg.outOfMovementCode,
        cfg.cannot
      )
  };
}

const REMAINING = 'character.movement.remaining';
const ge = (fact: string, value: number, code: string): LegalWhen => ({
  condition: (f) => f.num(fact) >= value,
  diagnostics: [{ code, severity: 'error' }]
});

// SRD 5.2 Prone, Restricted Movement: "Your only movement options are to
// crawl or to … right yourself." Every non-crawl travel offer carries this
// clause (and its apply re-check), sharing one diagnostic code.
const CANNOT_WHILE_PRONE = `${MV}.cannot_while_prone`;
const standing = (f: FactReader): boolean => f.num('condition.prone') === 0;
const notProne: LegalWhen = {
  condition: standing,
  diagnostics: [{ code: CANNOT_WHILE_PRONE, severity: 'error' }]
};
const notProneRecheck: Recheck = { code: CANNOT_WHILE_PRONE, can: standing };

/**
 * Movement: walk / rough terrain / crawl / swim / fly, each consuming feet from
 * `character.movement.remaining` (= total − spent). The legacy engine copied total → remaining
 * then decremented; here remaining is derived and each move advertises an
 * endOfTurn spend, so movement resets next turn with no reset rule. Rough terrain,
 * crawling, and costly swimming spend ×2; `half_remaining`/`half_total` are derived for
 * their slider defaults, and `half_speed` (floored) is the Get Up cost base.
 * While prone (SRD 5.2 Restricted Movement) every travel offer but CRAWL is
 * illegal — crawl itself exists only while prone (a structural gate, like Get Up).
 * The base distances come from the species. Foundational, so no search meta.
 */
const movement: RuleModule = {
  id: 'movement',
  derive: () => [
    {
      fact: REMAINING,
      value: (f) => f.num('character.movement.total') - f.num('character.movement.spent')
    },
    {
      fact: 'character.movement.half_total',
      value: (f) => f.num('character.movement.total') * 0.5
    },
    // Half your SPEED, floored (SRD 5.2 Prone: "half your Speed (round down)"
    // to right yourself) — unlike half_total/half_remaining, which stay
    // unrounded slider defaults. The species contributes `speed`; Dash never
    // touches it, so dashing does not raise the Get Up cost.
    {
      fact: 'character.movement.half_speed',
      value: (f) => Math.floor(f.num('character.movement.speed') * 0.5)
    },
    { fact: 'character.movement.half_remaining', value: (f) => f.num(REMAINING) * 0.5 }
  ],
  offer: () => [
    moveOffer({
      id: 'move-walk',
      nameKey: 'move-walk',
      defaultDistanceFact: REMAINING,
      maxDistanceFact: 'character.movement.total',
      mult: 1,
      legalWhen: [ge(REMAINING, 5, `${MV}.action-move-walk-offer.out_of_movement`), notProne],
      outOfMovementCode: `${MV}.action-move-walk-offer.out_of_movement`,
      cannot: [notProneRecheck]
    }),
    moveOffer({
      id: 'move-rough-terrain',
      nameKey: 'move-rough-terrain',
      packBehind: 'move-walk',
      defaultDistanceFact: 'character.movement.half_remaining',
      maxDistanceFact: 'character.movement.half_total',
      mult: 2,
      legalWhen: [
        ge(REMAINING, 10, `${MV}.action-move-rough-terrain-offer.out_of_movement`),
        notProne
      ],
      // The legacy planned-diagnostic reused the walk code here.
      outOfMovementCode: `${MV}.action-move-walk-offer.out_of_movement`,
      cannot: [notProneRecheck]
    }),
    // SRD 5.2 Prone, Restricted Movement: crawling is the only travel while
    // prone — a structural gate (the Get Up idiom), so the offer does not
    // exist while standing. Crawling costs 1 extra foot per foot (difficult
    // terrain's ×3 stacking is out of scope), so it shares the rough-terrain
    // shape: slider feet traversed (half_remaining default, half_total max),
    // ×2 spent, and the walk out-of-movement code.
    moveOffer({
      id: 'move-crawl',
      nameKey: 'move-crawl',
      when: (f) => f.num('condition.prone') > 0,
      packBehind: 'move-walk',
      defaultDistanceFact: 'character.movement.half_remaining',
      maxDistanceFact: 'character.movement.half_total',
      mult: 2,
      // 5 feet crawled × 2 (the rough-terrain threshold).
      legalWhen: [ge(REMAINING, 10, `${MV}.action-move-walk-offer.out_of_movement`)],
      outOfMovementCode: `${MV}.action-move-walk-offer.out_of_movement`
    }),
    moveOffer({
      id: 'move-swim',
      nameKey: 'move-swim',
      when: (f) => f.num('character.movement.swim.cost') === 1,
      packBehind: 'move-walk',
      defaultDistanceFact: REMAINING,
      maxDistanceFact: 'character.movement.total',
      mult: 1,
      legalWhen: [
        ge('character.movement.swim.can', 1, `${MV}.action-move-swim-offer.cannot_swim`),
        ge(REMAINING, 5, `${MV}.action-move-swim-offer.out_of_movement`),
        notProne
      ],
      outOfMovementCode: `${MV}.action-move-swim-offer.out_of_movement`,
      cannot: [
        {
          code: `${MV}.action-move-swim-offer.cannot_swim`,
          can: (f) => f.num('character.movement.swim.can') >= 1
        },
        notProneRecheck
      ]
    }),
    moveOffer({
      id: 'move-swim-costly',
      nameKey: 'move-swim',
      when: (f) => f.num('character.movement.swim.cost') === 2,
      packBehind: 'move-walk',
      defaultDistanceFact: 'character.movement.half_remaining',
      maxDistanceFact: 'character.movement.half_total',
      mult: 2,
      legalWhen: [
        ge('character.movement.swim.can', 1, `${MV}.action-move-swim-offer.cannot_swim`),
        ge(REMAINING, 10, `${MV}.action-move-swim-offer.out_of_movement`),
        notProne
      ],
      outOfMovementCode: `${MV}.action-move-swim-offer.out_of_movement`,
      cannot: [
        {
          code: `${MV}.action-move-swim-offer.cannot_swim`,
          can: (f) => f.num('character.movement.swim.can') >= 1
        },
        notProneRecheck
      ]
    }),
    moveOffer({
      id: 'move-fly',
      nameKey: 'move-fly',
      packBehind: 'move-walk',
      defaultDistanceFact: REMAINING,
      maxDistanceFact: 'character.movement.total',
      mult: 1,
      legalWhen: [
        ge('character.movement.fly.can', 1, `${MV}.action-move-fly-offer.cannot_fly`),
        ge(REMAINING, 5, `${MV}.action-move-fly-offer.out_of_movement`),
        notProne
      ],
      outOfMovementCode: `${MV}.action-move-fly-offer.out_of_movement`,
      cannot: [
        {
          code: `${MV}.action-move-fly-offer.cannot_fly`,
          can: (f) => f.num('character.movement.fly.can') >= 1
        },
        notProneRecheck
      ]
    })
  ]
};

export default defineRule(movement);
