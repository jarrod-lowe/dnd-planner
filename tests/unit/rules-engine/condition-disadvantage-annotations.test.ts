import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate } from '$lib/rules-engine';
import type { Facts, PlannedRef, RuleModule } from '$lib/rules-engine';
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
 * reason. Each imposing source answers with a VALUELESS rider in its annotate
 * pass (the GWF idiom): no `value`, so it renders as a text chip naming WHY
 * the matched panels default to 2d20-take-low (or take-high), and its label
 * rides the roll toast. A valueless rider has NO appliesTo purpose filter —
 * the scope IS the targets list, so these pins assert it exactly: `attack.any`
 * (weapons + unarmed), `check.any`/`check.<skill>` (the check rollers),
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
  chipKey = 'disadvantage'
): void {
  const key = `${ns}.${chipKey}`;
  describe(`${name} — ${chipKey} attribution chip`, () => {
    it('emits a valueless rider on exactly the panels whose rolls it disadvantages', () => {
      const ann = chipFrom(mod, ruleId, key);
      expect(ann, `${key} exists while the condition is live`).toBeDefined();
      expect(ann!.targets, 'the scope — no appliesTo filter exists for valueless riders').toEqual(
        targets
      );
      expect(ann!.rider, 'no value → text chip + toast label, never a modifier chip').toEqual({
        label: `${ns}.rider`,
        type: 'modifier'
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

pinsChip('condition-prone', conditionProne, 'record-prone', 'rule.dnd-5e-2024.condition-prone', [
  'attack.any'
]);
pinsChip(
  'condition-blinded',
  conditionBlinded,
  'record-blinded',
  'rule.dnd-5e-2024.condition-blinded',
  ['attack.any']
);
pinsChip(
  'condition-grappled',
  conditionGrappled,
  'record-grappled',
  'rule.dnd-5e-2024.condition-grappled',
  ['attack.any']
);
pinsChip(
  'condition-restrained',
  conditionRestrained,
  'record-restrained',
  'rule.dnd-5e-2024.condition-restrained',
  ['attack.any', 'save.dex']
);
// Poisoned reaches every D20 Test except saves: attacks, the checks (broad
// label, never dice.any — it would leak onto the save recorders), Initiative.
pinsChip(
  'condition-poisoned',
  conditionPoisoned,
  'record-poisoned',
  'rule.dnd-5e-2024.condition-poisoned',
  ['attack.any', 'check.any', 'dice.initiative']
);
pinsChip(
  'condition-incapacitated',
  conditionIncapacitated,
  'record-incapacitated',
  'rule.dnd-5e-2024.condition-incapacitated',
  ['dice.initiative']
);

// Frightened's chip is bespoke: its disadvantage is PER ROW (the LoS toggle
// carries it), so the chip states the condition's standing rule — a single
// sight-QUALIFIED sentence, NOT a seed-flipped variant. A flip cannot be
// per-row correct: rows capture their own sight value while the seed feeds
// forward, and annotation text is computed from global facts only, so a
// flipped key would contradict rows whose capture differs from the seed.
describe('condition-frightened — disadvantage attribution chip', () => {
  const CF = 'rule.dnd-5e-2024.condition-frightened';

  it('names the disadvantage the LoS chip forces, on attacks and checks', () => {
    const ann = chipFrom(conditionFrightened, 'record-frightened', `${CF}.disadvantage`);
    expect(ann).toBeDefined();
    expect(ann!.targets).toEqual(['attack.any', 'check.any']);
    expect(ann!.rider).toEqual({ label: `${CF}.rider`, type: 'modifier' });
  });

  it('the sentence is standing-qualified — the SAME chip in every sight state', () => {
    const all = evaluate({
      modules: [conditionFrightened],
      inputFacts: { 'frightened.sourceHidden': 1 },
      planned: [record('record-frightened')]
    }).annotations.map((a) => a.key);
    expect(all, 'the one qualified key, seed-independent').toContain(`${CF}.disadvantage`);
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

// Invisible is the ADVANTAGE polarity: same idiom, the ▲ explained.
pinsChip(
  'condition-invisible',
  conditionInvisible,
  'record-invisible',
  'rule.dnd-5e-2024.condition-invisible',
  ['attack.any', 'dice.initiative'],
  'advantage'
);

// Untrained armor: the shared builder-hosted chip. The annotation-targets
// orphan probe CANNOT fire this gate (its permissive reader sets proficiency
// to 1, un-setting the gate), so this pin is also the label-carriage guard
// for check.<skill> — a renamed check label breaks here first.
describe('untrained armor — disadvantage attribution chip', () => {
  const KEY = 'rule.dnd-5e-2024.armor-training.disadvantage';
  const hasChip = (mod: RuleModule, inputFacts: Facts, ruleId: string | null) =>
    evaluate({
      modules: [mod],
      inputFacts,
      planned: ruleId ? [record(ruleId)] : []
    }).annotations.some((a) => a.key === KEY);

  it('leather, worn without training, chips exactly the panels its flags disadvantage', () => {
    const ann = evaluate({
      modules: [leatherArmor],
      inputFacts: { 'armor.light.proficient': 0 },
      planned: [record('don-leather-armor')]
    }).annotations.find((a) => a.key === KEY);
    expect(ann).toBeDefined();
    expect(ann!.targets).toEqual([
      'attack.any',
      'dice.initiative',
      'check.acrobatics',
      'check.athletics',
      'check.sleight-of-hand',
      'check.stealth'
    ]);
    expect(ann!.rider).toEqual({
      label: 'rule.dnd-5e-2024.armor-training.rider',
      type: 'modifier'
    });
  });

  it('no chip while trained, nor before donning', () => {
    expect(
      hasChip(leatherArmor, { 'armor.light.proficient': 1 }, 'don-leather-armor'),
      'a proficient wearer rolls normally'
    ).toBe(false);
    expect(hasChip(leatherArmor, { 'armor.light.proficient': 0 }, null), 'nothing worn').toBe(
      false
    );
  });

  it('splint, worn without training, carries the same shared chip', () => {
    expect(hasChip(splintArmor, { 'armor.heavy.proficient': 0 }, 'don-splint-armor')).toBe(true);
  });
});

describe('attribution chips — i18n contract', () => {
  // Every chip sentence + rider label, per source (the frightened-los
  // precedent: the coverage test only sees keys referenced in src, so the
  // flipped variant and the armor namespace are pinned here directly).
  const SOURCES: [module: string, chipKey: string][] = [
    ['condition-prone', 'disadvantage'],
    ['condition-blinded', 'disadvantage'],
    ['condition-grappled', 'disadvantage'],
    ['condition-restrained', 'disadvantage'],
    ['condition-poisoned', 'disadvantage'],
    ['condition-incapacitated', 'disadvantage'],
    ['condition-frightened', 'disadvantage'],
    ['condition-invisible', 'advantage'],
    ['armor-training', 'disadvantage']
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
