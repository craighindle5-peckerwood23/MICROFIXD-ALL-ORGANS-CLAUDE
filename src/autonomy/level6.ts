import { randomUUID } from 'node:crypto';
import { cpus, totalmem, freemem, loadavg } from 'node:os';
import { sign } from './signing.ts';
import { MetaEvolver } from './meta-evolver.ts';
import type { Level6Record, Level6RecordType, RunRecord, RuntimeStore, Sandbox } from './types.ts';

export const GLOBAL_TENANT_ID = 'global';
export const AGENT_ROLES = ['meta-agent', 'critic-safety', 'reflection', 'planner', 'builder', 'repair'] as const;
export type AgentRole = typeof AGENT_ROLES[number];

const now = (): string => new Date().toISOString();
const validTenant = (tenantId: string): boolean => /^[a-z0-9][a-z0-9-]{0,63}$/.test(tenantId);

const record = (type: Level6RecordType, tenantId: string, name: string, status: string, payload: Record<string, unknown>, id: string = randomUUID()): Level6Record => {
  const timestamp = now();
  return { id, type, tenantId, name, status, payload, createdAt: timestamp, updatedAt: timestamp };
};

export class TenantControlPlane {
  static assertIdentifier(tenantId: string): void {
    if (!validTenant(tenantId)) throw new Error('Tenant Isolation Guard rejected the tenant identifier. Use lowercase letters, digits, and dashes only.');
  }

  static profile(tenantId: string): Record<string, unknown> {
    return {
      profileVersion: '2.0.0',
      tenantId,
      constitution: {
        source: 'inherits-global-tier-0-paragon',
        rule: 'Tenant policy may restrict local operations but can never relax a global constitutional invariant, Paragon decision, or Craig approval requirement.',
        governedSurfaces: ['actions', 'workflows', 'plugins', 'compute', 'memory', 'evolution'],
      },
      doctrine: { scope: 'tenant-local presentation and narrative constraints', boundary: 'Must remain consistent with global doctrine, safety, reality anchoring, and escalation policy.' },
      plugins: { isolation: 'tenant allowlists are evaluated beneath global Plugin Registry, OmniRouter, credential isolation, and Paragon policy', directNetworkAccess: false },
      workflows: { isolation: 'Every workflow and run carries tenantId; execution access asserts run ownership before any procedure.', externalEffects: 'OmniRouter and Paragon only' },
      memory: { isolation: 'Tenant-scoped durable memory routing with agent-local working context; cross-tenant reads and writes are rejected.', retention: 'Compression produces proposals and preserves source evidence until separately approved.' },
      compute: { isolation: 'Tenant posture and compute evidence are recorded separately; remote or cluster compute remains an adapter boundary.', selection: 'Read-only discovery is allowed; chargeable, remote, GPU, distributed, or cluster work is never automatic.' },
      safety: { isolation: 'Tenant safety evidence and constraints remain isolated, while global Paragon and Safe Mode continue to govern every tenant.', safeMode: 'Global operational halt with inspection-only exception.' },
      evolution: { isolation: 'Sandbox candidates, repairs, and change requests retain tenant provenance.', activation: 'No mutation, merge, deployment, capability activation, or rollback executes without Paragon review, Craig approval, and a registered adapter.' },
      runtime: { context: 'Tenant ID is required at protected route, run, memory, agent, workflow, integration-audit, and approval boundaries.', permissions: 'Tenant configuration cannot confer a capability absent from global policy.' },
      telemetry: { visibility: ['Paragon', 'Mission Control', 'authorized tenant context'], dimensions: ['load', 'errors', 'drift', 'safety', 'compute', 'memory', 'workflows', 'plugins', 'evolution', 'escalations'] },
      drift: { monitor: 'Tenant-local evidence is assessed against global constitutional and safety baselines.', response: 'Record evidence, halt unsafe work, and create only sandbox-bound repair proposals.' },
      recovery: { model: 'Preserve audit evidence and active state; recovery proposals are sandbox-only until separately governed activation.' },
      authority: 'Paragon Dissector Tier-0; no bypass or tenant override path exists.',
    };
  }

