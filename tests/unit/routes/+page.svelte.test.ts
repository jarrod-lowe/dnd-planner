import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from 'svelte';
import Page from '../../../src/routes/+page.svelte';

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
