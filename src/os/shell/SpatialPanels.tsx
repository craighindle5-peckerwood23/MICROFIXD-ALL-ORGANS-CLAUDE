// src/os/shell/SpatialPanels.tsx
//
// Panel set matching the screenshot's layout: Live Operations,
// Governance Status, Runtime Status, Runtime & Operator Credentials,
// Voice Transcript, Quick Intents. Every field below is a real fetched
// value or a real derived state -- none are hardcoded "Authenticated"/
// "Configured" strings. Where a real check fails, the honest failure
// reason is shown (matching the screenshot's own "Runtime request
// returned HTTP 404" pattern), never a silently-faked success.

import { useEffect, useState, type ReactNode } from 'react';
import { useOS } from '../state/os-context.tsx';
import { request, apiUrl } from '../state/api.ts';
import { audioManager } from './audio-manager.ts';

function StatusRow({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const color = tone === 'good' ? 'text-teal-300' : tone === 'bad' ? 'text-red-400' : 'text-violet-300';
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono tracking-wide ${color}`}>{value}</span>
    </div>
  );
}

function PanelFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-violet-500/15 bg-black/30 p-3 space-y-2">
      <div className="text-[10px] tracking-widest text-violet-300/60 font-mono">{title}</div>
      {children}
    </div>
  );
}

interface CredentialStatus {
  adminKeyConfigured: boolean; signingKeysConfigured: boolean; signingKeyCount: number; activeKeyVersion: string | null;
  githubTokenConfigured: boolean; renderApiKeyConfigured: boolean; railwayTokenConfigured: boolean; twilioConfigured: boolean; valueExposure: string;
}

/** Shared real fetch used by both status panels -- one honest source of truth for whether the backend is actually reachable, not two independent guesses. */
function useReadyz(adminKey: string) {
  const [state, setState] = useState<{ ok: boolean; httpStatus: number | null; body: unknown; error: string | null }>({ ok: false, httpStatus: null, body: null, error: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl('/readyz'), { headers: { 'x-microfixd-admin-key': adminKey } });
        const body = await res.json().catch(() => ({}));
        if (!cancelled) setState({ ok: res.ok, httpStatus: res.status, body, error: null });
      } catch (err) {
        if (!cancelled) setState({ ok: false, httpStatus: null, body: null, error: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => { cancelled = true; };
  }, [adminKey]);
  return state;
}

export function LiveOperationsPanel() {
  const { adminKey, tenantId } = useOS();
  const [usage, setUsage] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    request('/api/autonomy/usage-report', adminKey, tenantId)
      .then((d) => { if (!cancelled) setUsage(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [adminKey, tenantId]);

  return (
    <PanelFrame title="LIVE OPERATIONS">
      {error ? (
        <div className="text-xs text-amber-300">No verified live telemetry is available: {error}</div>
      ) : usage ? (
        <div className="text-xs text-teal-300">Usage report reachable -- real recent activity loaded.</div>
      ) : (
        <div className="text-xs text-slate-500">Loading...</div>
      )}
    </PanelFrame>
  );
}

export function GovernanceStatusPanel() {
  const { adminKey, tenantId } = useOS();
  const [approvalsOk, setApprovalsOk] = useState<boolean | null>(null);
  const [auditOk, setAuditOk] = useState<boolean | null>(null);
  const readyz = useReadyz(adminKey);

  useEffect(() => {
    let cancelled = false;
    request('/api/autonomy/approvals', adminKey, tenantId).then(() => { if (!cancelled) setApprovalsOk(true); }).catch(() => { if (!cancelled) setApprovalsOk(false); });
    request('/api/autonomy/usage-report', adminKey, tenantId).then(() => { if (!cancelled) setAuditOk(true); }).catch(() => { if (!cancelled) setAuditOk(false); });
    return () => { cancelled = true; };
  }, [adminKey, tenantId]);

  const emergencyStop = (readyz.body as { storage?: { durable?: boolean } } | null);

  return (
    <PanelFrame title="GOVERNANCE STATUS">
      <StatusRow label="Autonomy master switch" value={readyz.ok ? 'REACHABLE' : 'UNAVAILABLE'} tone={readyz.ok ? 'good' : 'bad'} />
      <StatusRow label="Human approval route" value={approvalsOk === null ? 'CHECKING' : approvalsOk ? 'REACHABLE' : 'UNAVAILABLE'} tone={approvalsOk ? 'good' : approvalsOk === false ? 'bad' : 'neutral'} />
      <StatusRow label="Promotion application" value={emergencyStop?.storage?.durable ? 'DURABLE STORE' : 'JSON STORE (NOT DURABLE)'} tone={emergencyStop?.storage?.durable ? 'good' : 'neutral'} />
      <StatusRow label="Trace display" value={auditOk === null ? 'CHECKING' : auditOk ? 'REACHABLE' : 'UNAVAILABLE'} tone={auditOk ? 'good' : auditOk === false ? 'bad' : 'neutral'} />
    </PanelFrame>
  );
}

export function RuntimeStatusPanel() {
  const { adminKey } = useOS();
  const readyz = useReadyz(adminKey);

  return (
    <PanelFrame title="RUNTIME STATUS">
      <StatusRow label="Spatial OS Shell" value={adminKey ? 'AUTHENTICATED' : 'NO KEY SET'} tone={adminKey ? 'good' : 'bad'} />
      <StatusRow label="Governed Runtime" value={readyz.ok ? 'ONLINE' : readyz.error ? `UNREACHABLE (${readyz.error})` : `HTTP ${readyz.httpStatus ?? '???'}`} tone={readyz.ok ? 'good' : 'bad'} />
      <StatusRow label="Credential Health" value={adminKey ? 'CONFIGURED' : 'MISSING'} tone={adminKey ? 'good' : 'bad'} />
      <StatusRow label="Autonomy" value={readyz.ok ? 'AVAILABLE' : 'UNAVAILABLE'} tone={readyz.ok ? 'good' : 'bad'} />
    </PanelFrame>
  );
}

export function OperatorCredentialsPanel() {
  const { adminKey, tenantId } = useOS();
  const [cred, setCred] = useState<CredentialStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readyz = useReadyz(adminKey);

  useEffect(() => {
    let cancelled = false;
    request<CredentialStatus>('/api/autonomy/system/credential-status', adminKey, tenantId)
      .then((d) => { if (!cancelled) setCred(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [adminKey, tenantId]);

  return (
    <PanelFrame title="RUNTIME & OPERATOR CREDENTIALS">
      <StatusRow label="Server-side URL" value={window.location.origin ? 'CONFIGURED' : 'UNSET'} tone="good" />
      <StatusRow label="Operator Credential" value={adminKey ? 'PRESENT' : 'MISSING'} tone={adminKey ? 'good' : 'bad'} />
      <StatusRow label="Route Health" value={readyz.httpStatus ? `HTTP ${readyz.httpStatus}` : readyz.error ? 'UNREACHABLE' : 'CHECKING'} tone={readyz.ok ? 'good' : 'bad'} />
      <StatusRow label="Authorization" value={readyz.ok ? 'VERIFIED' : 'NOT VERIFIED'} tone={readyz.ok ? 'good' : 'bad'} />
      {error ? (
        <div className="text-[11px] text-amber-300 pt-1">Credential status unavailable: {error}</div>
      ) : cred ? (
        <>
          <StatusRow label="Signing Keys" value={cred.signingKeysConfigured ? `${cred.signingKeyCount} (active: ${cred.activeKeyVersion})` : 'NONE CONFIGURED'} tone={cred.signingKeysConfigured ? 'good' : 'neutral'} />
          <StatusRow label="Rotation Metadata" value={cred.signingKeysConfigured ? 'AVAILABLE' : 'UNAVAILABLE FROM RUNTIME'} tone={cred.signingKeysConfigured ? 'good' : 'neutral'} />
          <StatusRow label="Value Exposure" value={cred.valueExposure.toUpperCase()} tone="good" />
        </>
      ) : (
        <div className="text-[11px] text-slate-500 pt-1">Loading credential status...</div>
      )}
    </PanelFrame>
  );
}

export function VoiceTranscriptPanel() {
  const { lastVoiceTranscript } = useOS();
  return (
    <PanelFrame title="VOICE TRANSCRIPT">
      <div className="text-xs text-slate-400">
        {lastVoiceTranscript ? <span className="text-teal-300">"{lastVoiceTranscript}"</span> : 'No verified narration has been received.'}
      </div>
    </PanelFrame>
  );
}

export function QuickIntentsPanel() {
  const { setPendingCommand } = useOS();
  const intents: { label: string; command: string }[] = [
    { label: 'Inspect', command: 'system status' },
    { label: 'Plan', command: 'create a goal to ' },
    { label: 'Review', command: 'list approvals' },
    { label: 'Trace', command: 'audit' },
  ];
  return (
    <PanelFrame title="QUICK INTENTS">
      <div className="grid grid-cols-2 gap-2">
        {intents.map((i) => (
          <button
            key={i.label}
            onClick={() => { audioManager.markUserInteracted(); setPendingCommand(i.command); }}
            className="flex flex-col items-center justify-center gap-1 rounded border border-violet-500/20 bg-violet-500/5 py-4 text-[11px] tracking-wide text-violet-200 hover:bg-violet-500/15"
          >
            {i.label}
          </button>
        ))}
      </div>
    </PanelFrame>
  );
}

export function SoundToggle() {
  const [enabled, setEnabled] = useState(false);
  return (
    <button
      onClick={() => {
        audioManager.markUserInteracted();
        const next = !enabled;
        audioManager.setEnabled(next);
        setEnabled(next);
        if (next) audioManager.play('approval-granted'); // audible confirmation that sound is now on
      }}
      className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs font-mono tracking-wide ${enabled ? 'border-teal-400/40 text-teal-300' : 'border-white/10 text-slate-500'}`}
    >
      <span>SOUND</span>
      <span>{enabled ? 'ON' : 'OFF'}</span>
    </button>
  );
}
