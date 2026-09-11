import { DOCTRINE, CONSTITUTION } from './governance.ts';
import { AGENT_ROLES, MultiAgentControlPlane } from './level6.ts';
import { OrganLifecycleController } from './organ-lifecycle.ts';
import type { Level6Record, RuntimeStore } from './types.ts';

const now = (): string => new Date().toISOString();

const ORGAN_INITIALIZATION = [
  'Identity Anchor', 'Constitution Engine', 'Doctrine Engine', 'Paragon Dissector preflight kernel',
  'Cognition Engine', 'Memory Engine', 'Safety Layer', 'Execution Layer', 'Evolution Layer',
  'Compute Layer', 'Infrastructure Layer', 'OS/UI Core Organ', 'Tenant Layer', 'Agents', 'Workflows',
];

const SAFETY_INITIALIZATION = ['Drift Protection Organ', 'Hallucination Filter', 'Cinematic Organ', 'Reality Anchor', 'Security Organ', 'Safety Router'];
const EVOLUTION_INITIALIZATION = ['Self-Modifying Engine', 'Sandbox Organ', 'Mutation Organ', 'Refactor Organ', 'Rollback Organ', 'GitHub Connector boundary', 'CI/CD Organ boundary'];
const COMPUTE_INITIALIZATION = ['GPU Offload Organ', 'Parallel Compute Organ', 'Tensor Engine', 'Distributed Compute Organ', 'Cluster Orchestrator', 'Server Runtime Organ'];
const RUNTIME_INITIALIZATION = ['Local Runtime Organ', 'Cloud Runtime Organ', 'Multi-Runtime Selector', 'Multi-Device Router'];
const TENANT_INITIALIZATION = ['Tenant Registry', 'Tenant Constitution Layer', 'Tenant Doctrine Layer', 'Tenant Plugin Layer', 'Tenant Workflow Layer', 'Tenant Memory Isolation', 'Tenant Compute Isolation', 'Tenant Safety Isolation', 'Tenant Evolution Isolation'];
const UI_INITIALIZATION = ['OS/UI Core Organ', 'Holographic Head Interface', 'System Dashboard', 'Organ Visualizer', 'Agent Visualizer', 'Workflow Visualizer', 'Tenant Visualizer', 'Compute Visualizer', 'Safety Visualizer', 'Evolution Visualizer', 'Paragon Oversight Console', 'Safe Mode Console', 'Approval/Deny Console', 'Logs and Telemetry Console'];

const event = (tenantId: string, stage: string, status: string, payload: Record<string, unknown>): Level6Record => {
  const timestamp = now();
  return {
    id: `bringup:${tenantId}:${stage}`, type: 'organ_boot', tenantId, name: `Governed bring-up: ${stage}`, status,
    payload: { bringUpVersion: '2.0.0', tenantId, authority: 'Paragon Dissector Tier-0', noActivation: 'Bring-up records runtime readiness and declared boundaries only. It does not activate integrations, remote compute, plugins, mutations, patches, deployment, merge, rollback, or external effects.', ...payload },
    createdAt: timestamp, updatedAt: timestamp,
  };
};

