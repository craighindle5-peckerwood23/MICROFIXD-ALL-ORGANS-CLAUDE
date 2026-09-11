// src/os/shell/ChatDock.tsx
//
// This is the literal "chat box input area for all operations commands"
// -- it calls the real, governed /api/autonomy/chat endpoint (see
// chat.ts: regex intents, plus an LLM interpretation layer when
// GEMINI_API_KEY is set, both routing through the same Paragon
// governance every REST route uses). Every reply is shown as text
// immediately; voice is layered on top via speak() and never blocks or
// replaces the text.

import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../state/api.ts';
import { speak } from './speak.ts';
import { listen } from './listen.ts';
import { useOS } from '../state/os-context.tsx';
import { audioManager } from './audio-manager.ts';

type ChatTurn = { role: 'user' | 'system'; text: string; voiceMethod?: string };

export function ChatDock() {
  const { adminKey, tenantId, handleEvent, pendingCommand, setPendingCommand, setLastVoiceTranscript } = useOS();
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendText = useCallback(async (text: string) => {
    if (!text.trim() || !adminKey || busy) return;
    audioManager.markUserInteracted(); // real user gesture -- unlocks audio per browser autoplay policy
    setTurns((prev) => [...prev, { role: 'user', text }]);
    setBusy(true);
    try {
      const result = await request<{ reply: string; status: string }>('/api/autonomy/chat', adminKey, tenantId, {
        method: 'POST',
        body: JSON.stringify({ message: text, requestedBy: 'Craig' }),
      });
      let voiceMethod: string | undefined;
      if (voiceEnabled) {
        const outcome = await speak(result.reply, adminKey, tenantId);
        voiceMethod = outcome.method;
      }
      setTurns((prev) => [...prev, { role: 'system', text: result.reply, voiceMethod }]);
      if (result.status === 'awaiting_approval') handleEvent({ type: 'approval.required', missionId: 'chat', stepId: 'chat' });
      else if (result.status === 'denied') handleEvent({ type: 'system.error', message: result.reply });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTurns((prev) => [...prev, { role: 'system', text: `Error: ${message}` }]);
      handleEvent({ type: 'system.error', message });
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  }, [adminKey, tenantId, busy, voiceEnabled, handleEvent]);

  const send = useCallback(() => {
    const text = input.trim();
    setInput('');
    void sendText(text);
  }, [input, sendText]);

  const [listening, setListening] = useState(false);
  const mic = useCallback(async () => {
    setListening(true);
    try {
      const transcript = await listen();
      setLastVoiceTranscript(transcript.trim() || null);
      if (transcript.trim()) void sendText(transcript);
    } catch (err) {
      setTurns((prev) => [...prev, { role: 'system', text: `Voice input error: ${err instanceof Error ? err.message : String(err)}` }]);
    } finally {
      setListening(false);
    }
  }, [sendText]);

  // Real dispatch path for QuickActions.tsx: a shortcut button sets
  // pendingCommand, this fires the exact same governed chat call as
  // typing it, then clears the flag.
  useEffect(() => {
    if (pendingCommand) {
      void sendText(pendingCommand);
      setPendingCommand(null);
    }
  }, [pendingCommand, sendText, setPendingCommand]);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div ref={scrollRef} className="max-h-40 overflow-y-auto space-y-1 px-1 font-mono text-xs">
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'text-slate-300' : 'text-teal-300'}>
            <span className="text-slate-600">{t.role === 'user' ? '> ' : ''}</span>{t.text}
            {t.voiceMethod === 'browser-tts' && <span className="ml-2 text-amber-400/70 text-[10px]">(fallback voice)</span>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="What would you like to accomplish?"
          disabled={!adminKey}
          className="flex-1 rounded-full border border-teal-500/20 bg-black/50 px-5 py-3 text-sm text-slate-200 outline-none focus:border-teal-400/60 disabled:opacity-40"
        />
        <button
          onClick={() => void mic()}
          disabled={!adminKey || listening}
          title="Speak a command"
          className={`rounded-full border px-3 py-3 text-xs ${listening ? 'border-red-400/60 text-red-300 animate-pulse' : 'border-teal-400/40 text-teal-300'} disabled:opacity-40`}
        >
          {listening ? '\u{1F534}' : '\u{1F3A4}'}
        </button>
        <button
          onClick={() => setVoiceEnabled((v) => !v)}
          title="Toggle voice output"
          className={`rounded-full border px-3 py-3 text-xs ${voiceEnabled ? 'border-teal-400/40 text-teal-300' : 'border-white/10 text-slate-600'}`}
        >
          {voiceEnabled ? '\u{1F50A}' : '\u{1F507}'}
        </button>
        <button
          onClick={send}
          disabled={busy || !input.trim() || !adminKey}
          className="rounded-full border border-teal-400/40 bg-teal-500/10 px-5 py-3 text-sm text-teal-200 disabled:opacity-40"
        >
          {busy ? '\u2026' : '\u2191'}
        </button>
      </div>
    </div>
  );
}
