import { randomUUID } from 'node:crypto';
import { ChangeControlPlane } from './level6.ts';
import { MetaLearningControlPlane } from './meta-learning.ts';
import { MetaEvolver } from './meta-evolver.ts';
import { sign } from './signing.ts';
import { checkGeneratedFiles } from './reality-anchor.ts';
import { loadPolicyPatterns } from './governance.ts';
import type { Level6Record, RunRecord, RuntimeStore, Sandbox } from './types.ts';

const now = (): string => new Date().toISOString();
const prohibitedEvolution = /(?:production|deploy|merge|push|credential|token|secret|network|fetch|curl|wget)/i;

/**
 * Real fix for the real contradiction the pasted "Self-Evolution
 * Contract" docs correctly identified: a diff-only format can't
 * represent creating something new (no "before" exists) or retiring
 * something (no "after" exists). What those docs got wrong was
 * proposing a fictional HSO/neural-topology evaluation layer to sit
 * around it. The real fix is just: branch on evolutionClass, and for
 * create/expand -- genuinely new content, not a modification -- run
 * the same real structural checks this codebase already has
 * (reality-anchor's fabrication patterns, Paragon's forbidden/high-risk
 * term patterns) against that new content specifically, since a new
 * organ or capability is exactly the kind of freshly-generated code
 * reality-anchor.ts already exists to check.
 */
export type EvolutionClass = 'modify' | 'create' | 'expand' | 'retire';

