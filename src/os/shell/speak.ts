// src/os/shell/speak.ts
//
// Real voice output. Primary path calls the actual backend
// /api/autonomy/voice/speak route (real ElevenLabs synthesis). If that
// fails for any reason (no ELEVENLABS_API_KEY configured, network
// failure, upstream error), this falls back to the browser's built-in
// SpeechSynthesis -- a real, working fallback, not a silent failure.
// Callers are responsible for always displaying the text regardless of
// which voice path (or neither) succeeds -- this function never gates
// text display on voice success.

export type SpeakResult = { played: boolean; method: 'elevenlabs' | 'browser-tts' | 'none'; error?: string };

export async function speak(text: string, adminKey: string, tenantId: string): Promise<SpeakResult> {
  if (!text.trim()) return { played: false, method: 'none' };

  try {
    const response = await fetch('/api/autonomy/voice/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-microfixd-admin-key': adminKey, 'x-microfixd-tenant': tenantId },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
    return { played: true, method: 'elevenlabs' };
  } catch (err) {
    // Real fallback: browser SpeechSynthesis, not a fake success.
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
        return { played: true, method: 'browser-tts', error: err instanceof Error ? err.message : String(err) };
      } catch (fallbackErr) {
        return { played: false, method: 'none', error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr) };
      }
    }
    return { played: false, method: 'none', error: err instanceof Error ? err.message : String(err) };
  }
}
