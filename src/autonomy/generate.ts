// src/autonomy/generate.ts
//
// Real "build me an app" capability -- adapted from the uploaded
// Microfyxd-standalone-main zip's SandboxOrchestrator, with one
// deliberate change: that module's PRIMARY path called an "OmniRoute"
// layer pointing at a fictional endpoint (api.omniroot.ai) and fake
// "free provider" names -- already flagged as fabricated earlier in
// this project. This version drops that entirely and calls Groq
// directly as the one real path. The JSON-file-map parsing logic below
// is the one part of that module that was genuinely real and reusable.

import { getPinnedModel } from './model-registry.ts';
import { checkGeneratedFiles, type RealityAnchorFinding } from './reality-anchor.ts';

export interface FileMap { [filename: string]: string }
export interface GenerateResult { files: FileMap; tokensUsed: number; success: boolean; error?: string; modelUsed?: string; realityAnchorFindings?: RealityAnchorFinding[] }

const SYSTEM_PROMPT = 'You are a code generator. Return ONLY a JSON object mapping filenames to file contents. No markdown, no explanation, no code fences. Example: {"index.html":"<!doctype html>...","app.js":"..."}';

function parseFileMap(raw: string): FileMap {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null) {
      const fileMap: FileMap = {};
      for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') fileMap[k] = v;
      return fileMap;
    }
  } catch { /* fall through to empty map, never fabricate a file */ }
  return {};
}

export async function generateFiles(prompt: string, existingFiles?: FileMap): Promise<GenerateResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { files: {}, tokensUsed: 0, success: false, error: 'GROQ_API_KEY is not configured.' };

  const modelId = getPinnedModel('code-generator').model;
  const existing = existingFiles ? `\n\nExisting files:\n${JSON.stringify(existingFiles).slice(0, 2000)}` : '';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: `${prompt}${existing}` }],
      max_tokens: 4096,
      temperature: 0.2,
      stream: false,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return { files: {}, tokensUsed: 0, success: false, error: `Groq generation failed (HTTP ${response.status}): ${detail.slice(0, 300)}`, modelUsed: modelId };
  }
  const data = (await response.json()) as { usage?: { total_tokens?: number }; choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? '';
  const files = parseFileMap(content);
  return { files, tokensUsed: data.usage?.total_tokens ?? 0, success: Object.keys(files).length > 0, modelUsed: modelId, realityAnchorFindings: checkGeneratedFiles(files) };
}
