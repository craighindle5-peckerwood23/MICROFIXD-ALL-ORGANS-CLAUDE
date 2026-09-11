import { type CSSProperties, type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Health = { status: string; service?: string; tier0?: string; uptimeSeconds?: number; storage?: { durable: boolean; storage: string }; reason?: string };
type Run = { id: string; tenantId: string; status: string; currentStep: number; outcome?: string; error?: string; workingMemory?: Record<string, unknown> };
type Approval = { id: string; runId: string; reason: string; status: string; action: { title: string; kind: string; risk: string }; requestedAt: string };
type RecordItem = { id: string; name: string; status: string; tenantId: string; payload: Record<string, unknown> };
type WhiteLabel = { settings: { brandName: string; palette: { accent: string; background: string } } };
type Metacognition = { assessment: { confidence: string; selfModel: { plannedSteps: number; completedSteps: number; blockedSteps: number; failedSteps: number } } };
type ChatReply = { reply: string; status: 'ok' | 'awaiting_approval' | 'denied' | 'not_understood'; organId?: string; data?: unknown };

// Minimal shape of the (non-standard, browser-only) Web Speech API's
// SpeechRecognition interface -- not part of the default TS DOM lib.
// This is the whole surface OperationsConsole actually uses.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const request = async <T,>(path: string, key: string, tenantId: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), 'x-microfixd-admin-key': key, 'x-microfixd-tenant': tenantId, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || body.reason || `Request failed with HTTP ${response.status}.`);
  return body as T;
};

const healthLabel = (health: Health | null): string => health?.status === 'ok' ? 'NOMINAL' : health?.status === 'degraded' ? 'LIMITED' : 'CHECKING';

