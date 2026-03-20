import { sveltekit } from '@sveltejs/kit/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [sveltekit()],
    ...(mode === 'test' ? { resolve: { conditions: ['browser'] } } : {}),
    server: {
      proxy: env.VITE_API_PROXY_TARGET
        ? {
            '/api': {
              target: env.VITE_API_PROXY_TARGET,
              changeOrigin: true,
              secure: true
            }
          }
        : undefined
    },
    test: {
      include: [
        'tests/unit/**/*.{test,spec}.{js,ts}',
        'tests/integration/**/*.{test,spec}.{js,ts}'
      ],
      environment: 'jsdom',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        reportsDirectory: './coverage'
      },
      server: {
        deps: {
          inline: ['svelte']
        }
      }
    }
  };
});
