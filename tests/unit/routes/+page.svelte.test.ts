import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import Page from '../../../src/routes/+page.svelte';

// English translations for testing
const translations: Record<string, string> = {
  'app.title': 'D&D Planner',
  'app.description':
    'A tablet-optimized web application for tracking D&D character resources and planning combat turns.',
  'status.checking': 'Checking API...',
  'status.connected': 'API Connected',
  'status.unavailable': 'API Unavailable',
  'status.notAuthenticated': 'Not authenticated',
  'auth.loading': 'Loading...',
  'auth.login': 'Login',
  'auth.logout': 'Logout',
  'auth.completingSignIn': 'Completing sign in...',
  'cognito.label': 'Cognito:'
};

// Mock $lib/i18n module for this test file
vi.mock('$lib/i18n', () => ({
  t: readable((key: string) => translations[key] ?? key),
  locale: {
    ...readable('en'),
    set: vi.fn()
  },
  isLoading: readable(false),
  initialized: readable(true),
  detectLocale: () => 'en',
  locales: ['en', 'en-x-tlh']
}));

describe('Page', () => {
  let container: HTMLElement;

  beforeEach(() => {
    vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'test-pool-id');
    vi.stubEnv('VITE_COGNITO_WEB_CLIENT_ID', 'test-client-id');
    vi.stubEnv('VITE_COGNITO_IDENTITY_POOL_ID', 'test-identity-pool-id');
    vi.stubEnv('VITE_COGNITO_LOGIN_DOMAIN', 'test-login-domain');

    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('displays cognito login domain', () => {
    mount(Page, { target: container });
    expect(container.textContent).toContain('Cognito:');
  });
});
