import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine';
import featAlert from '$lib/rules-engine/rules/feat-alert';
import initiative from '$lib/rules-engine/rules/initiative';

/**
 * Alert — SRD 5.2 grants ONLY two benefits: "Initiative Proficiency. When you
 * roll Initiative, you can add your Proficiency Bonus to the roll." and
 * "Initiative Swap. Immediately after you roll Initiative, you can swap your
 * Initiative with the Initiative of one willing ally in the same combat."
 * Both are modelled (the dice.initiative annotations + the swap roll), so the
 * module must emit NOTHING else — in particular no "can't be surprised"
 * notice: that is the 2014 feat, not 2024, and it was removed as invented
 * rule text. This guard pins that removal.
 */
const A = 'rule.dnd-5e-2024.feat-alert';

describe('feat-alert annotate — initiative benefits only', () => {
  it('emits no notice — SRD 5.2 Alert has no surprise benefit to remind', () => {
    const out = evaluate({ modules: [featAlert], inputFacts: {}, planned: [] });
    const notices = out.annotations.filter((a) => a.targets.includes('notice'));
    expect(notices).toEqual([]);
    expect(out.annotations.find((a) => a.key === `${A}.notice-surprise`)).toBeUndefined();
  });

  it('leaves the existing initiative annotations untouched', () => {
    const out = evaluate({ modules: [featAlert], inputFacts: {}, planned: [] });
    for (const suffix of ['annotation-swap', 'annotation-proficiency']) {
      const ann = out.annotations.find((a) => a.key === `${A}.${suffix}`);
      expect(ann, `${A}.${suffix} still exists`).toBeDefined();
      expect(ann!.targets).toEqual(['dice.initiative']);
    }
  });

  it('emits no alert annotations without the feat', () => {
    const out = evaluate({ modules: [initiative], inputFacts: {}, planned: [] });
    expect(out.annotations.filter((a) => a.key.startsWith(`${A}.`))).toEqual([]);
  });
});
