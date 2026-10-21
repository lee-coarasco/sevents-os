const apiUrl = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 60_000; // 60 seconds
const apiCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();

function makeCacheKey(accessToken: string | undefined, path: string): string {
  const tokenKey = accessToken ? accessToken.slice(-16) : "anon";
  return `${tokenKey}:::${path}`;
}

/**
 * Clear entries from the in-memory API cache.
 * If prefix is provided, only entries whose path starts with prefix are deleted.
 * Otherwise, the entire cache is cleared.
 */
export function clearApiCache(prefix?: string): void {
  if (!prefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    const pathPart = key.split(":::")[1] ?? key;
    if (pathPart.startsWith(prefix)) {
      apiCache.delete(key);
    }
  }
}

/**
 * Synchronous cache lookup for instant component state hydration.
 */
export function getCachedApiData<T>(path: string, accessToken?: string): T | undefined {
  const cacheKey = makeCacheKey(accessToken, path);
  const entry = apiCache.get(cacheKey);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  return undefined;
}

function invalidateResourceCache(path: string): void {
  const cleanPath = path.split("?")[0];
  const segments = cleanPath.split("/").filter(Boolean);
  if (segments.length === 0) {
    apiCache.clear();
    return;
  }

  const rootResource = `/${segments[0]}`;
  const subResource = segments.length > 1 ? `/${segments[0]}/${segments[1]}` : rootResource;

  for (const key of apiCache.keys()) {
    const cachedPath = key.split(":::")[1] ?? key;
    if (
      cachedPath.startsWith(subResource) ||
      cachedPath.startsWith(rootResource) ||
      (rootResource === "/workflow" && (cachedPath.startsWith("/tasks") || cachedPath.startsWith("/approvals") || cachedPath.startsWith("/tendering") || cachedPath.startsWith("/estimates") || cachedPath.startsWith("/bid-decisions"))) ||
      (rootResource === "/tasks" && cachedPath.startsWith("/workflow")) ||
      (rootResource === "/approvals" && (cachedPath.startsWith("/workflow") || cachedPath.startsWith("/tasks") || cachedPath.startsWith("/tendering") || cachedPath.startsWith("/estimates") || cachedPath.startsWith("/bid-decisions") || cachedPath.startsWith("/projects") || cachedPath.startsWith("/procurement"))) ||
      (rootResource === "/estimates" && (cachedPath.startsWith("/tendering") || cachedPath.startsWith("/approvals") || cachedPath.startsWith("/bid-decisions"))) ||
      (rootResource === "/bid-decisions" && (cachedPath.startsWith("/estimates") || cachedPath.startsWith("/tendering") || cachedPath.startsWith("/approvals") || cachedPath.startsWith("/bid-decisions"))) ||
      (rootResource === "/projects" && cachedPath.startsWith("/dashboard")) ||
      (rootResource === "/procurement" && cachedPath.startsWith("/dashboard")) ||
      (rootResource === "/site" && cachedPath.startsWith("/dashboard")) ||
      (rootResource === "/quality" && cachedPath.startsWith("/dashboard")) ||
      (rootResource === "/safety" && cachedPath.startsWith("/dashboard")) ||
      (rootResource === "/commercial" && cachedPath.startsWith("/dashboard"))
    ) {
      apiCache.delete(key);
    }
  }
}

/** Every call needs the Supabase session's access token as a bearer token — same contract every backend route already expects. */
export async function apiFetch<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const isGet = method === "GET" && !init.body;
  const bypassCache = init.cache === "no-store" || init.cache === "no-cache" || init.cache === "reload";
  const cacheKey = makeCacheKey(accessToken, path);

  // Return cached response if unexpired
  if (isGet && !bypassCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data as T;
    }

    // Deduplicate in-flight GET requests
    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${accessToken}`,
          ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new ApiError((body as { error?: string }).error ?? response.statusText, response.status);
      }

      if (isGet && init.cache !== "no-store") {
        apiCache.set(cacheKey, {
          data: body,
          expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS,
        });
      } else if (!isGet) {
        invalidateResourceCache(path);
      }

      return body as T;
    } finally {
      if (isGet) {
        inflightRequests.delete(cacheKey);
      }
    }
  })();

  if (isGet && !bypassCache) {
    inflightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}
