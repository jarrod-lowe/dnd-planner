/**
 * CodeMirror 6 linter that validates YAML rules using the existing
 * validation infrastructure. Maps errors to inline squiggly markers.
 */
import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import { yamlToRules } from './yamlConverter';
import { validateRules } from './validateRules';
import { mapErrorsToPositions } from './errorPositionMapper';

const yamlLinter = linter(
  async (view): Promise<Diagnostic[]> => {
    const doc = view.state.doc.toString();
    const parsed = yamlToRules(doc);

    if (parsed.error) {
      return [
        {
          from: 0,
          to: view.state.doc.line(1).to,
          severity: 'error',
          message: parsed.error
        }
      ];
    }

    if (!parsed.rules) return [];

    const result = await validateRules(parsed.rules);
    if (result.valid) return [];

    const positions = mapErrorsToPositions(doc, result.errors);

    return positions.map((ep) => {
      const line = view.state.doc.line(ep.line + 1); // CM6 lines are 1-indexed
      return {
        from: line.from,
        to: line.to,
        severity: 'error' as const,
        message: ep.message
      };
    });
  },
  { delay: 500 }
);

export const yamlLinterExtension: Extension = yamlLinter;
