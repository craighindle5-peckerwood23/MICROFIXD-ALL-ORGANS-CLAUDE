// src/autonomy/omni-router.ts
//
// The pre-registered, manifest-based path for external requests: real
// security input validation, per-plugin operation allowlists, caching,
// cost tracking, and audit, gated by PluginRegistry manifests
// configured via MICROFIXD_PLUGINS_JSON. Use this for any known,
// repeated integration. For a one-off or exploratory call to a URL
// that hasn't been registered as a manifest, see internet-agent.ts's
// lighter, ad-hoc domain-allowlisted path instead -- two intentional
// tiers, not two competing systems for the same job (see
// internet-agent.ts's own header for the reverse pointer).

import { createHash, randomUUID } from 'node:crypto';
import type { ParagonDissector } from './governance.ts';
import type { RuntimeStore } from './types.ts';
import type { Telemetry } from './telemetry.ts';
import { SecurityOrgans } from './security.ts';

export type PluginRoute = {
  id: string;
  baseUrl: string;
  kind: 'free' | 'paid';
  estimatedCostUsd: number;
  timeoutMs?: number;
  maxRetries?: number;
  credentialHeader?: { name: string; env: string; prefix?: string };
};

export type PluginManifest = {
  id: string;
  enabled: boolean;
  allowedOperations: string[];
  risk: 'low' | 'medium' | 'high' | 'critical';
  routes: PluginRoute[];
};

export type RouterRequest = {
  runId: string;
  stepId: string;
  pluginId: string;
  operation: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  cacheTtlSeconds?: number;
  retrySafe?: boolean;
};

export type RouterResponse = {
  status: 'ok' | 'awaiting_approval' | 'blocked' | 'failed';
  routeId?: string;
  statusCode?: number;
  data?: unknown;
  cached: boolean;
  detail: string;
};

type CacheEntry = { expiresAt: number; response: RouterResponse };

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginManifest>();

  constructor(manifests: PluginManifest[]) {
    for (const manifest of manifests) this.plugins.set(manifest.id, manifest);
  }

  get(pluginId: string): PluginManifest | undefined {
    return this.plugins.get(pluginId);
  }

  list(): PluginManifest[] {
    return Array.from(this.plugins.values()).map((plugin) => ({ ...plugin, routes: plugin.routes.map((route) => ({ ...route, credentialHeader: route.credentialHeader ? { ...route.credentialHeader, env: '[CONFIGURED ENVIRONMENT VARIABLE]' } : undefined })) }));
  }

  static fromEnvironment(): PluginRegistry {
    const source = process.env.MICROFIXD_PLUGINS_JSON;
    if (!source) return new PluginRegistry([]);
    try {
      const manifests = JSON.parse(source) as PluginManifest[];
      if (!Array.isArray(manifests)) throw new Error('MICROFIXD_PLUGINS_JSON must contain an array.');
      validateManifests(manifests);
      return new PluginRegistry(manifests);
    } catch (error) {
      throw new Error(`Plugin Registry configuration is invalid: ${(error as Error).message}`);
    }
  }
}

export class ApiRecyclingLayer {
  private readonly cache = new Map<string, CacheEntry>();

  get(key: string): RouterResponse | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return { ...entry.response, cached: true, detail: 'Response reused by the API Recycling Layer.' };
  }

  put(key: string, response: RouterResponse, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return;
    this.cache.set(key, { expiresAt: Date.now() + ttlSeconds * 1000, response: { ...response, cached: false } });
    if (this.cache.size > 1_000) this.cache.delete(this.cache.keys().next().value as string);
  }
}

export class OmniRouter {
  constructor(
    private readonly registry: PluginRegistry,
    private readonly paragon: ParagonDissector,
    private readonly store: RuntimeStore,
    private readonly telemetry: Telemetry,
    private readonly recycling = new ApiRecyclingLayer(),
  ) {}

