import yaml from 'js-yaml';
import type { Rule } from '$lib/rules-engine/types';

interface YamlToRulesResult {
  rules: Rule[] | null;
  error: string | null;
}

/**
 * Parse a YAML string into a rules array.
 * Returns { rules, error } - rules is null on parse error.
 */
export function yamlToRules(yamlString: string): YamlToRulesResult {
  if (!yamlString.trim()) {
    return { rules: [], error: null };
  }

  try {
    const parsed = yaml.load(yamlString);
    if (!Array.isArray(parsed)) {
      return { rules: null, error: 'YAML must be an array of rules' };
    }
    return { rules: parsed as Rule[], error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown YAML parse error';
    return { rules: null, error: message };
  }
}

/**
 * Convert a rules array to a YAML string.
 * Returns a placeholder comment for empty rules.
 */
export function rulesToYaml(rules: Rule[]): string {
  if (rules.length === 0) {
    return '# Add your custom rules here\n# Example:\n# - id: my-rule\n#   activities:\n#     - type: numberSet\n#       target:\n#         fact: resources.hp\n#       source:\n#         number: 10';
  }

  return yaml.dump(rules, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: "'"
  });
}
