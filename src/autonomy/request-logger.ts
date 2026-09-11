import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { Telemetry } from './telemetry.ts';
import type { RuntimeStore } from './types.ts';
import { SecurityOrgans } from './security.ts';

/**
 * requestLogger: one structured log line per HTTP request, through the
 * same Telemetry sink every other subsystem already writes to, AND a
 * durable UsageEvent row so request history survives a server restart
 * (Telemetry.recent() alone is an in-memory ring buffer that doesn't).
 *
 * Deliberately excludes: request bodies (may contain secrets or PII
 * beyond what SecurityOrgans.redact can reliably catch), and the
 * x-microfixd-admin-key / authorization headers (never logged, not even
 * redacted -- the safest redaction of a credential is to never write it
 * anywhere). IP is logged only when present; nothing is inferred.
 */
export const requestLogger = (telemetry: Telemetry, store: RuntimeStore) => (req: Request, res: Response, next: NextFunction): void => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  res.setHeader('x-microfixd-request-id', requestId);

  res.on('finish', () => {
    const route = SecurityOrgans.redact(req.originalUrl.split('?')[0]);
    const tenant = typeof req.header('x-microfixd-tenant') === 'string' ? req.header('x-microfixd-tenant') : 'global';
    telemetry.event('http_request', {
      requestId,
      method: req.method,
      route,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      tenant,
      ip: req.ip,
      authenticated: Boolean(req.header('x-microfixd-admin-key') || req.header('authorization')),
    });
    telemetry.increment('http_requests_total', { method: req.method, status: String(res.statusCode) });
    void store.appendUsageEvent({
      id: requestId,
      tenantId: tenant || 'global',
      kind: 'http_request',
      name: `${req.method} ${route}`,
      dataRefs: [],
      metadata: { status: res.statusCode, durationMs: Date.now() - startedAt },
      createdAt: new Date().toISOString(),
    }).catch(() => {}); // Logging must never break the response that already went out.
  });

  next();
};