export class GovernedBringUpControlPlane {
  static async run(store: RuntimeStore, tenantId: string): Promise<Level6Record> {
    const timestamp = now();
    const lifecycle = OrganLifecycleController.validate();
    if (!lifecycle.valid) throw new Error(`Bootloader rejected the system wiring graph: ${[...lifecycle.missingDependencies, ...lifecycle.invalidLayer0Order].join('; ')}`);
    const agents = await MultiAgentControlPlane.bootstrap(store, tenantId);
    const agentRoles = agents.map((agent) => agent.payload.role);
    const ready = Object.isFrozen(CONSTITUTION) && Object.isFrozen(DOCTRINE) && lifecycle.valid && agents.length === AGENT_ROLES.length;
    const stages: Level6Record[] = [
      event(tenantId, 'bootloader', ready ? 'integrity-validated' : 'degraded', {
        responsibility: ['constitution integrity', 'doctrine integrity', 'Paragon integrity', 'organ registry', 'agent registry', 'wiring integrity'],
        wiring: ['Constitution Engine', 'Doctrine Engine', 'Paragon Dissector', 'Organ Registry', 'Agent Registry', 'Layer Registry', 'OS/UI Core Organ'],
        results: { constitutionFrozen: Object.isFrozen(CONSTITUTION), doctrineFrozen: Object.isFrozen(DOCTRINE), wiringValid: lifecycle.valid, organCount: lifecycle.organCount, agentCount: agents.length },
      }),
      event(tenantId, 'organ-initialization', 'sequence-recorded', { order: ORGAN_INITIALIZATION, declarativeOrganBootOrder: OrganLifecycleController.bootPlan().map((organ) => organ.id), safetyPrecedesExecution: true, paragonPreflight: 'present from bootloader; final coverage activation follows readiness verification' }),
      event(tenantId, 'agent-initialization', 'sequence-recorded', { order: AGENT_ROLES, requiredOrder: ['meta-agent', 'critic-safety', 'reflection', 'planner', 'builder', 'repair'], observedRoles: agentRoles, directAgentExecution: false }),
      event(tenantId, 'safety-initialization', 'sequence-recorded', { order: SAFETY_INITIALIZATION, condition: 'Safety controls are initialized before cognition is allowed to issue bounded workflow evidence.' }),
      event(tenantId, 'evolution-initialization', 'sequence-recorded', { order: EVOLUTION_INITIALIZATION, boundary: 'Sandbox-only, no automatic mutation, merge, deployment, activation, or rollback.' }),
      event(tenantId, 'compute-initialization', 'sequence-recorded', { order: COMPUTE_INITIALIZATION, boundary: 'Local discovery is read-only; remote, paid, distributed, cluster, and GPU paths remain governed adapter boundaries.' }),
      event(tenantId, 'runtime-initialization', 'sequence-recorded', { order: RUNTIME_INITIALIZATION, boundary: 'External operations remain OmniRouter and Plugin Registry governed.' }),
      event(tenantId, 'tenant-initialization', 'sequence-recorded', { order: TENANT_INITIALIZATION, boundary: 'Tenant records, memory, workflows, approvals, and agent evidence remain isolated.' }),
      event(tenantId, 'os-ui-initialization', 'sequence-recorded', { order: UI_INITIALIZATION, boundary: 'Mission Control is a protected inspection and governed-command surface only.' }),
      event(tenantId, 'first-heartbeat', ready ? 'ready' : 'degraded', { trigger: ['constitution lock posture', 'doctrine lock posture', 'wiring validation', 'organ readiness', 'agent readiness', 'runtime readiness', 'compute readiness', 'Paragon coverage'], output: ['synthetic heartbeat evidence', 'system-wide readiness evidence', 'OS/UI readiness event'] }),
      event(tenantId, 'first-cognition', ready ? 'bounded-ready' : 'degraded', { trigger: ['Cognition Engine', 'Memory Engine', 'Safety Layer', 'Paragon oversight readiness'], output: ['bounded reasoning evidence', 'reflection evidence', 'safety evidence', 'drift evidence'], privateReasoningClaim: false }),
      event(tenantId, 'first-stability-lock', ready ? 'locked-runtime-posture' : 'degraded', { trigger: ['Safety Layer', 'Drift Layer', 'Compute Layer', 'Runtime Layer'], meaning: 'Stable operating posture is recorded; it does not prevent protected future change-control operations.' }),
      event(tenantId, 'first-safety-lock', ready ? 'locked-runtime-posture' : 'degraded', { trigger: SAFETY_INITIALIZATION, meaning: 'Safety and drift controls remain enabled; Safe Mode retains authority to halt non-inspection work.' }),
      event(tenantId, 'first-paragon-sync', ready ? 'tier-0-active' : 'degraded', { order: ['Constitution Hooks', 'Doctrine Hooks', 'Safety Hooks', 'Drift Hooks', 'Evolution Hooks', 'Compute Hooks', 'Tenant Hooks', 'OS/UI Hooks', 'Tier-0 coverage attestation'], meaning: 'Paragon preflight exists from boot; this final event attests that Tier-0 coverage has been checked across ready surfaces.', bypassPath: 'none' }),
      event(tenantId, 'first-tenant-sync', ready ? 'tenant-isolated-ready' : 'degraded', { tenantId, surfaces: ['constitution', 'doctrine', 'plugins', 'workflows', 'memory', 'compute', 'safety', 'evolution', 'mission control'], crossTenantAccess: false }),
      event(tenantId, 'first-os-ui-sync', ready ? 'mission-control-ready' : 'degraded', { surfaces: ['holographic head', 'safe mode', 'approval queue', 'agent constellation', 'compute and infrastructure posture', 'web-use posture', 'self-healing posture', 'wiring and audit posture'] }),
      event(tenantId, 'first-workflow-sync', ready ? 'bounded-workflow-ready' : 'degraded', { pathway: 'Tenant context → Agent Router → Organ Kernel → Paragon decision → Puppeteer Execution Control → durable evidence', externalEffect: 'requires Craig approval', directExecution: false }),
    ];
    for (const stage of stages) await store.upsertLevel6Record(stage);
    return event(tenantId, 'operational-readiness', ready ? 'ready-for-governed-operation' : 'degraded', { ready, stageIds: stages.map((stage) => stage.id), bootSequence: ORGAN_INITIALIZATION, capturedAt: timestamp });
  }

  static async posture(store: RuntimeStore, tenantId: string): Promise<Level6Record> {
    const readiness = await this.run(store, tenantId);
    await store.upsertLevel6Record(readiness);
    return readiness;
  }
}
