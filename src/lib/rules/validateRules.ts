import Ajv from 'ajv';

export interface ValidationError {
  message: string;
  path: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const SCHEMA_URL = '/data/rule-groups/schema.json';

let validateRule: ((data: unknown) => boolean) | null = null;
let schemaPromise: Promise<void> | null = null;

async function loadSchema(): Promise<void> {
  const response = await fetch(SCHEMA_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch schema: ${response.status}`);
  }
  const schema = await response.json();
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addSchema(schema, 'full-schema');
  validateRule = ajv.getSchema('full-schema#/definitions/rule')!;
}

function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = loadSchema();
  }
  return schemaPromise;
}

/**
 * Validate an array of rules against the schema.
 * Fetches the schema on first call, then caches the compiled validator.
 */
export async function validateRules(rules: unknown[]): Promise<ValidationResult> {
  if (!Array.isArray(rules)) {
    return { valid: false, errors: [{ message: 'Rules must be an array', path: '' }] };
  }

  await ensureSchema();

  if (!validateRule) {
    return { valid: false, errors: [{ message: 'Schema not loaded', path: '' }] };
  }

  const errors: ValidationError[] = [];

  for (let i = 0; i < rules.length; i++) {
    const valid = validateRule(rules[i]);
    if (!valid && validateRule.errors) {
      for (const err of validateRule.errors) {
        errors.push({
          message: err.message ?? 'Unknown validation error',
          path: `rules[${i}]${err.instancePath ?? ''}`
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
