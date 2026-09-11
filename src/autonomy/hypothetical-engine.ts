// src/autonomy/hypothetical-engine.ts
//
// The real Hypothetical Organ: genuinely different from repair_proposal
// and evolution_assessment, which are both meant as durable, reviewable
// commitments. This is deliberately the opposite -- pure exploration,
// "what would actually happen if," with no durable record created at
// all. It reuses the exact same real checks everything else in this
// codebase uses (reality-anchor's fabrication patterns, Paragon's
// forbidden/high-risk term patterns, real sandbox execution) so a
// hypothetical answer is grounded in the same real signals a real
// proposal would be -- it's just never written down as a proposal,
// because "what if" isn't a request to act.

import { checkGeneratedFiles } from './reality-anchor.ts';
import { loadPolicyPatterns } from './governance.ts';
import type { Sandbox } from './types.ts';

export interface HypotheticalResult {
  description: string;
  staticFindings: string[];
  execution: { attempted: boolean; exitCode: number | null; timedOut: boolean; stdout: string; stderr: string } | null;
  wouldPassRealValidation: boolean;
  reasoning: string;
}

/**
 * Real exploration: actually runs the specification through the real
 * sandbox (static validation + genuine execution if that passes), and
 * reports real, honest findings -- never a durable Level6Record. If the
 * person wants this turned into an actual proposal after seeing the
 * result, that's a separate, explicit call to RepairControlPlane or
 * EvolutionControlPlane, not something this function does implicitly.
 */
export async function runHypothetical(sandbox: Sandbox, description: string, specification: string): Promise<HypotheticalResult> {
  const artifact = await sandbox.validateCapability(`hypothetical: ${description.slice(0, 80)}`, specification);
  const realityFindings = checkGeneratedFiles({ [`${description}.hypothetical.ts`]: specification });
  const { forbiddenTerms, highRiskTerms } = loadPolicyPatterns();
  const policyHits: string[] = [];
  if (forbiddenTerms.test(specification)) policyHits.push('Matches a Paragon forbidden-term pattern -- this would be denied outright as a real proposal, not just flagged for review.');
  if (highRiskTerms.test(specification)) policyHits.push('Matches a Paragon high-risk-term pattern -- this would require review as a real proposal.');
  const staticFindings = [...realityFindings.filter((f) => f.severity === 'high').map((f) => `Reality-anchor: ${f.issue} (line ${f.line})`), ...policyHits];

  let execution: HypotheticalResult['execution'] = null;
  if (artifact.validation.passed && staticFindings.length === 0) {
    try {
      const result = await sandbox.execute(artifact.relativePath, 8_000);
      execution = { attempted: true, exitCode: result.exitCode, timedOut: result.timedOut, stdout: result.stdout.slice(0, 1_000), stderr: result.stderr.slice(0, 1_000) };
    } catch (err) {
      execution = { attempted: true, exitCode: null, timedOut: false, stdout: '', stderr: err instanceof Error ? err.message : String(err) };
    }
  }

  const wouldPassRealValidation = artifact.validation.passed && staticFindings.length === 0 && (execution === null || (execution.exitCode === 0 && !execution.timedOut));
  const reasoning = !artifact.validation.passed
    ? `Static validation failed: ${artifact.validation.checks?.join('; ') || 'unspecified'}.`
    : staticFindings.length > 0
      ? `Static validation passed, but real structural checks found: ${staticFindings.join('; ')}`
      : execution
        ? execution.exitCode === 0 && !execution.timedOut
          ? 'Passed static validation and actually ran successfully -- if proposed for real, this would likely reach sandbox-validated status.'
          : `Passed static checks but genuinely failed at runtime (exit ${execution.exitCode}${execution.timedOut ? ', timed out' : ''}) -- if proposed for real, this would be forced to sandbox-review-required.`
        : 'Passed static checks; execution was not attempted.';

  return { description, staticFindings, execution, wouldPassRealValidation, reasoning };
}
