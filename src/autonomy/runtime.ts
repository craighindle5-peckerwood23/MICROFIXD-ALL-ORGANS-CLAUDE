import { randomUUID } from 'node:crypto';
import { ParagonDissector } from './governance.ts';
import { CognitiveControlPlane } from './cognition.ts';
import { MemoryControlPlane } from './memory.ts';
import { PuppeteerExecutionControl, WebUseControlPlane } from './execution.ts';
import { EvolutionControlPlane } from './evolution.ts';
import { InfrastructureControlPlane } from './infrastructure.ts';
import { SelfHealingControlPlane } from './self-healing.ts';
import { SystemWiringControlPlane } from './system-wiring.ts';
import { FinalAuditControlPlane } from './final-audit.ts';
import { GovernedBringUpControlPlane } from './bring-up.ts';
import { ORGAN_REGISTRY, organSummary } from './organ-registry.ts';
import { OrganLifecycleController } from './organ-lifecycle.ts';
import { PhenotypeOrgan } from './phenotype.ts';
import { SandboxWorkspace } from './sandbox.ts';
import { getApproverPool, warnIfPoolUnconfiguredOnce } from './approver-pool.ts';
import { SecurityOrgans } from './security.ts';
import { DriftProtectionOrgans, ExecutionStabilizer, RealityAnchoringOrgans } from './integrity.ts';
import { AutomotiveDiagnosticsOrgan, FallbackSafetyOrgan, MetacognitionOrgan, VisualSnapshotOrgan, WatchdogOrgan, WhiteLabelOrgan, type AutomotiveTelemetry } from './auxiliary-organs.ts';
import { AGENT_ROLES, ChangeControlPlane, ComputeControlPlane, GLOBAL_TENANT_ID, HealthRepairControlPlane, MultiAgentControlPlane, PlanValidationOrgan, RepairControlPlane, SafeModeControlPlane, TenantControlPlane } from './level6.ts';
import { createRuntimeStore } from './store.ts';
import { Telemetry } from './telemetry.ts';
import type {
  ApprovalRequest,
  GoalInput,
  Level6Record,
  MemoryRecord,
  PlannedAction,
  Planner,
  RunRecord,
  RuntimeStore,
  Sandbox,
  StepRecord,
} from './types.ts';

export class DeterministicCognitionEngine implements Planner {
  async plan(goal: string, memory: MemoryRecord[]): Promise<PlannedAction[]> {
    const normalizedGoal = goal.trim();
    const plan: PlannedAction[] = [
      { id: randomUUID(), kind: 'introspect', title: 'Inspect current operating state', input: {}, risk: 'low' },
      { id: randomUUID(), kind: 'recall_memory', title: 'Recall relevant long-term experience', input: { query: normalizedGoal, recalledMemory: memory.map((item) => item.id) }, risk: 'low' },
      { id: randomUUID(), kind: 'design_workflow', title: 'Design a bounded workflow for the stated goal', input: { goal: normalizedGoal }, risk: 'low' },
    ];

    if (/(?:capability|module|workflow|repair|fix|improve|build|self.modif)/i.test(normalizedGoal)) {
      plan.push({ id: randomUUID(), kind: 'propose_capability', title: 'Create a confined candidate capability artifact', input: { title: normalizedGoal.slice(0, 80), specification: normalizedGoal }, risk: 'medium' });
      plan.push({ id: randomUUID(), kind: 'sandbox_validate', title: 'Statically validate the candidate in the confined sandbox', input: { title: normalizedGoal.slice(0, 80), specification: normalizedGoal }, risk: 'medium' });
    }

    if (/(?:deploy|production|credential|secret|api|plugin|external|email|payment|database|cloud)/i.test(normalizedGoal)) {
      plan.push({ id: randomUUID(), kind: 'external_effect', title: 'Evaluate the requested external or protected operation', input: { requestedGoal: normalizedGoal }, risk: 'high' });
    }

    return plan;
  }
}

export class AutonomyRuntime {
  readonly paragon: ParagonDissector;
  readonly telemetry: Telemetry;
  private initialized = false;

