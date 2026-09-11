// src/os/workspaces/AgentsWorkspace.tsx
//
// Renders the real per-agent Level6Records from /api/autonomy/agents as
// cards, not a raw JSON dump -- the data was already real; this makes
// it legible, matching the "AGENT NETWORK" view from the OS design doc.

import { useEffect, useState } from 'react';
import { request } from '../state/api.ts';
import { useOS } from '../state/os-context.tsx';

interface AgentRecord {
  id: string; name: string; status: string;
  payload: { role?: string; load?: unknown; executionBoundary?: string; drift?: { monitor?: string; response?: string } };
  updatedAt: string;
}

export function AgentsWorkspace() {
  const { adminKey, tenantId } = useOS();
  const [agents, setAgents] = useState<AgentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgentRecord | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    request<{ agents: AgentRecord[] }>('/api/autonomy/agents', adminKey, tenantId)
      .then((r) => setAgents(r.agents))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [adminKey, tenantId]);

  return (
    <div className="p-6 text-slate-200 space-y-4">
      <div>
        <div className="text-[11px] tracking-widest text-teal-400/70 font-mono mb-2">AGENTS</div>
        <h1 className="text-2xl font-semibold">Governed autonomous workforce</h1>
      </div>
      {!adminKey && <div className="text-xs text-amber-400">Connect an admin key to load real agent data.</div>}
      {error && <div className="text-xs text-red-400">Unavailable: {error}</div>}

      {agents && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelected(a)}
              className="text-left rounded-md border border-teal-500/10 bg-black/30 p-4 hover:border-teal-400/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-200">{a.name}</span>
                <span className={`text-[10px] tracking-wide font-mono ${a.status === 'active' ? 'text-teal-300' : 'text-slate-500'}`}>{a.status.toUpperCase()}</span>
              </div>
              <div className="text-xs text-slate-500">{a.payload.role ?? 'unspecified role'}</div>
              <div className="text-[10px] text-slate-600 mt-2">Updated {new Date(a.updatedAt).toLocaleTimeString()}</div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="rounded-md border border-violet-500/20 bg-black/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] tracking-widest text-violet-300/70 font-mono">{selected.name.toUpperCase()}</div>
            <button onClick={() => setSelected(null)} className="text-xs text-slate-500 hover:text-slate-300">close</button>
          </div>
          <div className="text-xs text-slate-400">
            <div className="mb-1"><span className="text-slate-500">Execution boundary:</span> {selected.payload.executionBoundary ?? 'not specified'}</div>
            {selected.payload.drift && (
              <>
                <div className="mb-1"><span className="text-slate-500">Drift monitor:</span> {selected.payload.drift.monitor}</div>
                <div><span className="text-slate-500">Drift response:</span> {selected.payload.drift.response}</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
