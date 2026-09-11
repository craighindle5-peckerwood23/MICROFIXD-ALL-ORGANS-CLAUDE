import { randomUUID } from 'node:crypto';
import { ParagonDissector } from './governance.ts';
import { AutonomyRuntime } from './runtime.ts';
import type { PlannedAction, RunRecord, StepRecord } from './types.ts';

/**
 * ParagonGateway: a generic actor/intent/context ingress point.
 *
 * This is NOT a second security system next to Paragon Dissector -- it is
 * a thin envelope adapter in front of the exact same
 * ParagonDissector.evaluate() / store.savePolicyDecision() /
 * store.createApproval() path that OrganKernel.invoke() already uses for
 * every organ call. One policy engine, one approval queue, one audit
 * trail, regardless of whether a request arrives as an organ invocation,
 * a chat message, or an actor/intent/context envelope.
 *
 * Deliberate departures from the sketch this was built from, and why:
 *
 * 1. Authentication never reads a credential out of the request body
 *    (e.g. `actor.admin_key`). The HTTP layer already authenticates the
 *    caller via the `x-microfixd-admin-key` header before this class is
 *    ever invoked (see routes.ts's `requireAdmin`). A body field is more
 *    likely to be logged by a proxy, CDN, or error tracker than a header
 *    -- so if a caller includes `admin_key` in the envelope, it is
 *    ignored, not honored.
 * 2. There is no unconditional "system.modify enable_autonomy" bypass.
 *    That intent is classified as an `apply_capability` action; if its
 *    payload touches autonomy/override-shaped terms it is classified
 *    `critical` risk, which ParagonDissector.evaluate() denies outright
 *    regardless of who the actor is. Nothing in this file can promote an
 *    actor past what the shared policy engine allows.
 * 3. An intent type with no wired runtime handler is never silently
 *    treated as successful. If policy allows it but no handler exists,
 *    the gateway says so explicitly rather than fabricating a result.
 */

export type GatewayEnvelope = {
  actor: { id: string; role: string; scopes?: string[] };
  intent: { type: string; payload?: Record<string, unknown> };
  context?: { system_state?: string; environment?: string; correlation_id?: string };
};

export type GatewayResponse = {
  decision: 'ALLOWED' | 'DENIED' | 'PENDING_APPROVAL';
  risk: PlannedAction['risk'];
  trace_id: string;
  result?: { status: 'SUCCESS' | 'NOT_WIRED'; data?: unknown; message?: string };
  reasons: string[];
};

const AUTONOMY_OVERRIDE_TERMS = /(enable_autonomy|runtime\.override|disable_governance|bypass)/i;

export class ParagonGateway {
  constructor(private runtime: AutonomyRuntime, private paragon: ParagonDissector) {}

  async handle(envelope: GatewayEnvelope, requestedBy: string): Promise<GatewayResponse> {
    const { kind, risk } = this.classify(envelope);
    const now = new Date().toISOString();

    const run: RunRecord = {
      id: `gateway-${randomUUID()}`,
      tenantId: 'global',
      agentId: `actor:${envelope.actor.id}`,
      goal: `Gateway intent ${envelope.intent.type}`,
      requestedBy,
      metadata: { actor: envelope.actor, context: envelope.context || {} },
      status: 'running',
      plan: [],
      currentStep: 0,
      workingMemory: {},
      createdAt: now,
      updatedAt: now,
    };
    const action: PlannedAction = {
      id: randomUUID(),
      kind,
      title: `${envelope.actor.role}:${envelope.actor.id} -> ${envelope.intent.type}`,
      input: { ...envelope.intent.payload, correlationId: envelope.context?.correlation_id },
      risk,
    };
    const step: StepRecord = { id: action.id, runId: run.id, sequence: 0, action, status: 'pending', createdAt: now };

    await this.runtime.store.createRun(run);
    await this.runtime.store.createStep(step);
    const decision = this.paragon.evaluate(run, step);
    await this.runtime.store.savePolicyDecision(decision);

    if (decision.outcome === 'deny') {
      return { decision: 'DENIED', risk, trace_id: decision.id, reasons: decision.reasons };
    }

    if (decision.outcome === 'require_approval') {
      await this.runtime.store.createApproval({ id: randomUUID(), runId: run.id, stepId: step.id, action, reason: decision.reasons.join(' '), status: 'pending', requestedAt: now, approvedBy: [] });
      return { decision: 'PENDING_APPROVAL', risk, trace_id: decision.id, reasons: decision.reasons };
    }

    const result = await this.forward(envelope);
    return { decision: 'ALLOWED', risk, trace_id: decision.id, result, reasons: decision.reasons };
  }

  /** Maps an intent.type to a governed action kind + risk. Unknown types default to the lowest-authority path, never the highest. */
  private classify(envelope: GatewayEnvelope): { kind: PlannedAction['kind']; risk: PlannedAction['risk'] } {
    const { type, payload } = envelope.intent;
    const payloadText = JSON.stringify(payload || {});
    const productionUplift = envelope.context?.environment === 'production' ? 1 : 0;

    if (type === 'mission.execute') return { kind: 'design_workflow', risk: productionUplift ? 'high' : 'medium' };
    if (type === 'agents.spawn') return { kind: 'apply_capability', risk: 'high' };
    if (type === 'runtime.override') return { kind: 'apply_capability', risk: 'critical' };
    if (type === 'system.modify') return { kind: 'apply_capability', risk: AUTONOMY_OVERRIDE_TERMS.test(payloadText) ? 'critical' : 'high' };
    if (type.endsWith('.read') || type.startsWith('status.')) return { kind: 'introspect', risk: 'low' };
    // Unknown intent types get the least authority by default, not the most.
    return { kind: 'introspect', risk: 'low' };
  }

  /** Only intents with a real wired handler execute; everything else says so honestly instead of pretending. */
  private async forward(envelope: GatewayEnvelope): Promise<GatewayResponse['result']> {
    if (envelope.intent.type === 'mission.execute') {
      const missionId = String(envelope.intent.payload?.mission_id || 'unnamed-mission');
      const parameters = envelope.intent.payload?.parameters;
      const run = await this.runtime.submitGoal({
        goal: `Mission ${missionId}: ${JSON.stringify(parameters || {})}`,
        tenantId: 'global',
        requestedBy: envelope.actor.id,
        metadata: { missionId, parameters, source: 'gateway' },
      });
      return { status: 'SUCCESS', data: { runId: run.id, runStatus: run.status } };
    }
    return { status: 'NOT_WIRED', message: `Policy allowed intent "${envelope.intent.type}", but no runtime handler is wired for it yet. Nothing was executed.` };
  }
}
