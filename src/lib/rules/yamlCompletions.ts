/**
 * CodeMirror 6 completion source that provides YAML autocomplete
 * for D&D Planner custom rules. Delegates to the pure yamlContext module.
 */
import { type CompletionContext, autocompletion } from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';
import { getYamlCompletions, type YamlCompletion } from './yamlContext';

function yamlCompletionSource(context: CompletionContext) {
  const doc = context.state.doc.toString();
  const pos = context.pos;

  const completions = getYamlCompletions(doc, pos);

  if (completions.length === 0) return null;

  // Find the word boundary for the current token being typed
  const word = context.matchBefore(/[\w-]*/);
  const from = word ? word.from : pos;

  return {
    from,
    options: completions.map(
      (c: YamlCompletion) =>
        ({
          label: c.label,
          type: c.type,
          detail: c.detail
        }) as const
    )
  };
}

/**
 * CodeMirror extension providing YAML rule autocomplete with a 300ms activation delay.
 */
export const yamlCompletionExtension: Extension = autocompletion({
  override: [yamlCompletionSource],
  activateOnTyping: true,
  icons: false
});
