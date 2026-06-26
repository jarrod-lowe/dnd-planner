import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginSvelte from 'eslint-plugin-svelte';

/** @type {import('eslint').Linter.Config[]} */
export default [
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginSvelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    // Rules-engine-v2 confinement. Authored rule modules must be pure, total
    // functions of their facts — no ambient runtime, I/O, time, randomness, or
    // engine internals. This keeps what-if reprocessing valid, the modules
    // serializable/sandboxable, and is the author/CI half of the security story
    // (the confinement + purity tests are belt-and-suspenders). Scoped to the
    // authored `rules/` dir only; the engine itself may use Date etc.
    files: ['src/lib/rules-engine-v2/rules/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'location',
        'history',
        'self',
        'top',
        'parent',
        'globalThis',
        'fetch',
        'XMLHttpRequest',
        'WebSocket',
        'EventSource',
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'caches',
        'Date',
        'crypto',
        'performance',
        'setTimeout',
        'setInterval',
        'setImmediate',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'process',
        'alert',
        'prompt',
        'confirm'
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Rule modules must be deterministic.' },
        { object: 'Date', property: 'now', message: 'No wall-clock time in rule modules.' },
        { object: 'performance', property: 'now', message: 'No wall-clock time in rule modules.' }
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['$app', '$app/*', '$env', '$env/*', '$service-worker'],
              message: 'No SvelteKit runtime in rule modules — they must be pure.'
            },
            {
              group: ['$lib/api', '$lib/api/*', '$lib/stores', '$lib/stores/*', '$lib/server/*'],
              message: 'No app stores/API in rule modules.'
            },
            {
              group: [
                'fs',
                'path',
                'os',
                'net',
                'http',
                'https',
                'crypto',
                'child_process',
                'node:*'
              ],
              message: 'No Node built-ins in rule modules.'
            }
            // The precise "import only ../builder" allowlist is enforced by the
            // confinement test (it parses each module's imports); expressing it
            // as a lint denylist matched ../builder itself.
          ]
        }
      ],
      // Ban non-terminating loops: while(true)/do-while(true) via checkLoops, and
      // C-style for(;;) via syntax. (for..of over a bounded list is fine.)
      'no-constant-condition': ['error', { checkLoops: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ForStatement[test=null]',
          message: 'Infinite for(;;) loops are not allowed in rule modules.'
        }
      ]
    }
  },
  {
    ignores: [
      'build/',
      '.svelte-kit/',
      'dist/',
      'node_modules/',
      'coverage/',
      'test-results/',
      'playwright-report/',
      '.claude/'
    ]
  }
];
