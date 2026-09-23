import { describe, it, expect } from 'vitest';
import { evaluate, NOTICE_TARGET } from '$lib/rules-engine';
import type { Facts } from '$lib/rules-engine';
import enCommon from '$lib/i18n/en/common.json';
import tlhCommon from '$lib/i18n/en-x-tlh/common.json';
import paladinLevel6 from '$lib/rules-engine/rules/class-paladin-level6';

/**
 * Paladin level 6 — the Aura of Protection notice.
 *
 * The aura has always been a rider: a default-on toggle chip on every save
 * panel worth the Charisma modifier (minimum +1). It is also a standing
 * condition the player must know before ANY save — theirs or a nearby ally's
 * — so the same annotation now carries the reserved 'notice' target alongside
 * its panel targets, and the notices strip renders it with a body quoting the
 * live +X bonus — but NOT the derivation ("Charisma modifier, minimum +1" is
 * maths the table doesn't need re-quoted; the chips do the calculating). The
 * rule module cannot import the constant (rule modules import only the
 * builder), so this test pins its literal 'notice' to NOTICE_TARGET.
 */
const A = 'rule.class-paladin-level6';
// A minimal module set: the level-6 module alone. Its derives read
// con.modifier (max HP) and its annotate reads cha.modifier (the bonus) —
// neither is derived by any module here, so both arrive as genuine inputs.
const FACTS: Facts = { 'cha.modifier': 3, 'con.modifier': 1 };

const auraAnnotation = (inputFacts: Facts) =>
  evaluate({ modules: [paladinLevel6], inputFacts, planned: [] }).annotations.find(
    (a) => a.key === `${A}.aura-of-protection`
  );

describe('paladin level 6 annotate — aura of protection notice', () => {
  it('the aura annotation doubles as a notice quoting the live bonus, not the derivation', () => {
    const aura = auraAnnotation(FACTS);
    expect(aura, 'the aura annotation exists').toBeDefined();
    // The save panels keep their targets; 'notice' rides alongside (the
    // reserved label no panel declares), so the notices strip claims it too.
    expect(aura!.targets).toEqual(['save.any', 'save.any.companion', NOTICE_TARGET]);
    expect(aura!.source).toBe(`${A}.name`);
    expect(aura!.body).toBe(`${A}.aura-of-protection.body`);
    // One number, two renderings: the sentence interpolates exactly what the
    // chip folds into the roll.
    expect(aura!.values).toEqual({ bonus: 3 });
    expect(aura!.rider?.value).toEqual({ kind: 'flat', bonus: 3 });
  });

  it('the notice bonus floors at +1 for an unset and a negative Charisma modifier', () => {
    for (const modifier of [0, -1]) {
      const aura = auraAnnotation({ ...FACTS, 'cha.modifier': modifier });
      expect(aura!.values, `modifier ${modifier}`).toEqual({ bonus: 1 });
    }
  });

  it('the body quotes the number and spares the maths — in both locales', () => {
    for (const catalog of [enCommon, tlhCommon]) {
      const ns = (catalog.rule as unknown as Record<string, Record<string, string | undefined>>)[
        'class-paladin-level6'
      ];
      const body = ns?.['aura-of-protection.body'];
      expect(body, 'body template exists').toBeDefined();
      // {{bonus}} double-brace (sveltekit-i18n), and it is the ONLY param.
      expect(body?.match(/{{[a-zA-Z]+}}/g)).toEqual(['{{bonus}}']);
    }
    // The en body carries the answer, never the working: no derivation
    // parenthetical (the canary locale only needs the param contract above).
    const en = (enCommon.rule as unknown as Record<string, Record<string, string | undefined>>)[
      'class-paladin-level6'
    ]?.['aura-of-protection.body'];
    expect(en).not.toContain('Charisma modifier');
    expect(en).not.toContain('minimum');
  });
});
