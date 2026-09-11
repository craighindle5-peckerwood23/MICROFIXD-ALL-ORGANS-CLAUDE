import { CONSTITUTION, DOCTRINE } from './governance.ts';
import { ORGAN_REGISTRY, organSummary } from './organ-registry.ts';
import { ComputeControlPlane, MultiAgentControlPlane, SafeModeControlPlane } from './level6.ts';
import { SelfHealingControlPlane } from './self-healing.ts';
import { SystemWiringControlPlane } from './system-wiring.ts';
import { sign } from './signing.ts';
import type { Level6Record, RuntimeStore } from './types.ts';

const now = (): string => new Date().toISOString();

type AuditCheck = { id: string; label: string; status: 'pass' | 'degraded'; severity: 'info' | 'warning' | 'critical'; evidence: Record<string, unknown>; escalationPath: string; correctionPath: string };

const check = (id: string, label: string, passing: boolean, evidence: Record<string, unknown>, correctionPath: string): AuditCheck => ({
  id, label, status: passing ? 'pass' : 'degraded', severity: passing ? 'info' : 'warning', evidence,
  escalationPath: passing ? 'None; retain durable audit evidence.' : 'Paragon Dissector Tier-0 → Craig for a protected corrective action.',
  correctionPath,
});

export class FinalAuditControlPlane {
  static async audit(store: RuntimeStore, tenantId: string): Promise<Level6Record> {
    const timestamp = now();
    const [wiring, selfHealing, agents, safeMode, computeRecords, infrastructureRecords, webRecords, cognitiveRecords, memoryRecords, evolutionRecords] = await Promise.all([
      SystemWiringControlPlane.validate(store, tenantId),
      SelfHealingControlPlane.assess(store, tenantId),
      MultiAgentControlPlane.posture(store, tenantId),
      SafeModeControlPlane.get(store),
      store.listLevel6Records('compute_profile', tenantId),
      store.listLevel6Records('infrastructure_assessment', tenantId),
      store.listLevel6Records('execution_assessment', tenantId),
      store.listLevel6Records('cognitive_assessment', tenantId),
      store.listLevel6Records('memory_assessment', tenantId),
      store.listLevel6Records('evolution_assessment', tenantId),
    ]);
    const summary = organSummary();
    const wiringPayload = wiring.payload as { validator?: { valid?: boolean; noDirectBypassPaths?: boolean }; masterMap?: { organRegistry?: { allParagonHooked?: boolean; allTenantIsolated?: boolean } } };
    const healthPayload = selfHealing.payload as { safety?: { sandboxOnly?: boolean; evidencePreserving?: boolean } };
    const agentsPayload = agents as { registry?: { agentCount?: number; versioned?: boolean }; router?: { directExecution?: boolean } };
    const safetyFrozen = Object.isFrozen(CONSTITUTION) && Object.isFrozen(DOCTRINE);
    const uiOrganIds = ['central-os-ui-organ', 'holographic-head-organ', 'system-dashboard-organ', 'approval-control-organ', 'safe-mode-control-organ', 'telemetry-viewer-organ'];
    const uiValid = uiOrganIds.every((id) => ORGAN_REGISTRY.some((organ) => organ.id === id));
    const checks: AuditCheck[] = [
      check('system', 'Full system audit', summary.total === 201 && summary.families === 21 && summary.layers === 8, { organSummary: summary, registeredOrgans: ORGAN_REGISTRY.length }, 'Rebuild the registry only through a sandbox-validated, Paragon- and Craig-approved change path.'),
      check('safety', 'Full safety audit', safetyFrozen && wiringPayload.validator?.noDirectBypassPaths === true && healthPayload.safety?.sandboxOnly === true, { constitutionFrozen: Object.isFrozen(CONSTITUTION), doctrineFrozen: Object.isFrozen(DOCTRINE), noDirectBypassPaths: wiringPayload.validator?.noDirectBypassPaths, repairSandboxOnly: healthPayload.safety?.sandboxOnly, evidencePreserving: healthPayload.safety?.evidencePreserving }, 'Retain evidence, enter Safe Mode if needed, and submit a sandbox correction proposal.'),
      check('drift', 'Full drift audit', cognitiveRecords.every((record) => ['bounded', 'review'].includes(record.status)) && memoryRecords.every((record) => record.tenantId === tenantId), { cognitiveAssessments: cognitiveRecords.length, memoryAssessments: memoryRecords.length, driftBoundary: 'Drift evidence cannot independently authorize action.' }, 'Escalate material drift through Paragon and create only a tenant-scoped sandbox proposal.'),
      check('evolution', 'Full evolution audit', evolutionRecords.every((record) => ['sandbox-validated', 'sandbox-review-required', 'adapter-dormant', 'no-production-change'].includes(record.status)), { evolutionAssessments: evolutionRecords.length, requiredBoundary: 'Sandbox → validation → Paragon → Craig approval → approved adapter', directActivation: false }, 'Preserve candidate evidence; do not activate, merge, deploy, or rollback without separate protected approval.'),
      check('compute', 'Full compute audit', computeRecords.length > 0 && ComputeControlPlane.scan().routes !== undefined, { computeRecords: computeRecords.length, posture: ComputeControlPlane.scan(), remoteAndCluster: 'adapter-dormant or policy-only' }, 'Record compute failure evidence and use a sandbox repair proposal; remote dispatch and scaling remain protected.'),
      check('tenant', 'Full tenant audit', wiringPayload.masterMap?.organRegistry?.allTenantIsolated === true && agentsPayload.registry?.agentCount === 6, { tenantId, allOrgansTenantIsolated: wiringPayload.masterMap?.organRegistry?.allTenantIsolated, agents: agentsPayload.registry?.agentCount, agentProfilesVersioned: agentsPayload.registry?.versioned, safeMode: safeMode?.status || 'disabled' }, 'Reject cross-tenant access, preserve audit evidence, and correct through tenant-scoped sandbox change control.'),
      check('os-ui', 'Full OS/UI audit', uiValid && infrastructureRecords.length > 0 && webRecords.length > 0, { uiOrganIds, uiValid, infrastructurePostures: infrastructureRecords.length, webExecutionEvidence: webRecords.length }, 'Use the protected inspection surface to retain UI evidence; visual or code changes remain sandbox and change-control governed.'),
      check('wiring', 'Full wiring audit', wiring.status === 'valid' && wiringPayload.validator?.valid === true && wiringPayload.masterMap?.organRegistry?.allParagonHooked === true, { wiringStatus: wiring.status, validator: wiringPayload.validator, paragonHooks: wiringPayload.masterMap?.organRegistry?.allParagonHooked }, 'Mark wiring degraded, halt unsafe actions, and submit a sandbox-only repair proposal.'),
    ];
    const passed = checks.every((item) => item.status === 'pass');
    const record: Level6Record = {
      id: `full-system-audit:${tenantId}`,
      type: 'audit_assessment',
      tenantId,
      name: 'Full system audit and shipability assessment',
      status: passed ? 'passed-with-governed-boundaries' : 'degraded',
      payload: {
        auditVersion: '2.0.0', tenantId, passed, checks,
        certification: passed ? {
          structural: 'verified registry and wiring evidence', architectural: 'verified declared control-plane boundaries', cognitive: 'bounded control evidence present', safety: 'non-bypassable policy and sandbox repair boundaries present', evolution: 'sandbox-only and approval-gated', compute: 'local discovery with dormant external adapters', tenant: 'tenant-scoped records and cross-tenant guards', osUi: 'registered protected mission-control surfaces',
        } : undefined,
        limitation: 'This is an evidence-based operational posture assessment. It does not claim that source code, cloud infrastructure, third-party services, or future human-authored changes are physically immutable or defect-free.',
        shipability: passed ? 'Ready for governed deployment validation; environment secrets, durable database connectivity, and platform health checks must still be configured in the target environment.' : 'Not ready; follow the recorded correction paths.',
        capturedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }

  static async lock(store: RuntimeStore, tenantId: string): Promise<Level6Record> {
    const audit = await this.audit(store, tenantId);
    const timestamp = now();
    const lock: Level6Record = {
      id: `governance-lock:${tenantId}`,
      type: 'governance_lock',
      tenantId,
      name: 'Constitution, doctrine, and Paragon lock-in evidence',
      status: audit.status === 'passed-with-governed-boundaries' ? 'locked-runtime-posture' : 'lock-degraded',
      payload: {
        lockVersion: '2.0.0', auditId: audit.id, auditStatus: audit.status,
        constitution: { version: CONSTITUTION.version, frozen: Object.isFrozen(CONSTITUTION), invariantCount: CONSTITUTION.invariants.length, authority: CONSTITUTION.authority },
        doctrine: { version: DOCTRINE.version, frozen: Object.isFrozen(DOCTRINE), invariantCount: DOCTRINE.invariants.length, authority: DOCTRINE.authority },
        paragon: { tier: 'tier-0', finalAuthority: true, veto: 'implemented through allow, require approval, and deny policy outcomes', escalation: 'Craig for high-risk, high-cost, uncertain, protected, or external-effect exceptions', bypassPath: 'none' },
        lockMeaning: 'The active runtime contract objects are frozen, their versions and invariants are recorded, and every governed procedure continues to require Paragon review. Source edits, database changes, deployments, and integration activation remain separately protected change-control operations; this record makes no stronger physical immutability claim.',
        activation: 'No new capability, integration, restart, patch, deployment, merge, rollback, or external action is activated by lock-in.',
        capturedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    // Second of the two highest-risk record types signed first: a
    // tampered governance-lock record could misreport the constitution
    // as frozen/valid when it isn't. Same skip-if-unconfigured behavior
    // as RepairControlPlane.propose().
    if (process.env.MICROFIXD_SIGNING_KEYS) {
      const envelope = sign({ id: lock.id, type: lock.type, tenantId: lock.tenantId, status: lock.status, auditId: audit.id });
      (lock.payload as Record<string, unknown>).signature = envelope;
    }
    await store.upsertLevel6Record(lock);
    return lock;
  }
}
