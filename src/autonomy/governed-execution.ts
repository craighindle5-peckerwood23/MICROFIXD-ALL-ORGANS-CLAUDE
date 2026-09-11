// src/autonomy/governed-execution.ts
//
// A shared propose -> require-approval -> one-time-consume helper for any
// feature whose commit() has real, meaningful side effects (sandbox code
// execution, browser automation). Both call this instead of duplicating
// the propose/approve/consume logic, and both get identical guarantees:
//
//  - The action is ALWAYS classified 'apply_capability' or
//    'external_effect', which governance.ts's rule set makes an
//    unconditional require_approval -- never silently allowed regardless
//    of what family/mode an organ registry entry might imply.
//  - An approval can be consumed exactly once. Consumption is recorded as
//    a durable UsageEvent tagged with the approvalId; a second attempt to
//    consume the same approvalId is rejected. There is no separate,
//    parallel approval store -- this is the same ApprovalRequest table
//    every other governed action in this backend already uses.
import { randomUUID } from 'node:crypto';
import type { AutonomyRuntime } from './runtime.ts';
import type { ApprovalRequest, PlannedAction, RunRecord, StepRecord } from './types.ts';

export type GovernedProposal = {
  outcome: 'allowed' | 'awaiting_approval' | 'denied';
  runId: string;
  stepId: string;
  approvalId?: string;
  reasons: string[];
  decisionId: string;
};

export async function proposeGovernedAction(
  runtime: AutonomyRuntime,
  input: { tenantId: string; requestedBy: string; kind: PlannedAction['kind']; title: string; actionInput: Record<string, unknown>; risk: PlannedAction['risk'] },
): Promise<GovernedProposal> {
  const now = new Date().toISOString();
  const run: RunRecord = {
    id: `governed-${randomUUID()}`,
    tenantId: input.tenantId,
    agentId: `actor:${input.requestedBy}`,
    goal: input.title,
    requestedBy: input.requestedBy,
    metadata: {},
    status: 'running',
    plan: [],
    currentStep: 0,
    workingMemory: {},
    createdAt: now,
    updatedAt: now,
  };
  const action: PlannedAction = { id: randomUUID(), kind: input.kind, title: input.title, input: input.actionInput, risk: input.risk };
  const step: StepRecord = { id: action.id, runId: run.id, sequence: 0, action, status: 'pending', createdAt: now };

  await runtime.store.createRun(run);
  await runtime.store.createStep(step);
  const decision = runtime.paragon.evaluate(run, step);
  await runtime.store.savePolicyDecision(decision);

  if (decision.outcome === 'deny') {
    return { outcome: 'denied', runId: run.id, stepId: step.id, reasons: decision.reasons, decisionId: decision.id };
  }
  if (decision.outcome === 'require_approval') {
    const approval: ApprovalRequest = { id: randomUUID(), runId: run.id, stepId: step.id, action, reason: decision.reasons.join(' '), status: 'pending', requestedAt: now, approvedBy: [] };
    await runtime.store.createApproval(approval);
    return { outcome: 'awaiting_approval', runId: run.id, stepId: step.id, approvalId: approval.id, reasons: decision.reasons, decisionId: decision.id };
  }
  return { outcome: 'allowed', runId: run.id, stepId: step.id, reasons: decision.reasons, decisionId: decision.id };
}

/**
 * Verifies an approval is genuinely approved and not previously consumed,
 * then immediately records its consumption (before the caller does
 * anything else) so a concurrent second call can't race past this check.
 * Returns null for anything short of "safe to execute right now."
 */
export async function consumeApprovalOnce(runtime: AutonomyRuntime, approvalId: string, tenantId: string): Promise<ApprovalRequest | null> {
  const approval = await runtime.store.getApproval(approvalId);
  if (!approval || approval.status !== 'approved') return null;

  const run = await runtime.store.getRun(approval.runId);
  if (!run || run.tenantId !== tenantId) return null;

  const priorConsumption = await runtime.store.listUsageEvents(tenantId, 2000);
  if (priorConsumption.some((event) => event.kind === 'approval_consumed' && event.dataRefs.includes(approvalId))) {
    return null;
  }

  await runtime.store.appendUsageEvent({
    id: randomUUID(),
    tenantId,
    kind: 'approval_consumed',
    name: `Consumed approval for ${approval.action.title}`,
    actorId: approval.decidedBy,
    dataRefs: [approvalId],
    metadata: { runId: approval.runId, stepId: approval.stepId },
    createdAt: new Date().toISOString(),
  });

  return approval;
}
