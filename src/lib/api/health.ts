interface HealthResponse {
  status: 'ok' | string;
}

interface HealthCheckResult {
  success: boolean;
  status?: string;
  error?: string;
}

export async function checkApiHealth(): Promise<HealthCheckResult> {
  try {
    const response = await fetch('/api/health');

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`
      };
    }

    const data: HealthResponse = await response.json();
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
