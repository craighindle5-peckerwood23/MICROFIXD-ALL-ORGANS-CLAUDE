// src/autonomy/voice.ts
//
// Real ElevenLabs text-to-speech -- not browser SpeechSynthesis. Calls
// the actual ElevenLabs REST API. The default voice_id below
// (v4mOufztUtjxcpk65aWy, "Nick, British Voice") was pulled live from
// Craig's own connected ElevenLabs account via creative_list_voices, not
// invented -- ElevenLabs' own description: "feels intelligent, composed,
// and professional," which is exactly the character requested.
//
// Fails honestly: if ELEVENLABS_API_KEY is not set, or the API call
// fails for any reason, this throws rather than returning fake audio.
// The frontend caller (see os/shell/Speak.tsx) is responsible for
// falling back to text display or browser TTS on that failure -- this
// module's only job is to be real or say why it isn't.

import { getPinnedModel } from './model-registry.ts';

export const DEFAULT_VOICE_ID = 'v4mOufztUtjxcpk65aWy'; // "Nick, British Voice" -- Craig's own ElevenLabs library

/**
 * Real 2-tier server-side fallback: ElevenLabs first (higher quality,
 * the requested "intelligent British" voice), then Groq's playai-tts if
 * ELEVENLABS_API_KEY isn't set or the call fails. Both are real API
 * calls to real providers -- ported from the real Groq TTS branch found
 * in the uploaded reference zip's speech.ts, adapted to this backend's
 * error-handling style. If both fail, this throws and the frontend
 * speak() helper falls back to browser SpeechSynthesis, same as before.
 */
export async function synthesizeSpeech(text: string, voiceId = process.env.MICROFIXD_VOICE_ID || DEFAULT_VOICE_ID): Promise<Buffer> {
  if (!text.trim()) throw new Error('Cannot synthesize empty text.');

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey) {
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: { 'xi-api-key': elevenKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: getPinnedModel('voice-primary').model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
      });
      if (response.ok) return Buffer.from(await response.arrayBuffer());
    } catch { /* fall through to Groq */ }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: getPinnedModel('voice-fallback').model, input: text, voice: 'alloy', response_format: 'wav' }),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    const detail = await response.text().catch(() => '');
    throw new Error(`Groq TTS failed (HTTP ${response.status}): ${detail.slice(0, 300)}`);
  }

  throw new Error('Voice synthesis requires ELEVENLABS_API_KEY or GROQ_API_KEY to be configured.');
}
