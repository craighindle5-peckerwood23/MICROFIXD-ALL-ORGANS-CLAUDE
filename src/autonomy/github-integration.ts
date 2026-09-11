// src/autonomy/github-integration.ts
//
// Real GitHub Contents API integration -- plain fetch, no new dependency.
// Confirmed reachable: api.github.com is on the allowed network list and
// returns real responses (rate-limited without a token, which is
// expected and resolved by setting GITHUB_TOKEN in production).
//
// Import (read) is safe and ungated -- reading a public or
// token-accessible file has no side effect. Export (write) is a real
// commit to a real repository and is ALWAYS gated as an 'external_effect'
// through governed-execution.ts, exactly like sandbox execution and
// browser automation -- propose, get a real approval, consume it once,
// then and only then write.

export type GitHubFile = { path: string; content: string; sha?: string; encoding: 'utf-8' };

export type FetchLike = typeof fetch;

import { findImmutableCoreViolations } from './immutable-core.ts';

export function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return token ? { Authorization: `Bearer ${token}`, 'User-Agent': 'Microfixd' } : { 'User-Agent': 'Microfixd' };
}

/** Real, safe, ungated read. No approval required -- reading has no side effect. */
export async function importRepoFile(owner: string, repo: string, path: string, ref?: string, fetchImpl: FetchLike = fetch): Promise<GitHubFile> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`;
  const response = await fetchImpl(url, { headers: { Accept: 'application/vnd.github.v3+json', ...authHeaders() } });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub import failed (HTTP ${response.status}): ${body.slice(0, 500)}`);
  }
  const data = (await response.json()) as { content: string; encoding: string; sha: string };
  const content = data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf-8') : data.content;
  return { path, content, sha: data.sha, encoding: 'utf-8' };
}

/**
 * Real write. Callers MUST have already run this through
 * governed-execution.ts's propose -> approve -> consumeApprovalOnce
 * cycle before calling this -- this function itself does not check for
 * an approval; routes.ts is responsible for that, the same separation
 * used for sandbox execution and browser automation.
 */
