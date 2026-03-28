import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import { readable } from 'svelte/store';
import UserDropdown from '$lib/components/UserDropdown.svelte';

// i18n mock - returns key as text
const translations: Record<string, string> = {
  'auth.userMenu': 'User menu',
  'auth.logout': 'Logout',
  'auth.version': 'Version',
  'rules.manageTitle': 'Manage Rules'
};

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

describe('UserDropdown', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('shows Manage Rules when showManageRules is true', () => {
    mount(UserDropdown, {
      target: container,
      props: {
        email: 'test@example.com',
        onLogout: vi.fn(),
        version: 'v1.0.0',
        showManageRules: true,
        onManageRules: vi.fn()
      }
    });

    // Open the details element so menu content renders
    const details = container.querySelector('details') as HTMLDetailsElement;
    if (details) details.open = true;

    expect(container.textContent).toContain('Manage Rules');
  });

  it('hides Manage Rules when showManageRules is false', () => {
    mount(UserDropdown, {
      target: container,
      props: {
        email: 'test@example.com',
        onLogout: vi.fn(),
        version: 'v1.0.0',
        showManageRules: false
      }
    });

    // Open the details element
    const details = container.querySelector('details') as HTMLDetailsElement;
    if (details) details.open = true;

    expect(container.textContent).not.toContain('Manage Rules');
  });

  it('calls onManageRules when Manage Rules is clicked', () => {
    const onManageRules = vi.fn();

    mount(UserDropdown, {
      target: container,
      props: {
        email: 'test@example.com',
        onLogout: vi.fn(),
        version: 'v1.0.0',
        showManageRules: true,
        onManageRules
      }
    });

    // Open the details element
    const details = container.querySelector('details') as HTMLDetailsElement;
    if (details) details.open = true;

    // Find and click the Manage Rules button
    const buttons = container.querySelectorAll('button');
    const manageRulesButton = Array.from(buttons).find((b) =>
      b.textContent?.includes('Manage Rules')
    );
    manageRulesButton?.click();

    expect(onManageRules).toHaveBeenCalledOnce();
  });
});