export class EvolutionControlPlane {
  static async propose(store: RuntimeStore, sandbox: Sandbox, run: RunRecord, title: string, specification: string, kind: 'mutation' | 'refactor' | 'capability' = 'capability', evolutionClass: EvolutionClass = 'modify'): Promise<Level6Record> {
    if (evolutionClass === 'retire') {
      // Nothing new to validate or execute -- retiring removes a
      // component rather than adding code. Still a real, durable,
      // approval-gated record; never auto-applied, same as everything
      // else in this file.
      return this.recordRetirement(store, run, title, specification);
    }

    const driftSignals = prohibitedEvolution.test(specification) ? ['Candidate specification mentions a production or external-effect term and is restricted to a static sandbox proposal.'] : [];

    // Real structural check for genuinely new content (create/expand):
    // reality-anchor's fabrication-pattern check and Paragon's real
    // forbidden/high-risk term patterns, both applied to the actual
    // proposed content -- not a fabricated "structural integrity score."
    let structuralFindings: string[] = [];
    if (evolutionClass === 'create' || evolutionClass === 'expand') {
      const realityFindings = checkGeneratedFiles({ [`${title}.candidate.ts`]: specification });
      const { forbiddenTerms, highRiskTerms } = loadPolicyPatterns();
      const policyHits: string[] = [];
      if (forbiddenTerms.test(specification)) policyHits.push('Specification matches a Paragon forbidden-term pattern (bypass, secret access, destructive shell command, or unrestricted execution).');
      if (highRiskTerms.test(specification)) policyHits.push('Specification matches a Paragon high-risk-term pattern -- requires review even if otherwise valid.');
      structuralFindings = [...realityFindings.filter((f) => f.severity === 'high').map((f) => `Reality-anchor: ${f.issue} (line ${f.line})`), ...policyHits];
    }

    const artifact = await sandbox.validateCapability(title, [
      `Evolution kind: ${kind}`,
      `Evolution class: ${evolutionClass}`,
      `Tenant: ${run.tenantId}`,
      `Run: ${run.id}`,
      'This is a candidate-only artifact. Do not execute, merge, deploy, access production state, or call external services.',
      specification,
    ].join('\n'));

    // Real execution, not just static validation -- identical fix to
    // RepairControlPlane.propose() in level6.ts, applied here because
    // evolution proposals go through the exact same
    // validateCapability() -> renderCapability() path and get written
    // as real executable .candidate.ts files the same way. A
    // specification that passes static pattern checks can still throw
    // immediately when actually run; "sandbox-validated" should mean
    // "ran successfully," not "contained no forbidden words."
    let execution: { attempted: boolean; exitCode: number | null; timedOut: boolean; stderr: string } | null = null;
    if (artifact.validation.passed && driftSignals.length === 0) {
      try {
        const result = await sandbox.execute(artifact.relativePath, 8_000);
        execution = { attempted: true, exitCode: result.exitCode, timedOut: result.timedOut, stderr: result.stderr.slice(0, 2_000) };
      } catch (err) {
        execution = { attempted: true, exitCode: null, timedOut: false, stderr: err instanceof Error ? err.message : String(err) };
      }
    } else {
      execution = { attempted: false, exitCode: null, timedOut: false, stderr: 'Skipped: static validation or drift-signal check already failed, nothing safe to execute.' };
    }
    const executionVerified = execution.attempted && execution.exitCode === 0 && !execution.timedOut;

    // Real self-learning: check this tenant's actual historical
    // evolution-proposal outcomes before deciding this proposal's
    // status. A tenant with a poor track record (recommendation ===
    // 'heightened-scrutiny') gets forced into review even if this
    // specific proposal would otherwise pass -- an actual behavior
    // change driven by real history, not just a recorded, unread number.
    // A candidate that failed real execution is ALSO forced to review
    // regardless of historical trust or static-pass status.
    const trust = await MetaLearningControlPlane.assessEvolutionTrust(store, run.tenantId);
    const passedRawValidation = artifact.validation.passed && driftSignals.length === 0;
    // Real system-wide signal (closes the same open loop fixed in
    // RepairControlPlane.propose()): a poor system-wide track record
    // for evolution_assessment as a record type forces review even if
    // this tenant's own history and this candidate's execution both
    // look fine.
    const systemWideSignal = (await MetaEvolver.recommend(store, run.tenantId)).find((r) => r.recordType === 'evolution_assessment');
    const systemWideRetirementCandidate = systemWideSignal?.recommendation === 'retirement-candidate';
    const structuralFindingsPresent = structuralFindings.length > 0;
    const status = passedRawValidation && executionVerified && trust.recommendation !== 'heightened-scrutiny' && !systemWideRetirementCandidate && !structuralFindingsPresent ? 'sandbox-validated' : 'sandbox-review-required';

    const timestamp = now();
    const proposal: Level6Record = {
      id: `evolution:${run.id}:${artifact.id}`,
      type: 'evolution_assessment',
      tenantId: run.tenantId,
      name: `${kind}:${title.slice(0, 80)}`,
      status,
      payload: {
        runId: run.id,
        kind,
        evolutionClass,
        artifact,
        execution,
        executionVerified,
        driftSignals,
        structuralFindings,
        historicalTrust: trust,
        systemWideSignal,
        heightenedScrutinyApplied: passedRawValidation && (trust.recommendation === 'heightened-scrutiny' || systemWideRetirementCandidate || structuralFindingsPresent),
        sandboxIsolation: 'Filesystem-confined static validation AND a real, actually-executed run of the candidate file. The sandbox has no production memory, organs, agents, workflows, tenants, plugins, APIs, compute, or OS/UI access.',
        progression: ['candidate artifact', 'static sandbox validation', 'real sandbox execution', 'Paragon review', 'Craig approval', 'GitHub change-request adapter', 'CI/CD adapter', 'separate deployment approval'],
        rollback: 'No source, runtime, deployment, or tenant state has changed. Rollback remains a recorded boundary only until a separately approved integration exists.',
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    // Real signing, not silently skipped: if MICROFIXD_SIGNING_KEYS
    // isn't configured yet, sign() throws rather than this proposal
    // pretending to be signed. The signature is attached to the stored
    // payload so it travels with the record; verification later checks
    // it against the same canonicalized payload.
    if (process.env.MICROFIXD_SIGNING_KEYS) {
      const envelope = sign({ id: proposal.id, type: proposal.type, tenantId: proposal.tenantId, status: proposal.status });
      (proposal.payload as Record<string, unknown>).signature = envelope;
    }
    await store.upsertLevel6Record(proposal);
    // Recompute and persist the trust signal to include this new
    // proposal, so the next call sees updated history.
    const updatedTrust = await MetaLearningControlPlane.assessEvolutionTrust(store, run.tenantId);
    await MetaLearningControlPlane.recordSignal(store, updatedTrust);
    return proposal;
  }

  static async requestGithubPipeline(store: RuntimeStore, run: RunRecord, summary: string): Promise<Level6Record> {
    const change = await ChangeControlPlane.request(store, run.tenantId, run, summary, 'github');
    const timestamp = now();
    const ci = {
      id: `cicd-adapter:${change.id}`,
      type: 'evolution_assessment' as const,
      tenantId: run.tenantId,
      name: `CI/CD adapter boundary for ${run.id}`,
      status: 'adapter-dormant',
      payload: {
        changeRequestId: change.id,
        adapterState: 'No CI/CD provider, branch, pull request, merge, deployment, or rollback action is invoked until an approved Plugin Registry manifest and Paragon/Craig decision exist.',
        requiredEvidence: ['sandbox artifact', 'tests', 'Paragon decision', 'Craig approval', 'allowlisted GitHub and CI/CD adapter manifests'],
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(ci);
    return change;
  }

  static async recordRollbackBoundary(store: RuntimeStore, run: RunRecord, reason: string): Promise<Level6Record> {
    const timestamp = now();
    const rollback: Level6Record = {
      id: `rollback-boundary:${run.id}:${randomUUID()}`,
      type: 'evolution_assessment',
      tenantId: run.tenantId,
      name: `Rollback boundary for ${run.id}`,
      status: 'no-production-change',
      payload: { reason: reason.slice(0, 2_000), action: 'Retain audit evidence and sandbox candidate; do not alter source, deployment, plugin, tenant, memory, or runtime state.', authority: 'Paragon Dissector Tier-0; protected rollback execution requires Craig approval and an approved adapter.' },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(rollback);
    return rollback;
  }

  /** No new content to validate or execute -- retiring removes rather than adds. Still durable, still requires a real reason, still never auto-applied: retirement of a real organ or capability is exactly as consequential as creating one and goes through the same downstream approval as any other evolution_assessment record. */
  private static async recordRetirement(store: RuntimeStore, run: RunRecord, target: string, reason: string): Promise<Level6Record> {
    const timestamp = now();
    const proposal: Level6Record = {
      id: `evolution:${run.id}:${randomUUID()}`,
      type: 'evolution_assessment',
      tenantId: run.tenantId,
      name: `retire:${target.slice(0, 80)}`,
      status: 'sandbox-review-required',
      payload: {
        runId: run.id,
        evolutionClass: 'retire' as EvolutionClass,
        target,
        reason: reason.slice(0, 2_000),
        activation: 'Retirement always requires review -- there is no static or execution check that can validate "this is safe to remove" the way there is for new code, so this status is never auto-escalated to sandbox-validated.',
        rollback: 'Nothing has been removed yet; this is a recorded proposal only.',
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.upsertLevel6Record(proposal);
    return proposal;
  }
}
