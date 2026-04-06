/**
 * Maps validation errors (with JSON pointer paths) to line/column positions
 * in the original YAML text. Uses line-by-line indentation tracking.
 */

export interface ErrorPosition {
  line: number;
  col: number;
  message: string;
}

interface PathEntry {
  path: string;
  line: number;
  col: number;
}

/**
 * Build a map from slash-separated paths to line numbers
 * by scanning the YAML text line by line.
 *
 * Path format: "0/activities/0/type" where numbers are array indices
 * and names are object keys. This matches the lookup paths derived
 * from validation error paths like "rules[0]/activities/0/type".
 */
function buildPathMap(yaml: string): PathEntry[] {
  const lines = yaml.split('\n');
  const entries: PathEntry[] = [];

  // Stack of path segments, tracking the current nesting context.
  // Each entry is the segment name (string key or numeric index).
  const context: string[] = [];

  // Track the indent level that each context entry was pushed at
  const contextIndents: number[] = [];

  // Array item counters per indent level
  const arrayCounters: Map<number, number> = new Map();

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    if (!line.trim()) continue;

    const indent = line.search(/\S/);
    const content = line.slice(indent);

    // Pop context stack back to the parent level
    while (contextIndents.length > 0 && contextIndents[contextIndents.length - 1] >= indent) {
      context.pop();
      contextIndents.pop();
    }

    // Reset array counters deeper than current indent (not at current level)
    for (const [k] of arrayCounters) {
      if (k > indent) arrayCounters.delete(k);
    }

    // Check for array item "- ..."
    const arrayMatch = content.match(/^- (.*)/);
    if (arrayMatch) {
      const idx = (arrayCounters.get(indent) ?? -1) + 1;
      arrayCounters.set(indent, idx);

      context.push(String(idx));
      contextIndents.push(indent);

      // Record the array item itself
      entries.push({ path: context.join('/'), line: lineIdx, col: indent });

      // Check for inline key: value
      const inlineContent = arrayMatch[1];
      const keyValueMatch = inlineContent.match(/^(\w+):\s*(.*)/);
      if (keyValueMatch) {
        const key = keyValueMatch[1];
        entries.push({ path: [...context, key].join('/'), line: lineIdx, col: indent });
      }
      continue;
    }

    // Check for key: value
    const keyMatch = content.match(/^(\w+):\s*(.*)/);
    if (keyMatch) {
      const key = keyMatch[1];
      const value = keyMatch[2];

      entries.push({ path: [...context, key].join('/'), line: lineIdx, col: indent });

      // If no value, this key becomes a context for nested items
      if (!value.trim()) {
        context.push(key);
        contextIndents.push(indent);
      }
    }
  }

  return entries;
}

/**
 * Convert a validation error path like "rules[0]/activities/0/type"
 * into a lookup path like "0/activities/0/type".
 */
function errorPathToLookupPath(errorPath: string): string {
  const rulesMatch = errorPath.match(/^rules\[(\d+)\](.*)/);
  if (!rulesMatch) return errorPath;

  const ruleIndex = rulesMatch[1];
  const rest = rulesMatch[2]; // JSON pointer like "/activities/0/type"

  const restPath = rest.startsWith('/') ? rest.slice(1) : rest;

  return restPath ? `${ruleIndex}/${restPath}` : ruleIndex;
}

/**
 * Map validation errors to line/column positions in the YAML text.
 */
export function mapErrorsToPositions(
  yaml: string,
  errors: { message: string; path: string }[]
): ErrorPosition[] {
  const pathMap = buildPathMap(yaml);

  return errors.map((error) => {
    if (!error.path) {
      return { line: 0, col: 0, message: error.message };
    }

    const lookupPath = errorPathToLookupPath(error.path);

    // Find the best matching entry (longest prefix match)
    let bestMatch: PathEntry | null = null;
    let bestMatchLen = -1;

    for (const entry of pathMap) {
      if (lookupPath === entry.path || lookupPath.startsWith(entry.path)) {
        if (entry.path.length > bestMatchLen) {
          bestMatch = entry;
          bestMatchLen = entry.path.length;
        }
      }
    }

    if (bestMatch) {
      return { line: bestMatch.line, col: bestMatch.col, message: error.message };
    }

    return { line: 0, col: 0, message: error.message };
  });
}
