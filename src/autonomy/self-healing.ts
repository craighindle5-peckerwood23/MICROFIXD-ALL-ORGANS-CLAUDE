import { randomUUID } from 'node:crypto';
import { OrganLifecycleController } from './organ-lifecycle.ts';
import { SecurityOrgans } from './security.ts';
import type { Level6Record, RuntimeStore } from './types.ts';

const now = (): string => new Date().toISOString();

export type RepairScope = 'organ' | 'agent' | 'workflow' | 'runtime' | 'compute' | 'memory' | 'cognition' | 'evolution' | 'os-ui' | 'safety' | 'tenant';
export type RepairSeverity = 'info' | 'warning' | 'critical';

export class SelfHealingControlPlane {
  static async assess(store: RuntimeStore, tenantId: string): Promise<Level6Record> {
    const timestamp = now();
    const [storage, agents, repairs] = await Promise.all([
      store.health(),
      store.listLevel6Records('agent', tenantId),
      store.listLevel6Records('repair_proposal', tenantId),
    ]);
    const wiring = OrganLifecycleController.validate();
    const status = storage.durable && wiring.valid ? 'nominal' : 'degraded';
    const record: Level6Record = {
      id: `health-assessment:${tenantId}`,
      type: 'health_assessment',
      tenantId,
      name: 'Governed self-healing posture',
      status,
      payload: {
        profileVersion: '2.0.0',
        tenantId,
        organRepairEngine: {
          status: wiring.valid ? 'ready-to-diagnose' : 'wiring-degraded',
          responsibilities: ['diagnose organ failure', 'prepare sandbox repair candidates', 'record stabilization evidence'],
          prohibited: ['automatic restart', 'automatic replacement', 'automatic patch', 'automatic activation'],
        },
        runtimeRepair: {
          status: storage.durable ? 'observed' : 'durability-degraded',
          responsibilities: ['diagnose runtime failures, overload, instability, and drift', 'retain evidence', 'prepare bounded repair proposals'],
          prohibited: ['automatic process restart', 'automatic runtime replacement', 'automatic rollback'],
        },
        failureDetection: {
          status: 'active-observation',
          monitoredScopes: ['organ', 'agent', 'workflow', 'runtime', 'compute', 'memory', 'cognition', 'evolution', 'os-ui', 'safety', 'tenant'],
          signals: { wiringValid: wiring.valid, missingDependencies: wiring.missingDependencies, invalidRootBootOrder: wiring.invalidLayer0Order, durableStore: storage.durable, agentCount: agents.length, retainedRepairProposals: repairs.length },
          response: 'Record a tenant-scoped failure event, halt unsafe work through normal governance, and create only a sandbox-bound repair proposal when a run context exists.',
        },
        healthcheck: {
          status,
          checks: ['declarative organ wiring', 'durable-store posture', 'tenant agent registry availability', 'retained repair evidence'],
          results: { durableStorage: storage, wiring: { valid: wiring.valid, organCount: wiring.organCount, wiringEdges: wiring.edges.length }, agents: agents.length, repairProposals: repairs.length },
        },
        telemetry: {
          visibleTo: ['Paragon Dissector', 'authorized Mission Control tenant context'],
          metrics: ['organ failures', 'agent failures', 'workflow failures', 'runtime failures', 'compute failures', 'safety failures', 'evolution failures', 'os-ui failures', 'tenant failures', 'repair attempts', 'repair outcomes', 'repair escalations'],
          evidenceRetention: 'Health assessments, failure records, repair proposals, system events, and execution evidence remain durable when configured storage is available.',
        },
        oversight: {
          authority: 'Paragon Dissector Tier-0',
          rule: 'All repairs, restarts, replacements, patches, corrections, and escalations remain subject to Paragon review. Any protected activation additionally requires Craig approval and an approved adapter where applicable.',
        },
        safety: {
          sandboxOnly: true,
          evidencePreserving: true,
          activationPath: ['failure or health evidence', 'sandbox repair candidate', 'validation', 'Paragon review', 'Craig approval where protected', 'approved change-control path'],
        },
        recovery: {
          model: 'Preserve active state and durable evidence. Do not silently restart, replace, patch, deploy, merge, activate, or rollback production state.',
        },
        capturedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }

  static async recordFailure(store: RuntimeStore, input: { tenantId: string; scope: RepairScope; severity: RepairSeverity; message: string; runId?: string; evidence?: Record<string, unknown> }): Promise<Level6Record> {
    const timestamp = now();
    const record: Level6Record = {
      id: `failure:${input.scope}:${randomUUID()}`,
      type: 'health_assessment',
      tenantId: input.tenantId,
      name: `Failure detection: ${input.scope}`,
      status: input.severity === 'critical' ? 'critical' : 'detected',
      payload: {
        profileVersion: '2.0.0',
        runId: input.runId,
        scope: input.scope,
        severity: input.severity,
        message: SecurityOrgans.redact(input.message).slice(0, 4_000),
        evidence: input.evidence || {},
        detection: 'Failure Detection Organ observed bounded failure evidence.',
        response: 'Failure evidence is retained. Unsafe work is halted by the normal execution and governance controls. Any repair candidate is sandbox-only.',
        repairBoundary: 'No automatic restart, replacement, patch, activation, merge, deployment, or rollback occurs.',
        oversight: 'Paragon Dissector Tier-0; protected activation requires Craig approval.',
        createdAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }
}
