import { apiGet } from './client';

interface TestResponse {
  status: 'ok' | string;
}

interface TestCheckResult {
  success: boolean;
  status?: string;
  error?: string;
}

export async function checkApiTest(): Promise<TestCheckResult> {
  try {
    const response = await apiGet('/api/test');

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`
      };
    }

    const data: TestResponse = await response.json();
    return {
      success: true,
      status: data.status
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