export async function exportRepoFile(
  owner: string, repo: string, path: string, content: string, message: string, branch = 'main', fetchImpl: FetchLike = fetch,
): Promise<{ commitSha: string }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required for real GitHub exports -- never accepted from the request body.');

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  let existingSha: string | undefined;
  const existing = await fetchImpl(`${url}?ref=${encodeURIComponent(branch)}`, { headers: { Accept: 'application/vnd.github.v3+json', ...authHeaders() } });
  if (existing.ok) {
    const existingData = (await existing.json()) as { sha: string };
    existingSha = existingData.sha;
  }

  const response = await fetchImpl(url, {
    method: 'PUT',
    headers: { Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ message, content: Buffer.from(content, 'utf-8').toString('base64'), branch, sha: existingSha }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub export failed (HTTP ${response.status}): ${body.slice(0, 500)}`);
  }
  const data = (await response.json()) as { commit: { sha: string } };
  return { commitSha: data.commit.sha };
}

/**
 * Real batch commit via the Git Data API (blobs -> tree -> commit -> ref
 * update) -- one atomic commit for many files, unlike calling
 * exportRepoFile() in a loop which would create one commit per file and
 * can leave a repo in a half-pushed state if it fails partway through.
 * Same governance requirement as exportRepoFile: caller must have
 * already run this through the propose -> approve -> consumeApprovalOnce
 * cycle.
 */
export async function exportRepoFiles(
  owner: string, repo: string, files: Record<string, string>, message: string, branch = 'main', fetchImpl: FetchLike = fetch,
): Promise<{ commitSha: string; fileCount: number }> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required for real GitHub exports -- never accepted from the request body.');
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = { Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json', ...authHeaders() };

  const refResponse = await fetchImpl(`${base}/git/ref/heads/${encodeURIComponent(branch)}`, { headers });
  if (!refResponse.ok) throw new Error(`Could not resolve branch "${branch}" (HTTP ${refResponse.status}): ${(await refResponse.text()).slice(0, 300)}`);
  const refData = (await refResponse.json()) as { object: { sha: string } };
  const baseCommitSha = refData.object.sha;

  const commitResponse = await fetchImpl(`${base}/git/commits/${baseCommitSha}`, { headers });
  if (!commitResponse.ok) throw new Error(`Could not read base commit (HTTP ${commitResponse.status}).`);
  const baseCommit = (await commitResponse.json()) as { tree: { sha: string } };

  const blobShas: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    const blobResponse = await fetchImpl(`${base}/git/blobs`, { method: 'POST', headers, body: JSON.stringify({ content: Buffer.from(content, 'utf-8').toString('base64'), encoding: 'base64' }) });
    if (!blobResponse.ok) throw new Error(`Blob creation failed for "${path}" (HTTP ${blobResponse.status}): ${(await blobResponse.text()).slice(0, 300)}`);
    const blobData = (await blobResponse.json()) as { sha: string };
    blobShas[path] = blobData.sha;
  }

  const treeResponse = await fetchImpl(`${base}/git/trees`, {
    method: 'POST', headers,
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: Object.entries(blobShas).map(([path, sha]) => ({ path, mode: '100644', type: 'blob', sha })) }),
  });
  if (!treeResponse.ok) throw new Error(`Tree creation failed (HTTP ${treeResponse.status}): ${(await treeResponse.text()).slice(0, 300)}`);
  const treeData = (await treeResponse.json()) as { sha: string };

  const newCommitResponse = await fetchImpl(`${base}/git/commits`, { method: 'POST', headers, body: JSON.stringify({ message, tree: treeData.sha, parents: [baseCommitSha] }) });
  if (!newCommitResponse.ok) throw new Error(`Commit creation failed (HTTP ${newCommitResponse.status}): ${(await newCommitResponse.text()).slice(0, 300)}`);
  const newCommitData = (await newCommitResponse.json()) as { sha: string };

  const updateRefResponse = await fetchImpl(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', headers, body: JSON.stringify({ sha: newCommitData.sha }) });
  if (!updateRefResponse.ok) throw new Error(`Ref update failed (HTTP ${updateRefResponse.status}): ${(await updateRefResponse.text()).slice(0, 300)}`);

  return { commitSha: newCommitData.sha, fileCount: Object.keys(files).length };
}

export interface PullRequestResult {
  branchName: string;
  commitSha: string;
  fileCount: number;
  pullRequestUrl: string;
  pullRequestNumber: number;
}

/**
 * The real fix for the gap LEVEL6_GAP_ANALYSIS.md calls out: exportRepoFiles()
 * above will happily commit straight to whatever branch it's given, and every
 * caller in this codebase defaulted that to 'main' -- meaning a repair or
 * evolution change request could reach main with zero PR review. This
 * function is the actual governed path: it always creates a NEW branch off
 * the base, commits there (reusing exportRepoFiles' real blob/tree/commit
 * logic against that new branch, not main), and opens a real GitHub Pull
 * Request via the Pulls API. Nothing calling this can land on the base
 * branch directly -- merging the PR is a separate, human-controlled action
 * on GitHub, exactly the "creating a real pull request... remain protected
 * actions" boundary the doc specifies.
 */
export async function proposeChangeAsPullRequest(
  owner: string, repo: string, files: Record<string, string>, opts: { title: string; body: string; baseBranch?: string; branchPrefix?: string }, fetchImpl: FetchLike = fetch,
): Promise<PullRequestResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required for real GitHub exports -- never accepted from the request body.');
  const immutableViolations = findImmutableCoreViolations(files);
  if (immutableViolations.length > 0) throw new Error(`Refused: ${immutableViolations.length} target path(s) are on the immutable core list and can never be modified by a governed change request: ${immutableViolations.join(', ')}.`);
  const baseBranch = opts.baseBranch || 'main';
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = { Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json', ...authHeaders() };

  const baseRefResponse = await fetchImpl(`${base}/git/ref/heads/${encodeURIComponent(baseBranch)}`, { headers });
  if (!baseRefResponse.ok) throw new Error(`Could not resolve base branch "${baseBranch}" (HTTP ${baseRefResponse.status}): ${(await baseRefResponse.text()).slice(0, 300)}`);
  const baseRefData = (await baseRefResponse.json()) as { object: { sha: string } };

  const branchName = `${opts.branchPrefix || 'microfixd-change'}/${Date.now()}`;
  const createRefResponse = await fetchImpl(`${base}/git/refs`, { method: 'POST', headers, body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseRefData.object.sha }) });
  if (!createRefResponse.ok) throw new Error(`Branch creation failed for "${branchName}" (HTTP ${createRefResponse.status}): ${(await createRefResponse.text()).slice(0, 300)}`);

  const commitResult = await exportRepoFiles(owner, repo, files, opts.title, branchName, fetchImpl);

  const prResponse = await fetchImpl(`${base}/pulls`, { method: 'POST', headers, body: JSON.stringify({ title: opts.title, body: opts.body, head: branchName, base: baseBranch }) });
  if (!prResponse.ok) throw new Error(`Pull request creation failed (HTTP ${prResponse.status}): ${(await prResponse.text()).slice(0, 300)}`);
  const prData = (await prResponse.json()) as { html_url: string; number: number };

  return { branchName, commitSha: commitResult.commitSha, fileCount: commitResult.fileCount, pullRequestUrl: prData.html_url, pullRequestNumber: prData.number };
}

export interface NewRepoResult {
  repoUrl: string;
  owner: string;
  repo: string;
  commitSha: string;
  fileCount: number;
}

/**
 * Real, new capability: creates a brand-new GitHub repository (with
 * auto_init so it has a real initial commit to build on top of, rather
 * than the empty-repo edge case exportRepoFiles isn't designed for),
 * then pushes the actual project content using the same real, already-
 * tested exportRepoFiles commit logic. This is the "new repo" half of
 * Creator Lab's GitHub submission -- the "existing repo, new branch"
 * half already existed via proposeChangeAsPullRequest.
 */
export async function createRepoAndPush(repoName: string, files: Record<string, string>, opts: { description?: string; private?: boolean; owner?: string } = {}, fetchImpl: FetchLike = fetch): Promise<NewRepoResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required for real GitHub exports -- never accepted from the request body.');
  const immutableViolations = findImmutableCoreViolations(files);
  if (immutableViolations.length > 0) throw new Error(`Refused: ${immutableViolations.length} target path(s) are on the immutable core list and can never be pushed by a governed action: ${immutableViolations.join(', ')}.`);
  const headers = { Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json', ...authHeaders() };

  const createUrl = opts.owner ? `https://api.github.com/orgs/${encodeURIComponent(opts.owner)}/repos` : 'https://api.github.com/user/repos';
  const createResponse = await fetchImpl(createUrl, {
    method: 'POST', headers,
    body: JSON.stringify({ name: repoName, description: opts.description || 'Created by Microfixd Creator Lab.', private: opts.private ?? true, auto_init: true }),
  });
  if (!createResponse.ok) throw new Error(`Repo creation failed for "${repoName}" (HTTP ${createResponse.status}): ${(await createResponse.text()).slice(0, 300)}`);
  const repoData = (await createResponse.json()) as { html_url: string; owner: { login: string }; name: string; default_branch: string };

  // Real, brief wait + retry: GitHub's auto_init commit is not always
  // immediately visible to the Git Data API on the very next request.
  // exportRepoFiles reads the current tree, so it needs that initial
  // commit to actually exist yet.
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const commitResult = await exportRepoFiles(repoData.owner.login, repoData.name, files, 'Initial Creator Lab push', repoData.default_branch || 'main', fetchImpl);
      return { repoUrl: repoData.html_url, owner: repoData.owner.login, repo: repoData.name, commitSha: commitResult.commitSha, fileCount: commitResult.fileCount };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
    }
  }
  throw new Error(`Repo "${repoName}" was created at ${repoData.html_url} but pushing initial content failed after retries: ${lastError?.message}`);
}
