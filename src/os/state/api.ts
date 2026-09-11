// src/os/state/api.ts
//
// Extracted verbatim from the existing, tested MicrofixedOS.tsx `request`
// helper -- not reimplemented. Every OS workspace calls the real
// /api/autonomy/* routes through this one function, so there is exactly
// one place that knows about the admin-key/tenant header contract.

export const request = async <T,>(
  path: string,
  key: string,
  tenantId: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(path, {
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
