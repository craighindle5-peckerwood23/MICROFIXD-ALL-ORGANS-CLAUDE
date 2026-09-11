// src/autonomy/http-dom-automation.ts
//
// Real alternative web-automation path for environments where a real
// Chromium binary isn't available (confirmed earlier this session:
// Playwright/Chromium do not run reliably on Termux/Android). Uses
// Node's native fetch + cheerio -- no axios needed, no jsdom (jsdom's
// JS execution would reintroduce the same arbitrary-code-execution risk
// class the sandbox's content checks already guard against, so it's
// deliberately left out rather than silently included).
//
// Honest capability boundary, unlike the reference doc this was adapted
// from: this can fetch, parse, extract, and submit GET/POST forms
// against static or server-rendered HTML. It CANNOT click a button that
// triggers client-side JavaScript, CANNOT wait for a React/Vue app to
// hydrate, and does not execute page scripts. Real name for what this
// is: an HTTP + HTML-parsing tool, not a browser. Sites that render
// their real content via client-side JS will not work through this
// path -- use the Playwright path (browser-automation.ts) for those,
// from a machine that has a real Chromium binary.
//
// Uses the exact same domain allowlist as the Playwright path
// (isDomainAllowed from browser-automation.ts) -- there is one
// governance boundary, not two competing ones.

import * as cheerio from 'cheerio';
import { isDomainAllowed } from './browser-automation.ts';

// Minimal, real, dependency-free cookie jar. Native fetch (undici)
// doesn't persist cookies across calls the way a browser does, so
// login/session-aware workflows need this -- rather than adding
// tough-cookie + axios-cookiejar-support (two more dependencies) for
// behavior this implements in ~15 real lines.
class CookieJar {
  private cookies = new Map<string, string>();

