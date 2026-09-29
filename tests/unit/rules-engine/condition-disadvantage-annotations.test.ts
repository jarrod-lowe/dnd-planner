import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate } from '$lib/rules-engine';
import type { Facts, PlannedRef, RuleModule } from '$lib/rules-engine';
import type { RollPurpose } from '$lib/rules-view';
import conditionProne from '$lib/rules-engine/rules/condition-prone';
import conditionBlinded from '$lib/rules-engine/rules/condition-blinded';
import conditionGrappled from '$lib/rules-engine/rules/condition-grappled';
import conditionRestrained from '$lib/rules-engine/rules/condition-restrained';
import conditionPoisoned from '$lib/rules-engine/rules/condition-poisoned';
import conditionIncapacitated from '$lib/rules-engine/rules/condition-incapacitated';
import conditionFrightened from '$lib/rules-engine/rules/condition-frightened';
import conditionInvisible from '$lib/rules-engine/rules/condition-invisible';
import leatherArmor from '$lib/rules-engine/rules/leather-armor';
import splintArmor from '$lib/rules-engine/rules/splint-armor';

/**
 * The disadvantage/advantage ATTRIBUTION chips: the roll-mode facts
 * (`attack.str.disadvantage`, `check.disadvantage`, …) are max-combined and
 * source-blind by construction, so the dice-lines render a bare ▼ with no
 * reason. Each imposing source answers with VALUELESS riders in its annotate
 * pass (the GWF idiom): no `value`, so each renders as a text chip naming WHY
 * the matched panels default to 2d20-take-low (or take-high), and its label
 * rides the roll toast of exactly the governed die — `rider.appliesTo`
 * scopes the toast label per purpose, the Exhaustion precedent of ONE
 * annotation per D20 Test kind (a weapon panel matches attack.any as a PANEL
 * label, so without appliesTo the attribution would ride the DAMAGE toast
 * too). The PANEL scope is still the targets list — `attack.any` (weapons +
 * unarmed), `check.any`/`check.<skill>` (the check rollers),
 * `dice.initiative`, `save.<ability>`. Never `dice.any`: it reaches every
 * dice panel including saves the source does not touch.
 */
const record = (ruleId: string): PlannedRef => ({ instanceId: 'c1', ruleId });

const chipFrom = (mod: RuleModule, ruleId: string, key: string, inputFacts: Facts = {}) =>
  evaluate({ modules: [mod], inputFacts, planned: [record(ruleId)] }).annotations.find(
    (a) => a.key === key
  );

/** One source's attribution pin: silent while not live; scoped + valueless live. */
function pinsChip(
  name: string,
  mod: RuleModule,
  ruleId: string,
  ns: string,
  targets: string[],
  appliesTo: RollPurpose,
  chipKey = 'disadvantage'
): void {
  const key = `${ns}.${chipKey}`;
  describe(`${name} — ${chipKey} attribution chip`, () => {
    it('emits a valueless rider on exactly the panels whose rolls it affects', () => {
      const ann = chipFrom(mod, ruleId, key);
      expect(ann, `${key} exists while the condition is live`).toBeDefined();
      expect(ann!.targets, 'the panel scope — labels, never a purpose filter').toEqual(targets);
      expect(ann!.rider, 'no value → text chip; appliesTo scopes the toast label').toEqual({
        label: `${ns}.rider`,
        type: 'modifier',
        appliesTo
      });
    });

    it('emits nothing while the condition is not live', () => {
      expect(
        evaluate({ modules: [mod], inputFacts: {}, planned: [] }).annotations.some(
          (a) => a.key === key
        ),
        `${key} absent with no committed condition`
      ).toBe(false);
    });
  });
}