  static async ensure(store: RuntimeStore, tenantId: string, name = tenantId): Promise<Level6Record> {
    this.assertIdentifier(tenantId);
    const existing = (await store.listLevel6Records('tenant', tenantId))[0];
    if (existing?.payload.profileVersion === '2.0.0') return existing;
    const timestamp = now();
    const tenant: Level6Record = existing ? {
      ...existing,
      name: existing.name || name.slice(0, 120),
      payload: { ...this.profile(tenantId), ...existing.payload },
      updatedAt: timestamp,
    } : record('tenant', tenantId, name.slice(0, 120), 'active', this.profile(tenantId), tenantId);
    await store.upsertLevel6Record(tenant);
    return tenant;
  }

  static async list(store: RuntimeStore): Promise<Level6Record[]> {
    return store.listLevel6Records('tenant');
  }

  static assertRunAccess(run: RunRecord, tenantId: string): void {
    this.assertIdentifier(tenantId);
    if (run.tenantId !== tenantId) throw new Error('Tenant Isolation Guard denied cross-tenant run access.');
  }
}

const AGENT_PROFILES: Record<AgentRole, Record<string, unknown>> = {
  planner: {
    displayName: 'Planner Agent', responsibilities: ['goal decomposition', 'strategy formation', 'workflow generation', 'bounded multi-step planning'],
    wiring: ['Planning Organ', 'Cognition Engine', 'Workflow Engine', 'Task Engine', 'Paragon Dissector', 'Mission Control'],
    permissions: ['prepare:bounded-plan', 'inspect:tenant-memory', 'record:plan-evidence'],
  },
  'critic-safety': {
    displayName: 'Critic / Safety Agent', responsibilities: ['safety checks', 'drift checks', 'hallucination checks', 'constitutional and doctrinal checks'],
    wiring: ['Safety Layer', 'Cognition Engine', 'Memory Engine', 'Workflow Engine', 'Paragon Dissector', 'Mission Control'],
    permissions: ['inspect:plan', 'inspect:tenant-evidence', 'record:safety-evidence', 'escalate:exception'],
  },
  builder: {
    displayName: 'Builder Agent', responsibilities: ['sandbox module candidates', 'workflow candidates', 'plugin and evolution proposals'],
    wiring: ['Self-Modifying Engine', 'Sandbox Organ', 'Paragon Dissector', 'Mission Control'],
    permissions: ['prepare:sandbox-candidate', 'record:build-evidence', 'escalate:unsafe-build'],
  },
  repair: {
    displayName: 'Repair Agent', responsibilities: ['organ repair proposals', 'workflow repair proposals', 'runtime and compute repair evidence'],
    wiring: ['Organ Repair Engine', 'Runtime Repair Organ', 'Failure Detection Organ', 'Health Trigger Organ', 'Paragon Dissector', 'Mission Control'],
    permissions: ['prepare:sandbox-repair', 'record:failure-evidence', 'escalate:repair-proposal'],
  },
  reflection: {
    displayName: 'Reflection Agent', responsibilities: ['self-analysis', 'self-audit', 'workflow and safety evaluation', 'correction evidence'],
    wiring: ['Reflection Organ', 'Self-Audit Organ', 'Cognition Engine', 'Paragon Dissector', 'Mission Control'],
    permissions: ['inspect:tenant-run', 'record:reflection', 'escalate:drift-evidence'],
  },
  'meta-agent': {
    displayName: 'Meta-Agent', responsibilities: ['agent coordination', 'agent monitoring', 'agent correction evidence', 'escalation coordination'],
    wiring: ['Agent Registry', 'Agent Router', 'Agent Collaboration Organ', 'Agent Oversight Organ', 'Agent Arbitration Organ', 'Paragon Dissector', 'Mission Control'],
    permissions: ['inspect:agent-state', 'record:coordination', 'record:arbitration-evidence', 'escalate:agent-conflict'],
  },
};

