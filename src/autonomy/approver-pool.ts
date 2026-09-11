// src/autonomy/approver-pool.ts
//
// A policy-driven, git-tracked list of who is eligible to approve a
// governed action, loaded from config/approver-pool.json. There is
// deliberately no runtime API to add an identity to this pool -- changing
// who can approve requires a reviewed change to a file in the repo.
//
// Deliberately NOT cached: decideApproval() is a rare, human-paced call,
// not a hot path, and caching this file created a real bug during
// testing -- a pool populated after the process started would never be
// picked up without a restart. Re-reading a small JSON file on each
// approval decision is negligible cost for a real correctness guarantee.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let warned = false;

export function getApproverPool(): string[] {
  try {
    const raw = readFileSync(resolve(process.cwd(), 'config/approver-pool.json'), 'utf8');
    const parsed = JSON.parse(raw) as { approvers?: string[] };
    return Array.isArray(parsed.approvers) ? parsed.approvers.map((a) => String(a).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function isPoolConfigured(): boolean {
  return getApproverPool().length > 0;
}

export function warnIfPoolUnconfiguredOnce(): void {
  if (!isPoolConfigured() && !warned) {
    warned = true;
    console.warn(
      '[approver-pool] config/approver-pool.json has no approvers configured. ' +
      'Falling back to single-decision approval (one call to decideApproval(true) finalizes immediately). ' +
      'Add real identities via a reviewed change to require two distinct approvers.',
    );
  }
}
