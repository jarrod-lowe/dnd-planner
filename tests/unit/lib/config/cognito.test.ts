import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('cognitoConfig', () => {
  let cognitoConfig: typeof import('$lib/config/cognito').cognitoConfig;

  beforeEach(async () => {
    vi.stubEnv('VITE_COGNITO_USER_POOL_ID', 'test-pool-id');
    vi.stubEnv('VITE_COGNITO_WEB_CLIENT_ID', 'test-client-id');
    vi.stubEnv('VITE_COGNITO_IDENTITY_POOL_ID', 'test-identity-pool-id');
    vi.stubEnv('VITE_COGNITO_LOGIN_DOMAIN', 'test-login-domain');

    // Dynamic import after env vars are stubbed
    vi.resetModules();
    const module = await import('$lib/config/cognito');
    cognitoConfig = module.cognitoConfig;
  });

  it('exposes login domain from environment', () => {
    expect(cognitoConfig.loginDomain).toBe('test-login-domain');
  });

  it('exposes user pool id from environment', () => {
    expect(cognitoConfig.userPoolId).toBe('test-pool-id');
  });

  it('exposes web client id from environment', () => {
    expect(cognitoConfig.webClientId).toBe('test-client-id');
  });

  it('exposes identity pool id from environment', () => {
    expect(cognitoConfig.identityPoolId).toBe('test-identity-pool-id');
  });
});