export class MultiAgentControlPlane {
  static profile(role: AgentRole, tenantId: string): Record<string, unknown> {
    return {
      profileVersion: '2.0.0', tenantId, role, ...AGENT_PROFILES[role],
      authority: 'Paragon Dissector Tier-0',
      executionBoundary: 'Produces bounded evidence, plans, critiques, and sandbox candidate artifacts. An agent cannot directly invoke an external provider, issue web actions, change another tenant, activate a capability, merge, deploy, or override Paragon.',
      runtimeContext: { tenantIsolated: true, entrypoint: 'Agent Router → Organ Kernel → Paragon preflight', version: '2.0.0' },
      telemetry: { endpoint: `/metrics#agent_${role.replace(/-/g, '_')}`, fields: ['load', 'handoffs', 'errors', 'drift', 'safety findings', 'escalations', 'recovery proposals'], visibleTo: ['Paragon Dissector', 'authorized Mission Control tenant context'] },
      drift: { monitor: 'Agent output, action intent, tenant context, and governance evidence are checked against constitutional and safety baselines.', response: 'Record evidence, halt unsafe work, and escalate or create only sandbox-bound proposals.' },
      failure: { model: 'Agent failure retains handoff and action evidence; no agent silently retries protected work or changes active state.' },
      recovery: { model: 'Repair Agent may prepare a sandbox repair proposal; activation remains a separately governed Paragon and Craig decision.' },
      versioning: { registryVersion: '2.0.0', changeBoundary: 'Agent configuration changes are protected evolution and require sandbox validation, Paragon review, Craig approval, and approved change-control adapters.' },
    };
  }

  static async bootstrap(store: RuntimeStore, tenantId: string): Promise<Level6Record[]> {
    const existing = await store.listLevel6Records('agent', tenantId);
    const byName = new Map(existing.map((item) => [item.name, item]));
    const agents: Level6Record[] = [];
    for (const role of AGENT_ROLES) {
      const name = `${role}-agent`;
      const current = byName.get(name);
      if (current?.payload.profileVersion === '2.0.0') agents.push(current);
      else {
        const timestamp = now();
        const agent: Level6Record = current ? { ...current, payload: { ...this.profile(role, tenantId), ...current.payload }, updatedAt: timestamp } : {
          id: `agent:${tenantId}:${role}`, type: 'agent', tenantId, name, status: 'active', payload: this.profile(role, tenantId), createdAt: timestamp, updatedAt: timestamp,
        };
        await store.upsertLevel6Record(agent);
        agents.push(agent);
      }
    }
    return agents;
  }

  static async recordHandoff(store: RuntimeStore, tenantId: string, runId: string, role: AgentRole, status: string, evidence: Record<string, unknown>): Promise<Level6Record> {
    const execution = record('agent_execution', tenantId, `${role}-agent:${runId}`, status, { runId, role, evidence, authority: 'Paragon Dissector Tier-0', executionBoundary: 'Handoff records evidence only; no authority transfers between agents.' });
    await store.upsertLevel6Record(execution);
    return execution;
  }

  static async route(store: RuntimeStore, tenantId: string, runId: string, role: AgentRole, task: string, source = 'Agent Router'): Promise<Level6Record> {
    return this.recordHandoff(store, tenantId, runId, role, 'routed', { source, task: task.slice(0, 2_000), route: `${source} → ${role}-agent`, boundary: 'Routing assigns bounded analytical responsibility only. Paragon remains the final action authority.' });
  }

  static async collaborate(store: RuntimeStore, tenantId: string, runId: string, roles: AgentRole[], objective: string): Promise<Level6Record> {
    const uniqueRoles = [...new Set(roles)].filter((role) => AGENT_ROLES.includes(role));
    const collaboration = record('agent_execution', tenantId, `agent-collaboration:${runId}`, 'coordinated', {
      runId, roles: uniqueRoles, objective: objective.slice(0, 2_000), authority: 'Paragon Dissector Tier-0',
      safety: 'Collaboration shares scoped task evidence only; it does not merge memory, grant cross-tenant access, or grant execution authority.',
      wiring: ['Agent Collaboration Organ', 'Cognition Engine', 'Workflow Engine', 'Paragon Dissector'],
    });
    await store.upsertLevel6Record(collaboration);
    return collaboration;
  }