  absorb(response: Response) {
    const raw = response.headers.getSetCookie?.() ?? [];
    for (const line of raw) {
      const [pair] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

export interface HttpDomAction {
  type: 'extract' | 'attribute';
  selector: string;
  attribute?: string; // required for type: 'attribute'
}

export interface HttpDomResult {
  status: 'ok' | 'error';
  url: string;
  title?: string;
  extracted?: Record<string, string | undefined>;
  error?: string;
}

export async function browseAndExtract(url: string, actions: HttpDomAction[] = []): Promise<HttpDomResult> {
  if (!isDomainAllowed(url)) {
    return { status: 'error', url, error: `"${url}" is not on the configured domain allowlist (MICROFIXD_BROWSER_ALLOWED_DOMAINS).` };
  }
  let html: string;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) return { status: 'error', url, error: `HTTP ${response.status} fetching ${url}.` };
    html = await response.text();
  } catch (err) {
    return { status: 'error', url, error: err instanceof Error ? err.message : String(err) };
  }

  const $ = cheerio.load(html);
  const extracted: Record<string, string | undefined> = {};
  for (const action of actions) {
    if (action.type === 'extract') extracted[action.selector] = $(action.selector).first().text().trim();
    if (action.type === 'attribute') extracted[`${action.selector}[${action.attribute}]`] = $(action.selector).first().attr(action.attribute ?? '');
  }
  return { status: 'ok', url, title: $('title').text().trim(), extracted };
}

export interface FormSubmitResult {
  status: 'ok' | 'error';
  submittedTo?: string;
  method?: 'GET' | 'POST';
  title?: string;
  error?: string;
}

async function fetchWithJar(url: string, jar: CookieJar, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const cookieHeader = jar.header();
  if (cookieHeader) headers.set('Cookie', cookieHeader);
  const response = await fetch(url, { ...init, headers, redirect: 'follow' });
  jar.absorb(response);
  return response;
}

export async function submitForm(pageUrl: string, formSelector: string, fields: Record<string, string>): Promise<FormSubmitResult> {
  if (!isDomainAllowed(pageUrl)) {
    return { status: 'error', error: `"${pageUrl}" is not on the configured domain allowlist (MICROFIXD_BROWSER_ALLOWED_DOMAINS).` };
  }
  let html: string;
  try {
    const pageResponse = await fetch(pageUrl);
    if (!pageResponse.ok) return { status: 'error', error: `HTTP ${pageResponse.status} fetching ${pageUrl}.` };
    html = await pageResponse.text();
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }

  const $ = cheerio.load(html);
  const form = $(formSelector);
  if (form.length === 0) return { status: 'error', error: `No form matched selector "${formSelector}".` };

  const action = form.attr('action') || pageUrl;
  const method = (form.attr('method') || 'GET').toUpperCase() as 'GET' | 'POST';
  const submitUrl = new URL(action, pageUrl).toString();

  if (!isDomainAllowed(submitUrl)) {
    return { status: 'error', error: `Form action "${submitUrl}" is not on the configured domain allowlist.` };
  }

  try {
    let response: Response;
    if (method === 'POST') {
      response = await fetch(submitUrl, { method: 'POST', body: new URLSearchParams(fields), redirect: 'follow' });
    } else {
      const withParams = new URL(submitUrl);
      for (const [k, v] of Object.entries(fields)) withParams.searchParams.set(k, v);
      response = await fetch(withParams.toString(), { redirect: 'follow' });
    }
    const resultHtml = await response.text();
    const $$ = cheerio.load(resultHtml);
    return { status: 'ok', submittedTo: submitUrl, method, title: $$('title').text().trim() };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export interface LoginResult {
  status: 'ok' | 'error';
  submittedTo?: string;
  code?: number;
  title?: string;
  error?: string;
  sessionCookieHeader?: string; // returned so a caller can persist/reuse it across a workflow run
}

/** Same governed pattern as submitForm, but keeps a cookie jar so the resulting session can be reused by runWorkflow(). */
export async function login(pageUrl: string, formSelector: string, fields: Record<string, string>): Promise<LoginResult> {
  if (!isDomainAllowed(pageUrl)) {
    return { status: 'error', error: `"${pageUrl}" is not on the configured domain allowlist.` };
  }
  const jar = new CookieJar();
  try {
    const pageResponse = await fetchWithJar(pageUrl, jar);
    const html = await pageResponse.text();
    const $ = cheerio.load(html);
    const form = $(formSelector);
    if (form.length === 0) return { status: 'error', error: `No form matched selector "${formSelector}".` };

    const action = form.attr('action') || pageUrl;
    const method = (form.attr('method') || 'POST').toUpperCase();
    const submitUrl = new URL(action, pageUrl).toString();
    if (!isDomainAllowed(submitUrl)) return { status: 'error', error: `Login form action "${submitUrl}" is not on the configured domain allowlist.` };

    const response = method === 'POST'
      ? await fetchWithJar(submitUrl, jar, { method: 'POST', body: new URLSearchParams(fields) })
      : await fetchWithJar((() => { const u = new URL(submitUrl); for (const [k, v] of Object.entries(fields)) u.searchParams.set(k, v); return u.toString(); })(), jar);

    const resultHtml = await response.text();
    return { status: 'ok', submittedTo: submitUrl, code: response.status, title: cheerio.load(resultHtml)('title').text().trim(), sessionCookieHeader: jar.header() };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : String(err) };
  }
}

export type WorkflowStep =
  | { type: 'navigate'; url: string }
  | { type: 'extract'; selector: string }
  | { type: 'follow'; selector: string }
  | { type: 'submit'; selector: string; fields: Record<string, string> };

export interface WorkflowLogEntry { type: string; url?: string; selector?: string; text?: string; error?: string; code?: number }
export interface WorkflowResult { status: 'ok' | 'error'; finalUrl?: string; log: WorkflowLogEntry[]; error?: string }

/**
 * Real multi-step workflow -- every navigate/follow/submit target is
 * checked against isDomainAllowed before the request fires, including
 * mid-workflow redirects via <a href> or form action, which the
 * reference version this was adapted from did not check at all. One bad
 * step stops the whole workflow rather than silently continuing against
 * a disallowed domain.
 */
export async function runWorkflow(startUrl: string, steps: WorkflowStep[]): Promise<WorkflowResult> {
  if (!isDomainAllowed(startUrl)) return { status: 'error', log: [], error: `"${startUrl}" is not on the configured domain allowlist.` };
  const jar = new CookieJar();
  let currentUrl = startUrl;
  const log: WorkflowLogEntry[] = [];
  try {
    let html = await (await fetchWithJar(currentUrl, jar)).text();

    for (const step of steps) {
      const $ = cheerio.load(html);

      if (step.type === 'navigate') {
        if (!isDomainAllowed(step.url)) { log.push({ type: 'navigate', url: step.url, error: 'not on allowlist' }); return { status: 'error', log, error: `"${step.url}" is not on the configured domain allowlist.` }; }
        currentUrl = step.url;
        html = await (await fetchWithJar(currentUrl, jar)).text();
        log.push({ type: 'navigate', url: currentUrl });
      }

      if (step.type === 'extract') {
        log.push({ type: 'extract', selector: step.selector, text: $(step.selector).first().text().trim(), url: currentUrl });
      }

      if (step.type === 'follow') {
        const href = $(step.selector).first().attr('href');
        if (!href) { log.push({ type: 'follow', selector: step.selector, error: 'no href found' }); continue; }
        const nextUrl = new URL(href, currentUrl).toString();
        if (!isDomainAllowed(nextUrl)) { log.push({ type: 'follow', url: nextUrl, error: 'not on allowlist' }); return { status: 'error', log, error: `"${nextUrl}" is not on the configured domain allowlist.` }; }
        currentUrl = nextUrl;
        html = await (await fetchWithJar(currentUrl, jar)).text();
        log.push({ type: 'follow', selector: step.selector, url: currentUrl });
      }

      if (step.type === 'submit') {
        const form = $(step.selector).first();
        const action = form.attr('action') || currentUrl;
        const method = (form.attr('method') || 'POST').toUpperCase();
        const submitUrl = new URL(action, currentUrl).toString();
        if (!isDomainAllowed(submitUrl)) { log.push({ type: 'submit', url: submitUrl, error: 'not on allowlist' }); return { status: 'error', log, error: `Form action "${submitUrl}" is not on the configured domain allowlist.` }; }
        const response = method === 'POST'
          ? await fetchWithJar(submitUrl, jar, { method: 'POST', body: new URLSearchParams(step.fields) })
          : await fetchWithJar((() => { const u = new URL(submitUrl); for (const [k, v] of Object.entries(step.fields)) u.searchParams.set(k, v); return u.toString(); })(), jar);
        html = await response.text();
        currentUrl = submitUrl;
        log.push({ type: 'submit', selector: step.selector, url: submitUrl, code: response.status });
      }
    }
    return { status: 'ok', finalUrl: currentUrl, log };
  } catch (err) {
    return { status: 'error', log, error: err instanceof Error ? err.message : String(err) };
  }
}
