// src/os/shell/AIInsights.tsx
//
// The reference image's "AI Insights" panel showed generic marketing
// lines ("Pattern recognition optimized," etc.) with no data behind
// them. This version shows the same visual slot but backed by the real
// /api/autonomy/usage-report event breakdown -- actual event kinds and
// counts from this tenant's real telemetry window, not invented claims.

import { useEffect, useState } from 'react';
import { request } from '../state/api.ts';
import { useOS } from '../state/os-context.tsx';

type UsageReport = { inMemoryWindow: { eventCount: number; eventCountByType: Record<string, number> } };

export function AIInsights() {
  const { adminKey, tenantId } = useOS();
  const [report, setReport] = useState<UsageReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    request<UsageReport>('/api/autonomy/usage-report', adminKey, tenantId).then(setReport).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [adminKey, tenantId]);

  const entries = report ? Object.entries(report.inMemoryWindow.eventCountByType).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 5) : [];

  return (
    <div className="rounded-md border border-violet-500/20 bg-black/40 p-3">
      <div className="mb-2 text-[10px] tracking-widest text-violet-300/70 font-mono">RECENT ACTIVITY</div>
      {!adminKey && <div className="text-[10px] text-slate-600">Connect to load real activity.</div>}
      {error && <div className="text-[10px] text-red-400">{error}</div>}
      {report && entries.length === 0 && <div className="text-[10px] text-slate-600">No events recorded since last restart.</div>}
      <ul className="space-y-1 text-[10px] text-slate-400">
        {entries.map(([name, count]) => (
          <li key={name} className="flex justify-between">
            <span>{name}</span>
            <span className="text-violet-300">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