pinsChip(
  'condition-prone',
  conditionProne,
  'record-prone',
  'rule.dnd-5e-2024.condition-prone',
  ['attack.any'],
  'to-hit'
);
pinsChip(
  'condition-blinded',
  conditionBlinded,
  'record-blinded',
  'rule.dnd-5e-2024.condition-blinded',
  ['attack.any'],
  'to-hit'
);
pinsChip(
  'condition-grappled',
  conditionGrappled,
  'record-grappled',
  'rule.dnd-5e-2024.condition-grappled',
  ['attack.any'],
  'to-hit'
);
// Restrained touches two D20 Test kinds, so two chips (the Exhaustion
// one-per-kind precedent): the STR/DEX attack flags, then save.dex.
pinsChip(
  'condition-restrained',
  conditionRestrained,
  'record-restrained',
  'rule.dnd-5e-2024.condition-restrained',
  ['attack.any'],
  'to-hit'
);
pinsChip(
  'condition-restrained',
  conditionRestrained,
  'record-restrained',
  'rule.dnd-5e-2024.condition-restrained',
  ['save.dex'],
  'save',
  'disadvantage-save'
);
// Poisoned reaches every D20 Test except saves: the checks chip carries the
// broad label (never dice.any — it would leak onto the save recorders) plus
// Initiative, whose die is purpose 'check'.
pinsChip(
  'condition-poisoned',
  conditionPoisoned,
  'record-poisoned',
  'rule.dnd-5e-2024.condition-poisoned',
  ['attack.any'],
  'to-hit'
);
pinsChip(
  'condition-poisoned',
  conditionPoisoned,
  'record-poisoned',
  'rule.dnd-5e-2024.condition-poisoned',
  ['check.any', 'dice.initiative'],
  'check',
  'disadvantage-checks'
);
pinsChip(
  'condition-incapacitated',
  conditionIncapacitated,
  'record-incapacitated',
  'rule.dnd-5e-2024.condition-incapacitated',
  ['dice.initiative'],
  'check'
);

// Frightened's chips are bespoke: the disadvantage is PER ROW (the LoS toggle
// carries it), so each chip states the condition's standing rule — a
// sight-QUALIFIED sentence, NOT a seed-flipped variant. A flip cannot be
// per-row correct: rows capture their own sight value while the seed feeds
// forward, and annotation text is computed from global facts only, so a
// flipped key would contradict rows whose capture differs from the seed.
describe('condition-frightened — disadvantage attribution chips', () => {
  const CF = 'rule.dnd-5e-2024.condition-frightened';

  it('names the disadvantage the LoS chip forces: attacks and checks, one chip each', () => {
    for (const [chipKey, targets, appliesTo] of [
      ['disadvantage', ['attack.any'], 'to-hit'],
      ['disadvantage-checks', ['check.any'], 'check']
    ] as const) {
      const ann = chipFrom(conditionFrightened, 'record-frightened', `${CF}.${chipKey}`);
      expect(ann, `${chipKey} exists`).toBeDefined();
      expect(ann!.targets).toEqual(targets);
      expect(ann!.rider).toEqual({ label: `${CF}.rider`, type: 'modifier', appliesTo });
    }
  });

  it('the sentences are standing-qualified — the SAME chips in every sight state', () => {
    const all = evaluate({
      modules: [conditionFrightened],
      inputFacts: { 'frightened.sourceHidden': 1 },
      planned: [record('record-frightened')]
    }).annotations.map((a) => a.key);
    expect(all, 'both qualified keys, seed-independent').toContain(`${CF}.disadvantage`);
    expect(all).toContain(`${CF}.disadvantage-checks`);
    expect(all, 'no flipped variant to contradict a row capture').not.toContain(
      `${CF}.disadvantage-hidden`
    );
  });

  it('emits nothing while the condition is not live', () => {
    expect(
      evaluate({ modules: [conditionFrightened], inputFacts: {}, planned: [] }).annotations.some(
        (a) => a.key.startsWith(`${CF}.disadvantage`)
      )
    ).toBe(false);
  });
});

// Invisible is the ADVANTAGE polarity: same idiom, the ▲ explained — the
// attack flags, then the Initiative advantage (its die is purpose 'check').
pinsChip(
  'condition-invisible',
  conditionInvisible,
  'record-invisible',
  'rule.dnd-5e-2024.condition-invisible',
  ['attack.any'],
  'to-hit',
  'advantage'
);
pinsChip(
  'condition-invisible',
  conditionInvisible,
  'record-invisible',
  'rule.dnd-5e-2024.condition-invisible',
  ['dice.initiative'],
  'check',
  'advantage-initiative'
);

