// src/os/state/api.ts
//
// Extracted verbatim from the existing, tested MicrofixedOS.tsx `request`
// helper -- not reimplemented. Every OS workspace calls the real
// /api/autonomy/* routes through this one function, so there is exactly
// one place that knows about the admin-key/tenant header contract.
//
// API_BASE makes this frontend a standalone, pluggable unit: when built
// and deployed on its own (separate from the Microfixd backend server),
// set VITE_API_BASE_URL to the backend's origin (e.g. the Render URL).
// When unset (the existing combined deploy, frontend served by the same
// Express server as the API), it stays '' and every call is same-origin
// exactly as before -- zero behavior change for the current deployment.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/** Resolve any backend-relative path against API_BASE. Use this for every
 * raw fetch()/EventSource URL outside of request() below. */
export const apiUrl = (path: string): string => `${API_BASE}${path}`;

export const request = async <T,>(
  path: string,
  key: string,
  tenantId: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      'x-microfixd-admin-key': key,
      'x-microfixd-tenant': tenantId,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.reason || `Request failed with HTTP ${response.status}.`);
  }
  return body as T;
};
