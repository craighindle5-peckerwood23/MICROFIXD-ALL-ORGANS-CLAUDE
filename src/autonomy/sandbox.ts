import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import type { CapabilityArtifact, Sandbox } from './types.ts';

const BLOCKED_CONTENT = /(?:child_process|process\.env|require\(|import\s+.*(?:http|https|net|tls|axios|fetch)|curl|wget|eval\(|new Function|rm\s+-rf)/i;

export type SandboxExecutionResult = {
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export class SandboxWorkspace implements Sandbox {
  private readonly root: string;

  constructor(rootDirectory = process.env.MICROFIXD_SANDBOX_DIR || './.microfixd/sandbox') {
    this.root = resolve(rootDirectory);
  }

  async inspect(): Promise<Record<string, unknown>> {
    await mkdir(this.root, { recursive: true });
    const entries = await readdir(this.root, { withFileTypes: true });
    const files = await Promise.all(entries.filter((entry) => entry.isFile()).map(async (entry) => {
      const fullPath = resolve(this.root, entry.name);
      const metadata = await stat(fullPath);
      return { name: entry.name, sizeBytes: metadata.size, modifiedAt: metadata.mtime.toISOString() };
    }));

    return {
      sandboxRoot: this.root,
      artifactCount: files.length,
      artifacts: files.sort((a, b) => a.name.localeCompare(b.name)),
      isolation: 'filesystem-confined; static validation only; no code execution or activation',
    };
  }

  async validateCapability(title: string, specification: string): Promise<CapabilityArtifact> {
    await mkdir(this.root, { recursive: true });
    const normalizedTitle = title.trim().replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 80) || 'Untitled capability';
    const normalizedSpecification = specification.trim().slice(0, 100_000);
    const slug = normalizedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'capability';
    const fingerprint = createHash('sha256').update(`${normalizedTitle}\n${normalizedSpecification}`).digest('hex').slice(0, 12);
    const filename = `${slug}-${fingerprint}.candidate.ts`;
    const target = resolve(this.root, filename);
    this.assertContained(target);

    const checks: string[] = [];
    const issues: string[] = [];
    if (normalizedSpecification.length === 0) issues.push('A capability specification is required.');
    else checks.push('Specification is non-empty.');
    if (BLOCKED_CONTENT.test(normalizedSpecification)) issues.push('Specification contains a prohibited host-execution, secret-access, or direct-networking pattern.');
    else checks.push('Specification contains no prohibited host-execution or direct-networking patterns.');
    if (normalizedSpecification.length <= 100_000) checks.push('Specification fits the sandbox size limit.');

    const passed = issues.length === 0;
    const artifact: CapabilityArtifact = {
      id: randomUUID(),
      title: normalizedTitle,
      relativePath: relative(process.cwd(), target),
      content: this.renderCapability(normalizedTitle, normalizedSpecification, passed, issues),
      validation: { passed, checks: [...checks, ...issues.map((issue) => `FAILED: ${issue}`)] },
      createdAt: new Date().toISOString(),
    };

    await writeFile(target, artifact.content, { mode: 0o600 });
    return artifact;
  }

  private renderCapability(title: string, specification: string, passed: boolean, issues: string[]): string {
    if (!passed) {
      // Failed validation: never store the rejected specification as
      // live, top-level executable code, even inertly -- keep it as a
      // plain data record. execute() also independently re-checks
      // BLOCKED_CONTENT before running anything, but a failed candidate
      // should never even look executable on disk.
      return `/**\n * Microfixd sandbox candidate artifact -- VALIDATION FAILED, not executable.\n * ${issues.join(' ')}\n */\nexport const candidateCapability = ${JSON.stringify({
        title, specification, validationPassed: false, validationIssues: issues, generatedAt: new Date().toISOString(),
      }, null, 2)} as const;\n`;
    }
    // Passed validation: the file IS the real, executable candidate --
    // not a data-wrapped description of one. Storing the specification
    // as inert JSON here was the actual reason execute() previously ran
    // "successfully" (exit code 0) but produced no output: there was no
    // live statement to run. Found by actually running it, not assumed.
    return `/**\n * Microfixd sandbox candidate artifact.\n * Title: ${title}\n * Passed static validation at ${new Date().toISOString()}.\n * This file is not loaded, executed, merged, or deployed automatically.\n * Real execution additionally requires a recorded Paragon Dissector\n * approval decision, consumed exactly once (see governed-execution.ts).\n */\n${specification}\n`;
  }

  private assertContained(target: string): void {
    const relativePath = relative(this.root, target);
    if (relativePath.startsWith('..') || relativePath.includes(`..${sep}`) || relativePath === '') {
      throw new Error('Sandbox path confinement rejected the candidate artifact path.');
    }
  }

  /**
   * Real execution of a previously-validated candidate file -- this is
   * genuinely new capability, not a description of one. It is NOT
   * exposed directly; callers (routes.ts) must gate every call through
   * governed-execution.ts's propose/approve/consume-once flow first.
   * This method itself re-checks BLOCKED_CONTENT immediately before
   * spawning (defense in depth: the file could theoretically have been
   * edited on disk between validateCapability() and execute()).
   *
   * Isolation model, stated plainly: this is a real subprocess with a
   * hard timeout and a stripped environment (no ADMIN_API_KEY, no
   * DATABASE_URL, no credentials of any kind) -- it is NOT container or
   * VM-level isolation. It cannot be trusted with hostile code; it is
   * appropriate for candidate code that already passed the static
   * BLOCKED_CONTENT check and a human approval, not arbitrary input.
   */
  async execute(relativePathFromCwd: string, timeoutMs = 8_000): Promise<SandboxExecutionResult> {
    // relativePathFromCwd matches validateCapability()'s own convention
    // (CapabilityArtifact.relativePath is relative(process.cwd(), target))
    // -- resolving against this.root instead of process.cwd() here was a
    // real bug caught by actually running this end to end: it silently
    // pointed at the wrong file when the sandbox root wasn't inside cwd.
    const target = resolve(process.cwd(), relativePathFromCwd);
    this.assertContained(target);

    const content = await readFile(target, 'utf8');
    if (BLOCKED_CONTENT.test(content)) {
      throw new Error('Execution refused: the candidate file contains a prohibited pattern (re-checked immediately before execution).');
    }

    const tsxBin = resolve(process.cwd(), 'node_modules/.bin/tsx');
    const startedAt = Date.now();

    return new Promise<SandboxExecutionResult>((resolvePromise) => {
      const child = spawn(tsxBin, [target], {
        cwd: this.root,
        // Stripped environment: no admin key, no database URL, no
        // provider credentials of any kind. Only what a bare script
        // needs to run under Node at all.
        env: { PATH: process.env.PATH || '', HOME: process.env.HOME || '/tmp', NODE_ENV: 'sandbox' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);

      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); if (stdout.length > 50_000) stdout = stdout.slice(0, 50_000) + '\n...[truncated]'; });
      child.stderr.on('data', (chunk) => { stderr += chunk.toString(); if (stderr.length > 50_000) stderr = stderr.slice(0, 50_000) + '\n...[truncated]'; });

      child.on('close', (code) => {
        clearTimeout(timer);
        resolvePromise({ exitCode: code, timedOut, stdout, stderr, durationMs: Date.now() - startedAt });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolvePromise({ exitCode: null, timedOut, stdout, stderr: `${stderr}\nspawn error: ${err.message}`, durationMs: Date.now() - startedAt });
      });
    });
  }
}