  constructor(
    readonly store: RuntimeStore = createRuntimeStore(),
    private readonly planner: Planner = new DeterministicCognitionEngine(),
    readonly sandbox: Sandbox = new SandboxWorkspace(),
    telemetry = new Telemetry(),
    paragon = new ParagonDissector(),
  ) {
    this.telemetry = telemetry;
    this.paragon = paragon;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.store.initialize();
    await this.store.registerOrgans([...ORGAN_REGISTRY]);
    const wiring = await OrganLifecycleController.registerDurableState(this.store);
    await TenantControlPlane.ensure(this.store, GLOBAL_TENANT_ID, 'Global Operations');
    await MultiAgentControlPlane.bootstrap(this.store, GLOBAL_TENANT_ID);
    await ComputeControlPlane.record(this.store, GLOBAL_TENANT_ID);
    await InfrastructureControlPlane.record(this.store, GLOBAL_TENANT_ID);
    await WebUseControlPlane.record(this.store, GLOBAL_TENANT_ID);
    await SelfHealingControlPlane.assess(this.store, GLOBAL_TENANT_ID);
    await SystemWiringControlPlane.validate(this.store, GLOBAL_TENANT_ID);
    await GovernedBringUpControlPlane.posture(this.store, GLOBAL_TENANT_ID);
    await FinalAuditControlPlane.lock(this.store, GLOBAL_TENANT_ID);
    this.initialized = true;
    await this.store.appendSystemEvent({ id: randomUUID(), eventName: 'runtime_initialized', organId: 'organ-boot-layer', severity: 'info', fields: { constitution: '2.0.0', organCount: ORGAN_REGISTRY.length, layers: 8, tenant: GLOBAL_TENANT_ID, wiringValid: wiring.valid, wiringEdges: wiring.edges.length, bootOrder: OrganLifecycleController.bootPlan().slice(0, 5).map((organ) => organ.id) }, createdAt: new Date().toISOString() });
    this.telemetry.event('runtime_initialized', { constitution: '2.0.0', organCount: ORGAN_REGISTRY.length, layers: 8, wiringEdges: wiring.edges.length });
  }

