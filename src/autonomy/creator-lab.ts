// src/autonomy/creator-lab.ts
//
// Per Craig's actual scope: doesn't need full isolation (a separate
// container/sandbox) -- it needs to be able to use every real
// capability the system already has (file writes with real reality-
// anchor + immutable-core checks, web automation, MCP, deployment,
// preview rebuilds), while keeping what gets BUILT here in its own
// directory, separate from Microfixd's own source. That's what this
// module does: it's a thin, real scoping layer over the existing
// file-writer.ts functions (which already have real safety checks
// built in) plus the existing GitHub functions (branch+PR to an
// existing repo, or a brand-new repo) -- not a parallel reimplementation
// of any of them.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFiles, deleteWorkspacePath, resolveSafe, type WriteFilesResult, type DeletePathResult } from './file-writer.ts';
import { proposeChangeAsPullRequest, createRepoAndPush, type PullRequestResult, type NewRepoResult } from './github-integration.ts';

export const CREATOR_LAB_ROOT = 'creator-lab';

export function slugifyProjectName(name: string): string {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) throw new Error(`"${name}" does not produce a usable project slug.`);
  return slug;
}

export interface CreatorLabProject { slug: string; }

/** Real listing of actual project directories under creator-lab/ -- not a fabricated catalog. */
export async function listCreatorLabProjects(): Promise<CreatorLabProject[]> {
  const rootCheck = resolveSafe(CREATOR_LAB_ROOT);
  if (!rootCheck.ok) return [];
  try {
    const entries = await readdir(rootCheck.absolute, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => ({ slug: e.name }));
  } catch {
    return []; // Directory doesn't exist yet -- no projects created, not an error.
  }
}

/** Real writes, scoped under creator-lab/<slug>/ -- reuses writeFiles() as-is, so the same real reality-anchor and immutable-core checks apply here too. */
export async function writeCreatorLabFiles(slug: string, files: Record<string, string>): Promise<WriteFilesResult> {
  const scoped: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) scoped[join(CREATOR_LAB_ROOT, slug, path)] = content;
  return writeFiles(scoped);
}

export async function deleteCreatorLabProject(slug: string): Promise<DeletePathResult> {
  return deleteWorkspacePath(join(CREATOR_LAB_ROOT, slug));
}

/** Real recursive read of every file in a project -- needed to build the file map GitHub submission requires. Skips node_modules/.git, the two directories a real generated project might actually contain that should never be pushed. */
async function readProjectFilesRecursive(absoluteDir: string, relativePrefix = ''): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  let entries;
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      Object.assign(result, await readProjectFilesRecursive(join(absoluteDir, entry.name), relPath));
    } else {
      try {
        result[relPath] = await readFile(join(absoluteDir, entry.name), 'utf8');
      } catch {
        // Real, honest skip for genuinely unreadable content (e.g.
        // binary files) rather than crashing the whole submission.
      }
    }
  }
  return result;
}

export type CreatorLabSubmission =
  | { mode: 'new-repo'; repoName: string; description?: string; private?: boolean; owner?: string }
  | { mode: 'branch-pr'; owner: string; repo: string; title: string; body: string; baseBranch?: string };

/** Real GitHub submission of an actual project's actual files -- reuses createRepoAndPush()/proposeChangeAsPullRequest() as-is, which already have real immutable-core and auth checks. This function's only job is gathering the real files and picking which of the two real paths to use. */
export async function submitCreatorLabProject(slug: string, submission: CreatorLabSubmission): Promise<PullRequestResult | NewRepoResult> {
  const dirCheck = resolveSafe(join(CREATOR_LAB_ROOT, slug));
  if (dirCheck.ok === false) throw new Error(dirCheck.error);
  const files = await readProjectFilesRecursive(dirCheck.absolute);
  if (Object.keys(files).length === 0) throw new Error(`Project "${slug}" has no files to submit -- write some files first.`);

  if (submission.mode === 'new-repo') {
    return createRepoAndPush(submission.repoName, files, { description: submission.description, private: submission.private, owner: submission.owner });
  }
  return proposeChangeAsPullRequest(submission.owner, submission.repo, files, { title: submission.title, body: submission.body, baseBranch: submission.baseBranch, branchPrefix: `creator-lab-${slug}` });
}
