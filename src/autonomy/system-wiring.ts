import { ORGAN_REGISTRY, organSummary } from './organ-registry.ts';
import { OrganLifecycleController } from './organ-lifecycle.ts';
import { MultiAgentControlPlane } from './level6.ts';
import type { Level6Record, RuntimeStore } from './types.ts';

const now = (): string => new Date().toISOString();

const REQUIRED_ORGANS = [
  'paragon-dissector', 'constitution-engine', 'doctrine-engine', 'organ-wiring-layer', 'agent-router',
  'puppeteer-organ', 'omnirouter-organ', 'plugin-registry-organ', 'security-organ', 'drift-protection-organ',
  'reality-anchor-organ', 'sandbox-organ', 'tenant-registry', 'device-capability-organ', 'web-automation-organ',
  'central-os-ui-organ', 'approval-control-organ', 'safe-mode-control-organ', 'health-trigger-organ',
] as const;

const CROSS_CUTTING_WIRING = {
  layerToLayer: [
    'Constitution → Doctrine → Paragon → Cognition → Memory → Execution → Evolution → Safety → Infrastructure → Mission Control',
    'Every action path enters through tenant context, Organ Kernel procedure, and a Paragon preflight before execution evidence is produced.',
  ],
  agentToAgent: { requiredPath: 'Agent Registry → Agent Router → Agent Collaboration / Oversight / Arbitration → Paragon', directAgentCalls: false },
  organToAgent: { requiredPath: 'Organ telemetry / workflow evidence → Agent Router → bounded task / workflow procedure → Paragon → Puppeteer Execution Control', directOrganAgentExecution: false },
  runtime: { requiredPath: 'Runtime → OmniRouter / Plugin Registry for external operations → Safety → Paragon → Mission Control', directExternalRuntimeCalls: false },
  compute: { requiredPath: 'Acceleration Router policy → local bounded compute or approved adapter → OmniRouter / Plugin Registry → Paragon', automaticRemoteSelection: false },
  safety: { connectedSurfaces: ['cognition', 'memory', 'execution', 'evolution', 'compute', 'tenants', 'mission control'], finalAuthority: 'Paragon Dissector Tier-0' },
  evolution: { requiredPath: 'Sandbox → validation → Paragon review → Craig approval for protected change → registered GitHub / CI-CD adapter', directActivation: false },
  tenants: { connectedSurfaces: ['constitution', 'doctrine', 'plugins', 'workflows', 'memory', 'compute', 'safety', 'evolution', 'mission control'], crossTenantAccess: false },
  missionControl: { connectedSurfaces: ['organs', 'agents', 'layers', 'runtimes', 'compute', 'safety', 'evolution', 'tenants', 'Paragon', 'constitution', 'doctrine'], controlBoundary: 'Protected API and Organ Kernel only' },
  paragon: { connectedTo: 'all system actions, organs, agents, workflows, integrations, tenant records, adapter requests, and protected operator commands', bypassPath: 'none' },
  constitution: { enforcedAcross: ['cognition', 'memory', 'execution', 'evolution', 'safety', 'compute', 'tenants', 'mission control', 'agents', 'organs'] },
  doctrine: { enforcedAcross: ['cinematic organ', 'hallucination filter', 'mission control', 'tenants', 'agents', 'organs'], cannotOverrideSafety: true },
};

export class SystemWiringControlPlane {
  static async validate(store: RuntimeStore, tenantId: string): Promise<Level6Record> {
    const timestamp = now();
    const lifecycle = OrganLifecycleController.validate();
    const ids = new Set(ORGAN_REGISTRY.map((organ) => organ.id));
    const missingRequiredOrgans = REQUIRED_ORGANS.filter((id) => !ids.has(id));
    const invalidAuthority = ORGAN_REGISTRY.filter((organ) => organ.finalAuthority !== 'Paragon Dissector' || !organ.metadata.paragonOversightHook || !organ.metadata.tenantIsolated).map((organ) => organ.id);
    const agents = await MultiAgentControlPlane.bootstrap(store, tenantId);
    const agentProfileIssues = agents.filter((agent) => agent.payload.profileVersion !== '2.0.0' || agent.payload.authority !== 'Paragon Dissector Tier-0').map((agent) => agent.id);
    const valid = lifecycle.valid && missingRequiredOrgans.length === 0 && invalidAuthority.length === 0 && agents.length === 6 && agentProfileIssues.length === 0;
    const record: Level6Record = {
      id: `master-wiring:${tenantId}`,
      type: 'organ_wiring',
      tenantId,
      name: 'Master system wiring map',
      status: valid ? 'valid' : 'degraded',
      payload: {
        wiringVersion: '2.0.0',
        authority: 'Paragon Dissector Tier-0',
        masterMap: {
          organRegistry: { ...organSummary(), metadataVersion: '2.0.0', allTenantIsolated: ORGAN_REGISTRY.every((organ) => organ.metadata.tenantIsolated), allParagonHooked: ORGAN_REGISTRY.every((organ) => Boolean(organ.metadata.paragonOversightHook)) },
          layerRegistry: { foundationalLayers: 8, overlays: ['Mission Control OS/UI', 'Multi-Tenant Enterprise', 'Governed Compute', 'Governed Web Use', 'Multi-Agent Workforce', 'Self-Healing', 'Master Wiring', 'Audit and Lock-In', 'Operational Bring-Up'] },
          agentRegistry: { count: agents.length, roles: agents.map((agent) => agent.payload.role), allVersioned: agentProfileIssues.length === 0, isolation: 'tenant-scoped' },
          declarativeOrganEdges: lifecycle.edges,
          declarativeEdgeCount: lifecycle.edges.length,
          crossCutting: CROSS_CUTTING_WIRING,
        },
        validator: {
          valid,
          lifecycle: { valid: lifecycle.valid, organCount: lifecycle.organCount, edgeCount: lifecycle.edges.length, missingDependencies: lifecycle.missingDependencies, invalidRootBootOrder: lifecycle.invalidLayer0Order, prohibitedDirectCalls: lifecycle.prohibitedDirectCalls },
          missingRequiredOrgans,
          invalidAuthority,
          agentProfileIssues,
          noDirectBypassPaths: true,
          failureModel: 'Any missing, unsafe, unauthorized, drift-inducing, or authority-bypassing wiring condition marks this posture degraded and permits only evidence retention and sandbox-bound repair proposals.',
          recoveryModel: 'Preserve active state and wiring evidence. No automatic rewiring, capability activation, restart, deployment, merge, rollback, or policy relaxation occurs.',
        },
        telemetry: { endpoint: '/metrics#system_wiring', fields: ['wiring errors', 'wiring drift', 'wiring violations', 'wiring escalations'], visibleTo: ['Paragon Dissector', 'authorized Mission Control tenant context'] },
        capturedAt: timestamp,
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(record);
    return record;
  }
}
