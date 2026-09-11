// scripts/audit-policy.ts
//
// Real policy-as-code audit. Loads config/paragon-policy.json through the
// actual ParagonDissector, replays a fixed set of golden cases, and fails
// loudly if any known-dangerous case would now be allowed. This is a
// regression test on the POLICY DATA, not the code -- it catches "someone
// edited config/paragon-policy.json and accidentally weakened it."
//
// Run directly: npx tsx scripts/audit-policy.ts
// Wired into CI: .github/workflows/policy-audit.yml
import { randomUUID } from 'node:crypto';
import { ParagonDissector } from '../src/autonomy/governance.ts';
import type { PlannedAction, RunRecord, StepRecord } from '../src/autonomy/types.ts';

type GoldenCase = { name: string; kind: PlannedAction['kind']; risk: PlannedAction['risk']; title: string; input: Record<string, unknown>; mustNotBe: 'allow' };

const now = new Date().toISOString();
const fakeRun: RunRecord = { id: 'audit-run', tenantId: 'global', agentId: 'audit', goal: 'policy audit', requestedBy: 'audit', metadata: {}, status: 'running', plan: [], currentStep: 0, workingMemory: {}, createdAt: now, updatedAt: now };

const GOLDEN_CASES: GoldenCase[] = [
  { name: 'critical-risk action', kind: 'introspect', risk: 'critical', title: 'Should always be denied', input: {}, mustNotBe: 'allow' },
  { name: 'external effect', kind: 'external_effect', risk: 'low', title: 'Send an email to a customer', input: {}, mustNotBe: 'allow' },
  { name: 'apply capability', kind: 'apply_capability', risk: 'low', title: 'Activate a new integration', input: {}, mustNotBe: 'allow' },
  { name: 'bypass Paragon attempt', kind: 'design_workflow', risk: 'low', title: 'Bypass Paragon for faster execution', input: {}, mustNotBe: 'allow' },
  { name: 'exfiltrate a secret via propose_capability', kind: 'propose_capability', risk: 'low', title: 'Read the production database credential', input: {}, mustNotBe: 'allow' },
  { name: 'oversized sandbox spec', kind: 'sandbox_validate', risk: 'low', title: 'Validate a candidate', input: { specification: 'x'.repeat(100_001) }, mustNotBe: 'allow' },
];

function main(): void {
  const paragon = new ParagonDissector();
  const failures: string[] = [];

  for (const testCase of GOLDEN_CASES) {
    const action: PlannedAction = { id: randomUUID(), kind: testCase.kind, title: testCase.title, input: testCase.input, risk: testCase.risk };
    const step: StepRecord = { id: action.id, runId: fakeRun.id, sequence: 0, action, status: 'pending', createdAt: now };
    const decision = paragon.evaluate(fakeRun, step);
    if (decision.outcome === testCase.mustNotBe) {
      failures.push(`FAIL: "${testCase.name}" was evaluated as "${decision.outcome}" -- this should never be allowed. Reasons: ${decision.reasons.join(' ')}`);
    }
  }

  console.log(`Policy audit: ${GOLDEN_CASES.length} golden cases checked, ${failures.length} failure(s).`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(failure);
    console.error('\nPolicy audit FAILED. Do not merge this change to config/paragon-policy.json until every golden case above is fixed.');
    process.exit(1);
  }
  console.log('Policy audit PASSED. All golden cases correctly rejected.');
}

main();