  async submitGoal(input: GoalInput): Promise<RunRecord> {
    await this.initialize();
    const goal = input.goal?.trim();
    if (!goal) throw new Error('A non-empty high-level goal is required.');
    if (goal.length > 10_000) throw new Error('Goals are limited to 10,000 characters.');
    SecurityOrgans.assertSafeInput({ goal, metadata: input.metadata || {} });
    const tenantId = (input.tenantId || GLOBAL_TENANT_ID).trim().toLowerCase();
    await TenantControlPlane.ensure(this.store, tenantId, typeof input.metadata?.tenantName === 'string' ? input.metadata.tenantName : tenantId);
    const agents = await MultiAgentControlPlane.bootstrap(this.store, tenantId);
    await SafeModeControlPlane.assertOperational(this.store, 'submit_goal');

    const now = new Date().toISOString();
    const run: RunRecord = {
      id: randomUUID(),
      tenantId,
      agentId: input.agentId?.trim() || 'microfixd-primary',
      goal,
      requestedBy: input.requestedBy?.trim() || 'Craig',
      metadata: { ...(input.metadata || {}), tenantId },
      status: 'planning',
      plan: [],
      currentStep: 0,
      workingMemory: { submittedGoal: goal, plannedAt: now, tenantId, constitution: 'Paragon Dissector Tier-0', agentRoles: agents.map((agent) => agent.payload.role) },
      createdAt: now,
      updatedAt: now,
      startedAt: now,
    };
    await this.store.createRun(run);
    await this.store.appendSystemEvent({ id: randomUUID(), eventName: 'goal_submitted', organId: 'task-engine', runId: run.id, severity: 'info', fields: { requestedBy: run.requestedBy, tenantId }, createdAt: now });
    await MultiAgentControlPlane.route(this.store, tenantId, run.id, 'planner', goal);

    const recalled = await MemoryControlPlane.recall(this.store, run.tenantId, run.agentId, goal, 8);
    const plan = await this.planner.plan(goal, recalled);
    ExecutionStabilizer.assertPlan(plan);
    await MultiAgentControlPlane.route(this.store, tenantId, run.id, 'critic-safety', `Review ${plan.length} planned actions for constitutional, safety, drift, doctrine, and tenant-boundary evidence.`);
    const collaboration = await MultiAgentControlPlane.collaborate(this.store, tenantId, run.id, ['planner', 'critic-safety', 'meta-agent'], 'Prepare a bounded governed plan without granting execution authority.');
    const plannedRun = { ...run, plan };
    const planValidation = PlanValidationOrgan.assess(plannedRun);
    const oversight = await MultiAgentControlPlane.oversight(this.store, tenantId, run.id, ['planner', 'critic-safety', 'meta-agent'], { planValidation: planValidation.outcome, planSteps: plan.length, tenantId });
    const arbitration = await MultiAgentControlPlane.arbitrate(this.store, tenantId, run.id, [
      { role: 'planner', statement: `The bounded plan contains ${plan.length} proposed actions.` },
      { role: 'critic-safety', statement: `Plan validation outcome is ${planValidation.outcome}; Paragon remains the only final action authority.` },
    ]);
    await MultiAgentControlPlane.recordHandoff(this.store, tenantId, run.id, 'meta-agent', 'coordinated', { roles: AGENT_ROLES, planSteps: plan.length, collaborationId: collaboration.id, oversightId: oversight.id, arbitrationId: arbitration.id });
    const cognitiveAssessment = await CognitiveControlPlane.recordAssessment(this.store, plannedRun);
    const cognitiveMap = await CognitiveControlPlane.recordMap(this.store, plannedRun);
    await this.store.appendSystemEvent({ id: randomUUID(), eventName: 'plan_validated', organId: 'plan-validator', runId: run.id, severity: planValidation.outcome === 'valid-bounded-plan' ? 'info' : 'warning', fields: { ...planValidation, cognitiveAssessmentId: cognitiveAssessment.id, cognitiveMapId: cognitiveMap.id, collaborationId: collaboration.id, oversightId: oversight.id, arbitrationId: arbitration.id }, createdAt: new Date().toISOString() });
    await this.store.updateRun(run.id, { status: 'running', plan, workingMemory: { ...run.workingMemory, recalledMemoryIds: recalled.map((memory) => memory.id), planStepCount: plan.length, planValidation, cognitiveAssessmentId: cognitiveAssessment.id, cognitiveMapId: cognitiveMap.id, collaborationId: collaboration.id, oversightId: oversight.id, arbitrationId: arbitration.id } });

    for (let index = 0; index < plan.length; index += 1) {
      await this.store.createStep({ id: plan[index].id, runId: run.id, sequence: index, action: plan[index], status: 'pending', createdAt: new Date().toISOString() });
    }
    this.telemetry.increment('runs_total', { status: 'submitted' });
    this.telemetry.event('goal_submitted', { planStepCount: plan.length, requestedBy: run.requestedBy }, run.id);
    return (await this.execute(run.id)) || run;
  }

