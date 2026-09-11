// src/autonomy/file-writer.ts
//
// Real filesystem writer -- the missing piece flagged at the end of
// the last turn: generate.ts only ever returned file content, never
// applied it. This actually writes, with the same governance
// requirement as every other write path (GitHub export, sandbox
// execution): the CALLER must have already run this through
// propose -> approve -> consumeApprovalOnce in routes.ts. This module
// itself doesn't check for an approval, matching the separation
// already used in github-integration.ts and browser-automation.ts.
//
// Real safety property this actually enforces (not just documents):
// every path is resolved and checked against WORKSPACE_ROOT before any
// write, create, or delete -- rejects '..' traversal and absolute
// paths outside the workspace. A generated file named
// "../../../etc/passwd" gets rejected here, not silently written.

import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, relative } from 'node:path';
import { checkGeneratedFiles, type RealityAnchorFinding } from './reality-anchor.ts';
import { findImmutableCoreViolations } from './immutable-core.ts';

const WORKSPACE_ROOT = process.env.MICROFIXD_WORKSPACE_ROOT || process.cwd();

export function resolveSafe(relativePath: string): { ok: true; absolute: string } | { ok: false; error: string } {
  if (isAbsolute(relativePath)) return { ok: false as const, error: `Absolute paths are not allowed: "${relativePath}". Provide a path relative to the workspace root.` };
  const absolute = normalize(join(WORKSPACE_ROOT, relativePath));
  const rel = relative(WORKSPACE_ROOT, absolute);
  if (rel.startsWith('..') || isAbsolute(rel)) return { ok: false as const, error: `"${relativePath}" resolves outside the workspace root. Path traversal is rejected.` };
  return { ok: true as const, absolute };
}

export interface WriteFilesResult {
  status: 'ok' | 'error' | 'blocked';
  written?: string[];
  realityAnchorFindings?: RealityAnchorFinding[];
  error?: string;
}

/**
 * Writes multiple files atomically-ish: checks every path FIRST, then
 * runs the reality-anchor check across the whole batch, and only
 * writes if nothing is blocked. If any path fails the safety check or
 * a high-severity reality-anchor finding is present, nothing is
 * written -- never a partial write of an unsafe/fabricated batch.
 */
export async function writeFiles(files: Record<string, string>, options: { skipRealityAnchor?: boolean } = {}): Promise<WriteFilesResult> {
  // Real, hard block -- not skippable by skipRealityAnchor, since this
  // isn't a fabrication heuristic that can have false positives; it's a
  // literal path match against real governance-critical files.
  const immutableViolations = findImmutableCoreViolations(files);
  if (immutableViolations.length > 0) {
    return { status: 'blocked', error: `Refused: ${immutableViolations.length} target path(s) are on the immutable core list and can never be written by a governed action: ${immutableViolations.join(', ')}.` };
  }

  const resolved: Array<{ relativePath: string; absolute: string }> = [];
  for (const relativePath of Object.keys(files)) {
    const result: { ok: true; absolute: string } | { ok: false; error: string } = resolveSafe(relativePath);
    if (result.ok === false) return { status: 'blocked', error: result.error };
    resolved.push({ relativePath, absolute: result.absolute });
  }

  let findings: RealityAnchorFinding[] = [];
  if (!options.skipRealityAnchor) {
    findings = checkGeneratedFiles(files);
    const highSeverity = findings.filter((f) => f.severity === 'high');
    if (highSeverity.length > 0) {
      return { status: 'blocked', realityAnchorFindings: findings, error: `${highSeverity.length} high-severity reality-anchor finding(s) -- nothing written. Review the findings, fix the source, or call again with skipRealityAnchor:true if this is a deliberate false positive.` };
    }
  }

  try {
    for (const { absolute } of resolved) await mkdir(dirname(absolute), { recursive: true });
    for (const { relativePath, absolute } of resolved) await writeFile(absolute, files[relativePath], 'utf-8');
    return { status: 'ok', written: resolved.map((r) => r.relativePath), realityAnchorFindings: findings };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export interface ReadFileResult { status: 'ok' | 'error'; content?: string; error?: string }

/** Real read, ungated (matches importRepoFile's read/no-side-effect exemption in github-integration.ts). */
export async function readWorkspaceFile(relativePath: string): Promise<ReadFileResult> {
  const result: { ok: true; absolute: string } | { ok: false; error: string } = resolveSafe(relativePath);
  if (result.ok === false) return { status: 'error', error: result.error };
  try {
    return { status: 'ok', content: await readFile(result.absolute, 'utf-8') };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export interface ListDirectoryResult { status: 'ok' | 'error'; entries?: Array<{ name: string; type: 'file' | 'directory' }>; error?: string }

export async function listWorkspaceDirectory(relativePath: string): Promise<ListDirectoryResult> {
  const result: { ok: true; absolute: string } | { ok: false; error: string } = resolveSafe(relativePath);
  if (result.ok === false) return { status: 'error', error: result.error };
  try {
    const entries = await readdir(result.absolute, { withFileTypes: true });
    return { status: 'ok', entries: entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 'directory' as const : 'file' as const })) };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export interface DeletePathResult { status: 'ok' | 'error' | 'blocked'; error?: string }

/** Deletion is the highest-risk filesystem operation here -- refuses to delete the workspace root itself or anything that isn't clearly inside it (resolveSafe already covers the latter). Caller (routes.ts) must still gate this behind approval like every other destructive action. */
export async function deleteWorkspacePath(relativePath: string): Promise<DeletePathResult> {
  if (relativePath === '' || relativePath === '.' || relativePath === '/') return { status: 'blocked', error: 'Refusing to delete the workspace root.' };
  if (findImmutableCoreViolations({ [relativePath]: '' }).length > 0) return { status: 'blocked', error: `Refused: "${relativePath}" is on the immutable core list and can never be deleted by a governed action.` };
  const result: { ok: true; absolute: string } | { ok: false; error: string } = resolveSafe(relativePath);
  if (result.ok === false) return { status: 'blocked', error: result.error };
  try {
    const s = await stat(result.absolute);
    await rm(result.absolute, { recursive: s.isDirectory() });
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

/** Scaffolding: a named directory structure with starter files, built from a plain map (no template-string magic) so callers can compose it with generate.ts output before calling writeFiles(). */
export function buildScaffold(basePath: string, structure: Record<string, string>): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [relPath, content] of Object.entries(structure)) files[join(basePath, relPath)] = content;
  return files;
}
