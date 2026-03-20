import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * Get authentication headers for API requests.
 * Retrieves the ID token from the current Cognito session.
 * Note: API Gateway Cognito User Pool authorizers validate ID tokens, not access tokens.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    if (idToken) {
      return { Authorization: `Bearer ${idToken}` };
    } else {
      console.warn('[getAuthHeaders] No ID token in session');
    }
  } catch (error) {
    console.warn('[getAuthHeaders] Error fetching session:', error);
  }

  return {};
}

/**
 * Make an authenticated GET request.
 */
export async function apiGet(url: string): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(url, { headers });
}

/**
 * Make an authenticated POST request with JSON body.
 */
export async function apiPost(url: string, body: unknown): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
}

/**
 * Make an authenticated PUT request with JSON body.
 */
export async function apiPut(url: string, body: unknown): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  });
}

/**
 * Make an authenticated DELETE request.
 */
export async function apiDelete(url: string): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(url, {
    method: 'DELETE',
    headers
  });
}
