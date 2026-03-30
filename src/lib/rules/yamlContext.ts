/**
 * YAML context detection for autocomplete suggestions.
 * Uses lightweight heuristic parsing (indentation + key path scanning)
 * to determine what completions are available at a given cursor position.
 */

export interface YamlCompletion {
  label: string;
  type?: string;
  detail?: string;
}

/** Activity type enum values from the rule schema */
const ACTIVITY_TYPES: YamlCompletion[] = [
  'numberSet',
  'numberIncrement',
  'numberCopy',
  'numberSum',
  'numberFunction',
  'emitEvent',
  'generateRule',
  'offerRule',
  'setClear',
  'setAdd'
].map((t) => ({ label: t, type: 'constant', detail: 'activity type' }));

/** Comparison operator enum values */
const COMPARISON_OPERATORS: YamlCompletion[] = [
  'equals',
  'notEquals',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual'
].map((t) => ({ label: t, type: 'constant', detail: 'comparison operator' }));

/** Phase enum values */
const PHASES: YamlCompletion[] = ['early', 'normal', 'safeguard'].map((t) => ({
  label: t,
  type: 'constant',
  detail: 'execution phase'
}));

/** Function enum values */
const FUNCTIONS: YamlCompletion[] = ['statToModifier', 'multiply'].map((t) => ({
  label: t,
  type: 'function',
  detail: 'named function'
}));

/** Rule-level property keys */
const RULE_KEYS: YamlCompletion[] = [
  'id',
  'description',
  'ui',
  'vars',
  'selections',
  'phase',
  'enabled',
  'when',
  'after',
  'group',
  'activities'
].map((t) => ({ label: t, type: 'property', detail: 'rule property' }));

/** Activity-level property keys */
const ACTIVITY_KEYS: YamlCompletion[] = [
  'type',
  'id',
  'when',
  'target',
  'source',
  'sources',
  'max',
  'subtract',
  'function',
  'args',
  'event',
  'rule',
  'legalWhen'
].map((t) => ({ label: t, type: 'property', detail: 'activity property' }));

/** Keys that have enum value completions */
const VALUE_COMPLETIONS: Record<string, YamlCompletion[]> = {
  phase: PHASES,
  type: ACTIVITY_TYPES,
  operator: COMPARISON_OPERATORS,
  function: FUNCTIONS
};

/**
 * Detect the YAML context at a given cursor position and return
 * appropriate completion suggestions.
 */
export function getYamlCompletions(yaml: string, cursorPos: number): YamlCompletion[] {
  const lines = yaml.split('\n');
  const { lineIndex } = getLineAndCol(lines, cursorPos);
  const currentLine = lines[lineIndex];

  // Check if cursor is after a "key: " pattern (value position)
  // Handles both "  key: " and "  - key: " forms
  const valueMatch = currentLine?.match(/^\s*(?:- )?(\w+):\s*$/);
  if (valueMatch) {
    const key = valueMatch[1];
    const completions = VALUE_COMPLETIONS[key];
    if (completions) {
      return completions;
    }
  }

  // Check if cursor is on a partially typed value after a known key
  const partialValueMatch = currentLine?.match(/^\s*(?:- )?(\w+):\s+(\w*)$/);
  if (partialValueMatch) {
    const key = partialValueMatch[1];
    const completions = VALUE_COMPLETIONS[key];
    if (completions) {
      return completions;
    }
  }

  // Check if cursor is at a key position (typing a new key)
  // This includes "- " at array item start or "  key:" at indented level
  const keyContext = getKeyContext(lines, lineIndex);
  if (keyContext === 'rule') {
    return RULE_KEYS;
  }
  if (keyContext === 'activity') {
    return ACTIVITY_KEYS;
  }

  return [];
}

/** Convert a flat cursor position to line index and column */
function getLineAndCol(lines: string[], pos: number): { lineIndex: number; col: number } {
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineLen = lines[i].length;
    // +1 for the newline character that was split out
    if (offset + lineLen >= pos) {
      return { lineIndex: i, col: pos - offset };
    }
    offset += lineLen + 1;
  }
  return { lineIndex: lines.length - 1, col: lines[lines.length - 1]?.length ?? 0 };
}

/**
 * Determine if the cursor is at a key-position within a rule or activity.
 * Returns 'rule', 'activity', or null.
 */
function getKeyContext(lines: string[], lineIndex: number): 'rule' | 'activity' | null {
  const currentLine = lines[lineIndex];
  if (!currentLine) return null;

  // Cursor at "- " (array item start)
  const arrayItemMatch = currentLine.match(/^(\s*)- (\w*)$/);
  // Cursor at indented key position: "  partialkey" with no colon
  const indentedKeyMatch = currentLine.match(/^(\s+)(\w*)$/);

  const match = arrayItemMatch || indentedKeyMatch;
  if (!match) return null;

  const indent = match[1].length;

  // Determine context by scanning upward for parent structure
  if (arrayItemMatch) {
    // "- " at indent 0 = rule array item
    if (indent === 0) return 'rule';

    // "- " at deeper indent = check if we're inside activities
    for (let i = lineIndex - 1; i >= 0; i--) {
      const line = lines[i];
      const lineIndent = line.search(/\S/);
      if (lineIndent === -1) continue; // blank line

      if (lineIndent < indent) {
        // Found a less-indented line - check if it's "activities:"
        if (line.trimStart().startsWith('activities:')) {
          return 'activity';
        }
        // It's some other parent - not an activity context
        // Check if any ancestor is activities
        for (let j = i; j >= 0; j--) {
          const ancestorLine = lines[j];
          if (ancestorLine.trimStart().startsWith('activities:')) {
            return 'activity';
          }
        }
        return 'rule';
      }
    }
    return 'rule';
  }

  // Indented key position (no "- " prefix) - check parent context
  // Look for the nearest "- " or "activities:" above
  let inActivities = false;
  for (let i = lineIndex - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line.trim()) continue;
    const li = line.search(/\S/);

    if (line.trimStart().startsWith('activities:')) {
      inActivities = true;
      break;
    }
    if (li === 0 && line.startsWith('- ')) {
      // Top-level rule array item
      break;
    }
  }
  return inActivities ? 'activity' : 'rule';
}