// Untrained armor: the shared builder-hosted chips. The annotation-targets
// orphan probe CANNOT fire this gate (its permissive reader sets proficiency
// to 1, un-setting the gate), so this pin is also the label-carriage guard
// for check.<skill> — a renamed check label breaks here first.
describe('untrained armor — disadvantage attribution chips', () => {
  const NS = 'rule.dnd-5e-2024.armor-training';
  const anns = (mod: RuleModule, inputFacts: Facts, planned: PlannedRef[]) =>
    evaluate({ modules: [mod], inputFacts, planned }).annotations;

  it('leather, worn without training, chips exactly the panels its flags disadvantage', () => {
    const live = anns(leatherArmor, { 'armor.light.proficient': 0 }, [record('don-leather-armor')]);
    const attack = live.find((a) => a.key === `${NS}.disadvantage`);
    expect(attack).toBeDefined();
    expect(attack!.targets).toEqual(['attack.any']);
    expect(attack!.rider).toEqual({ label: `${NS}.rider`, type: 'modifier', appliesTo: 'to-hit' });

    const checks = live.find((a) => a.key === `${NS}.disadvantage-checks`);
    expect(checks).toBeDefined();
    expect(checks!.targets).toEqual([
      'dice.initiative',
      'check.acrobatics',
      'check.athletics',
      'check.sleight-of-hand',
      'check.stealth'
    ]);
    expect(checks!.rider).toEqual({ label: `${NS}.rider`, type: 'modifier', appliesTo: 'check' });
  });

  it('no chip while trained, nor before donning', () => {
    const keys = (inputFacts: Facts, ruleId: string | null) =>
      anns(leatherArmor, inputFacts, ruleId ? [record(ruleId)] : [])
        .map((a) => a.key)
        .filter((k) => k.startsWith(NS));
    expect(
      keys({ 'armor.light.proficient': 1 }, 'don-leather-armor'),
      'a proficient wearer rolls normally'
    ).toEqual([]);
    expect(keys({ 'armor.light.proficient': 0 }, null), 'nothing worn').toEqual([]);
  });

  it('splint, worn without training, carries the same shared chips', () => {
    const live = anns(splintArmor, { 'armor.heavy.proficient': 0 }, [record('don-splint-armor')]);
    expect(live.some((a) => a.key === `${NS}.disadvantage`)).toBe(true);
    expect(live.some((a) => a.key === `${NS}.disadvantage-checks`)).toBe(true);
  });
});

describe('attribution chips — i18n contract', () => {
  // Every chip sentence + rider label, per source (the frightened-los
  // precedent: the coverage test only sees keys referenced in src, so the
  // armor namespace and every split variant are pinned here directly).
  const SOURCES: [module: string, chipKey: string][] = [
    ['condition-prone', 'disadvantage'],
    ['condition-blinded', 'disadvantage'],
    ['condition-grappled', 'disadvantage'],
    ['condition-restrained', 'disadvantage'],
    ['condition-restrained', 'disadvantage-save'],
    ['condition-poisoned', 'disadvantage'],
    ['condition-poisoned', 'disadvantage-checks'],
    ['condition-incapacitated', 'disadvantage'],
    ['condition-frightened', 'disadvantage'],
    ['condition-frightened', 'disadvantage-checks'],
    ['condition-invisible', 'advantage'],
    ['condition-invisible', 'advantage-initiative'],
    ['armor-training', 'disadvantage'],
    ['armor-training', 'disadvantage-checks']
  ];

  it('every chip sentence and rider label exists in BOTH locales', () => {
    for (const locale of ['en', 'en-x-tlh']) {
      const dict = JSON.parse(
        readFileSync(join(process.cwd(), `src/lib/i18n/${locale}/common.json`), 'utf8')
      ) as Record<string, Record<string, Record<string, Record<string, string>>>>;
      const ns = dict['rule']['dnd-5e-2024'];
      for (const [module, chipKey] of SOURCES) {
        expect(ns[module]?.[chipKey], `${locale}: ${module}.${chipKey}`).toBeTruthy();
        expect(ns[module]?.['rider'], `${locale}: ${module}.rider`).toBeTruthy();
      }
    }
  });
});
