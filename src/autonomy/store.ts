import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Pool } from 'pg';
import type {
  ApprovalRequest,
  ApprovalStatus,
  IntegrationAuditRecord,
  Level6Record,
  Level6RecordType,
  MemoryRecord,
  OrganInvocationRecord,
  OrganRegistryRecord,
  PhenotypeRecord,
  SystemEventRecord,
  PolicyDecision,
  RunRecord,
  RuntimeStore,
  StepRecord,
  UsageEvent,
} from './types.ts';

type JsonState = {
  runs: RunRecord[];
  steps: StepRecord[];
  memory: MemoryRecord[];
  decisions: PolicyDecision[];
  approvals: ApprovalRequest[];
  integrationAudits: IntegrationAuditRecord[];
  organRegistry: OrganRegistryRecord[];
  organInvocations: OrganInvocationRecord[];
  phenotypes: PhenotypeRecord[];
  systemEvents: SystemEventRecord[];
  level6Records: Level6Record[];
  usageEvents: UsageEvent[];
};

const emptyState = (): JsonState => ({ runs: [], steps: [], memory: [], decisions: [], approvals: [], integrationAudits: [], organRegistry: [], organInvocations: [], phenotypes: [], systemEvents: [], level6Records: [], usageEvents: [] });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class JsonRuntimeStore implements RuntimeStore {
  private state: JsonState = emptyState();
  private initialized = false;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      this.state = { ...emptyState(), ...(JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<JsonState>) };
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await this.persist();
    }
    this.initialized = true;
  }

  async health(): Promise<{ durable: boolean; storage: 'postgres' | 'json' }> {
    return { durable: false, storage: 'json' };
  }

  async createRun(run: RunRecord): Promise<void> {
    this.state.runs.push(clone(run));
    await this.persist();
  }

  async getRun(id: string): Promise<RunRecord | undefined> {
    const run = this.state.runs.find((candidate) => candidate.id === id);
    return run ? clone(run) : undefined;
  }

  async listRuns(tenantId: string, limit: number): Promise<RunRecord[]> {
    return this.state.runs.filter((run) => run.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(clone);
  }

  async updateRun(id: string, patch: Partial<RunRecord>): Promise<RunRecord | undefined> {
    const index = this.state.runs.findIndex((candidate) => candidate.id === id);
    if (index < 0) return undefined;
    this.state.runs[index] = { ...this.state.runs[index], ...clone(patch), updatedAt: new Date().toISOString() };
    await this.persist();
    return clone(this.state.runs[index]);
  }

  async createStep(step: StepRecord): Promise<void> {
    this.state.steps.push(clone(step));
    await this.persist();
  }

  async updateStep(id: string, patch: Partial<StepRecord>): Promise<StepRecord | undefined> {
    const index = this.state.steps.findIndex((candidate) => candidate.id === id);
    if (index < 0) return undefined;
    this.state.steps[index] = { ...this.state.steps[index], ...clone(patch) };
    await this.persist();
    return clone(this.state.steps[index]);
  }

  async listSteps(runId: string): Promise<StepRecord[]> {
    return this.state.steps.filter((step) => step.runId === runId).sort((a, b) => a.sequence - b.sequence).map(clone);
  }

  async appendMemory(memory: MemoryRecord): Promise<void> {
    this.state.memory.push(clone(memory));
    await this.persist();
  }

  async recallMemory(agentId: string, query: string, limit: number, tenantId: string): Promise<MemoryRecord[]> {
    const normalized = query.toLowerCase().split(/\s+/).filter((token) => token.length >= 3);
    return this.state.memory
      .filter((memory) => memory.agentId === agentId && memory.tenantId === tenantId)
      .map((memory) => ({ memory, relevance: normalized.reduce((score, token) => score + Number(`${memory.content} ${memory.tags.join(' ')}`.toLowerCase().includes(token)), 0) }))
      .filter(({ relevance }) => relevance > 0 || normalized.length === 0)
      .sort((a, b) => b.relevance - a.relevance || b.memory.importance - a.memory.importance)
      .slice(0, limit)
      .map(({ memory }) => clone(memory));
  }

  async listAllMemory(tenantId: string, limit: number): Promise<MemoryRecord[]> {
    return this.state.memory
      .filter((memory) => memory.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map(clone);
  }

  async savePolicyDecision(decision: PolicyDecision): Promise<void> {
    this.state.decisions.push(clone(decision));
    await this.persist();
  }

  async createApproval(approval: ApprovalRequest): Promise<void> {
    this.state.approvals.push(clone(approval));
    await this.persist();
  }

  async getApproval(id: string): Promise<ApprovalRequest | undefined> {
    const approval = this.state.approvals.find((candidate) => candidate.id === id);
    return approval ? clone(approval) : undefined;
  }

  async updateApproval(id: string, patch: Partial<ApprovalRequest>): Promise<ApprovalRequest | undefined> {
    const index = this.state.approvals.findIndex((candidate) => candidate.id === id);
    if (index < 0) return undefined;
    this.state.approvals[index] = { ...this.state.approvals[index], ...clone(patch) };
    await this.persist();
    return clone(this.state.approvals[index]);
  }

  async listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    return this.state.approvals.filter((approval) => !status || approval.status === status).map(clone);
  }

  async appendIntegrationAudit(audit: IntegrationAuditRecord): Promise<void> {
    this.state.integrationAudits.push(clone(audit));
    if (this.state.integrationAudits.length > 10_000) this.state.integrationAudits.shift();
    await this.persist();
  }

  async listIntegrationAudits(runId: string, limit: number): Promise<IntegrationAuditRecord[]> {
    return this.state.integrationAudits.filter((audit) => audit.runId === runId).slice(-limit).reverse().map(clone);
  }

  async registerOrgans(organs: OrganRegistryRecord[]): Promise<void> {
    this.state.organRegistry = organs.map(clone);
    await this.persist();
  }

  async appendOrganInvocation(invocation: OrganInvocationRecord): Promise<void> {
    this.state.organInvocations.push(clone(invocation));
    await this.persist();
  }

  async appendPhenotype(snapshot: PhenotypeRecord): Promise<void> {
    this.state.phenotypes.push(clone(snapshot));
    if (this.state.phenotypes.length > 2_000) this.state.phenotypes.shift();
    await this.persist();
  }

  async appendSystemEvent(event: SystemEventRecord): Promise<void> {
    this.state.systemEvents.push(clone(event));
    if (this.state.systemEvents.length > 10_000) this.state.systemEvents.shift();
    await this.persist();
  }

  async upsertLevel6Record(record: Level6Record): Promise<void> {
    const index = this.state.level6Records.findIndex((candidate) => candidate.id === record.id);
    if (index >= 0) this.state.level6Records[index] = clone(record);
    else this.state.level6Records.push(clone(record));
    await this.persist();
  }

  async listLevel6Records(type: Level6RecordType, tenantId?: string): Promise<Level6Record[]> {
    return this.state.level6Records.filter((record) => record.type === type && (!tenantId || record.tenantId === tenantId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone);
  }

  async appendUsageEvent(event: UsageEvent): Promise<void> {
    this.state.usageEvents.push(clone(event));
    if (this.state.usageEvents.length > 20_000) this.state.usageEvents.shift();
    await this.persist();
  }

  async listUsageEvents(tenantId: string, limit: number): Promise<UsageEvent[]> {
    return this.state.usageEvents.filter((event) => event.tenantId === tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(clone);
  }

  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.state, null, 2);
    const write = async (): Promise<void> => {
      const tempPath = `${this.filePath}.tmp`;
      await writeFile(tempPath, snapshot, { mode: 0o600 });
      await rename(tempPath, this.filePath);
    };
    this.persistQueue = this.persistQueue.then(write, write);
    return this.persistQueue;
  }
}

