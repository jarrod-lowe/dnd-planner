import { describe, it, expect } from 'vitest';
import { evaluate } from '$lib/rules-engine/evaluate';
import type { EngineInput, EngineOutput, Rule } from '$lib/rules-engine/types';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const scenariosDir = join(dirname(fileURLToPath(import.meta.url)), 'scenarios');

interface Step {
  add?: Rule[];
  remove?: string[];
  acceptOffer?: string[];
}

// Auto-discover scenario directories
const scenarios = existsSync(scenariosDir)
  ? readdirSync(scenariosDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
  : [];

describe('rules-engine e2e scenarios', () => {
  for (const scenarioName of scenarios) {
    it(scenarioName, () => {
      const scenarioPath = join(scenariosDir, scenarioName);

      // Load input
      const input: EngineInput = JSON.parse(
        readFileSync(join(scenarioPath, 'input.json'), 'utf-8')
      );

      // Initial evaluation
      let output: EngineOutput = evaluate(input);

      // Process steps (step1.json, step2.json, ...)
      let stepNum = 1;
      while (existsSync(join(scenarioPath, `step${stepNum}.json`))) {
        const stepContent = readFileSync(join(scenarioPath, `step${stepNum}.json`), 'utf-8');
        const step: Step = JSON.parse(stepContent);

        // Modify planned rules
        let planned = [...output.next.rules.planned];
        if (step.remove) {
          const removeIds = step.remove;
          planned = planned.filter((r: Rule) => !removeIds.includes(r.id));
        }
        if (step.acceptOffer) {
          for (const offerId of step.acceptOffer) {
            const offered = output.availableRules.find((ar) => ar.rule.id === offerId);
            if (!offered) {
              throw new Error(`Offered rule "${offerId}" not found in availableRules`);
            }
            planned = [...planned, offered.rule];
          }
        }
        if (step.add) {
          planned = [...planned, ...step.add];
        }

        // Build next input using output.next as base
        const nextInput: EngineInput = {
          ...output.next,
          rules: { ...output.next.rules, planned }
        };

        output = evaluate(nextInput);
        stepNum++;
      }

      // Load expected output and compare
      const expected: EngineOutput = JSON.parse(
        readFileSync(join(scenarioPath, 'output.json'), 'utf-8')
      );

      expect(output).toEqual(expected);
    });
  }
});
