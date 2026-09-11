export type GoalStatus = 'queued' | 'planning' | 'running' | 'awaiting_approval' | 'succeeded' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'succeeded' | 'blocked' | 'denied' | 'failed';
export type PolicyOutcome = 'allow' | 'require_approval' | 'deny';
export type RiskTier = 'low' | 'medium' | 'high' | 'critical';
export type MemoryKind = 'episodic' | 'semantic' | 'procedural' | 'experience';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface GoalInput {
  goal: string;
  agentId?: string;
  tenantId?: string;
  requestedBy?: string;
  metadata?: Record<string, unknown>;
}

export interface PlannedAction {
  id: string;
  kind: 'introspect' | 'recall_memory' | 'design_workflow' | 'sandbox_validate' | 'propose_capability' | 'apply_capability' | 'external_effect';
  title: string;
  input: Record<string, unknown>;
  risk: RiskTier;
}

export interface RunRecord {
  id: string;
  tenantId: string;
  agentId: string;
  goal: string;
  requestedBy: string;
  metadata: Record<string, unknown>;
  status: GoalStatus;
  plan: PlannedAction[];
  currentStep: number;
  workingMemory: Record<string, unknown>;
  outcome?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface StepRecord {
  id: string;
  runId: string;
  sequence: number;
  action: PlannedAction;
  status: StepStatus;
  policy?: PolicyDecision;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface MemoryRecord {
  id: string;
  tenantId: string;
  agentId: string;
  runId?: string;
  kind: MemoryKind;
  content: string;
  tags: string[];
  importance: number;
  score?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PolicyDecision {
  id: string;
  runId: string;
  stepId: string;
  actionKind: PlannedAction['kind'];
  risk: RiskTier;
  outcome: PolicyOutcome;
  reasons: string[];
  evidence: Record<string, unknown>;
  createdAt: string;
  /** Provenance: which version of the Paragon rule set produced this decision. */
  paragonVersion: string;
  /**
   * For each rule that actually fired: what the outcome would have been
   * without it. Real sensitivity analysis computed from the same rule
   * evaluation used for the actual decision -- not a separate, divergent
   * explanation path. Empty for a clean 'allow' with nothing to explain.
   */
  counterfactuals: Array<{ ruleId: string; reason: string; resultingOutcome: PolicyOutcome; wouldChangeDecision: boolean }>;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  stepId: string;
  action: PlannedAction;
  reason: string;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionNote?: string;
  /**
   * Distinct approver identities who have said yes so far. When the
   * approver pool (config/approver-pool.json) is configured, status only
   * becomes 'approved' once this has 2 distinct pool members in it --
   * see decideApproval() in runtime.ts. Empty when the pool isn't
   * configured yet, in which case a single decideApproval(true) call
   * still finalizes immediately, exactly as before this field existed.
   */
  approvedBy: string[];
}

export interface IntegrationAuditRecord {
  id: string;
  runId: string;
  stepId: string;
  pluginId: string;
  operation: string;
  routeId?: string;
  outcome: 'cache_hit' | 'sent' | 'fallback' | 'blocked' | 'awaiting_approval' | 'failed';
  estimatedCostUsd: number;
  actualCostUsd?: number;
  attempt: number;
  responseStatus?: number;
  details: Record<string, unknown>;
  createdAt: string;
}

/**
 * UsageEvent: a durable, queryable, cross-restart record of what
 * happened, by whom, and what data it touched. This is what closes the
 * "in-memory only" limitation on /api/autonomy/usage-report -- that
 * route still works off Telemetry's 500-event ring buffer, but every
 * event it logs now ALSO gets written here so history survives a
 * restart and can be queried per tenant.
 *
 * `dataRefs` is the lineage piece: opaque identifiers for whatever data
 * this event touched (a run id, an uploaded file id, an organ id, a
 * plugin id) so a later question like "what touched upload X" or "what
 * did organ Y do" can be answered by scanning this table, without
 * needing a separate graph database. It stays a flat, queryable log
 * rather than a graph -- accurate for what it is, not oversold as full
 * relational lineage.
 */
export interface UsageEvent {
  id: string;
  tenantId: string;
  kind: 'http_request' | 'chat' | 'organ_invocation' | 'policy_decision' | 'upload' | 'voice' | 'approval_consumed' | 'sandbox_execution' | 'browser_automation' | 'other';
  name: string;
  runId?: string;
  actorId?: string;
  dataRefs: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface OrganRegistryRecord {
  id: string;
  name: string;
  family: string;
  familyNumber: number;
  layer: number;
  version: string;
  tier: 'tier-0' | 'tier-1' | 'tier-2';
  mode: 'native' | 'composed' | 'adapter';
  guidedPath: string;
  finalAuthority: 'Paragon Dissector';
  metadata: Record<string, unknown>;
}

export interface OrganInvocationRecord {
  id: string;
  runId?: string;
  organId: string;
  operation: 'status' | 'describe' | 'prepare';
  outcome: 'allowed' | 'awaiting_approval' | 'denied';
  decisionId: string;
  procedure: Record<string, unknown>;
  requestedBy: string;
  createdAt: string;
}

export interface PhenotypeRecord {
  id: string;
  runId?: string;
  snapshot: Record<string, unknown>;
  createdAt: string;
}

export interface SystemEventRecord {
  id: string;
  eventName: string;
  organId?: string;
  runId?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  fields: Record<string, unknown>;
  createdAt: string;
}

export type Level6RecordType = 'tenant' | 'agent' | 'agent_execution' | 'repair_proposal' | 'compute_profile' | 'change_request' | 'safe_mode' | 'workflow_template' | 'organ_boot' | 'organ_health' | 'organ_wiring' | 'cognitive_map' | 'cognitive_assessment' | 'memory_assessment' | 'execution_assessment' | 'evolution_assessment' | 'infrastructure_assessment' | 'health_assessment' | 'audit_assessment' | 'governance_lock' | 'meta_learning_signal' | 'world_model_project' | 'semantic_fact';

export interface Level6Record {
  id: string;
  type: Level6RecordType;
  tenantId: string;
  name: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface HealthSnapshot {
  status: 'ok' | 'degraded' | 'failed';
  service: string;
  version: string;
  uptimeSeconds: number;
  durableMemory: boolean;
  storage: 'postgres' | 'json';
  emergencyStop: boolean;
  timestamp: string;
}

export interface ExecutionResult {
  status: 'succeeded' | 'awaiting_approval' | 'denied' | 'failed';
  details: Record<string, unknown>;
  outcome?: string;
}

export interface RuntimeStore {
  initialize(): Promise<void>;
  health(): Promise<{ durable: boolean; storage: 'postgres' | 'json' }>;
  createRun(run: RunRecord): Promise<void>;
  getRun(id: string): Promise<RunRecord | undefined>;
  listRuns(tenantId: string, limit: number): Promise<RunRecord[]>;
  updateRun(id: string, patch: Partial<RunRecord>): Promise<RunRecord | undefined>;
  createStep(step: StepRecord): Promise<void>;
  updateStep(id: string, patch: Partial<StepRecord>): Promise<StepRecord | undefined>;
  listSteps(runId: string): Promise<StepRecord[]>;
  appendMemory(memory: MemoryRecord): Promise<void>;
  recallMemory(agentId: string, query: string, limit: number, tenantId: string): Promise<MemoryRecord[]>;
  /** Real gap this closes: recallMemory requires a specific agentId, but semantic-memory distillation needs to see all episodic memory across a tenant regardless of which agent logged it. */
  listAllMemory(tenantId: string, limit: number): Promise<MemoryRecord[]>;
  savePolicyDecision(decision: PolicyDecision): Promise<void>;
  createApproval(approval: ApprovalRequest): Promise<void>;
  getApproval(id: string): Promise<ApprovalRequest | undefined>;
  updateApproval(id: string, patch: Partial<ApprovalRequest>): Promise<ApprovalRequest | undefined>;
  listApprovals(status?: ApprovalStatus): Promise<ApprovalRequest[]>;
  appendIntegrationAudit(audit: IntegrationAuditRecord): Promise<void>;
  listIntegrationAudits(runId: string, limit: number): Promise<IntegrationAuditRecord[]>;
  registerOrgans(organs: OrganRegistryRecord[]): Promise<void>;
  appendOrganInvocation(invocation: OrganInvocationRecord): Promise<void>;
  appendPhenotype(snapshot: PhenotypeRecord): Promise<void>;
  appendSystemEvent(event: SystemEventRecord): Promise<void>;
  upsertLevel6Record(record: Level6Record): Promise<void>;
  listLevel6Records(type: Level6RecordType, tenantId?: string): Promise<Level6Record[]>;
  appendUsageEvent(event: UsageEvent): Promise<void>;
  listUsageEvents(tenantId: string, limit: number): Promise<UsageEvent[]>;
}

export interface TelemetryEvent {
  name: string;
  timestamp: string;
  runId?: string;
  fields: Record<string, string | number | boolean | undefined>;
}

export interface Planner {
  plan(goal: string, memory: MemoryRecord[]): Promise<PlannedAction[]>;
}

export interface CapabilityArtifact {
  id: string;
  title: string;
  relativePath: string;
  content: string;
  validation: { passed: boolean; checks: string[] };
  createdAt: string;
}

export interface Sandbox {
  inspect(): Promise<Record<string, unknown>>;
  validateCapability(title: string, specification: string): Promise<CapabilityArtifact>;
  execute(relativePathFromCwd: string, timeoutMs?: number): Promise<{ exitCode: number | null; timedOut: boolean; stdout: string; stderr: string; durationMs: number }>;
}

export interface PolicyEngine {
  evaluate(run: RunRecord, step: StepRecord): PolicyDecision;
}
