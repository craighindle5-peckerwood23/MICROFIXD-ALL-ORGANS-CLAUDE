// src/autonomy/approval-tiers.ts
//
// Formalizes the policy Craig described: pre-set criteria for routine
// actions (async-notified, not blocking), real human approval still
// required for anything that matters, and a fast path ONLY for genuine
// system-collapse conditions.
//
// The hard line, stated in code so it can't drift: CRITICAL_SAFE_ACTIONS
// below is the complete, closed list of what the emergency tier is
// allowed to trigger without waiting for approval. It contains
// stabilization actions only (activate safe mode, halt the build loop).
// It does NOT contain "generate code," "integrate module," "write
// file," or "deploy" -- those stay gated at medium/large severity no
// matter how urgent the situation looks, because a system that's
// failing should freeze, not accelerate its own code-writing while
// nobody is watching. If a future change needs to add to this list,
// that's a real decision to make explicitly here, not something a
// caller should be able to expand by passing a different severity
// string.
//
// Notification is real and durable (a UsageEvent, visible immediately
// via the existing /api/autonomy/usage-report route) AND pushes a real
// SMS via Twilio when TWILIO_* env vars are configured -- confirmed
// real account via Gmail search (trial tier; Account SID intentionally
// not repeated here -- see TWILIO_ACCOUNT_SID in the deployment secret
// store). The Auth Token is never sourced from anywhere but the
// environment; it isn't and shouldn't be recoverable from email, so
// this doesn't try. Falls back to durable-only notification (no crash,
// no fake success) if Twilio isn't configured.

import { randomUUID } from 'node:crypto';
import { SafeModeControlPlane } from './level6.ts';
import type { AutonomyRuntime } from './runtime.ts';
import { proposeGovernedAction, type GovernedProposal } from './governed-execution.ts';
import type { PlannedAction } from './types.ts';