  static async oversight(store: RuntimeStore, tenantId: string, runId: string, roles: AgentRole[], findings: Record<string, unknown>): Promise<Level6Record> {
    const oversight = record('agent_execution', tenantId, `agent-oversight:${runId}`, 'observed', {
      runId, roles, findings, authority: 'Paragon Dissector Tier-0',
      checks: ['constitution', 'doctrine', 'safety', 'tenant isolation', 'drift baseline', 'execution boundary'],
      response: 'Evidence is recorded; violations are escalated to Paragon or converted to sandbox-only repair proposals.',
    });
    await store.upsertLevel6Record(oversight);
    return oversight;
  }

  static async arbitrate(store: RuntimeStore, tenantId: string, runId: string, positions: Array<{ role: AgentRole; statement: string }>): Promise<Level6Record> {
    const arbitration = record('agent_execution', tenantId, `agent-arbitration:${runId}`, 'paragon-governed', {
      runId, positions: positions.map((position) => ({ role: position.role, statement: position.statement.slice(0, 2_000) })),
      authority: 'Paragon Dissector Tier-0',
      outcome: 'Arbitration records competing evidence and may recommend escalation. It never overrides a Paragon policy decision or independently authorizes execution.',
      wiring: ['Agent Arbitration Organ', 'Agent Oversight Organ', 'Paragon Dissector'],
    });
    await store.upsertLevel6Record(arbitration);
    return arbitration;
  }

  static async posture(store: RuntimeStore, tenantId: string): Promise<Record<string, unknown>> {
    const agents = await this.bootstrap(store, tenantId);
    const evidence = await store.listLevel6Records('agent_execution', tenantId);
    const byStatus = evidence.reduce<Record<string, number>>((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {});
    return {
      profileVersion: '2.0.0', tenantId, authority: 'Paragon Dissector Tier-0',
      registry: { agentCount: agents.length, roles: agents.map((agent) => agent.payload.role), versioned: agents.every((agent) => agent.payload.profileVersion === '2.0.0') },
      telemetry: { evidenceCount: evidence.length, byStatus, endpoint: '/metrics#agent_*', visibility: ['Paragon Dissector', 'authorized Mission Control tenant context'] },
      router: { path: 'Agent Router → Organ Kernel → Paragon preflight', directExecution: false },
      collaboration: { status: 'durably-evidenced', boundary: 'Shared task evidence is tenant-scoped and grants no execution authority.' },
      oversight: { checks: ['constitution', 'doctrine', 'safety', 'tenant isolation', 'drift'], escalation: 'Paragon and Craig for protected exceptions' },
      arbitration: { status: 'evidence-only', boundary: 'No agent conflict record overrides a Paragon decision.' },
      recovery: { status: 'sandbox-proposal-only', boundary: 'Agent and runtime repairs cannot activate, merge, deploy, or change production state automatically.' },
    };
  }

  static async list(store: RuntimeStore, tenantId: string): Promise<Level6Record[]> {
    return store.listLevel6Records('agent', tenantId);
  }
}

export class PlanValidationOrgan {
  static assess(run: RunRecord): Record<string, unknown> {
    const duplicateKinds = run.plan.filter((action, index) => run.plan.findIndex((candidate) => candidate.kind === action.kind && candidate.title === action.title) !== index).map((action) => action.id);
    const protectedActions = run.plan.filter((action) => ['apply_capability', 'external_effect'].includes(action.kind)).map((action) => action.kind);
    return {
      organ: 'Plan Validator',
      runId: run.id,
      tenantId: run.tenantId,
      bounded: run.plan.length <= Number(process.env.MICROFIXD_MAX_PLAN_STEPS || 25),
      duplicateActionIds: duplicateKinds,
      protectedActions,
      outcome: duplicateKinds.length === 0 ? 'valid-bounded-plan' : 'requires-review',
      boundary: 'Validation evaluates plan structure only. Paragon remains the final action-by-action authority.',
    };
  }
}

export interface RepairTrust {
  tenantId: string;
  sampleSize: number;
  validatedCount: number;
  reviewRequiredCount: number;
  trustScore: number;
  recommendation: 'normal-scrutiny' | 'heightened-scrutiny' | 'insufficient-history';
}

export class RepairControlPlane {
  /**
   * Real self-learning for repairs, same pattern as
   * MetaLearningControlPlane.assessEvolutionTrust() in meta-learning.ts:
   * reads this tenant's actual repair_proposal history and computes a
   * real validated/reviewed ratio. Kept local to level6.ts (rather than
   * importing meta-learning.ts here) to avoid a circular import, since
   * meta-learning.ts already models this exact computation for
   * evolution_assessment records -- same math, different record type.
   */
  static async assessRepairTrust(store: RuntimeStore, tenantId: string): Promise<RepairTrust> {
    const history = await store.listLevel6Records('repair_proposal', tenantId);
    const sampleSize = history.length;
    if (sampleSize === 0) {
      return { tenantId, sampleSize: 0, validatedCount: 0, reviewRequiredCount: 0, trustScore: 0.5, recommendation: 'insufficient-history' };
    }
    const validatedCount = history.filter((r) => r.status === 'sandbox-validated').length;
    const reviewRequiredCount = sampleSize - validatedCount;
    const trustScore = validatedCount / sampleSize;
    return {
      tenantId, sampleSize, validatedCount, reviewRequiredCount, trustScore,
      recommendation: sampleSize < 3 ? 'insufficient-history' : trustScore < 0.6 ? 'heightened-scrutiny' : 'normal-scrutiny',
    };
  }