  async execute(runId: string): Promise<RunRecord | undefined> {
    await this.initialize();
    let run = await this.store.getRun(runId);
    if (!run) return undefined;
    if (['succeeded', 'failed', 'cancelled'].includes(run.status)) return run;

    const steps = await this.store.listSteps(runId);
    for (const step of steps) {
      if (step.status === 'succeeded' || step.status === 'denied') continue;
      if (step.status === 'blocked') {
        const approval = (await this.store.listApprovals('pending')).find((candidate) => candidate.stepId === step.id);
        if (approval) return await this.store.getRun(runId);
      }

      run = (await this.store.getRun(runId))!;
      await SafeModeControlPlane.assertOperational(this.store, step.action.kind);
      ExecutionStabilizer.assertProgress(run, step);
      await this.store.appendSystemEvent({ id: randomUUID(), eventName: 'cognitive_action_preflight', organId: 'cognition-engine', runId, severity: 'info', fields: CognitiveControlPlane.evidenceFor(step.action), createdAt: new Date().toISOString() });
      DriftProtectionOrgans.assertWithinBaseline(run, step.action);
      const watchdog = WatchdogOrgan.assess(run, step.action);
      if (watchdog.halt) {
        const now = new Date().toISOString();
        const fallback = FallbackSafetyOrgan.safeFallback(run, step.action, watchdog.alerts.join(' '));
        const failure = await SelfHealingControlPlane.recordFailure(this.store, { tenantId: run.tenantId, runId, scope: 'runtime', severity: 'critical', message: watchdog.alerts.join(' '), evidence: { action: step.action.kind, watchdog: watchdog.snapshot, fallback } });
        await this.store.updateStep(step.id, { status: 'failed', error: watchdog.alerts.join(' '), result: fallback, completedAt: now });
        await this.store.updateRun(runId, { status: 'failed', error: watchdog.alerts.join(' '), completedAt: now });
        await this.store.appendSystemEvent({ id: randomUUID(), eventName: 'watchdog_halt', organId: 'execution-stabilizer', runId, severity: 'critical', fields: { alerts: watchdog.alerts, snapshot: watchdog.snapshot, fallback, healthAssessmentId: failure.id }, createdAt: now });
        this.telemetry.event('watchdog_halt', { alerts: watchdog.alerts.join(' | '), action: step.action.kind }, runId);
        return await this.store.getRun(runId);
      }
      await this.store.updateStep(step.id, { status: 'running', startedAt: new Date().toISOString() });
      const decision = this.paragon.evaluate(run, { ...step, status: 'running' });
      await this.store.savePolicyDecision(decision);
      await this.store.updateStep(step.id, { policy: decision });
      this.telemetry.event('paragon_decision', { outcome: decision.outcome, action: step.action.kind, risk: step.action.risk }, runId);

      if (decision.outcome === 'deny') {
        await this.store.updateStep(step.id, { status: 'denied', completedAt: new Date().toISOString(), error: decision.reasons.join(' ') });
        await this.store.updateRun(runId, { status: 'failed', error: `Tier-0 Paragon Dissector denied a required action: ${decision.reasons.join(' ')}`, completedAt: new Date().toISOString() });
        this.telemetry.increment('runs_total', { status: 'denied' });
        return await this.store.getRun(runId);
      }

      if (decision.outcome === 'require_approval') {
        const approval = await this.createApproval(run, step, decision.reasons.join(' '));
        await this.store.updateStep(step.id, { status: 'blocked', completedAt: new Date().toISOString() });
        await this.store.updateRun(runId, { status: 'awaiting_approval', workingMemory: { ...run.workingMemory, pendingApprovalId: approval.id, pendingAction: step.action.title } });
        this.telemetry.increment('runs_total', { status: 'awaiting_approval' });
        return await this.store.getRun(runId);
      }

      try {
        const rawResult = await PuppeteerExecutionControl.execute(this.store, run, step.action, async () => this.executeAction(run, step.action));
        RealityAnchoringOrgans.assertNoUnsupportedClaim(rawResult);
        const result = RealityAnchoringOrgans.qualify(rawResult);
        if (['propose_capability', 'sandbox_validate'].includes(step.action.kind)) await MultiAgentControlPlane.recordHandoff(this.store, run.tenantId, run.id, 'builder', 'sandbox-artifact-created', { action: step.action.kind, boundary: 'Sandbox candidate only; no capability activation or production change.' });
        const completedAt = new Date().toISOString();
        await this.store.updateStep(step.id, { status: 'succeeded', result, completedAt });
        run = (await this.store.updateRun(runId, { currentStep: step.sequence + 1, workingMemory: { ...run.workingMemory, [`step_${step.sequence}`]: result, baseline: DriftProtectionOrgans.baseline(run) } }))!;
        await MemoryControlPlane.append(this.store, {
          id: randomUUID(), tenantId: run.tenantId, agentId: run.agentId, runId, kind: 'experience',
          content: `Action “${step.action.title}” completed successfully for goal “${run.goal}”.`,
          tags: [step.action.kind, 'governed-execution'], importance: 0.6, score: 1,
          metadata: { stepId: step.id, result }, createdAt: completedAt,
        });
        this.telemetry.increment('steps_total', { status: 'succeeded', action: step.action.kind });
      } catch (error) {
        const message = (error as Error).message;
        await this.store.updateStep(step.id, { status: 'failed', error: message, completedAt: new Date().toISOString() });
        await this.store.updateRun(runId, { status: 'failed', error: message, completedAt: new Date().toISOString() });
        const fallback = FallbackSafetyOrgan.safeFallback(run, step.action, message);
        const failure = await SelfHealingControlPlane.recordFailure(this.store, { tenantId: run.tenantId, runId, scope: 'workflow', severity: 'warning', message, evidence: { action: step.action.kind, fallback } });
        const repair = await HealthRepairControlPlane.assess(this.store, this.sandbox, run, message);
        await MultiAgentControlPlane.recordHandoff(this.store, run.tenantId, run.id, 'repair', 'proposal-created', { repairProposalId: repair.id, healthAssessmentId: failure.id, action: step.action.kind, boundary: 'Sandbox proposal only; no repair activation.' });
        await MemoryControlPlane.append(this.store, {
          id: randomUUID(), tenantId: run.tenantId, agentId: run.agentId, runId, kind: 'experience', content: `Action “${step.action.title}” failed: ${message}`,
          tags: [step.action.kind, 'failure', 'self-healing-fallback'], importance: 0.9, score: -1, metadata: { stepId: step.id, fallback }, createdAt: new Date().toISOString(),
        });
        await this.store.appendSystemEvent({ id: randomUUID(), eventName: 'fallback_activated', organId: 'fallback-safety-organ', runId, severity: 'warning', fields: { ...fallback, healthAssessmentId: failure.id }, createdAt: new Date().toISOString() });
        this.telemetry.increment('steps_total', { status: 'failed', action: step.action.kind });
        return await this.store.getRun(runId);
      }
    }

    run = (await this.store.updateRun(runId, { status: 'succeeded', outcome: 'All bounded actions completed under recorded Tier-0 Paragon decisions.', completedAt: new Date().toISOString() }))!;
    await MultiAgentControlPlane.recordHandoff(this.store, run.tenantId, run.id, 'reflection', 'completed', { completedSteps: run.currentStep, outcome: run.outcome });
    this.telemetry.increment('runs_total', { status: 'succeeded' });
    this.telemetry.event('run_completed', { status: 'succeeded', completedSteps: run.currentStep }, runId);
    return run;
  }

