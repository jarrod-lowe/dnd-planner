/**
 * Authentication store for managing Cognito auth state.
 * Uses Svelte 5 $state rune for reactivity.
 */
import { getCurrentUser, fetchAuthSession, signInWithRedirect, signOut } from 'aws-amplify/auth';

export interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  isLoading: boolean;
}

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  userId: null,
  email: null,
  isLoading: true
};

// Reactive state using Svelte 5 $state rune
let state = $state<AuthState>({ ...initialState });

/**
 * Initialize auth state by checking current Cognito session.
 * Should be called on app startup.
 * Uses fetchAuthSession first to ensure token exchange completes.
 */
async function initialize(): Promise<void> {
  try {
    // Force token exchange if OAuth code is present in URL
    const session = await fetchAuthSession();
    const user = await getCurrentUser();

    // Extract email from ID token claims or signInDetails
    let email: string | null = null;
    if (session.tokens?.idToken?.payload?.email) {
      email = session.tokens.idToken.payload.email as string;
    } else if (user.signInDetails?.loginId) {
      email = user.signInDetails.loginId;
    }

    state = {
      isAuthenticated: true,
      userId: user.userId,
      email,
      isLoading: false
    };
  } catch {
    state = {
      isAuthenticated: false,
      userId: null,
      email: null,
      isLoading: false
    };
  }
}

/**
 * Initiate login via Cognito Hosted UI.
 * Redirects user to Cognito login page.
 */
async function login(): Promise<void> {
  await signInWithRedirect();
}

/**
 * Logout the current user.
 * Clears session and resets state.
 */
async function logout(): Promise<void> {
  await signOut();
  state = {
    isAuthenticated: false,
    userId: null,
    email: null,
    isLoading: false
  };
}

/**
 * Reset store to initial state (for testing).
 */
function reset(): void {
  state = { ...initialState };
}

export const authStore = {
  get state() {
    return state;
  },
  initialize,
  login,
  logout,
  reset
};
