import { randomUUID } from 'node:crypto';
import type { Level6Record, PlannedAction, RunRecord, RuntimeStore } from './types.ts';

const now = (): string => new Date().toISOString();

export type ExecutionAssessment = {
  runId: string;
  tenantId: string;
  actionId: string;
  actionKind: string;
  trigger: 'Puppeteer Organ';
  executionBoundary: 'bounded-in-process-procedure';
  safety: 'Paragon-preflight-required';
  stability: 'checked';
  telemetry: { startedAt: string; completedAt?: string; latencyMs?: number; outcome: 'started' | 'succeeded' | 'failed' };
};

export class PuppeteerExecutionControl {
  static async execute<T>(store: RuntimeStore, run: RunRecord, action: PlannedAction, invoke: () => Promise<T>): Promise<T> {
    const startedAt = now();
    const start = Date.now();
    const base: ExecutionAssessment = {
      runId: run.id, tenantId: run.tenantId, actionId: action.id, actionKind: action.kind,
      trigger: 'Puppeteer Organ', executionBoundary: 'bounded-in-process-procedure', safety: 'Paragon-preflight-required', stability: 'checked',
      telemetry: { startedAt, outcome: 'started' },
    };
    await this.record(store, run, action, 'started', base);
    try {
      const result = await invoke();
      await this.record(store, run, action, 'succeeded', { ...base, telemetry: { ...base.telemetry, completedAt: now(), latencyMs: Date.now() - start, outcome: 'succeeded' } });
      return result;
    } catch (error) {
      await this.record(store, run, action, 'failed', { ...base, telemetry: { ...base.telemetry, completedAt: now(), latencyMs: Date.now() - start, outcome: 'failed' }, error: (error as Error).message });
      throw error;
    }
  }

  static async record(store: RuntimeStore, run: RunRecord, action: PlannedAction, status: string, payload: Record<string, unknown>): Promise<Level6Record> {
    const timestamp = now();
    const record: Level6Record = {
      id: `execution:${run.id}:${action.id}:${status}`,
      type: 'execution_assessment',
      tenantId: run.tenantId,
      name: `Puppeteer execution ${status}: ${action.title}`,
      status,
      payload: {
        ...payload,
        recovery: status === 'failed' ? 'Fallback Safety, Organ Repair, and sandbox-only repair proposal are activated by the runtime; no production restart or rollback is automatic.' : undefined,
        workflowBoundary: 'Nested, conditional, parallel, or external workflows require separately planned and Paragon-governed actions.',
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }
}


export class WebUseControlPlane {
  static posture(): Record<string, unknown> {
    return {
      browser: { status: 'adapter-dormant', boundary: 'A browser session is never a direct outbound path. Browser-capable work must be represented as a bounded workflow action and routed through an approved Plugin Registry manifest and OmniRouter.' },
      webAutomation: { status: 'governed-procedure-only', boundary: 'Automation plans require Security Organ checks, tenant scope, Organ Kernel invocation, Paragon preflight, and Puppeteer execution control.' },
      webInteraction: { status: 'governed-procedure-only', supportedIntent: ['click', 'type', 'scroll', 'select', 'submit', 'extract'], boundary: 'No interaction is executed merely because an intent is present.' },
      puppeteer: { exclusiveWebActionAuthority: true, boundary: 'The Puppeteer Organ is the sole web-action trigger. It records start, outcome, latency, stability, and recovery evidence for every bounded action.' },
      safety: { hooks: ['domain and relative-path validation', 'tenant ownership', 'Security Organ input inspection', 'Plugin Registry allowlist', 'OmniRouter policy', 'Paragon decision', 'Safe Mode operational halt'], directNetworkAccess: false },
      drift: { monitor: 'Unexpected route, domain, interaction, runtime, or policy evidence is recorded and blocked until separately planned and governed.', response: 'No automatic web retry outside OmniRouter’s bounded retry policy; no automatic capability activation.' },
      reality: { hallucinationFilter: 'Web results are provider responses and audit evidence, not asserted facts until a bounded verification workflow records supporting evidence.', anchor: 'Route identity, response status, timestamps, and integration audit records preserve what was observed.' },
      doctrine: { cinematic: 'Tenant presentation and narrative constraints may guide outputs but cannot alter safety, routing, policy, or execution controls.' },
      telemetry: { visibleTo: ['Paragon Dissector', 'authorized Mission Control tenant context'], metrics: ['page and route attempts', 'navigation and interaction outcomes', 'automation failures', 'extraction evidence', 'safety blocks', 'drift blocks', 'approval escalations'], durableEvidence: 'Integration audits and execution assessments are retained by run and tenant.' },
      routing: { requiredPath: 'Security Organ → Plugin Registry → OmniRouter → Paragon decision → Puppeteer Execution Control', noExceptions: true },
      recovery: { model: 'Preserve telemetry and audit evidence. Failed work may produce a sandbox-only repair proposal; no automatic login, submission, deployment, restart, or rollback occurs.' },
      capturedAt: now(),
    };
  }

  static async record(store: RuntimeStore, tenantId: string): Promise<Level6Record> {
    const timestamp = now();
    const record: Level6Record = {
      id: `web-use-posture:${tenantId}`,
      type: 'execution_assessment',
      tenantId,
      name: 'Governed web-use posture',
      status: 'observed',
      payload: this.posture(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }
}