export class PostgresRuntimeStore implements RuntimeStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX || 5),
    });
  }

  async initialize(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS microfixd_runtime_runs (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'global', agent_id TEXT NOT NULL, goal TEXT NOT NULL, requested_by TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL, plan JSONB NOT NULL DEFAULT '[]'::jsonb,
        current_step INTEGER NOT NULL DEFAULT 0, working_memory JSONB NOT NULL DEFAULT '{}'::jsonb,
        outcome TEXT, error TEXT, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL,
        started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS microfixd_runtime_steps (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES microfixd_runtime_runs(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL, action JSONB NOT NULL, status TEXT NOT NULL, policy JSONB,
        result JSONB, error TEXT, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS microfixd_memory_records (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'global', agent_id TEXT NOT NULL, run_id TEXT, kind TEXT NOT NULL, content TEXT NOT NULL,
        tags JSONB NOT NULL DEFAULT '[]'::jsonb, importance DOUBLE PRECISION NOT NULL, score DOUBLE PRECISION,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS microfixd_memory_records_agent_created ON microfixd_memory_records (tenant_id, agent_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS microfixd_governance_decisions (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL, step_id TEXT NOT NULL, action_kind TEXT NOT NULL,
        risk TEXT NOT NULL, outcome TEXT NOT NULL, reasons JSONB NOT NULL, evidence JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS microfixd_approval_requests (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL, step_id TEXT NOT NULL, action JSONB NOT NULL,
        reason TEXT NOT NULL, status TEXT NOT NULL, requested_at TIMESTAMPTZ NOT NULL,
        decided_at TIMESTAMPTZ, decided_by TEXT, decision_note TEXT, approved_by JSONB NOT NULL DEFAULT '[]'::jsonb
      );
      CREATE TABLE IF NOT EXISTS microfixd_integration_audits (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL, step_id TEXT NOT NULL, plugin_id TEXT NOT NULL,
        operation TEXT NOT NULL, route_id TEXT, outcome TEXT NOT NULL, estimated_cost_usd DOUBLE PRECISION NOT NULL,
        actual_cost_usd DOUBLE PRECISION, attempt INTEGER NOT NULL, response_status INTEGER,
        details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS microfixd_integration_audits_run_created ON microfixd_integration_audits (run_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS microfixd_level6_records (
        id TEXT PRIMARY KEY, record_type TEXT NOT NULL, tenant_id TEXT NOT NULL, name TEXT NOT NULL,
        status TEXT NOT NULL, payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS microfixd_level6_records_type_tenant_idx ON microfixd_level6_records (record_type, tenant_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS microfixd_usage_events (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'global', kind TEXT NOT NULL, name TEXT NOT NULL,
        run_id TEXT, actor_id TEXT, data_refs JSONB NOT NULL DEFAULT '[]'::jsonb, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS microfixd_usage_events_tenant_created ON microfixd_usage_events (tenant_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS microfixd_phenotype_snapshots (
        id TEXT PRIMARY KEY, run_id TEXT, snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS microfixd_system_events (
        id TEXT PRIMARY KEY, event_name TEXT NOT NULL, organ_id TEXT, run_id TEXT, severity TEXT NOT NULL,
        fields JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS microfixd_system_events_created ON microfixd_system_events (created_at DESC);
      CREATE TABLE IF NOT EXISTS microfixd_organ_registry (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, family TEXT NOT NULL, family_number INTEGER NOT NULL, layer INTEGER NOT NULL,
        version TEXT NOT NULL, tier TEXT NOT NULL, mode TEXT NOT NULL, guided_path TEXT NOT NULL, final_authority TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS microfixd_organ_invocations (
        id TEXT PRIMARY KEY, run_id TEXT, organ_id TEXT NOT NULL, operation TEXT NOT NULL, outcome TEXT NOT NULL,
        decision_id TEXT NOT NULL, procedure JSONB NOT NULL DEFAULT '{}'::jsonb, requested_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS microfixd_organ_invocations_organ_created ON microfixd_organ_invocations (organ_id, created_at DESC);
    `);
  }

  async health(): Promise<{ durable: boolean; storage: 'postgres' | 'json' }> {
    await this.pool.query('SELECT 1');
    return { durable: true, storage: 'postgres' };
  }

  async createRun(run: RunRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO microfixd_runtime_runs (id, tenant_id, agent_id, goal, requested_by, metadata, status, plan, current_step, working_memory, outcome, error, created_at, updated_at, started_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [run.id, run.tenantId, run.agentId, run.goal, run.requestedBy, run.metadata, run.status, run.plan, run.currentStep, run.workingMemory, run.outcome ?? null, run.error ?? null, run.createdAt, run.updatedAt, run.startedAt ?? null, run.completedAt ?? null],
    );
  }

  async getRun(id: string): Promise<RunRecord | undefined> {
    const result = await this.pool.query('SELECT * FROM microfixd_runtime_runs WHERE id = $1', [id]);
    return result.rowCount ? rowToRun(result.rows[0]) : undefined;
  }

  async listRuns(tenantId: string, limit: number): Promise<RunRecord[]> {
    const result = await this.pool.query('SELECT * FROM microfixd_runtime_runs WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2', [tenantId, limit]);
    return result.rows.map(rowToRun);
  }

  async updateRun(id: string, patch: Partial<RunRecord>): Promise<RunRecord | undefined> {
    const current = await this.getRun(id);
    if (!current) return undefined;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await this.pool.query(
      `UPDATE microfixd_runtime_runs SET tenant_id=$2, agent_id=$3, goal=$4, requested_by=$5, metadata=$6, status=$7, plan=$8, current_step=$9, working_memory=$10, outcome=$11, error=$12, updated_at=$13, started_at=$14, completed_at=$15 WHERE id=$1`,
      [id, next.tenantId, next.agentId, next.goal, next.requestedBy, next.metadata, next.status, next.plan, next.currentStep, next.workingMemory, next.outcome ?? null, next.error ?? null, next.updatedAt, next.startedAt ?? null, next.completedAt ?? null],
    );
    return next;
  }

  async createStep(step: StepRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO microfixd_runtime_steps (id, run_id, sequence, action, status, policy, result, error, started_at, completed_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [step.id, step.runId, step.sequence, step.action, step.status, step.policy ?? null, step.result ?? null, step.error ?? null, step.startedAt ?? null, step.completedAt ?? null, step.createdAt],
    );
  }

  async updateStep(id: string, patch: Partial<StepRecord>): Promise<StepRecord | undefined> {
    const result = await this.pool.query('SELECT * FROM microfixd_runtime_steps WHERE id = $1', [id]);
    if (!result.rowCount) return undefined;
    const current = rowToStep(result.rows[0]);
    const next = { ...current, ...patch };
    await this.pool.query(
      `UPDATE microfixd_runtime_steps SET run_id=$2, sequence=$3, action=$4, status=$5, policy=$6, result=$7, error=$8, started_at=$9, completed_at=$10 WHERE id=$1`,
      [id, next.runId, next.sequence, next.action, next.status, next.policy ?? null, next.result ?? null, next.error ?? null, next.startedAt ?? null, next.completedAt ?? null],
    );
    return next;
  }

  async listSteps(runId: string): Promise<StepRecord[]> {
    const result = await this.pool.query('SELECT * FROM microfixd_runtime_steps WHERE run_id=$1 ORDER BY sequence ASC', [runId]);
    return result.rows.map(rowToStep);
  }

  async appendMemory(memory: MemoryRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO microfixd_memory_records (id, tenant_id, agent_id, run_id, kind, content, tags, importance, score, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [memory.id, memory.tenantId, memory.agentId, memory.runId ?? null, memory.kind, memory.content, memory.tags, memory.importance, memory.score ?? null, memory.metadata, memory.createdAt],
    );
  }

  async recallMemory(agentId: string, query: string, limit: number, tenantId: string): Promise<MemoryRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM microfixd_memory_records WHERE tenant_id=$1 AND agent_id=$2 AND ($3='' OR content ILIKE '%' || $3 || '%') ORDER BY importance DESC, created_at DESC LIMIT $4`,
      [tenantId, agentId, query.slice(0, 500), limit],
    );
    return result.rows.map(rowToMemory);
  }

  async listAllMemory(tenantId: string, limit: number): Promise<MemoryRecord[]> {
    const result = await this.pool.query(
      `SELECT * FROM microfixd_memory_records WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows.map(rowToMemory);
  }

  async savePolicyDecision(decision: PolicyDecision): Promise<void> {
    await this.pool.query(
      `INSERT INTO microfixd_governance_decisions (id, run_id, step_id, action_kind, risk, outcome, reasons, evidence, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [decision.id, decision.runId, decision.stepId, decision.actionKind, decision.risk, decision.outcome, decision.reasons, decision.evidence, decision.createdAt],
    );
  }

  async createApproval(approval: ApprovalRequest): Promise<void> {
    await this.pool.query(
      `INSERT INTO microfixd_approval_requests (id, run_id, step_id, action, reason, status, requested_at, decided_at, decided_by, decision_note, approved_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [approval.id, approval.runId, approval.stepId, approval.action, approval.reason, approval.status, approval.requestedAt, approval.decidedAt ?? null, approval.decidedBy ?? null, approval.decisionNote ?? null, approval.approvedBy ?? []],
    );
  }

  async getApproval(id: string): Promise<ApprovalRequest | undefined> {
    const result = await this.pool.query('SELECT * FROM microfixd_approval_requests WHERE id=$1', [id]);
    return result.rowCount ? rowToApproval(result.rows[0]) : undefined;
  }

  async updateApproval(id: string, patch: Partial<ApprovalRequest>): Promise<ApprovalRequest | undefined> {
    const current = await this.getApproval(id);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    await this.pool.query(
      `UPDATE microfixd_approval_requests SET run_id=$2, step_id=$3, action=$4, reason=$5, status=$6, requested_at=$7, decided_at=$8, decided_by=$9, decision_note=$10, approved_by=$11 WHERE id=$1`,
      [id, next.runId, next.stepId, next.action, next.reason, next.status, next.requestedAt, next.decidedAt ?? null, next.decidedBy ?? null, next.decisionNote ?? null, next.approvedBy ?? []],
    );
    return next;
  }

  async listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]> {
    const result = status
      ? await this.pool.query('SELECT * FROM microfixd_approval_requests WHERE status=$1 ORDER BY requested_at ASC', [status])
      : await this.pool.query('SELECT * FROM microfixd_approval_requests ORDER BY requested_at ASC');
    return result.rows.map(rowToApproval);
  }

  async appendIntegrationAudit(audit: IntegrationAuditRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO microfixd_integration_audits (id, run_id, step_id, plugin_id, operation, route_id, outcome, estimated_cost_usd, actual_cost_usd, attempt, response_status, details, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [audit.id, audit.runId, audit.stepId, audit.pluginId, audit.operation, audit.routeId ?? null, audit.outcome, audit.estimatedCostUsd, audit.actualCostUsd ?? null, audit.attempt, audit.responseStatus ?? null, audit.details, audit.createdAt],
    );
  }

  async listIntegrationAudits(runId: string, limit: number): Promise<IntegrationAuditRecord[]> {
    const result = await this.pool.query('SELECT * FROM microfixd_integration_audits WHERE run_id=$1 ORDER BY created_at DESC LIMIT $2', [runId, limit]);
    return result.rows.map(rowToIntegrationAudit);
  }

  async registerOrgans(organs: OrganRegistryRecord[]): Promise<void> {
    for (const organ of organs) {
      await this.pool.query(
        `INSERT INTO public.microfixd_organ_registry (id, name, family, family_number, layer, version, tier, mode, guided_path, final_authority, metadata, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, family=EXCLUDED.family, family_number=EXCLUDED.family_number, layer=EXCLUDED.layer, version=EXCLUDED.version, tier=EXCLUDED.tier, mode=EXCLUDED.mode, guided_path=EXCLUDED.guided_path, final_authority=EXCLUDED.final_authority, metadata=EXCLUDED.metadata, updated_at=now()`,
        [organ.id, organ.name, organ.family, organ.familyNumber, organ.layer, organ.version, organ.tier, organ.mode, organ.guidedPath, organ.finalAuthority, organ.metadata],
      );
    }
  }

  async appendOrganInvocation(invocation: OrganInvocationRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.microfixd_organ_invocations (id, run_id, organ_id, operation, outcome, decision_id, procedure, requested_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [invocation.id, invocation.runId ?? null, invocation.organId, invocation.operation, invocation.outcome, invocation.decisionId, invocation.procedure, invocation.requestedBy, invocation.createdAt],
    );
  }

  async appendPhenotype(snapshot: PhenotypeRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.microfixd_phenotype_snapshots (id, run_id, snapshot, created_at) VALUES ($1,$2,$3,$4)`,
      [snapshot.id, snapshot.runId ?? null, snapshot.snapshot, snapshot.createdAt],
    );
  }

  async appendSystemEvent(event: SystemEventRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.microfixd_system_events (id, event_name, organ_id, run_id, severity, fields, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [event.id, event.eventName, event.organId ?? null, event.runId ?? null, event.severity, event.fields, event.createdAt],
    );
  }

  async upsertLevel6Record(record: Level6Record): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.microfixd_level6_records (id, record_type, tenant_id, name, status, payload, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET tenant_id=EXCLUDED.tenant_id, name=EXCLUDED.name, status=EXCLUDED.status, payload=EXCLUDED.payload, updated_at=EXCLUDED.updated_at`,
      [record.id, record.type, record.tenantId, record.name, record.status, record.payload, record.createdAt, record.updatedAt],
    );
  }

  async listLevel6Records(type: Level6RecordType, tenantId?: string): Promise<Level6Record[]> {
    const result = tenantId
      ? await this.pool.query('SELECT * FROM public.microfixd_level6_records WHERE record_type=$1 AND tenant_id=$2 ORDER BY updated_at DESC', [type, tenantId])
      : await this.pool.query('SELECT * FROM public.microfixd_level6_records WHERE record_type=$1 ORDER BY updated_at DESC', [type]);
    return result.rows.map((row) => ({ id: row.id, type: row.record_type, tenantId: row.tenant_id, name: row.name, status: row.status, payload: row.payload || {}, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }));
  }

  async appendUsageEvent(event: UsageEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO public.microfixd_usage_events (id, tenant_id, kind, name, run_id, actor_id, data_refs, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [event.id, event.tenantId, event.kind, event.name, event.runId ?? null, event.actorId ?? null, event.dataRefs, event.metadata, event.createdAt],
    );
  }

  async listUsageEvents(tenantId: string, limit: number): Promise<UsageEvent[]> {
    const result = await this.pool.query('SELECT * FROM public.microfixd_usage_events WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2', [tenantId, limit]);
    return result.rows.map((row) => ({ id: row.id, tenantId: row.tenant_id, kind: row.kind, name: row.name, runId: row.run_id ?? undefined, actorId: row.actor_id ?? undefined, dataRefs: row.data_refs || [], metadata: row.metadata || {}, createdAt: row.created_at.toISOString() }));
  }
}

const rowToRun = (row: Record<string, any>): RunRecord => ({
  id: row.id, tenantId: row.tenant_id || row.metadata?.tenantId || 'global', agentId: row.agent_id, goal: row.goal, requestedBy: row.requested_by, metadata: row.metadata || {}, status: row.status,
  plan: row.plan || [], currentStep: row.current_step, workingMemory: row.working_memory || {}, outcome: row.outcome ?? undefined,
  error: row.error ?? undefined, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  startedAt: row.started_at?.toISOString(), completedAt: row.completed_at?.toISOString(),
});
const rowToStep = (row: Record<string, any>): StepRecord => ({
  id: row.id, runId: row.run_id, sequence: row.sequence, action: row.action, status: row.status, policy: row.policy ?? undefined,
  result: row.result ?? undefined, error: row.error ?? undefined, startedAt: row.started_at?.toISOString(), completedAt: row.completed_at?.toISOString(), createdAt: row.created_at.toISOString(),
});
const rowToMemory = (row: Record<string, any>): MemoryRecord => ({
  id: row.id, tenantId: row.tenant_id || row.metadata?.tenantId || 'global', agentId: row.agent_id, runId: row.run_id ?? undefined, kind: row.kind, content: row.content, tags: row.tags || [],
  importance: row.importance, score: row.score ?? undefined, metadata: row.metadata || {}, createdAt: row.created_at.toISOString(),
});
const rowToApproval = (row: Record<string, any>): ApprovalRequest => ({
  id: row.id, runId: row.run_id, stepId: row.step_id, action: row.action, reason: row.reason, status: row.status,
  requestedAt: row.requested_at.toISOString(), decidedAt: row.decided_at?.toISOString(), decidedBy: row.decided_by ?? undefined, decisionNote: row.decision_note ?? undefined,
  approvedBy: row.approved_by || [],
});
const rowToIntegrationAudit = (row: Record<string, any>): IntegrationAuditRecord => ({
  id: row.id, runId: row.run_id, stepId: row.step_id, pluginId: row.plugin_id, operation: row.operation, routeId: row.route_id ?? undefined,
  outcome: row.outcome, estimatedCostUsd: row.estimated_cost_usd, actualCostUsd: row.actual_cost_usd ?? undefined, attempt: row.attempt,
  responseStatus: row.response_status ?? undefined, details: row.details || {}, createdAt: row.created_at.toISOString(),
});

export const createRuntimeStore = (): RuntimeStore => {
  const databaseUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (databaseUrl) {
    // eslint-disable-next-line no-console
    console.log(`[microfixd] Durable store: PostgresRuntimeStore (Supabase). Connection source: ${process.env.SUPABASE_DB_URL ? 'SUPABASE_DB_URL' : 'DATABASE_URL'}.`);
    return new PostgresRuntimeStore(databaseUrl);
  }
  // Real enforcement of "one system, one mind, one db": a silent
  // fallback to a local JSON file is exactly the split-brain risk that
  // was flagged and explicitly rejected. This now REFUSES to start in
  // that ambiguous state unless local fallback is explicitly requested
  // -- so "which store is actually being used" is never a silent
  // question again.
  if (process.env.MICROFIXD_ALLOW_LOCAL_FALLBACK === 'true') {
    // eslint-disable-next-line no-console
    console.warn('[microfixd] WARNING: No SUPABASE_DB_URL/DATABASE_URL configured. Running on local JsonRuntimeStore because MICROFIXD_ALLOW_LOCAL_FALLBACK=true was explicitly set. This is NOT your Supabase database -- nothing recorded here reaches Supabase.');
    return new JsonRuntimeStore(process.env.MICROFIXD_STATE_FILE || './data/microfixd-state.json');
  }
  throw new Error(
    'No durable database is configured (SUPABASE_DB_URL or DATABASE_URL). Refusing to silently fall back to a local JSON file, per the one-system/one-database requirement -- that silent fallback was the actual root cause of the earlier "why is my system not persisting to Supabase" confusion. '
    + 'Set SUPABASE_DB_URL to your real Supabase Session Pooler connection string (see .env.example), or set MICROFIXD_ALLOW_LOCAL_FALLBACK=true if you genuinely want local-only mode for now.'
  );
};