  static async propose(store: RuntimeStore, sandbox: Sandbox, run: RunRecord, reason: string): Promise<Level6Record> {
    const artifact = await sandbox.validateCapability(`Repair candidate for ${run.id.slice(0, 8)}`, `Tenant: ${run.tenantId}\nGoal: ${run.goal}\nFailure evidence: ${reason}\nCreate a confined repair proposal only. Do not activate production changes.`);

    // Real execution, not just static validation: validateCapability()
    // only pattern-checks the specification text -- it never confirms
    // the candidate actually runs. A candidate that passes static
    // checks can still throw immediately or produce nothing.
    // Genesis-learning-loop principle applied here: a "verified"
    // status must trace back to a real pass/fail signal, not a
    // self-report. If static validation already failed, there is
    // nothing safe to execute -- BLOCKED_CONTENT-flagged text was
    // never written as live code by renderCapability() in the first
    // place, so execute() would just fail to find real statements to
    // run. Skip execution in that case rather than reporting a
    // meaningless result.
    let execution: { attempted: boolean; exitCode: number | null; timedOut: boolean; stderr: string } | null = null;
    if (artifact.validation.passed) {
      try {
        const result = await sandbox.execute(artifact.relativePath, 8_000);
        execution = { attempted: true, exitCode: result.exitCode, timedOut: result.timedOut, stderr: result.stderr.slice(0, 2_000) };
      } catch (err) {
        execution = { attempted: true, exitCode: null, timedOut: false, stderr: err instanceof Error ? err.message : String(err) };
      }
    } else {
      execution = { attempted: false, exitCode: null, timedOut: false, stderr: 'Skipped: static validation already failed, nothing safe to execute.' };
    }
    const executionVerified = execution.attempted && execution.exitCode === 0 && !execution.timedOut;

    // Real behavior change from real history: a tenant whose past
    // repair proposals mostly needed review gets this one forced to
    // review too, regardless of this proposal's own artifact result.
    // A candidate that failed real execution is ALSO forced to review,
    // regardless of historical trust -- historical trust in past
    // repairs is not evidence this specific candidate runs.
    // Real system-wide signal, not just this tenant's history: if
    // repair proposals as a record type are failing broadly across all
    // tenants (MetaEvolver's real success/review ratio), that's a
    // genuine reason for extra scrutiny even for a tenant with a good
    // individual track record. Previously MetaEvolver's recommendation
    // was computed and displayed but never actually consumed by
    // anything -- an open loop. This closes it.
    const trust = await this.assessRepairTrust(store, run.tenantId);
    const systemWideSignal = (await MetaEvolver.recommend(store, run.tenantId)).find((r) => r.recordType === 'repair_proposal');
    const systemWideRetirementCandidate = systemWideSignal?.recommendation === 'retirement-candidate';
    const status = (trust.recommendation === 'heightened-scrutiny' || !executionVerified || systemWideRetirementCandidate) ? 'sandbox-review-required' : 'sandbox-validated';

    const proposal = record('repair_proposal', run.tenantId, `repair:${run.id}`, status, {
      runId: run.id,
      reason,
      artifact,
      execution,
      executionVerified,
      historicalTrust: trust,
      systemWideSignal,
      heightenedScrutinyApplied: trust.recommendation === 'heightened-scrutiny' || systemWideRetirementCandidate,
      activation: 'requires Paragon escalation and Craig approval',
      rollback: 'active state remains unchanged; only the candidate artifact and audit record are retained',
    });
    // Real signing for the highest-risk record type: an unauthorized or
    // tampered repair proposal is a direct self-modification vector, so
    // this is one of the two record types signed first. Throws only if
    // MICROFIXD_SIGNING_KEYS is misconfigured as something other than
    // JSON -- an unset key is treated as "signing not yet enabled" and
    // silently skipped rather than blocking real repair work before
    // Craig has provisioned a key.
    if (process.env.MICROFIXD_SIGNING_KEYS) {
      const envelope = sign({ id: proposal.id, type: proposal.type, tenantId: proposal.tenantId, status: proposal.status, runId: run.id });
      (proposal.payload as Record<string, unknown>).signature = envelope;
    }
    await store.upsertLevel6Record(proposal);
    return proposal;
  }
}

export class HealthRepairControlPlane {
  static async assess(store: RuntimeStore, sandbox: Sandbox, run: RunRecord, reason: string): Promise<Level6Record> {
    const proposal = await RepairControlPlane.propose(store, sandbox, run, reason);
    const healthProposal = { ...proposal, name: `health-repair:${run.id}`, payload: { ...proposal.payload, trigger: 'Health Trigger Organ', failureDetection: 'Runtime failure evidence observed' } };
    await store.upsertLevel6Record(healthProposal);
    return healthProposal;
  }
}

export class ComputeControlPlane {
  static scan(): Record<string, unknown> {
    const configuredGpu = (process.env.NVIDIA_VISIBLE_DEVICES || '').trim();
    const gpuVisible = configuredGpu !== '' && configuredGpu !== 'void' && configuredGpu !== 'none';
    const cpuLogicalCores = cpus().length;
    // Real host metrics -- genuinely measured, not simulated. loadavg() is
    // 1/5/15-minute averages (Unix-style; on Windows Node reports zeros,
    // which is reported as-is rather than faked).
    const load1m = loadavg()[0];
    const cpuLoadPercent = cpuLogicalCores > 0 ? Math.min(100, Math.round((load1m / cpuLogicalCores) * 100)) : null;
    const memoryUsedPercent = Math.round(((totalmem() - freemem()) / totalmem()) * 100);
    return {
      local: {
        cpuLogicalCores,
        memoryBytes: totalmem(),
        gpuVisible,
        gpuDescriptor: gpuVisible ? configuredGpu : 'none-detected',
        processArchitecture: process.arch,
        // Real, live host measurements for UI display. cpuLoadPercent is
        // null on platforms where loadavg() isn't meaningful (Windows)
        // rather than a fabricated number.
        cpuLoadPercent,
        memoryUsedPercent,
        uptimeSeconds: Math.floor(process.uptime()),
      },
      organs: {
        gpuOffload: { status: gpuVisible ? 'candidate-discovery-only' : 'not-detected', purpose: 'GPU acceleration for separately approved bounded workloads', boundary: 'No GPU workload launches through discovery.' },
        parallelCompute: { status: 'local-bounded-candidate', capacity: cpuLogicalCores, purpose: 'Bounded local CPU parallelization', boundary: 'Parallel execution cannot bypass plan validation, tenant scope, or Paragon action review.' },
        tensorEngine: { status: 'adapter-dormant', purpose: 'Tensor or model-math acceleration', boundary: 'No tensor provider, model, or remote runtime route is configured.' },
        accelerationRouter: { status: 'policy-only', selection: 'local read-only posture; no automatic remote, GPU, distributed, or cluster selection' },
        serverRuntime: { status: 'active-bounded-node-runtime', purpose: 'Containerized server-side orchestration and UI rendering', boundary: 'All external access remains OmniRouter-exclusive.' },
        distributedCompute: { status: 'adapter-dormant', purpose: 'Governed multi-node compute', boundary: 'Requires allowlisted adapter, OmniRouter, Paragon review, cost policy, and Craig approval.' },
        clusterOrchestrator: { status: 'adapter-dormant', purpose: 'Governed cluster scheduling', boundary: 'No cluster provisioning, scaling, node action, or workload dispatch is attempted.' },
      },
      routes: {
        localParallel: 'available for bounded CPU work after runtime action governance',
        gpuOffload: gpuVisible ? 'candidate; governed workload route still required' : 'not available on this runtime',
        remoteCompute: 'adapter-only via OmniRouter and Plugin Registry',
        cluster: 'adapter-only via OmniRouter and Plugin Registry',
      },
      telemetry: {
        observed: ['cpuLogicalCores', 'memoryBytes', 'gpuDescriptor', 'runtimeArchitecture', 'organStatuses'],
        deferredUntilAdapterExists: ['gpuLoad', 'gpuMemoryUsage', 'kernelErrors', 'distributedLoad', 'clusterLoad', 'providerCost', 'remoteJobErrors'],
        visibility: ['Paragon Dissector', 'authorized Mission Control tenant context'],
      },
      safety: {
        tenantIsolation: 'Posture records are tenant-scoped. No tenant can submit or inspect another tenant’s compute evidence through governed routes.',
        drift: 'Unrecognized device, runtime, routing, or resource changes create observations; they do not authorize execution.',
        recovery: 'Failure evidence can create a sandbox repair proposal. Restart, scaling, remote dispatch, and rollback remain protected.',
      },
      boundary: 'Discovery is read-only. Compute jobs, provider charges, data transfer, remote dispatch, scaling, and cluster changes are protected actions under Paragon and require an approved OmniRouter Plugin Registry route plus Craig approval.',
      capturedAt: now(),
    };
  }

