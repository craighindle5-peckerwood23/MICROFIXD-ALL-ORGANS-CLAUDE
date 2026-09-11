// src/autonomy/preview.ts
//
// Real "live preview" for Laboratory, scoped to how this app is
// actually architected: a single running app, not a multi-project
// generator spinning up arbitrary dev servers (that option was
// evaluated and explicitly not built -- see the process-lifecycle/
// port-allocation/reverse-proxy complexity noted earlier). What IS
// real and useful:
//   - In dev mode, Vite's own middleware already live-reloads on file
//     change -- there is nothing to "preview," the running page already
//     reflects saved files. This module doesn't pretend otherwise.
//   - In production (e.g. deployed on Railway), server.ts serves
//     static files from dist/, so a file write via Laboratory does NOT
//     take effect until a real rebuild runs. This module runs that
//     real rebuild and reports real success/failure with real output,
//     rather than claiming a change is "live" when it isn't yet.

import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface RebuildResult {
  status: 'ok' | 'error';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/** Real subprocess execution of the actual build command (vite build && esbuild ...) -- not the stripped-down sandbox used for untrusted candidate code, since this builds trusted source with full real dependencies. */
export async function rebuild(timeoutMs = 60_000): Promise<RebuildResult> {
  const startedAt = Date.now();
  return new Promise<RebuildResult>((resolvePromise) => {
    const child = spawn('npm', ['run', 'build'], { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolvePromise({ status: exitCode === 0 ? 'ok' : 'error', exitCode, stdout: stdout.slice(-4_000), stderr: stderr.slice(-4_000), durationMs: Date.now() - startedAt });
    });
  });
}

export interface PreviewStatus {
  mode: 'development' | 'production';
  note: string;
  distIndexExists: boolean;
  distLastBuilt: string | null;
}

export async function getPreviewStatus(): Promise<PreviewStatus> {
  const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const distIndexPath = resolve(process.cwd(), 'dist', 'index.html');
  try {
    const s = await stat(distIndexPath);
    return {
      mode,
      note: mode === 'development'
        ? 'Dev mode: Vite middleware live-reloads on file save. Nothing to rebuild -- the running page already reflects saved files.'
        : `Production mode: the running app serves dist/, last built ${s.mtime.toISOString()}. File writes do NOT take effect until a rebuild runs.`,
      distIndexExists: true,
      distLastBuilt: s.mtime.toISOString(),
    };
  } catch {
    return {
      mode,
      note: mode === 'development'
        ? 'Dev mode: Vite middleware live-reloads on file save. Nothing to rebuild.'
        : 'Production mode: no dist/index.html found yet -- a rebuild has never run in this environment.',
      distIndexExists: false,
      distLastBuilt: null,
    };
  }
}
