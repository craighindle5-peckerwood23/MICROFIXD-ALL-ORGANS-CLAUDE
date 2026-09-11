// src/autonomy/model-registry.ts
//
// Closes a real, confirmed gap: four model identifiers were hardcoded
// independently across chat.ts, generate.ts, and voice.ts, with no
// central record of what's pinned or which version produced a given
// output. This is the single source of truth now -- every call site
// imports its model id from here instead of a literal string, and every
// response that used a model reports which registry entry it used, so
// two clones of this system are provably running the same models
// (or a diff shows exactly which ones drifted).

export interface PinnedModel {
  role: string;
  provider: 'google' | 'groq' | 'elevenlabs' | 'deepseek';
  model: string;
  pinnedAt: string; // when this pin was last changed, not when the file was read
  usedFor: string;
}

// Changing a value here is the one real, auditable place a model gets
// upgraded -- not a grep-and-replace across three files.
export const MODEL_REGISTRY: Record<string, PinnedModel> = {
  'chat-intent-interpreter': {
    role: 'chat-intent-interpreter',
    provider: 'google',
    model: 'gemini-2.5-flash',
    pinnedAt: '2026-09-04',
    usedFor: 'Primary intent classifier in intent-classifier.ts, used by both chat.ts and intent-organ. Never generates the reply itself.',
  },
  'chat-intent-interpreter-fallback-1': {
    role: 'chat-intent-interpreter-fallback-1',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    pinnedAt: '2026-09-09',
    usedFor: 'Real fallback in intent-classifier.ts when Gemini fails for any reason (quota, rate limit, network, missing key) -- avoids being charged/blocked on a single paid provider for a task this small.',
  },
  'chat-intent-interpreter-fallback-2': {
    role: 'chat-intent-interpreter-fallback-2',
    provider: 'deepseek',
    model: 'deepseek-chat',
    pinnedAt: '2026-09-09',
    usedFor: 'Second real fallback in intent-classifier.ts, tried only if both Gemini and Groq fail. Not live-tested end-to-end in this sandbox (api.deepseek.com is outside the network allowlist) -- structurally correct, built from the documented DeepSeek OpenAI-compatible format.',
  },
  'code-generator': {
    role: 'code-generator',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    pinnedAt: '2026-09-04',
    usedFor: 'Generates the file map returned by /api/autonomy/generate.',
  },
  'voice-primary': {
    role: 'voice-primary',
    provider: 'elevenlabs',
    model: 'eleven_multilingual_v2',
    pinnedAt: '2026-09-04',
    usedFor: 'Primary TTS voice (Nick, British) in voice.ts.',
  },
  'voice-fallback': {
    role: 'voice-fallback',
    provider: 'groq',
    model: 'playai-tts',
    pinnedAt: '2026-09-04',
    usedFor: 'TTS fallback in voice.ts when ElevenLabs is unavailable or ELEVENLABS_API_KEY is unset.',
  },
};

export function getPinnedModel(role: keyof typeof MODEL_REGISTRY): PinnedModel {
  const entry = MODEL_REGISTRY[role];
  if (!entry) throw new Error(`No pinned model registered for role "${role}". Add it to MODEL_REGISTRY before using it.`);
  return entry;
}