async function sendTwilioSms(body: string): Promise<{ sent: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const toNumber = process.env.TWILIO_TO_NUMBER;
  if (!accountSid || !authToken || !fromNumber || !toNumber) return { sent: false, error: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, and TWILIO_TO_NUMBER must all be set.' };

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: toNumber, From: fromNumber, Body: body.slice(0, 1500) }),
    });
    if (!response.ok) {
      const detail = await response.text();
      return { sent: false, error: `Twilio HTTP ${response.status}: ${detail.slice(0, 300)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type ApprovalTier = 'routine' | 'medium' | 'large' | 'critical';

export interface TierClassificationInput {
  kind: PlannedAction['kind'];
  risk: PlannedAction['risk'];
  /** True only for a real, already-confirmed system-collapse signal (e.g. MetaAnalyzer reporting degraded with a high anomalyScore) -- never set from an action's own self-description. */
  systemCollapseConfirmed: boolean;
  /** Craig's own pre-set allowlist of routine action titles/kinds, read from MICROFIXD_PREAUTHORIZED_ACTIONS (comma-separated action kinds). Empty by default -- nothing is pre-authorized until Craig explicitly sets this. */
  actionKind: string;
}

function preauthorizedKinds(): Set<string> {
  const raw = process.env.MICROFIXD_PREAUTHORIZED_ACTIONS || '';
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

export function classifyTier(input: TierClassificationInput): ApprovalTier {
  if (input.systemCollapseConfirmed) return 'critical';
  if (input.risk === 'high') return 'large';
  if (input.kind === 'apply_capability' || input.kind === 'external_effect') {
    return preauthorizedKinds().has(input.actionKind) ? 'routine' : 'medium';
  }
  return 'routine';
}

/** The complete, closed set of emergency-tier actions. Nothing else may bypass approval, regardless of stated urgency. */
const CRITICAL_SAFE_ACTIONS = ['activate-safe-mode', 'halt-build-loop'] as const;
export type CriticalSafeAction = typeof CRITICAL_SAFE_ACTIONS[number];

export interface TieredProposalResult extends GovernedProposal {
  tier: ApprovalTier;
  autoApproved: boolean;
  notified: boolean;
}

/**
 * Wraps proposeGovernedAction with tier policy. Medium and large tiers
 * are completely unchanged from today's behavior -- real approval
 * required, no shortcut. Routine tier still creates the real
 * proposal/run/step records (so there's a durable audit trail) but
 * auto-consumes its own approval and records a notification event
 * instead of blocking. Critical tier does not call
 * proposeGovernedAction at all -- it can ONLY execute one of
 * CRITICAL_SAFE_ACTIONS, checked by name, and always records a
 * notification.
 */
export async function proposeWithTier(
  runtime: AutonomyRuntime,
  input: { tenantId: string; requestedBy: string; kind: PlannedAction['kind']; title: string; actionInput: Record<string, unknown>; risk: PlannedAction['risk']; actionKindLabel: string; systemCollapseConfirmed?: boolean },
): Promise<TieredProposalResult> {
  const tier = classifyTier({ kind: input.kind, risk: input.risk, systemCollapseConfirmed: input.systemCollapseConfirmed ?? false, actionKind: input.actionKindLabel });

  const proposal = await proposeGovernedAction(runtime, input);

  if (tier === 'routine' && proposal.outcome === 'awaiting_approval' && proposal.approvalId) {
    await runtime.store.appendUsageEvent({
      id: randomUUID(), tenantId: input.tenantId, kind: 'other', name: `tier.auto-approved:${input.actionKindLabel}`,
      actorId: 'approval-tiers', dataRefs: [proposal.approvalId],
      metadata: { title: input.title, tier: 'routine', reason: `"${input.actionKindLabel}" is on MICROFIXD_PREAUTHORIZED_ACTIONS.` },
      createdAt: new Date().toISOString(),
    });
    return { ...proposal, tier, autoApproved: true, notified: true };
  }

  const sms = await sendTwilioSms(`Microfixd [${tier}]: "${input.title}" needs your approval. Outcome: ${proposal.outcome}.${proposal.approvalId ? ` approvalId: ${proposal.approvalId}` : ''}`);
  await runtime.store.appendUsageEvent({
    id: randomUUID(), tenantId: input.tenantId, kind: 'other', name: `tier.pending-notification:${input.actionKindLabel}`,
    actorId: 'approval-tiers', dataRefs: proposal.approvalId ? [proposal.approvalId] : [],
    metadata: { title: input.title, tier, outcome: proposal.outcome, smsSent: sms.sent, smsError: sms.error },
    createdAt: new Date().toISOString(),
  });
  return { ...proposal, tier, autoApproved: false, notified: true };
}

export interface CriticalActionResult { status: 'ok' | 'rejected' | 'error'; action?: CriticalSafeAction; error?: string }

/**
 * The ONLY way to skip approval in this system. Takes an action name,
 * not free-form input -- rejects anything not in CRITICAL_SAFE_ACTIONS
 * by construction, so there's no argument-injection path to something
 * more dangerous. Requires systemCollapseConfirmed=true, which callers
 * must derive from a real signal (MetaAnalyzer.analyze().degraded with
 * a high anomalyScore), not from the action's own claim of urgency.
 */
export async function executeCriticalSafeAction(
  runtime: AutonomyRuntime,
  input: { tenantId: string; requestedBy: string; action: string; systemCollapseConfirmed: boolean; reason: string },
): Promise<CriticalActionResult> {
  if (!input.systemCollapseConfirmed) return { status: 'rejected', error: 'systemCollapseConfirmed must be true, derived from a real MetaAnalyzer signal -- not settable by request body alone in routes.ts.' };
  if (!(CRITICAL_SAFE_ACTIONS as readonly string[]).includes(input.action)) {
    return { status: 'rejected', error: `"${input.action}" is not in the closed CRITICAL_SAFE_ACTIONS list (${CRITICAL_SAFE_ACTIONS.join(', ')}). Nothing else may bypass approval.` };
  }

  try {
    if (input.action === 'activate-safe-mode') {
      await SafeModeControlPlane.set(runtime.store, true, input.requestedBy, `Critical-tier emergency activation: ${input.reason}`);
    }
    // 'halt-build-loop': the flag itself is the mechanism -- build-loop.ts
    // checks this before starting any new cycle (see build-loop.ts).
    if (input.action === 'halt-build-loop') {
      await runtime.store.appendUsageEvent({ id: randomUUID(), tenantId: input.tenantId, kind: 'other', name: 'build-loop.emergency-halt', actorId: input.requestedBy, dataRefs: [], metadata: { reason: input.reason }, createdAt: new Date().toISOString() });
    }
    await runtime.store.appendUsageEvent({
      id: randomUUID(), tenantId: input.tenantId, kind: 'other', name: `tier.critical-action-executed:${input.action}`,
      actorId: input.requestedBy, dataRefs: [], metadata: { reason: input.reason, requiresRetroactiveReview: true },
      createdAt: new Date().toISOString(),
    });
    await sendTwilioSms(`Microfixd CRITICAL: system-collapse confirmed, auto-executed "${input.action}". Reason: ${input.reason}. This requires your retroactive review.`);
    return { status: 'ok', action: input.action as CriticalSafeAction };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}
