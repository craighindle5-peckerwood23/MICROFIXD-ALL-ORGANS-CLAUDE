// src/os/workspaces/SystemWorkspace.tsx
import { useEffect, useState } from 'react';
import { request } from '../state/api.ts';
import { useOS } from '../state/os-context.tsx';

export function SystemWorkspace() {
  const { adminKey, tenantId } = useOS();
  const [infra, setInfra] = useState<unknown | null>(null);
  const [compute, setCompute] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    Promise.all([
      request('/api/autonomy/infrastructure', adminKey, tenantId).then(setInfra),
      request('/api/autonomy/compute', adminKey, tenantId).then(setCompute),
    ]).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [adminKey, tenantId]);

  return (
    <div className="p-6 text-slate-200 space-y-4">
      <div>
        <div className="text-[11px] tracking-widest text-teal-400/70 font-mono mb-2">SYSTEM</div>
        <h1 className="text-2xl font-semibold">Infrastructure & runtime</h1>
      </div>
      {!adminKey && <div className="text-xs text-amber-400">Connect an admin key to load real system telemetry.</div>}
      {error && <div className="text-xs text-red-400">Unavailable: {error}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-teal-500/10 bg-black/30 p-4">
          <div className="mb-2 text-[11px] tracking-widest text-teal-400/70 font-mono">INFRASTRUCTURE</div>
          {infra != null ? (
            <pre className="text-xs text-slate-400 overflow-auto max-h-80">{JSON.stringify(infra, null, 2)}</pre>
          ) : (
            <div className="text-xs text-slate-600">No data loaded yet.</div>
          )}
        </div>
        <div className="rounded-md border border-teal-500/10 bg-black/30 p-4">
          <div className="mb-2 text-[11px] tracking-widest text-teal-400/70 font-mono">COMPUTE</div>
          {compute != null ? (
            <pre className="text-xs text-slate-400 overflow-auto max-h-80">{JSON.stringify(compute, null, 2)}</pre>
          ) : (
            <div className="text-xs text-slate-600">No data loaded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