  static async record(store: RuntimeStore, tenantId: string): Promise<Level6Record> {
    const timestamp = now();
    const profile: Level6Record = { id: `compute-profile:${tenantId}`, type: 'compute_profile', tenantId, name: 'runtime-compute-profile', status: 'observed', payload: this.scan(), createdAt: timestamp, updatedAt: timestamp };
    await store.upsertLevel6Record(profile);
    return profile;
  }
}

export class ChangeControlPlane {
  static async request(store: RuntimeStore, tenantId: string, run: RunRecord, summary: string, type: 'github' | 'deployment' = 'github'): Promise<Level6Record> {
    const request = record('change_request', tenantId, `${type}:${run.id}`, 'awaiting_paragon_and_craig', {
      runId: run.id,
      summary: summary.slice(0, 2_000),
      pipeline: ['sandbox candidate', 'tests', 'Paragon review', 'Craig approval', 'GitHub PR adapter', 'CI/CD adapter', 'separate deployment approval', 'rollback boundary'],
      boundary: 'No PR, merge, deploy, or rollback action is attempted by this record.',
    });
    await store.upsertLevel6Record(request);
    return request;
  }
}

export class SafeModeControlPlane {
  static async get(store: RuntimeStore): Promise<Level6Record | undefined> {
    return (await store.listLevel6Records('safe_mode', GLOBAL_TENANT_ID))[0];
  }

  static async set(store: RuntimeStore, enabled: boolean, actor: string, reason: string): Promise<Level6Record> {
    const current = await this.get(store);
    const timestamp = now();
    const safeMode: Level6Record = {
      id: current?.id || 'global-safe-mode',
      type: 'safe_mode',
      tenantId: GLOBAL_TENANT_ID,
      name: 'global-safe-mode',
      status: enabled ? 'enabled' : 'disabled',
      payload: { enabled, actor: actor.slice(0, 120), reason: reason.slice(0, 2_000), authority: 'Paragon Dissector Tier-0' },
      createdAt: current?.createdAt || timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(safeMode);
    return safeMode;
  }

  static async assertOperational(store: RuntimeStore, action: string): Promise<void> {
    const current = await this.get(store);
    if (current?.status === 'enabled' && action !== 'introspect') throw new Error('Safe Mode Control Organ halted the requested operation. Only inspection remains available until Craig disables safe mode.');
  }
}