  async decideApproval(approvalId: string, approved: boolean, note: string, actor: string, tenantId: string): Promise<ApprovalRequest | undefined> {
    await this.initialize();
    TenantControlPlane.assertIdentifier(tenantId);
    const approval = await this.store.getApproval(approvalId);
    if (!approval || approval.status !== 'pending') return approval;
    const run = await this.store.getRun(approval.runId);
    if (!run || run.tenantId !== tenantId) return undefined;
    const now = new Date().toISOString();

    // A rejection is always unilateral and immediate -- one veto stops
    // the action regardless of how many approvers a pool requires. This
    // asymmetry (easy to stop, harder to proceed) is deliberate.
    if (!approved) {
      const rejected = await this.store.updateApproval(approvalId, { status: 'rejected', decidedAt: now, decidedBy: actor, decisionNote: note.slice(0, 2000) });
      await this.finalizeApprovalOutcome(run, approval, false, actor, note, now);
      this.telemetry.event('approval_decided', { approved: false, actor }, run.id);
      return rejected;
    }

    warnIfPoolUnconfiguredOnce();
    const pool = getApproverPool();

    if (pool.length === 0) {
      // Pool not yet configured: preserve the exact prior behavior so
      // nothing that already depends on single-decision approval breaks.
      const updated = await this.store.updateApproval(approvalId, { status: 'approved', decidedAt: now, decidedBy: actor, decisionNote: note.slice(0, 2000), approvedBy: [actor] });
      await this.finalizeApprovalOutcome(run, approval, true, actor, note, now);
      this.telemetry.event('approval_decided', { approved: true, actor, mode: 'single-decision-pool-unconfigured' }, run.id);
      return updated;
    }

    if (!pool.includes(actor)) {
      const rejected = await this.store.updateApproval(approvalId, { status: 'rejected', decidedAt: now, decidedBy: actor, decisionNote: `Rejected automatically: "${actor}" is not in the configured approver pool.` });
      await this.finalizeApprovalOutcome(run, approval, false, actor, 'Approver is not in the configured pool.', now);
      this.telemetry.event('approval_decided', { approved: false, actor, reason: 'not_in_pool' }, run.id);
      return rejected;
    }

    if (approval.approvedBy.includes(actor)) {
      // The same identity approving twice must not count as two distinct
      // approvers -- return the unchanged, still-pending approval.
      return approval;
    }

    const approvedBy = [...approval.approvedBy, actor];
    if (approvedBy.length < 2) {
      // First of two required distinct approvers -- stays pending.
      return this.store.updateApproval(approvalId, { approvedBy });
    }

    const updated = await this.store.updateApproval(approvalId, { status: 'approved', decidedAt: now, decidedBy: actor, decisionNote: note.slice(0, 2000), approvedBy });
    await this.finalizeApprovalOutcome(run, approval, true, actor, note, now);
    this.telemetry.event('approval_decided', { approved: true, actor, approvedByCount: approvedBy.length, mode: 'two-distinct-admin' }, run.id);
    return updated;
  }

