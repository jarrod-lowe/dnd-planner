import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import AuthStatus from '$lib/components/AuthStatus.svelte';

// English translations for testing
const translations: Record<string, string> = {
  'auth.loading': 'Loading...',
  'auth.login': 'Login',
  'auth.logout': 'Logout'
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

describe('AuthStatus', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('shows loading state when isLoading is true', () => {
    mount(AuthStatus, {
      target: container,
      props: {
        isLoading: true
      }
    });

    expect(container.textContent).toContain('Loading');
  });

  it('shows login button when unauthenticated', () => {
    const onLogin = vi.fn();

    mount(AuthStatus, {
      target: container,
      props: {
        isLoading: false,
        isAuthenticated: false,
        onLogin
      }
    });

    const loginButton = container.querySelector('button');
    expect(loginButton).toBeTruthy();
    expect(loginButton?.textContent).toContain('Login');
  });

  it('shows user id and logout button when authenticated', async () => {
    const onLogout = vi.fn();

    mount(AuthStatus, {
      target: container,
      props: {
        isLoading: false,
        isAuthenticated: true,
        userId: 'user-abc-123',
        onLogout
      }
    });

    expect(container.textContent).toContain('user-abc-123');

    const logoutButton = container.querySelector('button');
    expect(logoutButton).toBeTruthy();
    expect(logoutButton?.textContent).toContain('Logout');
  });

  it('calls onLogin when login button clicked', async () => {
    const onLogin = vi.fn();

    mount(AuthStatus, {
      target: container,
      props: {
        isLoading: false,
        isAuthenticated: false,
        onLogin
      }
    });

    const loginButton = container.querySelector('button');
    loginButton?.click();

    expect(onLogin).toHaveBeenCalledOnce();
  });

  it('calls onLogout when logout button clicked', async () => {
    const onLogout = vi.fn();

    mount(AuthStatus, {
      target: container,
      props: {
        isLoading: false,
        isAuthenticated: true,
        userId: 'user-abc-123',
        onLogout
      }
    });

    const logoutButton = container.querySelector('button');
    logoutButton?.click();

    expect(onLogout).toHaveBeenCalledOnce();
  });
});
