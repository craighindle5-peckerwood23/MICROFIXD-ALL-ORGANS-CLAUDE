// src/autonomy/internet-agent.ts
//
// Real gap this closes: everything built so far for external requests
// (http-dom-automation.ts, browser-automation.ts) is HTML-scraping and
// form-submission shaped. This is for the other real case -- calling
// an arbitrary third-party REST API with auth headers and reading a
// JSON response, e.g. a webhook, a SaaS API, a payment provider's
// status endpoint. Same governance boundary as everything else: one
// domain allowlist (isDomainAllowed from browser-automation.ts), no
// second competing list.
//
// Scope boundary vs. omni-router.ts/PluginRegistry (found via audit,
// not built together, so this needs to be explicit rather than
// assumed): OmniRouter is the pre-registered, manifest-based path --
// use it for any KNOWN, repeated integration, since it gets real
// security input validation, caching, cost tracking, and audit for
// free. This module is deliberately the lighter, ad-hoc path for a
// URL that hasn't been (and may never be) formally registered as a
// PluginManifest -- a one-off call, an exploratory integration, or
// something too simple to justify a manifest entry. If a call target
// here starts recurring, that is the real signal to register it as a
// PluginRegistry manifest and route it through OmniRouter instead, not
// a reason to keep growing this module's own allowlist in parallel.
// Two tiers, not two competing systems for the same job.

import { isDomainAllowed } from './browser-automation.ts';

export interface ExternalApiRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  /** Name of an env var holding a bearer token -- never the token itself in the request body, so tokens never end up in stored Level6Records or logs. */
  bearerTokenEnvVar?: string;
}

export interface ExternalApiResult {
  status: 'ok' | 'error';
  httpStatus?: number;
  responseBody?: unknown;
  error?: string;
}

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB cap -- this is meant for API responses, not for downloading large files

export async function callExternalApi(request: ExternalApiRequest): Promise<ExternalApiResult> {
  if (!isDomainAllowed(request.url)) {
    return { status: 'error', error: `"${request.url}" is not on the configured domain allowlist (MICROFIXD_BROWSER_ALLOWED_DOMAINS). One allowlist governs all external requests, scraping or API.` };
  }

  const headers = new Headers(request.headers ?? {});
  if (request.bearerTokenEnvVar) {
    const token = process.env[request.bearerTokenEnvVar];
    if (!token) {
      return { status: 'error', error: `Env var "${request.bearerTokenEnvVar}" is not set. Refusing to send the request without the token it's supposed to carry, rather than sending it unauthenticated.` };
    }
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (request.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  try {
    const response = await fetch(request.url, {
      method: request.method ?? 'GET',
      headers,
      body: request.body !== undefined ? JSON.stringify(request.body) : undefined,
      redirect: 'follow',
    });

    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
      return { status: 'error', httpStatus: response.status, error: `Response is ${contentLength} bytes, exceeding the ${MAX_RESPONSE_BYTES}-byte cap for this capability.` };
    }

    const text = await response.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      return { status: 'error', httpStatus: response.status, error: `Response body exceeded ${MAX_RESPONSE_BYTES} bytes after reading.` };
    }

    let responseBody: unknown = text;
    try { responseBody = JSON.parse(text); } catch { /* not JSON, keep as text -- real APIs return plain text or HTML sometimes too */ }

    return { status: response.ok ? 'ok' : 'error', httpStatus: response.status, responseBody, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
