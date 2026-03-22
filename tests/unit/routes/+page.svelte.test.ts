import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import Page from '../../../src/routes/+page.svelte';

// English translations for testing
const translations: Record<string, string> = {
  'app.title': 'D&D Planner',
  'app.description':
    'A tablet-optimized web application for tracking D&D character resources and planning combat turns.',
  'app.tagline': 'Track resources. Plan turns. Master combat.',
  'app.welcomeBack': 'Welcome back, adventurer.',
  'status.checking': 'Checking API...',
  'status.connected': 'API Connected',
  'status.unavailable': 'API Unavailable',
  'status.notAuthenticated': 'Not authenticated',
  'auth.loading': 'Loading...',
  'auth.login': 'Login',
  'auth.logout': 'Logout',
  'auth.completingSignIn': 'Completing sign in...',
  'auth.userMenu': 'User menu',
  'auth.version': 'Version',
  'layout.loading': 'Loading...',
  'cognito.label': 'Cognito:',
  'landing.hero': 'Your adventure awaits',
  'landing.heroSubtitle':
    'A companion for tracking character resources and planning combat turns at your tabletop.',
  'landing.tagline': 'Track resources. Plan turns. Master combat.',
  'landing.getStarted': 'Begin Your Journey',
  'landing.feature1Title': 'Resource Tracking',
  'landing.feature1Desc': 'Monitor spell slots, abilities, and consumables at a glance.',
  'landing.feature2Title': 'Turn Planning',
  'landing.feature2Desc': 'Plan your actions before initiative rolls around.',
  'landing.feature3Title': 'Tablet Optimized',
  'landing.feature3Desc': 'Touch-friendly interface designed for use at the gaming table.'
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

// Mock authStore
vi.mock('$lib/auth/authStore.svelte', () => ({
  authStore: {
    state: {
      isAuthenticated: false,
      isLoading: false,
      userId: null,
      email: null
    },
    login: vi.fn(),
    logout: vi.fn(),
    initialize: vi.fn()
  }
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

  it('displays landing page with title when not authenticated', () => {
    mount(Page, { target: container });
    expect(container.textContent).toContain('D&D Planner');
  });

  it('displays the hero text', () => {
    mount(Page, { target: container });
    expect(container.textContent).toContain('Your adventure awaits');
  });

  it('displays the get started button', () => {
    mount(Page, { target: container });
    expect(container.textContent).toContain('Begin Your Journey');
  });
});