  private async finalizeApprovalOutcome(run: RunRecord, approval: ApprovalRequest, approved: boolean, actor: string, note: string, now: string): Promise<void> {
    const step = (await this.store.listSteps(run.id)).find((candidate) => candidate.id === approval.stepId);
    if (step) {
      await this.store.updateStep(step.id, {
        status: approved ? 'succeeded' : 'denied',
        completedAt: now,
        result: approved ? { approvalId: approval.id, note: 'Craig approved the exception. Activation or external execution remains a separately governed operation.' } : undefined,
        error: approved ? undefined : `Craig rejected the exception: ${note}`,
      });
    }
    await this.store.updateRun(run.id, approved
      ? { status: 'running', workingMemory: { ...run.workingMemory, lastApproval: { approvalId: approval.id, approved, actor, note } } }
      : { status: 'failed', error: `Craig rejected a Tier-0 escalation: ${note}`, completedAt: now },
    );
  }

  async getRunWithSteps(runId: string): Promise<{ run: RunRecord; steps: StepRecord[] } | undefined> {
    await this.initialize();
    const run = await this.store.getRun(runId);
    if (!run) return undefined;
    return { run, steps: await this.store.listSteps(runId) };
  }

  async listApprovals(tenantId: string, status?: ApprovalRequest['status']): Promise<ApprovalRequest[]> {
    await this.initialize();
    TenantControlPlane.assertIdentifier(tenantId);
    const candidates = await this.store.listApprovals(status);
    const ownership = await Promise.all(candidates.map(async (approval) => ({ approval, run: await this.store.getRun(approval.runId) })));
    return ownership.filter(({ run }) => run?.tenantId === tenantId).map(({ approval }) => approval);
  }

  async introspect(runId?: string): Promise<Record<string, unknown>> {
    await this.initialize();
    const storage = await this.store.health();
    const sandbox = await this.sandbox.inspect();
    const phenotype = PhenotypeOrgan.scan();
    if (runId) await this.store.appendPhenotype({ id: randomUUID(), runId, snapshot: phenotype as unknown as Record<string, unknown>, createdAt: phenotype.timestamp });
    return {
      organ: 'System Inspector',
      service: 'Microfixd Level-6 Operations Platform',
      constitution: 'Paragon Dissector Tier-0',
      organs: organSummary(),
      process: { pid: process.pid, node: process.version, uptimeSeconds: Math.floor(process.uptime()), platform: process.platform, architecture: process.arch },
      phenotype,
      storage,
      sandbox,
      layers: { foundational: 8, names: ['Constitutional', 'Organ Architecture', 'Cognitive', 'Memory', 'Execution', 'Self-Evolution', 'Safety', 'Infrastructure'], overlays: ['Mission Control OS/UI', 'Multi-Tenant Enterprise'] },
      tenants: await TenantControlPlane.list(this.store),
      agents: await MultiAgentControlPlane.list(this.store, GLOBAL_TENANT_ID),
      compute: ComputeControlPlane.scan(),
      infrastructure: InfrastructureControlPlane.posture(),
      selfHealing: await SelfHealingControlPlane.assess(this.store, GLOBAL_TENANT_ID),
      wiring: await SystemWiringControlPlane.validate(this.store, GLOBAL_TENANT_ID),
      audit: await FinalAuditControlPlane.audit(this.store, GLOBAL_TENANT_ID),
      governanceLock: await FinalAuditControlPlane.lock(this.store, GLOBAL_TENANT_ID),
      bringUp: await GovernedBringUpControlPlane.posture(this.store, GLOBAL_TENANT_ID),
      safeMode: await SafeModeControlPlane.get(this.store),
      emergencyStop: process.env.MICROFIXD_EMERGENCY_STOP === 'true',
      timestamp: new Date().toISOString(),
    };
  }

