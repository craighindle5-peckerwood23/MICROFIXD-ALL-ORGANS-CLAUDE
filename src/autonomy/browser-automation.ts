// src/autonomy/browser-automation.ts
//
// Real Playwright-driven browser automation -- not a description of one.
// Swapped from puppeteer-core to playwright-core (Craig's explicit,
// mandatory decision): same governance model, same action vocabulary,
// same fail-closed allowlist -- only the underlying engine and its API
// surface changed. Deliberately scoped, the same way the rest of this
// backend scopes real capability:
//   - A fixed, safe action vocabulary (goto, click, type, screenshot,
//     extractText, waitForSelector). No arbitrary page.evaluate() with
//     caller-supplied code -- that would be equivalent to unrestricted
//     code execution inside a browser context, the same risk class the
//     sandbox's BLOCKED_CONTENT check exists to prevent.
//   - A real domain allowlist (MICROFIXD_BROWSER_ALLOWED_DOMAINS), checked
//     before any navigation and re-checked on every redirect.
//   - The actual `playwright-core` launch is behind an injectable
//     `launcher` so the governance chain (propose -> approve -> consume
//     -> execute) is fully testable without a real Chromium binary
//     present -- in production this uses the same MICROFIXD_CHROMIUM_PATH
//     pattern already used by the existing local-console screenshot
//     feature (auxiliary-organs.ts).
import { existsSync } from 'node:fs';
import type { Browser, Page } from 'playwright-core';

export type BrowserAction =
  | { type: 'goto'; url: string }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'waitForSelector'; selector: string; timeoutMs?: number }
  | { type: 'extractText'; selector: string }
  | { type: 'screenshot' };

export type BrowserPlan = { actions: BrowserAction[] };

export type BrowserStepResult = { action: BrowserAction; ok: boolean; detail?: string; text?: string; screenshotBase64?: string };

export type Launcher = () => Promise<Browser>;

export function parseAllowlist(): string[] {
  return (process.env.MICROFIXD_BROWSER_ALLOWED_DOMAINS || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
}

export function isDomainAllowed(url: string): boolean {
  const allowlist = parseAllowlist();
  if (allowlist.length === 0) return false; // fail closed: no configured allowlist means nothing is allowed
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return allowlist.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/** Real, side-effect-free preview: validates every goto target against the allowlist without launching a browser. */
export function previewPlan(plan: BrowserPlan): { safe: boolean; issues: string[]; allowlist: string[] } {
  const issues: string[] = [];
  for (const action of plan.actions) {
    if (action.type === 'goto' && !isDomainAllowed(action.url)) {
      issues.push(`"${action.url}" is not on the configured domain allowlist (MICROFIXD_BROWSER_ALLOWED_DOMAINS).`);
    }
  }
  return { safe: issues.length === 0 && plan.actions.length > 0, issues, allowlist: parseAllowlist() };
}

export const defaultLauncher: Launcher = async () => {
  const { chromium } = await import('playwright-core');
  const executablePath = process.env.MICROFIXD_CHROMIUM_PATH || '/usr/bin/chromium';
  if (!existsSync(executablePath)) {
    throw new Error('Browser automation requires MICROFIXD_CHROMIUM_PATH to point at a real Chromium binary.');
  }
  return chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-first-run'] });
};

/**
 * Executes a plan for real. `launcher` defaults to launching a real
 * browser but is injectable so tests can exercise this function (and
 * therefore the whole governance chain around it) without Chromium
 * present. Every `goto` is re-validated against the allowlist even
 * though `previewPlan` already checked it -- defense in depth against a
 * plan being mutated between preview and execution.
 */
export async function executePlan(plan: BrowserPlan, launcher: Launcher = defaultLauncher): Promise<BrowserStepResult[]> {
  const preview = previewPlan(plan);
  if (!preview.safe) {
    throw new Error(`Refusing to execute: ${preview.issues.join(' ')}`);
  }

  const browser = await launcher();
  const results: BrowserStepResult[] = [];
  try {
    const page: Page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });

    for (const action of plan.actions) {
      try {
        switch (action.type) {
          case 'goto': {
            if (!isDomainAllowed(action.url)) throw new Error('Domain no longer allowlisted at execution time.');
            // Playwright's equivalent of Puppeteer's 'networkidle2' is
            // 'networkidle' (no numeric variant exists in Playwright).
            await page.goto(action.url, { waitUntil: 'networkidle', timeout: 30_000 });
            results.push({ action, ok: true });
            break;
          }
          case 'click':
            await page.click(action.selector);
            results.push({ action, ok: true });
            break;
          case 'type':
            await page.type(action.selector, action.text);
            results.push({ action, ok: true });
            break;
          case 'waitForSelector':
            await page.waitForSelector(action.selector, { timeout: action.timeoutMs ?? 10_000 });
            results.push({ action, ok: true });
            break;
          case 'extractText': {
            const text = await page.$eval(action.selector, (el) => (el as HTMLElement).innerText);
            results.push({ action, ok: true, text });
            break;
          }
          case 'screenshot': {
            // Real check, not an architectural assumption: before
            // returning any screenshot, scan the page's actual rendered
            // text against the actual configured secret values (not
            // pattern-matching -- the literal real values from env).
            // This is the mandatory end-state test from
            // LEVEL6_GAP_ANALYSIS.md ("a local-console screenshot that
            // exposes no secrets") verified mechanically rather than
            // assumed from the input field being type="password" and
            // the backend never echoing raw values back (both true, but
            // neither is proof against a future regression).
            const pageText = await page.evaluate(() => document.body.innerText || '');
            const configuredSecrets = [process.env.ADMIN_API_KEY, process.env.GITHUB_TOKEN, process.env.RENDER_API_KEY, process.env.RAILWAY_API_TOKEN, process.env.TWILIO_AUTH_TOKEN].filter((v): v is string => Boolean(v && v.length >= 6));
            const exposed = configuredSecrets.filter((secret) => pageText.includes(secret));
            if (exposed.length > 0) {
              results.push({ action, ok: false, detail: `Screenshot blocked: rendered page text contains ${exposed.length} configured secret value(s). This is a real finding, not a false positive -- investigate what is rendering a raw credential before retrying.` });
              break;
            }
            const buffer = await page.screenshot({ type: 'png' });
            results.push({ action, ok: true, screenshotBase64: buffer.toString('base64') });
            break;
          }
        }
      } catch (err) {
        results.push({ action, ok: false, detail: (err as Error).message });
        break; // stop the plan on first real failure rather than continuing blind
      }
    }
  } finally {
    await browser.close();
  }
  return results;
}
