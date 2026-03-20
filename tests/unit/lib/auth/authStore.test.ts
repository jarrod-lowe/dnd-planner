import { describe, it, expect, vi, beforeEach } from 'vitest';

// Store references to mocks that will be created in the factory
const mocks = {
  fetchAuthSession: vi.fn(),
  getCurrentUser: vi.fn(),
  signInWithRedirect: vi.fn(),
  signOut: vi.fn()
};

// Mock aws-amplify/auth using indirect references
vi.mock('aws-amplify/auth', () => ({
  get fetchAuthSession() {
    return mocks.fetchAuthSession;
  },
  get getCurrentUser() {
    return mocks.getCurrentUser;
  },
  get signInWithRedirect() {
    return mocks.signInWithRedirect;
  },
  get signOut() {
    return mocks.signOut;
  }
}));

// Import after mock is set up
import { authStore } from '$lib/auth/authStore.svelte';

describe('authStore', () => {
  beforeEach(() => {
    // Reset all mocks to their default state
    mocks.fetchAuthSession.mockReset();
    mocks.getCurrentUser.mockReset();
    mocks.signInWithRedirect.mockReset();
    mocks.signOut.mockReset();
    authStore.reset();
  });

  describe('initialize', () => {
    it('sets isAuthenticated=true and userId when user found', async () => {
      mocks.fetchAuthSession.mockResolvedValueOnce({});
      mocks.getCurrentUser.mockResolvedValueOnce({
        userId: 'test-user-123',
        username: 'testuser'
      });

      await authStore.initialize();

      expect(authStore.state.isLoading).toBe(false);
      expect(authStore.state.isAuthenticated).toBe(true);
      expect(authStore.state.userId).toBe('test-user-123');
    });

    it('sets isAuthenticated=false and userId=null when no user', async () => {
      mocks.fetchAuthSession.mockRejectedValueOnce(new Error('No session'));
      mocks.getCurrentUser.mockRejectedValueOnce(new Error('Not authenticated'));

      await authStore.initialize();

      expect(authStore.state.isLoading).toBe(false);
      expect(authStore.state.isAuthenticated).toBe(false);
      expect(authStore.state.userId).toBe(null);
    });
  });

  describe('logout', () => {
    it('clears auth state', async () => {
      // First set up an authenticated state
      mocks.fetchAuthSession.mockResolvedValueOnce({});
      mocks.getCurrentUser.mockResolvedValueOnce({
        userId: 'test-user-123',
        username: 'testuser'
      });
      await authStore.initialize();
      expect(authStore.state.isAuthenticated).toBe(true);

      // Now logout
      await authStore.logout();

      expect(mocks.signOut).toHaveBeenCalledOnce();
      expect(authStore.state.isAuthenticated).toBe(false);
      expect(authStore.state.userId).toBe(null);
      expect(authStore.state.isLoading).toBe(false);
    });
  });

  describe('login', () => {
    it('calls signInWithRedirect', async () => {
      await authStore.login();

      expect(mocks.signInWithRedirect).toHaveBeenCalledOnce();
    });
  });
});