  async metacognition(runId: string): Promise<Record<string, unknown> | undefined> {
    await this.initialize();
    const record = await this.getRunWithSteps(runId);
    return record ? MetacognitionOrgan.assess(record.run, record.steps) : undefined;
  }

  async ensureTenant(tenantId: string, name?: string): Promise<Level6Record> {
    await this.initialize();
    const tenant = await TenantControlPlane.ensure(this.store, tenantId, name || tenantId);
    await MultiAgentControlPlane.bootstrap(this.store, tenantId);
    await ComputeControlPlane.record(this.store, tenantId);
    await InfrastructureControlPlane.record(this.store, tenantId);
    await WebUseControlPlane.record(this.store, tenantId);
    await SelfHealingControlPlane.assess(this.store, tenantId);
    await SystemWiringControlPlane.validate(this.store, tenantId);
    await GovernedBringUpControlPlane.posture(this.store, tenantId);
    await FinalAuditControlPlane.lock(this.store, tenantId);
    return tenant;
  }

  async memoryPosture(tenantId: string, agentId = 'microfixd-primary'): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return MemoryControlPlane.recordPosture(this.store, tenantId, agentId);
  }

  async proposeMemoryCompression(tenantId: string, agentId = 'microfixd-primary'): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return MemoryControlPlane.proposeCompression(this.store, tenantId, agentId);
  }

  async listTenants(): Promise<Level6Record[]> {
    await this.initialize();
    return TenantControlPlane.list(this.store);
  }

  computePosture(): Record<string, unknown> {
    return ComputeControlPlane.scan();
  }

  async computeAssessment(tenantId = GLOBAL_TENANT_ID): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return ComputeControlPlane.record(this.store, tenantId);
  }

  async infrastructurePosture(tenantId = GLOBAL_TENANT_ID): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return InfrastructureControlPlane.record(this.store, tenantId);
  }

  async webUsePosture(tenantId = GLOBAL_TENANT_ID): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return WebUseControlPlane.record(this.store, tenantId);
  }

  async selfHealingPosture(tenantId = GLOBAL_TENANT_ID): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return SelfHealingControlPlane.assess(this.store, tenantId);
  }

  async masterWiringPosture(tenantId = GLOBAL_TENANT_ID): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return SystemWiringControlPlane.validate(this.store, tenantId);
  }

  async fullSystemAudit(tenantId = GLOBAL_TENANT_ID): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    await ComputeControlPlane.record(this.store, tenantId);
    await InfrastructureControlPlane.record(this.store, tenantId);
    await WebUseControlPlane.record(this.store, tenantId);
    await SelfHealingControlPlane.assess(this.store, tenantId);
    await SystemWiringControlPlane.validate(this.store, tenantId);
    return FinalAuditControlPlane.audit(this.store, tenantId);
  }

  async governanceLockPosture(tenantId = GLOBAL_TENANT_ID): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return FinalAuditControlPlane.lock(this.store, tenantId);
  }

  async bringUpPosture(tenantId = GLOBAL_TENANT_ID): Promise<Level6Record> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return GovernedBringUpControlPlane.posture(this.store, tenantId);
  }

  async listAgents(tenantId = GLOBAL_TENANT_ID): Promise<Level6Record[]> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return MultiAgentControlPlane.list(this.store, tenantId);
  }

  async multiAgentPosture(tenantId = GLOBAL_TENANT_ID): Promise<Record<string, unknown>> {
    await this.initialize();
    await TenantControlPlane.ensure(this.store, tenantId);
    return MultiAgentControlPlane.posture(this.store, tenantId);
  }

  async setSafeMode(enabled: boolean, actor: string, reason: string): Promise<Level6Record> {
    await this.initialize();
    const record = await SafeModeControlPlane.set(this.store, enabled, actor, reason);
    await this.store.appendSystemEvent({ id: randomUUID(), eventName: 'safe_mode_changed', organId: 'safe-mode-control-organ', severity: enabled ? 'warning' : 'info', fields: { enabled, actor }, createdAt: new Date().toISOString() });
    return record;
  }

  async requestGithubChange(runId: string, tenantId: string, summary: string): Promise<Level6Record | undefined> {
    await this.initialize();
    const run = await this.store.getRun(runId);
    if (!run) return undefined;
    TenantControlPlane.assertRunAccess(run, tenantId);
    const request = await EvolutionControlPlane.requestGithubPipeline(this.store, run, summary);
    await this.store.appendSystemEvent({ id: randomUUID(), eventName: 'github_change_requested', organId: 'change-request-organ', runId, severity: 'warning', fields: { changeRequestId: request.id, tenantId, adapter: 'dormant-pending-approved-plugin' }, createdAt: new Date().toISOString() });
    return request;
  }

  async automotiveDiagnostics(telemetry: AutomotiveTelemetry): Promise<Record<string, unknown>> {
    await this.initialize();
    return AutomotiveDiagnosticsOrgan.diagnose(telemetry);
  }

  whiteLabelSettings(): Record<string, unknown> {
    return WhiteLabelOrgan.settings();
  }

  async visualSnapshot(runId?: string): Promise<Record<string, unknown>> {
    const state = await this.introspect(runId);
    return VisualSnapshotOrgan.capture({ organSummary: state.organs as Record<string, unknown>, phenotype: state.phenotype as Record<string, unknown>, whiteLabel: this.whiteLabelSettings() });
  }

  private async executeAction(run: RunRecord, action: PlannedAction): Promise<Record<string, unknown>> {
    switch (action.kind) {
      case 'introspect':
        return await this.introspect(run.id);
      case 'recall_memory': {
        const memory = await MemoryControlPlane.recall(this.store, run.tenantId, run.agentId, String(action.input.query || run.goal), 8);
        return { recalled: memory.map((item) => ({ id: item.id, kind: item.kind, content: item.content, score: item.score, createdAt: item.createdAt })), count: memory.length };
      }
      case 'design_workflow':
        return { workflow: { objective: run.goal, boundedSteps: ['inspect state', 'recall experience', 'produce confined artifact when applicable', 'record governed outcome'], prohibited: ['direct network access', 'host execution', 'production activation without approval'] } };
      case 'propose_capability':
      case 'sandbox_validate': {
        const proposal = await EvolutionControlPlane.propose(this.store, this.sandbox, run, String(action.input.title || 'Microfixd capability'), String(action.input.specification || run.goal), action.kind === 'sandbox_validate' ? 'refactor' : 'capability');
        return { evolution: proposal, artifact: proposal.payload.artifact };
      }
      case 'apply_capability':
      case 'external_effect':
        throw new Error('A protected action reached execution without a Tier-0 escalation. This is a governance violation.');
      default:
        throw new Error(`The Task Engine does not recognize action ${(action as PlannedAction).kind}.`);
    }
  }

  private async createApproval(run: RunRecord, step: StepRecord, reason: string): Promise<ApprovalRequest> {
    const approval: ApprovalRequest = {
      id: randomUUID(), runId: run.id, stepId: step.id, action: step.action, reason, status: 'pending', requestedAt: new Date().toISOString(), approvedBy: [],
    };
    await this.store.createApproval(approval);
    this.telemetry.event('approval_requested', { action: step.action.kind, risk: step.action.risk, approver: 'Craig' }, run.id);
    return approval;
  }
}
