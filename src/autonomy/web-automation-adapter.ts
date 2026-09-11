// src/autonomy/web-automation-adapter.ts
//
// Real environment-detecting adapter, not a manual switch: picks the
// Playwright/Chromium path (browser-automation.ts, full JS rendering)
// when a real Chromium binary is actually present and on-disk, and
// falls back to the HTTP-DOM path (http-dom-automation.ts, no JS
// execution but works anywhere Node runs, including Termux) when it
// isn't. The caller doesn't need to know which environment it's
// running in -- Termux, Codespaces, a real Linux box, a Docker
// container -- this checks for itself, every call, since the same
// deployed code might run in different places over its lifetime.
//
// Confirmed this session: Termux/Android cannot run Chromium (kernel
// blocks required sandbox namespaces) even if MICROFIXD_CHROMIUM_PATH
// is set to a binary that happens to exist there -- so detection here
// is deliberately "does a real launch actually succeed," not just
// "does the file exist," to avoid falsely reporting Chromium as usable
// on a platform where the binary is present but can't run.

import { existsSync } from 'node:fs';
import { executePlan, previewPlan, type BrowserPlan, type BrowserStepResult } from './browser-automation.ts';
import { browseAndExtract, type HttpDomAction, type HttpDomResult } from './http-dom-automation.ts';

export type WebAutomationBackend = 'playwright' | 'http-dom';

export interface CapabilityCheck {
  backend: WebAutomationBackend;
  reason: string;
}

let cachedCheck: { result: CapabilityCheck; checkedAt: number } | null = null;
const CACHE_MS = 60_000; // re-check every minute -- cheap enough, and environments can change (e.g. a container image update)

/**
 * Real launch test, not just a file-existence check. A stat-only check
 * would incorrectly report "Chromium available" on Termux if someone
 * copied a Linux Chromium binary onto the device -- it exists as a
 * file, but the kernel refuses to actually run it. This launches
 * headless with a 3-second timeout and immediately closes; if that
 * doesn't succeed, the Playwright path is not usable here regardless
 * of what MICROFIXD_CHROMIUM_PATH points at.
 */
export async function detectWebAutomationBackend(force = false): Promise<CapabilityCheck> {
  if (!force && cachedCheck && Date.now() - cachedCheck.checkedAt < CACHE_MS) return cachedCheck.result;

  const executablePath = process.env.MICROFIXD_CHROMIUM_PATH || '/usr/bin/chromium';
  if (!existsSync(executablePath)) {
    const result: CapabilityCheck = { backend: 'http-dom', reason: `No Chromium binary found at ${executablePath}. Using HTTP-DOM automation instead.` };
    cachedCheck = { result, checkedAt: Date.now() };
    return result;
  }

  try {
    const { chromium } = await import('playwright-core');
    const launchPromise = chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('launch timed out after 3s')), 3000));
    const browser = await Promise.race([launchPromise, timeout]);
    await browser.close();
    const result: CapabilityCheck = { backend: 'playwright', reason: `Chromium at ${executablePath} launched successfully.` };
    cachedCheck = { result, checkedAt: Date.now() };
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: CapabilityCheck = { backend: 'http-dom', reason: `Chromium binary exists at ${executablePath} but failed to launch (${message}). This is the exact Termux/Android situation confirmed this session -- falling back to HTTP-DOM automation, which works regardless of sandbox namespace support.` };
    cachedCheck = { result, checkedAt: Date.now() };
    return result;
  }
}

export interface AdaptedWebResult {
  backendUsed: WebAutomationBackend;
  backendReason: string;
  playwrightResult?: BrowserStepResult[];
  httpDomResult?: HttpDomResult;
}

/**
 * Single entry point for "go get this page and pull some data from
 * it." For a simple goto+extract task this is a reasonable universal
 * shape; multi-step Playwright plans (click, type, waitForSelector)
 * have no HTTP-DOM equivalent and will just use whichever backend was
 * detected -- if that's HTTP-DOM and the plan needs real JS
 * interaction, the caller gets back an honest limitation, not a
 * silent partial result.
 */
export async function executeWebTask(url: string, actions: HttpDomAction[]): Promise<AdaptedWebResult> {
  const capability = await detectWebAutomationBackend();

  if (capability.backend === 'http-dom') {
    const httpDomResult = await browseAndExtract(url, actions);
    return { backendUsed: 'http-dom', backendReason: capability.reason, httpDomResult };
  }

  // Playwright path: translate the simple extract/attribute action
  // shape into a real BrowserPlan (goto, then extractText per selector).
  const plan: BrowserPlan = {
    actions: [
      { type: 'goto', url },
      ...actions.filter((a) => a.type === 'extract').map((a) => ({ type: 'extractText' as const, selector: a.selector })),
    ],
  };
  const preview = previewPlan(plan);
  if (!preview.safe) {
    return { backendUsed: 'playwright', backendReason: `${capability.reason} Plan rejected: ${preview.issues.join(' ')}`, playwrightResult: [] };
  }
  const playwrightResult = await executePlan(plan);
  return { backendUsed: 'playwright', backendReason: capability.reason, playwrightResult };
}