export default function OperationsConsole() {
  const [health, setHealth] = useState<Health | null>(null);
  const [readiness, setReadiness] = useState<Health | null>(null);
  const [key, setKey] = useState('');
  const [tenantId, setTenantId] = useState('global');
  const [tenantName, setTenantName] = useState('');
  const [tenants, setTenants] = useState<RecordItem[]>([]);
  const [agents, setAgents] = useState<RecordItem[]>([]);
  const [agentPosture, setAgentPosture] = useState<Record<string, unknown> | null>(null);
  const [compute, setCompute] = useState<Record<string, unknown> | null>(null);
  const [infrastructure, setInfrastructure] = useState<RecordItem | null>(null);
  const [webUse, setWebUse] = useState<RecordItem | null>(null);
  const [selfHealing, setSelfHealing] = useState<RecordItem | null>(null);
  const [wiring, setWiring] = useState<RecordItem | null>(null);
  const [audit, setAudit] = useState<RecordItem | null>(null);
  const [governanceLock, setGovernanceLock] = useState<RecordItem | null>(null);
  const [bringUp, setBringUp] = useState<RecordItem | null>(null);
  const [safeMode, setSafeMode] = useState<RecordItem | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [whiteLabel, setWhiteLabel] = useState<WhiteLabel | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [metacognition, setMetacognition] = useState<Metacognition | null>(null);
  const [goal, setGoal] = useState('Design and validate a sandbox capability for governed telemetry summarization.');
  const [agentId, setAgentId] = useState('microfixd-primary');
  const [message, setMessage] = useState('Enter an operations key to unlock tenant-scoped mission control.');
  const [busy, setBusy] = useState(false);
  const [arcanaSpeaking, setArcanaSpeaking] = useState(false);
  const arcanaAudio = useRef<HTMLAudioElement | null>(null);
  const [chatLog, setChatLog] = useState<Array<{ role: 'user' | 'microfixd'; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = useMemo(
    () => typeof window !== 'undefined' && Boolean((window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition),
    [],
  );
  const synthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const refreshHealth = useCallback(async () => {
    try {
      const [nextHealth, nextReady] = await Promise.all([
        fetch('/healthz').then((response) => response.json() as Promise<Health>),
        fetch('/readyz').then((response) => response.json() as Promise<Health>),
      ]);
      setHealth(nextHealth);
      setReadiness(nextReady);
    } catch (error) { setMessage((error as Error).message); }
  }, []);

  const refreshMission = useCallback(async () => {
    if (!key) return;
    try {
      const [tenantData, agentData, agentPostureData, computeData, infrastructureData, webUseData, selfHealingData, wiringData, auditData, governanceLockData, bringUpData, safeData, approvalData, labelData] = await Promise.all([
        request<{ tenants: RecordItem[] }>('/api/autonomy/tenants', key, tenantId),
        request<{ agents: RecordItem[] }>('/api/autonomy/agents', key, tenantId),
        request<{ posture: Record<string, unknown> }>('/api/autonomy/agents/posture', key, tenantId),
        request<{ compute: Record<string, unknown> }>('/api/autonomy/compute', key, tenantId),
        request<{ infrastructure: RecordItem }>('/api/autonomy/infrastructure', key, tenantId),
        request<{ webUse: RecordItem }>('/api/autonomy/web/posture', key, tenantId),
        request<{ selfHealing: RecordItem }>('/api/autonomy/self-healing', key, tenantId),
        request<{ wiring: RecordItem }>('/api/autonomy/wiring', key, tenantId),
        request<{ audit: RecordItem }>('/api/autonomy/audit', key, tenantId),
        request<{ governanceLock: RecordItem }>('/api/autonomy/governance-lock', key, tenantId),
        request<{ bringUp: RecordItem }>('/api/autonomy/bring-up', key, tenantId),
        request<{ safeMode: RecordItem[] }>('/api/autonomy/safe-mode', key, tenantId),
        request<{ approvals: Approval[] }>('/api/autonomy/approvals?status=pending', key, tenantId),
        request<WhiteLabel>('/api/autonomy/white-label', key, tenantId),
      ]);
      setTenants(tenantData.tenants);
      setAgents(agentData.agents);
      setAgentPosture(agentPostureData.posture);
      setCompute(computeData.compute);
      setInfrastructure(infrastructureData.infrastructure);
      setWebUse(webUseData.webUse);
      setSelfHealing(selfHealingData.selfHealing);
      setWiring(wiringData.wiring);
      setAudit(auditData.audit);
      setGovernanceLock(governanceLockData.governanceLock);
      setBringUp(bringUpData.bringUp);
      setSafeMode(safeData.safeMode[0] || null);
      setApprovals(approvalData.approvals);
      setWhiteLabel(labelData);
    } catch (error) { setMessage((error as Error).message); }
  }, [key, tenantId]);

  useEffect(() => { void refreshHealth(); }, [refreshHealth]);
  useEffect(() => { void refreshMission(); }, [refreshMission]);
  useEffect(() => () => {
    if (!arcanaAudio.current) return;
    arcanaAudio.current.pause();
    arcanaAudio.current.src = '';
    arcanaAudio.current = null;
  }, []);
  useEffect(() => () => { recognitionRef.current?.stop(); if (synthesisSupported) window.speechSynthesis.cancel(); }, [synthesisSupported]);

  const submitGoal = async (event: FormEvent) => {
    event.preventDefault();
    if (!key) return setMessage('Enter the operations key before submitting a governed goal.');
    setBusy(true);
    try {
      const result = await request<{ run: Run }>('/api/autonomy/goals', key, tenantId, { method: 'POST', body: JSON.stringify({ goal, agentId, tenantId, requestedBy: 'Craig' }) });
      setRun(result.run);
      if (result.run.status !== 'awaiting_approval') setMetacognition(await request<Metacognition>(`/api/autonomy/runs/${result.run.id}/metacognition`, key, tenantId));
      setMessage(result.run.status === 'awaiting_approval' ? 'Tier-0 escalated this work to Craig.' : 'The bounded workflow, agent handoffs, and reflection record completed.');
      await refreshMission();
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };

  const createTenant = async () => {
    if (!key) return setMessage('Enter the operations key before creating a tenant.');
    const nextId = tenantName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!nextId) return setMessage('Enter a tenant name using letters, digits, spaces, or dashes.');
    setBusy(true);
    try {
      await request('/api/autonomy/tenants', key, nextId, { method: 'POST', body: JSON.stringify({ tenantId: nextId, name: tenantName }) });
      setTenantId(nextId); setTenantName(''); setMessage(`Created and selected tenant ${nextId}.`);
      await refreshMission();
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };

  const toggleSafeMode = async () => {
    if (!key) return setMessage('Enter the operations key before changing safe mode.');
    setBusy(true);
    try {
      const enabled = safeMode?.status !== 'enabled';
      await request('/api/autonomy/safe-mode', key, tenantId, { method: 'POST', body: JSON.stringify({ enabled, actor: 'Craig', reason: enabled ? 'Mission-control operator hold' : 'Mission-control operator release' }) });
      setMessage(enabled ? 'Safe mode is active: only inspection is permitted.' : 'Safe mode released: bounded work may resume under Tier-0 review.');
      await refreshMission();
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };

  const captureScreenshot = async () => {
    if (!key) return setMessage('Enter the operations key before requesting a local-console screenshot.');
    setBusy(true);
    try {
      const response = await fetch('/api/autonomy/snapshot/screenshot', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-microfixd-admin-key': key, 'x-microfixd-tenant': tenantId }, body: '{}' });
      if (response.ok && (response.headers.get('content-type') || '').includes('image/png')) {
        const url = URL.createObjectURL(await response.blob()); window.open(url, '_blank', 'noopener,noreferrer');
        setMessage('Captured a Tier-0-governed local mission-control screenshot. External navigation was blocked.');
      } else { const body = await response.json().catch(() => ({})); setMessage(body.screenshot?.reason || body.error || `Screenshot request returned HTTP ${response.status}.`); }
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  };

  const playArcanaIntroduction = async () => {
    try {
      let audio = arcanaAudio.current;
      if (!audio) {
        audio = new Audio('/audio/arcana-introduction.wav');
        audio.preload = 'auto';
        audio.volume = 0.84;
        audio.addEventListener('ended', () => setArcanaSpeaking(false));
        audio.addEventListener('pause', () => setArcanaSpeaking(false));
        audio.addEventListener('error', () => {
          setArcanaSpeaking(false);
          setMessage('Arcana’s local voice asset is unavailable. Rebuild the client bundle and try again.');
        });
        arcanaAudio.current = audio;
      }
      audio.currentTime = 0;
      setArcanaSpeaking(true);
      await audio.play();
      setMessage('Arcana voice introduction playing locally. No provider request or credential is used.');
    } catch (error) {
      setArcanaSpeaking(false);
      setMessage(`Browser audio requires a direct click to play: ${(error as Error).message}`);
    }
  };

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !synthesisSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled, synthesisSupported]);

  const stopSpeaking = () => {
    if (!synthesisSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const sendChatMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;
    if (!key) { setMessage('Enter the operations key before using the chat interface.'); return; }
    setChatLog((log) => [...log, { role: 'user', text }]);
    setChatBusy(true);
    try {
      const result = await request<ChatReply>('/api/autonomy/chat', key, tenantId, { method: 'POST', body: JSON.stringify({ message: text, requestedBy: 'Craig' }) });
      setChatLog((log) => [...log, { role: 'microfixd', text: result.reply }]);
      speak(result.reply);
      if (result.status !== 'not_understood') await refreshMission();
    } catch (error) {
      const errorText = (error as Error).message;
      setChatLog((log) => [...log, { role: 'microfixd', text: errorText }]);
    } finally {
      setChatBusy(false);
    }
  }, [key, tenantId, speak, refreshMission]);

  const uploadFile = useCallback(async (file: File) => {
    if (!key) { setMessage('Enter the operations key before uploading.'); return; }
    setUploadBusy(true);
    setChatLog((log) => [...log, { role: 'user', text: `Uploading ${file.name} (${(file.size / 1024).toFixed(1)} KB)...` }]);
    try {
      const base64Content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.slice(result.indexOf(',') + 1)); // strip the data: URL prefix
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await request<{ upload: { id: string; filename: string; sizeBytes: number }; note: string }>(
        '/api/autonomy/upload', key, tenantId,
        { method: 'POST', body: JSON.stringify({ filename: file.name, mimeType: file.type, base64Content, requestedBy: 'Craig' }) },
      );
      setChatLog((log) => [...log, { role: 'microfixd', text: `Stored "${result.upload.filename}" (${result.upload.sizeBytes} bytes, id ${result.upload.id}). ${result.note}` }]);
      await refreshMission();
    } catch (error) {
      setChatLog((log) => [...log, { role: 'microfixd', text: `Upload failed: ${(error as Error).message}` }]);
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [key, tenantId, refreshMission]);

  const handleFileSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file);
  };

  const submitChatInput = (event: FormEvent) => {
    event.preventDefault();
    const text = chatInput;
    setChatInput('');
    void sendChatMessage(text);
  };

  const toggleListening = () => {
    if (!speechSupported) { setMessage('This browser does not support live speech recognition. Chrome or Edge is recommended.'); return; }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionCtor = ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)!;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) void sendChatMessage(transcript);
    };
    recognition.onerror = (event) => { setMessage(`Voice input error: ${event.error}`); setListening(false); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const runDiagnostics = async () => {
    if (!key) return setMessage('Enter the operations key before running read-only automotive diagnostics.');
    try {
      const result = await request<{ diagnostics: { classification: string; alerts: string[] } }>('/api/autonomy/automotive/diagnostics', key, tenantId, { method: 'POST', body: JSON.stringify({ coolantTempC: 115, voltage: 11.2, rpm: 2500, diagnosticCodes: ['P0128'] }) });
      setMessage(`Automotive read-only diagnostic: ${result.diagnostics.classification}. ${result.diagnostics.alerts.join(' ')}`);
    } catch (error) { setMessage((error as Error).message); }
  };

  const brandName = whiteLabel?.settings.brandName || 'Microfixd';
  const safeModeOn = safeMode?.status === 'enabled';
  const computeSummary = useMemo(() => compute?.local as Record<string, unknown> | undefined, [compute]);
  const agentTelemetry = useMemo(() => agentPosture?.telemetry as { evidenceCount?: number; byStatus?: Record<string, number> } | undefined, [agentPosture]);
  const headStyle = whiteLabel ? ({ '--accent': whiteLabel.settings.palette.accent, '--background': whiteLabel.settings.palette.background } as CSSProperties) : undefined;

  return <main className="mission-shell" style={headStyle}>
    <header className="mission-header">
      <div><p className="eyebrow">LEVEL-6 SYNTHETIC OPERATIONS PLATFORM</p><h1>{brandName}<span>/ MISSION CONTROL</span></h1><p>Tier‑0 Paragon Dissector governs all 200 organs, eight foundational layers, enterprise tenant overlays, agents, workflows, adapters, and operator commands.</p></div>
      <div className={`mission-status ${health?.status === 'ok' ? 'ok' : 'warn'}`}><b>{healthLabel(health)}</b><small>{safeModeOn ? 'SAFE MODE ACTIVE' : readiness?.storage?.durable ? 'SUPABASE DURABLE' : 'LOCAL DEVELOPMENT MODE'}</small></div>
    </header>

    <section className="holo-grid">
      <aside className="holo-side"><p className="eyebrow">TENANT CONTEXT</p><select value={tenantId} onChange={(event) => setTenantId(event.target.value)}>{tenants.map((tenant) => <option value={tenant.tenantId} key={tenant.id}>{tenant.name} · {tenant.status}</option>)}<option value="global">Global Operations</option></select><div className="tenant-create"><input value={tenantName} onChange={(event) => setTenantName(event.target.value)} placeholder="New tenant name" /><button type="button" onClick={() => void createTenant()} disabled={busy}>Add tenant</button></div><p className="tiny">The tenant profile isolates constitutions, doctrine, plugins, workflows, memory, compute, safety, evolution, telemetry, drift, and recovery evidence. Global Paragon remains above every tenant doctrine.</p><label>Operations key<input type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Never retained" autoComplete="off" /></label><button className="ghost-button" type="button" onClick={() => void refreshMission()}>Refresh mission state</button></aside>

      <section className="holo-core" aria-label="Holographic humanoid mission-control representation">
        <div className="orbit orbit-one"><span>ORGANS</span></div><div className="orbit orbit-two"><span>AGENTS</span></div><div className="orbit orbit-three"><span>TENANTS</span></div>
        <div className="holographic-head"><div className="head-halo"/><div className="head-crown"/><div className="head-face"><i/><i/><b/></div><div className="head-neck"/></div>
        <div className="arcana-voice-control"><span>ARCANA / VOICE LINK</span><button className="arcana-button" type="button" onClick={() => void playArcanaIntroduction()} aria-pressed={arcanaSpeaking}>{arcanaSpeaking ? 'Arcana speaking…' : 'Hear Arcana introduction'}</button><small>User-triggered local audio · no provider route</small></div>
        <div className="core-label"><b>PARAGON</b><span>TIER‑0 AUTHORITY</span><small>{safeModeOn ? 'SAFE MODE / INSPECTION ONLY' : 'BOUNDARY-CONTROLLED AUTONOMY'}</small></div>

        <div className="chat-console" aria-label="Governed chat interface reaching every organ">
          <div className="chat-log" role="log" aria-live="polite">
            {chatLog.length === 0 && <p className="tiny">Ask about system status, organs, agents, compute, safe mode, approvals, or say "create a goal to ...". Every answer comes from the same governed path as the panels above -- nothing here bypasses Paragon.</p>}
            {chatLog.map((entry, index) => <p key={index} className={entry.role === 'user' ? 'chat-line chat-user' : 'chat-line chat-microfixd'}><b>{entry.role === 'user' ? 'You' : 'Microfixd'}:</b> {entry.text}</p>)}
          </div>
          <form className="chat-input-row" onSubmit={submitChatInput}>
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="What would you like to know or do?"
              disabled={chatBusy}
              aria-label="Chat with Microfixd"
            />
            <input ref={fileInputRef} type="file" onChange={handleFileSelected} disabled={uploadBusy} style={{ display: 'none' }} aria-label="Upload a photo, zip, or OBD2 export" />
            <button type="button" className="mic-button" onClick={() => fileInputRef.current?.click()} disabled={uploadBusy} title="Upload a photo, zip, or OBD2 export">
              {uploadBusy ? '…' : '📎'}
            </button>
            <button type="button" className={listening ? 'mic-button mic-active' : 'mic-button'} onClick={toggleListening} disabled={!speechSupported} title={speechSupported ? 'Talk instead of typing' : 'Speech recognition is not supported in this browser'} aria-pressed={listening}>
              {listening ? '● Listening' : '🎙'}
            </button>
            <button type="submit" className="primary" disabled={chatBusy || !chatInput.trim()}>{chatBusy ? 'Working…' : 'Send'}</button>
          </form>
          <div className="voice-toggle">
            <label><input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} disabled={!synthesisSupported} /> Speak replies aloud{!synthesisSupported && ' (not supported in this browser)'}</label>
            {speaking && <button type="button" className="mic-button" onClick={stopSpeaking} title="Stop speaking now">⏹ Stop speaking</button>}
          </div>
        </div>
      </section>


      <aside className="holo-side telemetry-panel"><p className="eyebrow">LIVE POSTURE</p><dl><dt>Health</dt><dd>{healthLabel(health)}</dd><dt>Organs</dt><dd>200 / 21 families</dd><dt>Layers</dt><dd>8 + enterprise overlays</dd><dt>Router</dt><dd>{String(((infrastructure?.payload.omniRouter as Record<string, unknown> | undefined)?.exclusiveOutboundPath) ? 'exclusive' : 'checking')}</dd><dt>Wiring</dt><dd>{wiring?.status || 'checking'}</dd><dt>Audit</dt><dd>{audit?.status || 'checking'}</dd><dt>Bring-up</dt><dd>{bringUp?.status || 'checking'}</dd><dt>Agents</dt><dd>{agents.length || 6} / governed</dd><dt>CPU</dt><dd>{String(computeSummary?.cpuLogicalCores || 'discovering')}</dd><dt>GPU</dt><dd>{String(computeSummary?.gpuVisible ? 'candidate' : 'not detected')}</dd></dl><button className={safeModeOn ? 'danger-button' : 'ghost-button'} type="button" onClick={() => void toggleSafeMode()} disabled={busy}>{safeModeOn ? 'Release safe mode' : 'Engage safe mode'}</button></aside>
    </section>

    <section className="mission-cards">
      <form className="mission-card goal-card" onSubmit={submitGoal}><div className="card-heading"><div><p className="eyebrow">WORKFLOW ORCHESTRATOR</p><h2>Submit governed objective</h2></div><span className="tenant-pill">{tenantId}</span></div><label>Agent identity<input value={agentId} onChange={(event) => setAgentId(event.target.value)} /></label><label>High-level goal<textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={4}/></label><button className="primary" disabled={busy}>{busy ? 'Paragon reviewing…' : 'Launch bounded workflow'}</button>{message && <p className="mission-message">{message}</p>}</form>
      <article className="mission-card"><p className="eyebrow">MULTI-AGENT CONSTELLATION</p><h2>Six governed roles</h2><div className="agent-grid">{['Meta-Agent', 'Critic/Safety', 'Reflection', 'Planner', 'Builder', 'Repair'].map((role, index) => <div className="agent-node" key={role}><span>{index + 1}</span><b>{role}</b><small>{agents[index]?.status || 'ready'}</small></div>)}</div><p className="tiny">{agentTelemetry ? `${agentTelemetry.evidenceCount || 0} tenant-scoped agent evidence records; router, collaboration, oversight, and arbitration are durable evidence only.` : 'Inspecting tenant-scoped agent telemetry…'} Roles produce plans, critiques, sandbox candidates, repair proposals, reflections, and coordination evidence. No role bypasses Paragon.</p></article>
      <article className="mission-card"><p className="eyebrow">GOVERNED ADAPTERS</p><h2>Compute, web, source control</h2><dl><dt>Compute</dt><dd>{String((compute?.routes as Record<string, unknown> | undefined)?.remoteCompute || 'adapter-only')}</dd><dt>Web use</dt><dd>{String(((webUse?.payload.puppeteer as Record<string, unknown> | undefined)?.exclusiveWebActionAuthority) ? 'Puppeteer-only / governed' : 'checking')}</dd><dt>Plugins</dt><dd>{String(((infrastructure?.payload.pluginRegistry as Record<string, unknown> | undefined)?.status) || 'checking')}</dd><dt>GitHub</dt><dd>Sandbox → review → change request</dd><dt>Runtime</dt><dd>{readiness?.storage?.durable ? 'cloud-durable' : 'local-fallback'}</dd></dl><div className="button-row"><button className="ghost-button" type="button" onClick={() => void runDiagnostics()}>Read-only diagnostics</button><button className="ghost-button" type="button" onClick={() => void captureScreenshot()}>Mission screenshot</button></div></article>
    </section>

    <section className="mission-cards lower-cards">
      <article className="mission-card"><p className="eyebrow">RUN / METACOGNITION</p><h2>{run ? `Run ${run.id.slice(0, 8)}` : 'Awaiting objective'}</h2>{run ? <dl><dt>Status</dt><dd>{run.status}</dd><dt>Tenant</dt><dd>{run.tenantId}</dd><dt>Progress</dt><dd>{run.currentStep} bounded steps</dd><dt>Reflection</dt><dd>{metacognition?.assessment.confidence || 'pending'}</dd></dl> : <p className="tiny">Submitted work creates a tenant-scoped audit trail, agent handoffs, policy decisions, memory, and bounded results.</p>}</article>
      <article className="mission-card"><p className="eyebrow">HUMAN-BY-EXCEPTION</p><h2>Craig’s approval queue</h2>{approvals.length ? <div className="approval-list">{approvals.slice(0, 4).map((approval) => <div className="approval" key={approval.id}><b>{approval.action.title}</b><span>{approval.action.risk} risk · {new Date(approval.requestedAt).toLocaleString()}</span><p>{approval.reason}</p></div>)}</div> : <p className="tiny">No tenant-scoped approval exceptions are pending. Protected web, source-control, deployment, cost, and behavior changes are halted here for Craig.</p>}</article>
      <article className="mission-card"><p className="eyebrow">AUDIT / RECOVERY</p><h2>Self-healing boundaries</h2><p className="tiny">Health posture: <b>{selfHealing?.status || 'checking'}</b>. Final audit: <b>{audit?.status || 'checking'}</b>. Governance lock: <b>{governanceLock?.status || 'checking'}</b>. Failure Detection and Health Trigger create sandbox-validated repair proposals. Fallback preserves evidence and retains active production state. Paragon and Craig control every activation, restart, replacement, patch, pull request, merge, deployment, and rollback.</p><button className="ghost-button" type="button" onClick={() => void refreshHealth()}>Refresh telemetry</button></article>
    </section>
  </main>;
}
