// src/autonomy/intent-classifier.ts
//
// The real, shared classification logic behind BOTH ChatOrgan's intent
// parsing and the declared intent-organ in the registry -- previously
// two disconnected things (real logic in chat.ts, an unwired name in
// organ-registry.ts). Now genuinely one system.
//
// Multi-provider fallback, matching the exact resilience pattern
// already proven in this codebase (Playwright -> HTTP-DOM): try Gemini
// first (the existing pinned model), fall back to Groq-hosted Llama on
// any failure (rate limit, quota exhausted, network error, missing
// key), then DeepSeek as a second fallback. Falls back on ANY failure,
// not just a detected rate-limit code specifically -- a quota error's
// exact shape varies by provider and isn't worth brittle-matching when
// "try the next real provider" is safe regardless of failure reason.
//
// Honest limit: api.groq.com, api.deepseek.com, and Gemini's API are
// all outside this sandbox's network allowlist, so none of the three
// providers can be live-tested end-to-end here. What IS verified: the
// fallback control flow itself, with each provider mocked to fail in
// sequence (see the live proof run alongside this file). The actual
// HTTP request shapes for Groq and Gemini are copied verbatim from
// generate.ts/chat.ts's already-proven-working calls; DeepSeek's is
// built from its documented OpenAI-compatible format and is
// structurally consistent with the other two, but its exact response
// shape has not been exercised against a live DeepSeek response in
// this environment.

import { GoogleGenAI } from '@google/genai';
import { getPinnedModel } from './model-registry.ts';

export interface IntentCandidate {
  name: string;
  describe: string;
}

export interface ClassificationResult {
  intent: string | null;
  providerUsed: 'gemini' | 'groq' | 'deepseek' | null;
  attempts: { provider: string; ok: boolean; detail?: string }[];
}

function buildPrompt(text: string, candidates: IntentCandidate[]): string {
  return `You are an intent router for a governed system. Given the user's message, pick the single best-matching intent from this exact list, or "none" if nothing fits. Do not answer the user's question yourself.\n\nIntents:\n${candidates.map((c) => `- ${c.name}: ${c.describe}`).join('\n')}\n\nUser message: "${text}"`;
}

async function tryGemini(text: string, candidates: IntentCandidate[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured.');
  const ai = new GoogleGenAI({ apiKey });
  const names = candidates.map((c) => c.name);
  const response = await ai.models.generateContent({
    model: getPinnedModel('chat-intent-interpreter').model,
    contents: buildPrompt(text, candidates),
    config: { responseMimeType: 'application/json', responseSchema: { type: 'object', properties: { intent: { type: 'string', enum: [...names, 'none'] } }, required: ['intent'] } },
  });
  const parsed = JSON.parse(response.text ?? '{}') as { intent?: string };
  return parsed.intent && parsed.intent !== 'none' ? parsed.intent : null;
}

/** Shared OpenAI-compatible request shape for both Groq and DeepSeek -- same wire format, different base URL/model/key. */
async function tryOpenAiCompatible(baseUrl: string, apiKeyEnv: string, model: string, text: string, candidates: IntentCandidate[]): Promise<string | null> {
  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) throw new Error(`${apiKeyEnv} not configured.`);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: 'Respond with ONLY a JSON object of the exact shape {"intent": "<name-or-none>"}. No other text.' }, { role: 'user', content: buildPrompt(text, candidates) }],
      max_tokens: 60,
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`${apiKeyEnv.split('_')[0]} intent call failed (HTTP ${response.status}): ${(await response.text().catch(() => '')).slice(0, 200)}`);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as { intent?: string };
  return parsed.intent && parsed.intent !== 'none' ? parsed.intent : null;
}

/**
 * Real fallback chain. Never throws -- exhausting all three real
 * providers is a legitimate outcome (returns intent: null), same
 * honesty standard as genesis-self-model.ts's "insufficient-evidence"
 * rather than crashing the caller.
 */
export async function classifyIntent(text: string, candidates: IntentCandidate[]): Promise<ClassificationResult> {
  const attempts: ClassificationResult['attempts'] = [];

  try {
    const intent = await tryGemini(text, candidates);
    attempts.push({ provider: 'gemini', ok: true });
    return { intent, providerUsed: 'gemini', attempts };
  } catch (err) {
    attempts.push({ provider: 'gemini', ok: false, detail: (err as Error).message });
  }

  try {
    const intent = await tryOpenAiCompatible('https://api.groq.com/openai/v1', 'GROQ_API_KEY', getPinnedModel('chat-intent-interpreter-fallback-1').model, text, candidates);
    attempts.push({ provider: 'groq', ok: true });
    return { intent, providerUsed: 'groq', attempts };
  } catch (err) {
    attempts.push({ provider: 'groq', ok: false, detail: (err as Error).message });
  }

  try {
    const intent = await tryOpenAiCompatible('https://api.deepseek.com', 'DEEPSEEK_API_KEY', getPinnedModel('chat-intent-interpreter-fallback-2').model, text, candidates);
    attempts.push({ provider: 'deepseek', ok: true });
    return { intent, providerUsed: 'deepseek', attempts };
  } catch (err) {
    attempts.push({ provider: 'deepseek', ok: false, detail: (err as Error).message });
  }

  return { intent: null, providerUsed: null, attempts };
}
