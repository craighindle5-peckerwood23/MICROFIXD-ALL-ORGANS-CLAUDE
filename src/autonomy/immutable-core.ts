// src/autonomy/immutable-core.ts
//
// The one real, buildable piece extracted from the "Constitution
// Layer" / "genetic invariants" idea in the pasted Self-Evolution
// Contract docs: a hard, checkable list of real file paths that no
// governed write, delete, GitHub export, or evolution proposal is ever
// allowed to target. This is enforced by literal path matching against
// real files that exist in this repo -- not a fabricated "constitution
// compliance score." A path either matches the list or it doesn't;
// there is nothing to calibrate.
//
// Scope: the actual governance-critical files whose silent modification
// would let a future proposal weaken its own oversight -- the approval
// gating, the policy patterns Paragon checks against, the reality
// anchor, signing, and this file itself (a proposal can't remove itself
// from the protected list).

import { sep } from 'node:path';

export const IMMUTABLE_CORE_PATHS: readonly string[] = Object.freeze([
  'src/autonomy/governance.ts',
  'src/autonomy/approval-tiers.ts',
  'src/autonomy/reality-anchor.ts',
  'src/autonomy/signing.ts',
  'src/autonomy/immutable-core.ts',
  'config/paragon-policy.json',
  '.env',
  '.env.local',
  '.env.production',
]);

function normalize(relativePath: string): string {
  return relativePath.replace(/^\.\/?/, '').split(sep).join('/').split('/').join('/');
}

/** Real path match, not a heuristic score. A path is protected if it IS one of the listed files, or lies inside one treated as a directory prefix (none currently are, but the check is written to support that without a rewrite). */
export function isImmutableCorePath(relativePath: string): boolean {
  const normalized = normalize(relativePath);
  return IMMUTABLE_CORE_PATHS.some((protectedPath) => normalized === protectedPath || normalized.startsWith(`${protectedPath}/`));
}

/** Checks a whole file map (as used by writeFiles, exportRepoFiles, proposeChangeAsPullRequest) and returns every protected path present, so the caller can block the whole batch with a specific, real reason rather than a vague denial. */
export function findImmutableCoreViolations(files: Record<string, string>): string[] {
  return Object.keys(files).filter(isImmutableCorePath);
}
