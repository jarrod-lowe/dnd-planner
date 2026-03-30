/**
 * Creates the CodeMirror 6 extensions for the YAML rule editor.
 * This module is designed to be lazy-loaded alongside CodeMirrorEditor.svelte
 * to keep CM6 out of the main bundle.
 */
import type { Extension } from '@codemirror/state';
import { lineNumbers } from '@codemirror/view';
import { yaml } from '@codemirror/lang-yaml';
import { yamlCompletionExtension } from '$lib/rules/yamlCompletions';
import { yamlLinterExtension } from '$lib/rules/yamlLinter';
import { dndPlannerTheme } from '$lib/rules/codemirrorTheme';

export function createRuleEditorExtensions(): Extension[] {
  return [lineNumbers(), yaml(), yamlCompletionExtension, yamlLinterExtension, ...dndPlannerTheme];
}
