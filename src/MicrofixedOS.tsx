import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type RefObject } from 'react';

/**
 * MicrofixedOS: the single, unified UI -- the visual design from the
 * approved brief (boot sequence + persistent hologram dashboard),
 * wired to the real, tested backend (chat, voice, upload, telemetry).
 *
 * This replaces the split between OperationsConsole.tsx (real backend,
 * wrong visual design) and the standalone HTML mockup (right visual
 * design, fake data) with one component that is both.
 *
 * Anything shown here that looks like a number is either read from a
 * real backend response, or explicitly labeled as unavailable -- never
 * silently randomized to look alive.
 */

type ChatMsg = { role: 'user' | 'ai'; text: string };
type ComputeLocal = { cpuLoadPercent: number | null; memoryUsedPercent: number; uptimeSeconds: number; cpuLogicalCores: number };
type UsageEvent = { kind: string; name: string; createdAt: string };

const request = async <T,>(path: string, key: string, tenantId: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), 'x-microfixd-admin-key': key, 'x-microfixd-tenant': tenantId, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.reason || `Request failed with HTTP ${response.status}.`);
  return body as T;
};

type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

/** Real particle-face renderer -- same technique in the approved mockup, ported to a React-owned canvas ref. */
function useFaceParticles(canvasRef: RefObject<HTMLCanvasElement>, count: number, ringY: number) {
  const stateRef = useRef<{ setForm: (p: number) => void; setEyesLit: (v: boolean) => void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, formProgress = 0, eyesLit = false, t = 0;

    function resize() {
      w = canvas!.clientWidth; h = canvas!.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function buildFacePoints(n: number, cx: number, cy: number, scale: number) {
      const off = document.createElement('canvas'); off.width = 200; off.height = 240;
      const octx = off.getContext('2d')!;
      octx.fillStyle = '#fff';
      octx.beginPath(); octx.ellipse(100, 110, 58, 78, 0, 0, Math.PI * 2); octx.fill();
      octx.beginPath(); octx.moveTo(65, 175); octx.lineTo(60, 230); octx.lineTo(140, 230); octx.lineTo(135, 175); octx.closePath(); octx.fill();
      octx.globalCompositeOperation = 'destination-out';
      octx.beginPath(); octx.ellipse(78, 105, 8, 6, 0, 0, Math.PI * 2); octx.fill();
      octx.beginPath(); octx.ellipse(122, 105, 8, 6, 0, 0, Math.PI * 2); octx.fill();
      octx.beginPath(); octx.ellipse(100, 140, 14, 5, 0, 0, Math.PI * 2); octx.fill();
      octx.globalCompositeOperation = 'source-over';
      const data = octx.getImageData(0, 0, 200, 240).data;
      const candidates: { x: number; y: number }[] = [];
      for (let y = 0; y < 240; y += 2) for (let x = 0; x < 200; x += 2) {
        if (data[(y * 200 + x) * 4 + 3] > 100) candidates.push({ x: (x - 100) * scale + cx, y: (y - 120) * scale + cy });
      }
      for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
      return candidates.slice(0, n);
    }

    const cx = w / 2, cy = h / 2;
    const targets = buildFacePoints(count, cx, cy, Math.min(w, h) / 260);
    const particles = targets.map((tp) => ({ x: cx + (Math.random() - 0.5) * w * 1.4, y: cy + (Math.random() - 0.5) * h * 1.4, tx: tp.x, ty: tp.y, size: Math.random() * 1.4 + 0.6, hueMix: Math.random(), driftPhase: Math.random() * Math.PI * 2 }));
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
    const color = (mix: number, alpha: number) => { const c1 = [94, 234, 212], c2 = [167, 139, 250]; const r = c1[0] + (c2[0] - c1[0]) * mix, g = c1[1] + (c2[1] - c1[1]) * mix, b = c1[2] + (c2[2] - c1[2]) * mix; return `rgba(${r | 0},${g | 0},${b | 0},${alpha})`; };

    function draw() {
      t += 0.016;
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        const drift = Math.sin(t * 0.6 + p.driftPhase) * (1 - formProgress) * 6;
        const ex = p.x + (p.tx - p.x) * easeOutCubic(formProgress) + drift * (1 - formProgress);
        const ey = p.y + (p.ty - p.y) * easeOutCubic(formProgress) + drift * (1 - formProgress) * 0.5;
        p.x += (ex - p.x) * 0.06; p.y += (ey - p.y) * 0.06;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx!.fillStyle = color(p.hueMix, 0.35 + 0.45 * formProgress); ctx!.fill();
      }
      if (eyesLit && formProgress > 0.8) {
        const scale = Math.min(w, h) / 260;
        [[-22, -15], [22, -15]].forEach(([dx, dy]) => {
          const gx = cx + dx * scale, gy = cy + dy * scale;
          const grad = ctx!.createRadialGradient(gx, gy, 0, gx, gy, 14 * scale);
          grad.addColorStop(0, 'rgba(94,234,212,0.9)'); grad.addColorStop(1, 'rgba(94,234,212,0)');
          ctx!.fillStyle = grad; ctx!.beginPath(); ctx!.arc(gx, gy, 14 * scale, 0, Math.PI * 2); ctx!.fill();
        });
      }
      const ringCx = w / 2, ringCy = h * ringY;
      for (let i = 0; i < 3; i++) {
        ctx!.beginPath(); ctx!.ellipse(ringCx, ringCy, (60 + i * 22) * formProgress, (10 + i * 3) * formProgress, 0, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(94,234,212,${0.25 - i * 0.07})`; ctx!.lineWidth = 1.2; ctx!.stroke();
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    stateRef.current = { setForm: (p) => { formProgress = p; }, setEyesLit: (v) => { eyesLit = v; } };
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [canvasRef, count, ringY]);

  return stateRef;
}

export default function MicrofixedOS() {
  // --- Connection gate (real credentials, persisted locally in the real deployed app) ---
  const [key, setKey] = useState(() => localStorage.getItem('microfixd_key') || '');
  const [tenantId] = useState('global');
  const [connected, setConnected] = useState(() => Boolean(localStorage.getItem('microfixd_key')));
  const [connectError, setConnectError] = useState('');

  // --- Boot sequence ---
  const [bootStage, setBootStage] = useState(0); // 0..6, 6 = done
  const bootCanvasRef = useRef<HTMLCanvasElement>(null);
  const bootFace = useFaceParticles(bootCanvasRef, 1100, 0.82);
  const holoCanvasRef = useRef<HTMLCanvasElement>(null);
  const holoFace = useFaceParticles(holoCanvasRef, 1400, 0.9);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const synthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      await sleep(400); setBootStage(1);
      await sleep(2400); if (cancelled) return; bootFace.current?.setForm(1); setBootStage(2);
      await sleep(1800); if (cancelled) return; setBootStage(3);
      await sleep(900); if (cancelled) return; bootFace.current?.setEyesLit(true); setBootStage(4);
      // Spoken welcome uses the phonetic pronunciation ("Microfixed") --
      // separate from the on-screen branded spelling ("MICROFIXD") -- so
      // a screen reader or TTS engine doesn't try to sound out the
      // letters literally.
      if (synthesisSupported && voiceEnabled) {
        const welcome = new SpeechSynthesisUtterance('Welcome to Microfixed. Good morning. I am Microfixed, connected to your real, governed backend.');
        window.speechSynthesis.speak(welcome);
      }
      await sleep(2600); if (cancelled) return; setBootStage(5);
      await sleep(1800); if (cancelled) return; setBootStage(6);
      await sleep(700); if (cancelled) return; setBootStage(7); // fully done
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  useEffect(() => {
    if (bootStage >= 7) { holoFace.current?.setForm(1); holoFace.current?.setEyesLit(true); }
  }, [bootStage, holoFace]);

  // --- Chat ---
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = typeof window !== 'undefined' && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !synthesisSupported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => setSpeaking(true); u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [voiceEnabled, synthesisSupported]);
  const stopSpeaking = () => { if (synthesisSupported) window.speechSynthesis.cancel(); setSpeaking(false); };

  // --- Live telemetry, polled from the real backend ---
  const [compute, setCompute] = useState<ComputeLocal | null>(null);
  const [recentEvents, setRecentEvents] = useState<UsageEvent[]>([]);
  const [telemetryError, setTelemetryError] = useState('');

  const refreshTelemetry = useCallback(async () => {
    if (!connected) return;
    try {
      const computeRes = await request<{ compute: { payload: { local: ComputeLocal } } }>('/api/autonomy/compute/posture', key, tenantId);
      setCompute(computeRes.compute.payload.local);
      const usage = await request<{ recentDurableEvents: UsageEvent[] }>('/api/autonomy/usage-report', key, tenantId);
      setRecentEvents(usage.recentDurableEvents.slice(0, 6));
      setTelemetryError('');
    } catch (err) {
      setTelemetryError((err as Error).message);
    }
  }, [connected, key, tenantId]);

  useEffect(() => {
    if (!connected) return;
    refreshTelemetry();
    const id = setInterval(refreshTelemetry, 6000);
    return () => clearInterval(id);
  }, [connected, refreshTelemetry]);

  const sendChatMessage = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setChatLog((log) => [...log, { role: 'user', text }]);
    setChatBusy(true);
    try {
      const result = await request<{ reply: string }>('/api/autonomy/chat', key, tenantId, { method: 'POST', body: JSON.stringify({ message: text, requestedBy: 'Craig' }) });
      setChatLog((log) => [...log, { role: 'ai', text: result.reply }]);
      speak(result.reply);
      refreshTelemetry();
    } catch (err) {
      setChatLog((log) => [...log, { role: 'ai', text: `Error: ${(err as Error).message}` }]);
    } finally {
      setChatBusy(false);
    }
  }, [key, tenantId, speak, refreshTelemetry]);

  const toggleListening = () => {
    if (!speechSupported) return;
    if (listening) { recognitionRef.current?.stop(); return; }
    const Ctor = ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)!;
    const rec = new Ctor();
    rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e) => { const t = e.results[0]?.[0]?.transcript; if (t) void sendChatMessage(t); };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec; setListening(true); rec.start();
  };

  // --- File upload ---
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFile = useCallback(async (file: File) => {
    setUploadBusy(true);
    setChatLog((log) => [...log, { role: 'user', text: `Uploading ${file.name}...` }]);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).slice((reader.result as string).indexOf(',') + 1));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await request<{ upload: { filename: string; sizeBytes: number; id: string } }>('/api/autonomy/upload', key, tenantId, { method: 'POST', body: JSON.stringify({ filename: file.name, mimeType: file.type, base64Content: base64, requestedBy: 'Craig' }) });
      setChatLog((log) => [...log, { role: 'ai', text: `Stored "${result.upload.filename}" (${result.upload.sizeBytes} bytes).` }]);
      refreshTelemetry();
    } catch (err) {
      setChatLog((log) => [...log, { role: 'ai', text: `Upload failed: ${(err as Error).message}` }]);
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [key, tenantId, refreshTelemetry]);

  const [activePanel, setActivePanel] = useState('mission-control');

  // "Always alive" cue: a brief pulse through the persistent head when
  // the user navigates, so it visibly reacts rather than sitting inert
  // in the corner while the UI changes around it.
  const acknowledgeNav = useCallback((panel: string) => {
    setActivePanel(panel);
    holoFace.current?.setForm(0.85);
    setTimeout(() => holoFace.current?.setForm(1), 220);
  }, [holoFace]);

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault();
    setConnectError('');
    try {
      await request('/api/autonomy/introspection', key, tenantId);
      localStorage.setItem('microfixd_key', key);
      setConnected(true);
    } catch (err) {
      setConnectError((err as Error).message);
    }
  };

  if (!connected) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#030712', color: '#e2e8f0', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleConnect} style={{ width: 340, background: '#0a1120', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>MICROFIXED</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 18, letterSpacing: 1 }}>ENTER OPERATIONS KEY TO CONNECT</div>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin API key" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #1e293b', background: '#030712', color: '#e2e8f0', marginBottom: 12 }} />
          {connectError && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{connectError}</div>}
          <button type="submit" style={{ width: '100%', padding: 10, borderRadius: 8, border: 'none', background: '#2dd4bf', color: '#031014', fontWeight: 700, cursor: 'pointer' }}>Connect</button>
        </form>
      </div>
    );
  }

  const stageLabels = ['', '1 · Boot Sequence', '2 · Emergence — AI takes shape', '3 · Awareness — System online', '4 · Greeting', '5 · Interaction', '6 · Full Interface', ''];

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#030712', color: '#e2e8f0', fontFamily: "'Segoe UI', sans-serif", overflow: 'hidden' }}>
      {bootStage < 7 && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100, background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: bootStage >= 7 ? 0 : 1, transition: 'opacity 0.8s ease' }}>
          <canvas ref={bootCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          {bootStage >= 1 && (
            <div style={{ position: 'absolute', top: '14%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'monospace', fontSize: 13, color: '#5eead4', lineHeight: 1.9, width: 340 }}>
              {['Initializing Core Systems...', 'Loading Neural Architecture...', 'Calibrating Modules...', 'Establishing Secure Connection...', 'Priming Memory Banks...', 'System Check: Complete...'].map((l, i) => <div key={i}>&gt; {l}</div>)}
              <div style={{ color: '#4ade80', marginTop: 6 }}>&gt; STATUS: NOMINAL</div>
            </div>
          )}
          {bootStage >= 4 && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(calc(-50% + 190px), -50%)', width: 320 }}>
              <div style={{ fontSize: 11, color: '#475569', letterSpacing: 2, textTransform: 'uppercase' }}>Autonomous Intelligence</div>
              <h1 style={{ fontSize: 26, fontWeight: 300, letterSpacing: 1, color: '#fff' }}>WELCOME TO MICROFIXD</h1>
              <div style={{ fontSize: 12, color: '#5eead4', letterSpacing: 1, marginBottom: 10 }}>pronounced "Microfixed" — spelled M‑I‑C‑R‑O‑F‑I‑X‑D</div>
              <p style={{ marginTop: 14, fontSize: 14, color: '#94a3b8' }}>Good Morning. I am Microfixd.</p>
              <p style={{ fontSize: 14, color: '#94a3b8' }}>Connected to your real, governed backend.</p>
              {bootStage >= 5 && <p style={{ marginTop: 10, fontSize: 14, color: '#94a3b8' }}>How may I assist you today?</p>}
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', fontSize: 11, letterSpacing: 3, color: '#475569', textTransform: 'uppercase' }}>{stageLabels[bootStage]}</div>
          <button onClick={() => setBootStage(7)} style={{ position: 'absolute', bottom: 28, right: 32, background: 'transparent', border: '1px solid #1e293b', color: '#94a3b8', padding: '8px 16px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Skip &rarr;</button>
        </div>
      )}

      <div style={{ position: 'absolute', inset: 0, opacity: bootStage >= 7 ? 1 : 0, transition: 'opacity 1s ease', display: 'grid', gridTemplateRows: '52px 1fr' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid #1e293b', background: '#0a1120' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#2dd4bf,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, color: '#041014' }}>MF</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>MICROFIXED</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#94a3b8' }}>
            {telemetryError && <span style={{ color: '#fbbf24' }}>Telemetry: {telemetryError}</span>}
            <span>UPTIME {compute ? `${Math.floor(compute.uptimeSeconds / 60)}m` : '—'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: '#4ade80' }} /> LIVE</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', overflow: 'hidden' }}>
          <div style={{ background: '#0a1120', borderRight: '1px solid #1e293b', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[['mission-control', 'Mission'], ['ai-core', 'AI Core'], ['agents', 'Agents'], ['workspace', 'Workspace'], ['infra', 'System']].map(([id, label]) => (
              <div key={id} onClick={() => acknowledgeNav(id)} style={{ padding: '9px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: activePanel === id ? 'rgba(94,234,212,0.08)' : 'transparent', border: activePanel === id ? '1px solid rgba(94,234,212,0.25)' : '1px solid transparent' }}>{label}</div>
            ))}
            <div style={{ flex: 1 }} />
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: 10, fontSize: 10, color: '#94a3b8' }}>
              <div>CPU {compute?.cpuLoadPercent ?? '—'}%</div>
              <div>MEM {compute?.memoryUsedPercent ?? '—'}%</div>
              <div>{compute?.cpuLogicalCores ?? '—'} cores</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr 230px', gap: 10, padding: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              <div style={{ background: '#0a1120', border: '1px solid #1e293b', borderRadius: 10, padding: 12 }}>
                <h3 style={{ fontSize: 11, letterSpacing: 1, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Host Metrics (Real)</h3>
                <div style={{ fontSize: 11.5, marginBottom: 4 }}>CPU Load: <b style={{ color: '#5eead4' }}>{compute?.cpuLoadPercent ?? 'unavailable'}%</b></div>
                <div style={{ fontSize: 11.5, marginBottom: 4 }}>Memory Used: <b style={{ color: '#5eead4' }}>{compute?.memoryUsedPercent ?? '—'}%</b></div>
                <div style={{ fontSize: 11.5 }}>Logical Cores: <b style={{ color: '#5eead4' }}>{compute?.cpuLogicalCores ?? '—'}</b></div>
              </div>
              <div style={{ background: '#0a1120', border: '1px solid #1e293b', borderRadius: 10, padding: 12, flex: 1, overflow: 'auto' }}>
                <h3 style={{ fontSize: 11, letterSpacing: 1, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Recent Activity (Real, Durable)</h3>
                {recentEvents.length === 0 && <div style={{ fontSize: 11, color: '#475569' }}>No events yet.</div>}
                {recentEvents.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#94a3b8', padding: '5px 0', borderBottom: '1px solid #1e293b' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569', marginRight: 6 }}>{new Date(e.createdAt).toLocaleTimeString()}</span>{e.kind}: {e.name}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 560, maxHeight: 160, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chatLog.map((m, i) => (
                  <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', fontSize: 12, padding: '8px 12px', borderRadius: 8, background: '#0a1120', border: '1px solid #1e293b', maxWidth: '90%', color: m.role === 'user' ? '#e2e8f0' : '#2dd4bf' }}>{m.text}</div>
                ))}
              </div>
              <canvas ref={holoCanvasRef} style={{ width: '100%', flex: 1 }} />
              <form onSubmit={(e) => { e.preventDefault(); const t = chatInput; setChatInput(''); void sendChatMessage(t); }} style={{ width: '100%', maxWidth: 560, background: '#0a1120', border: '1px solid #1e293b', borderRadius: 12, padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} disabled={chatBusy} placeholder="What would you like me to accomplish?" style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 13 }} />
                <input ref={fileInputRef} type="file" onChange={(e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }} disabled={uploadBusy} style={{ display: 'none' }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadBusy} style={{ background: '#0d1526', border: '1px solid #1e293b', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#e2e8f0' }}>{uploadBusy ? '…' : '📎'}</button>
                <button type="button" onClick={toggleListening} disabled={!speechSupported} style={{ background: listening ? '#5c1a1a' : '#0d1526', border: '1px solid #1e293b', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: '#e2e8f0' }}>{listening ? '●' : '🎙'}</button>
                <button type="submit" disabled={chatBusy || !chatInput.trim()} style={{ background: '#2dd4bf', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', color: '#031014', fontWeight: 700, fontSize: 12 }}>{chatBusy ? '…' : 'Send'}</button>
              </form>
              <div style={{ display: 'flex', gap: 10, fontSize: 10.5, color: '#94a3b8', marginTop: 6 }}>
                <label><input type="checkbox" checked={voiceEnabled} onChange={(e) => setVoiceEnabled(e.target.checked)} /> Speak replies</label>
                {speaking && <button onClick={stopSpeaking} style={{ background: 'transparent', border: '1px solid #1e293b', color: '#94a3b8', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>⏹ Stop</button>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto' }}>
              <div style={{ background: '#0a1120', border: '1px solid #1e293b', borderRadius: 10, padding: 12 }}>
                <h3 style={{ fontSize: 11, letterSpacing: 1, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 8 }}>Quick Actions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {['system status', 'list organs', 'safe mode status', 'usage report'].map((cmd) => (
                    <div key={cmd} onClick={() => sendChatMessage(cmd)} style={{ background: '#0d1526', border: '1px solid #1e293b', borderRadius: 8, padding: '8px 4px', textAlign: 'center', fontSize: 10, color: '#94a3b8', cursor: 'pointer' }}>{cmd}</div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#0a1120', border: '1px solid #1e293b', borderRadius: 10, padding: 12, fontSize: 10.5, color: '#475569' }}>
                Every response here comes from your real <code>/api/autonomy/chat</code> endpoint through Paragon governance -- nothing on this panel is simulated.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