  async route(request: RouterRequest): Promise<RouterResponse> {
    try {
      SecurityOrgans.assertSafeInput({ pluginId: request.pluginId, operation: request.operation, method: request.method, path: request.path, query: request.query, body: request.body, headers: request.headers });
    } catch (error) {
      const detail = SecurityOrgans.redact((error as Error).message);
      await this.audit(request, { outcome: 'blocked', estimatedCostUsd: 0, attempt: 0, details: { reason: detail, gate: 'Security Organ before Plugin Registry and OmniRouter routing.' } });
      this.telemetry.increment('integration_requests_total', { outcome: 'blocked', plugin: request.pluginId });
      return { status: 'blocked', cached: false, detail };
    }
    const plugin = this.registry.get(request.pluginId);
    if (!plugin || !plugin.enabled || !plugin.allowedOperations.includes(request.operation)) {
      await this.audit(request, { outcome: 'blocked', estimatedCostUsd: 0, attempt: 0, details: { reason: 'Plugin missing, disabled, or not allowed for this operation.' } });
      this.telemetry.increment('integration_requests_total', { outcome: 'blocked', plugin: request.pluginId });
      return { status: 'blocked', cached: false, detail: 'Plugin Registry denied this operation.' };
    }

    const method = request.method || 'GET';
    const cacheKey = this.cacheKey(request);
    if (method === 'GET' && (request.cacheTtlSeconds || 0) > 0) {
      const cached = this.recycling.get(cacheKey);
      if (cached) {
        await this.audit(request, { outcome: 'cache_hit', estimatedCostUsd: 0, attempt: 0, details: { cacheKey } });
        this.telemetry.increment('integration_requests_total', { outcome: 'cache_hit', plugin: request.pluginId });
        return cached;
      }
    }

    const routes = [...plugin.routes].sort((a, b) => Number(a.kind === 'paid') - Number(b.kind === 'paid') || a.estimatedCostUsd - b.estimatedCostUsd);
    if (routes.length === 0) {
      await this.audit(request, { outcome: 'blocked', estimatedCostUsd: 0, attempt: 0, details: { reason: 'No configured routes for plugin.' } });
      return { status: 'blocked', cached: false, detail: 'Plugin Registry contains no executable route for this plugin.' };
    }

    for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
      const route = routes[routeIndex];
      const decision = this.paragon.evaluateIntegration({
        runId: request.runId,
        stepId: request.stepId,
        pluginId: request.pluginId,
        operation: request.operation,
        risk: plugin.risk,
        estimatedCostUsd: route.estimatedCostUsd,
        routeKind: route.kind,
      });
      await this.store.savePolicyDecision(decision);

      if (decision.outcome === 'deny') {
        await this.audit(request, { outcome: 'blocked', routeId: route.id, estimatedCostUsd: route.estimatedCostUsd, attempt: 0, details: { reasons: decision.reasons, decisionId: decision.id } });
        this.telemetry.increment('integration_requests_total', { outcome: 'blocked', plugin: request.pluginId });
        return { status: 'blocked', routeId: route.id, cached: false, detail: `Tier-0 Paragon Dissector denied the request: ${decision.reasons.join(' ')}` };
      }

      if (decision.outcome === 'require_approval') {
        await this.store.createApproval({
          id: randomUUID(),
          runId: request.runId,
          stepId: request.stepId,
          action: { id: request.stepId, kind: 'external_effect', title: `OmniRouter ${request.pluginId}/${request.operation}`, input: { pluginId: request.pluginId, operation: request.operation, routeId: route.id, estimatedCostUsd: route.estimatedCostUsd }, risk: plugin.risk },
          reason: decision.reasons.join(' '),
          status: 'pending',
          requestedAt: new Date().toISOString(),
          approvedBy: [],
        });
        await this.audit(request, { outcome: 'awaiting_approval', routeId: route.id, estimatedCostUsd: route.estimatedCostUsd, attempt: 0, details: { reasons: decision.reasons, decisionId: decision.id } });
        this.telemetry.increment('integration_requests_total', { outcome: 'awaiting_approval', plugin: request.pluginId });
        return { status: 'awaiting_approval', routeId: route.id, cached: false, detail: `Tier-0 Paragon Dissector escalated this request to Craig: ${decision.reasons.join(' ')}` };
      }

      const attemptLimit = Math.max(0, Math.min(route.maxRetries ?? 2, 4));
      for (let attempt = 0; attempt <= attemptLimit; attempt += 1) {
        try {
          const response = await this.send(route, request);
          const data = await parseResponse(response);
          const result: RouterResponse = { status: 'ok', routeId: route.id, statusCode: response.status, data, cached: false, detail: routeIndex > 0 ? 'Request completed through an approved fallback route.' : 'Request completed through the approved primary route.' };
          await this.audit(request, { outcome: routeIndex > 0 ? 'fallback' : 'sent', routeId: route.id, estimatedCostUsd: route.estimatedCostUsd, actualCostUsd: route.estimatedCostUsd, attempt, responseStatus: response.status, details: { decisionId: decision.id, cacheable: method === 'GET' } });
          this.telemetry.increment('integration_requests_total', { outcome: routeIndex > 0 ? 'fallback' : 'sent', plugin: request.pluginId });
          if (method === 'GET' && (request.cacheTtlSeconds || 0) > 0) this.recycling.put(cacheKey, result, request.cacheTtlSeconds || 0);
          return result;
        } catch (error) {
          const retryable = method === 'GET' || request.retrySafe === true;
          const finalAttempt = attempt === attemptLimit || !retryable;
          await this.audit(request, { outcome: finalAttempt ? 'failed' : 'fallback', routeId: route.id, estimatedCostUsd: route.estimatedCostUsd, attempt, details: { message: (error as Error).message, retryable } });
          if (finalAttempt) break;
          await pause(Math.min(250 * (2 ** attempt), 1_500));
        }
      }
    }

