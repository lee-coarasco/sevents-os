const apiUrl = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Every call needs the Supabase session's access token as a bearer token — same contract every backend route already expects. */
export async function apiFetch<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError((body as { error?: string }).error ?? response.statusText, response.status);
  }
  return body as T;
}
