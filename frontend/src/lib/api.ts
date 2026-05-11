const ENV_BASE = (import.meta.env.VITE_ERP_API_BASE_URL ?? '').replace(/\/+$/, '');
const AUTH_TOKEN_KEY = 'erp_auth_token';

/** Which candidate URL index worked last (same ordering as {@link buildCandidateUrlList}). Speeds up all later requests. */
const CANDIDATE_IX_SESSION_KEY = 'erp_api_working_candidate_ix';

function inferBasePath() {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (!parts.length) return '';
  const last = parts[parts.length - 1];
  const dirParts = last.includes('.') ? parts.slice(0, -1) : parts;
  return dirParts.length ? `/${dirParts.join('/')}` : '';
}

/** Canonical ordered list of API base URLs to try for this path (not session-reordered). */
function buildCandidateUrlList(path: string): string[] {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const basePath = inferBasePath();
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    if (seen.has(u)) return;
    seen.add(u);
    ordered.push(u);
  };

  if (origin) {
    if (basePath) {
      push(`${origin}${basePath}${normalizedPath}`);
      push(`${origin}${basePath}/index.php${normalizedPath}`);
    }
    push(`${origin}${normalizedPath}`);
    push(`${origin}/index.php${normalizedPath}`);
  }

  if (ENV_BASE) {
    push(`${ENV_BASE}${normalizedPath}`);
    push(`${ENV_BASE}/index.php${normalizedPath}`);
  }

  return ordered;
}

function prioritizeCandidateUrls(raw: string[]): string[] {
  if (typeof sessionStorage === 'undefined') return raw;
  const stored = sessionStorage.getItem(CANDIDATE_IX_SESSION_KEY);
  if (stored == null) return raw;
  const ix = Number.parseInt(stored, 10);
  if (!Number.isFinite(ix) || ix < 0 || ix >= raw.length) return raw;
  const winner = raw[ix];
  return [winner, ...raw.filter((_, i) => i !== ix)];
}

function rememberCandidateIndexFromUrl(raw: string[], urlThatWorked: string) {
  if (typeof sessionStorage === 'undefined') return;
  const ix = raw.indexOf(urlThatWorked);
  if (ix >= 0) {
    sessionStorage.setItem(CANDIDATE_IX_SESSION_KEY, String(ix));
  }
}

/** Same-origin / ENV candidates for this path, with last-known-good candidate tried first. */
export function candidateUrls(path: string): string[] {
  return prioritizeCandidateUrls(buildCandidateUrlList(path));
}

/** Resolved URL for an API path (subfolder apps + optional `VITE_ERP_API_BASE_URL`). */
export function resolveApiUrl(apiPath: string): string {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const urls = candidateUrls(path);
  if (urls.length > 0) {
    return urls[0];
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/** Treat typical JSON API responses as JSON (includes `+json` vendor types). */
function isLikelyJsonResponse(contentType: string): boolean {
  const c = contentType.toLowerCase();
  if (!c) return false;
  if (c.includes('application/json') || c.includes('text/json')) return true;
  return /\+json\b/i.test(c);
}

/** True when body matches Laravel JSON API envelope (not arbitrary `{}` from a SPA shell). */
function looksLikeLaravelApiJson(payload: unknown): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    ('status' in payload || 'data' in payload || 'message' in payload || 'errors' in payload)
  );
}

export async function fetchJson(path: string, init?: RequestInit) {
  const raw = buildCandidateUrlList(path);
  const urls = prioritizeCandidateUrls(raw);
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, withAuthHeader(init));
      if (res.ok) {
        const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
        if (!isLikelyJsonResponse(contentType)) {
          continue;
        }
        rememberCandidateIndexFromUrl(raw, url);
        return await res.json();
      }
      if (res.status === 404) continue;
      throw new Error(`Request failed: ${res.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Network error');
    }
  }

  throw lastError ?? new Error(`Request failed for ${path}`);
}

export async function fetchWithFallback(path: string, init?: RequestInit) {
  const raw = buildCandidateUrlList(path);
  const urls = prioritizeCandidateUrls(raw);
  let lastRes: Response | null = null;

  for (const url of urls) {
    const res = await fetch(url, withAuthHeader(init));
    lastRes = res;
    if (res.ok) {
      if (init?.body instanceof FormData) {
        rememberCandidateIndexFromUrl(raw, url);
        return res;
      }
      const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
      if (isLikelyJsonResponse(contentType)) {
        rememberCandidateIndexFromUrl(raw, url);
        return res;
      }
      continue;
    }
    if (res.status !== 404) return res;
  }

  return lastRes ?? new Response(null, { status: 500, statusText: 'No API candidate responded' });
}

/** Result from {@link postFormDataExpectJson}. Body is pre-parsed to avoid double-read issues. */
export type FormDataPostResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
};

/**
 * POST multipart FormData to the API and return the first response that looks like our Laravel JSON.
 *
 * Only retries on 404 or network failure. If a URL returns 2xx but non-JSON (e.g. SPA HTML), we stop —
 * retrying would POST again and could hit Laravel multiple times, duplicating uploads.
 */
export async function postFormDataExpectJson(path: string, formData: FormData): Promise<FormDataPostResult> {
  const raw = buildCandidateUrlList(path);
  const urls = prioritizeCandidateUrls(raw);

  for (const url of urls) {
    let res: Response;
    try {
      res = await fetch(url, withAuthHeader({
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      }));
    } catch {
      continue;
    }

    if (res.status === 404) {
      continue;
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = (await res.json()) as Record<string, unknown>;
    } catch {
      // body is HTML or plain text
    }

    if (!res.ok) {
      return { ok: false, status: res.status, json: parsed ?? {} };
    }

    const ct = res.headers.get('content-type')?.toLowerCase() ?? '';
    if (parsed && (isLikelyJsonResponse(ct) || looksLikeLaravelApiJson(parsed))) {
      rememberCandidateIndexFromUrl(raw, url);
      return { ok: true, status: res.status, json: parsed };
    }

    return {
      ok: false,
      status: res.status,
      json: {
        message:
          'The server returned a non-JSON response for this upload. If the app runs in a subfolder (e.g. /ERP/public), set VITE_ERP_API_BASE_URL in .env to your Laravel public URL and rebuild the frontend.',
      },
    };
  }

  return {
    ok: false,
    status: 502,
    json: {
      message:
        'Upload could not reach the ERP API. If the app runs in a subfolder (e.g. /ERP/public), set VITE_ERP_API_BASE_URL in .env to your Laravel public URL, rebuild the frontend, and run php artisan storage:link.',
    },
  };
}

/**
 * PUT a blob to a presigned S3 URL (browser → storage). No ERP `Authorization` header; auth is in the URL query string.
 */
export async function putBlobToPresignedUrl(
  url: string,
  body: Blob,
  headers: Record<string, string>,
): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    body,
    headers,
    mode: 'cors',
    credentials: 'omit',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      text.trim() ||
        `Direct upload failed (${String(res.status)} ${res.statusText})`.trim(),
    );
  }
}

function withAuthHeader(init?: RequestInit): RequestInit {
  const headers: Record<string, string> = {};

  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(init.headers)) {
      init.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, init.headers);
    }
  }

  if (!headers['Authorization'] && !headers['authorization'] && typeof window !== 'undefined') {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  return {
    ...init,
    headers,
  };
}