    this.telemetry.increment('integration_requests_total', { outcome: 'failed', plugin: request.pluginId });
    return { status: 'failed', cached: false, detail: 'All Tier-0-approved plugin routes failed within their bounded retry budgets.' };
  }

  private async send(route: PluginRoute, request: RouterRequest): Promise<Response> {
    const url = buildUrl(route.baseUrl, request.path, request.query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1_000, Math.min(route.timeoutMs ?? 10_000, 30_000)));
    try {
      const headers: Record<string, string> = { Accept: 'application/json', ...(request.headers || {}) };
      if (request.body) headers['Content-Type'] = 'application/json';
      if (route.credentialHeader) {
        const secret = process.env[route.credentialHeader.env];
        if (!secret) throw new Error(`Plugin route ${route.id} is missing its configured credential environment variable.`);
        headers[route.credentialHeader.name] = `${route.credentialHeader.prefix || ''}${secret}`;
      }
      const response = await fetch(url, { method: request.method || 'GET', headers, body: request.body ? JSON.stringify(request.body) : undefined, signal: controller.signal });
      if (!response.ok && (response.status >= 500 || response.status === 429)) throw new Error(`Provider returned retryable HTTP ${response.status}.`);
      if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private cacheKey(request: RouterRequest): string {
    return createHash('sha256').update(JSON.stringify({ pluginId: request.pluginId, operation: request.operation, method: request.method || 'GET', path: request.path, query: request.query || {}, body: request.body || {} })).digest('hex');
  }

  private async audit(request: RouterRequest, event: { outcome: 'cache_hit' | 'sent' | 'fallback' | 'blocked' | 'awaiting_approval' | 'failed'; routeId?: string; estimatedCostUsd: number; actualCostUsd?: number; attempt: number; responseStatus?: number; details: Record<string, unknown> }): Promise<void> {
    await this.store.appendIntegrationAudit({
      id: randomUUID(), runId: request.runId, stepId: request.stepId, pluginId: request.pluginId, operation: request.operation,
      routeId: event.routeId, outcome: event.outcome, estimatedCostUsd: event.estimatedCostUsd, actualCostUsd: event.actualCostUsd,
      attempt: event.attempt, responseStatus: event.responseStatus, details: event.details, createdAt: new Date().toISOString(),
    });
  }
}

const validateManifests = (manifests: PluginManifest[]): void => {
  const identifiers = new Set<string>();
  for (const plugin of manifests) {
    if (!/^[a-z0-9-]{2,64}$/.test(plugin.id)) throw new Error(`Invalid plugin id: ${plugin.id}`);
    if (identifiers.has(plugin.id)) throw new Error(`Duplicate plugin id: ${plugin.id}`);
    identifiers.add(plugin.id);
    if (!Array.isArray(plugin.allowedOperations) || plugin.allowedOperations.length === 0) throw new Error(`Plugin ${plugin.id} must allow at least one operation.`);
    for (const route of plugin.routes) {
      const url = new URL(route.baseUrl);
      if (url.protocol !== 'https:') throw new Error(`Plugin ${plugin.id} route ${route.id} must use HTTPS.`);
      if (!Number.isFinite(route.estimatedCostUsd) || route.estimatedCostUsd < 0) throw new Error(`Plugin ${plugin.id} route ${route.id} has an invalid cost.`);
    }
  }
};

const buildUrl = (baseUrl: string, path: string, query: RouterRequest['query']): string => {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) throw new Error('OmniRouter only accepts a relative route path.');
  const base = new URL(baseUrl);
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new Error('OmniRouter rejected a cross-origin route path.');
  for (const [key, value] of Object.entries(query || {})) if (value !== undefined) url.searchParams.set(key, String(value));
  return url.toString();
};

const parseResponse = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') || '';
  const text = (await response.text()).slice(0, 1_000_000);
  if (contentType.includes('application/json')) {
    try { return JSON.parse(text); } catch { return { raw: text, parseError: 'Provider marked the response as JSON but it could not be parsed.' }; }
  }
  return { raw: text };
};
const pause = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
