/**
 * AWS Amplify configuration for Cognito authentication.
 * Uses existing Cognito resources defined in environment variables.
 */
import { Amplify } from 'aws-amplify';
import { cognitoConfig } from '$lib/config/cognito';

/**
 * Get sign-in redirect URLs based on current origin.
 * In development, SvelteKit uses paths without .html extension.
 * In production (S3 static hosting), .html extension is required.
 */
function getSignInRedirectUrls(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const origin = window.location.origin;
  const isDev = import.meta.env.DEV || origin.includes('localhost');
  const callbackPath = isDev ? '/auth/callback' : '/auth/callback.html';

  return [`${origin}${callbackPath}`];
}

/**
 * Get sign-out redirect URLs.
 * After logout, redirect to the root path.
 */
function getSignOutRedirectUrls(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  return [`${window.location.origin}/`];
}

/**
 * Configure Amplify with Cognito settings.
 * Should be called once on app startup.
 */
export function configureAmplify(): void {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: cognitoConfig.userPoolId,
        userPoolClientId: cognitoConfig.webClientId,
        identityPoolId: cognitoConfig.identityPoolId,
        loginWith: {
          oauth: {
            domain: cognitoConfig.loginDomain,
            scopes: ['openid', 'aws.cognito.signin.user.admin'],
            redirectSignIn: getSignInRedirectUrls(),
            redirectSignOut: getSignOutRedirectUrls(),
            responseType: 'code'
          }
        }
      }
    }
  });
}
