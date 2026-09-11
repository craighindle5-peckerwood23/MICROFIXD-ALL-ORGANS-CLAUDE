import type { PlannedAction, RunRecord, StepRecord } from './types.ts';

const MAX_PLAN_STEPS = Number(process.env.MICROFIXD_MAX_PLAN_STEPS || 25);
const MAX_COMPLETED_STEPS = Number(process.env.MICROFIXD_MAX_COMPLETED_STEPS || 25);

export class ExecutionStabilizer {
  static assertPlan(plan: PlannedAction[]): void {
    if (plan.length === 0) throw new Error('Stability Organ rejected an empty plan.');
    if (plan.length > MAX_PLAN_STEPS) throw new Error(`Stability Organ rejected a plan over the ${MAX_PLAN_STEPS}-step limit.`);
    if (new Set(plan.map((step) => step.id)).size !== plan.length) throw new Error('Consistency Organ rejected a plan with duplicate step identities.');
  }

  static assertProgress(run: RunRecord, step: StepRecord): void {
    if (run.currentStep >= MAX_COMPLETED_STEPS) throw new Error(`Execution Stabilizer halted the run after ${MAX_COMPLETED_STEPS} completed steps.`);
    if (step.sequence < run.currentStep) throw new Error('Behavior-Drift Monitor rejected an attempt to replay an already-completed step.');
    if (run.status === 'cancelled' || run.status === 'failed') throw new Error('Execution Stabilizer rejected work on a terminal run.');
  }
}

export class DriftProtectionOrgans {
  static assertWithinBaseline(run: RunRecord, action: PlannedAction): void {
    const expected = run.plan.find((candidate) => candidate.id === action.id);
    if (!expected) throw new Error('Organ-Drift Monitor rejected an action absent from the approved run plan.');
    if (expected.kind !== action.kind || expected.risk !== action.risk) throw new Error('Reasoning-Drift Monitor rejected a mutated action outside its approved type or risk tier.');
  }

  static baseline(run: RunRecord): Record<string, unknown> {
    return { runId: run.id, plannedStepCount: run.plan.length, currentStep: run.currentStep, identity: 'Microfixd governed by Paragon Dissector Tier-0', constitutionVersion: '1.0.0' };
  }
}

export class RealityAnchoringOrgans {
  static qualify(result: Record<string, unknown>): Record<string, unknown> {
    const artifact = result.artifact as { validation?: { passed?: boolean; checks?: string[] } } | undefined;
    if (artifact) {
      return { ...result, evidence: { source: 'Sandbox Organ static validation', validationPassed: artifact.validation?.passed === true, checks: artifact.validation?.checks || [], certainty: artifact.validation?.passed ? 'validated candidate artifact' : 'candidate requires correction' } };
    }
    return { ...result, evidence: { source: 'Governed runtime procedure', certainty: 'bounded operation result; no external factual claim was inferred.' } };
  }

  static assertNoUnsupportedClaim(result: Record<string, unknown>): void {
    const text = JSON.stringify(result);
    if (/production deployed|secret rotated|payment completed|vehicle command executed/i.test(text)) {
      throw new Error('Hallucination Filter rejected an unsupported external-effect claim.');
    }
  }
}

export class NarrativeCoherenceOrgans {
  static summarize(run: RunRecord, steps: StepRecord[]): string {
    const completed = steps.filter((step) => step.status === 'succeeded').length;
    const blocked = steps.filter((step) => step.status === 'blocked').length;
    const denied = steps.filter((step) => step.status === 'denied').length;
    return `Run ${run.id} is ${run.status}: ${completed} completed, ${blocked} awaiting approval, and ${denied} denied steps. This chronology is derived from the durable run record and does not add unverified events.`;
  }
}
