// src/os/shell/ActivityTimeline.tsx
//
// Real Milestone 3 piece: the granular timestamped event log described
// in the OS design doc ("13:14:22 Mission created", etc.). The data
// source (recentDurableEvents from /api/autonomy/usage-report) already
// existed and was real -- this was purely a missing UI, not a missing
// backend capability. Polls every 4s; real event names/kinds are shown
// as-is (lightly formatted), not paraphrased into fake-sounding copy.

import { useEffect, useState } from 'react';
import { useOS } from '../state/os-context.tsx';
import { request } from '../state/api.ts';

interface UsageEvent {
  id: string; kind: string; name: string; createdAt: string; metadata: Record<string, unknown>;
}

function formatEventLabel(e: UsageEvent): string {
  // Real formatting of the real event name -- 'tier.auto-approved:web-browse' becomes 'tier auto approved: web browse', not an invented sentence.
  return e.name.replace(/[:._-]/g, ' ').trim();
}

export function ActivityTimeline({ maxItems = 40 }: { maxItems?: number }) {
  const { adminKey, tenantId } = useOS();
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminKey) return;
    let cancelled = false;
    const load = () => {
      request<{ recentDurableEvents: UsageEvent[] }>('/api/autonomy/usage-report', adminKey, tenantId)
        .then((r) => { if (!cancelled) setEvents(r.recentDurableEvents.slice(-maxItems).reverse()); })
        .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    };
    load();
    const interval = setInterval(load, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [adminKey, tenantId, maxItems]);

  return (
    <div className="rounded-md border border-teal-500/10 bg-black/30 p-3 space-y-1">
      <div className="text-[10px] tracking-widest text-teal-400/60 font-mono mb-2">LIVE ACTIVITY</div>
      {!adminKey && <div className="text-xs text-amber-400">Connect an admin key to load real activity.</div>}
      {error && <div className="text-xs text-red-400">Unavailable: {error}</div>}
      {adminKey && !error && events.length === 0 && <div className="text-xs text-slate-600">No events recorded yet.</div>}
      <ul className="space-y-1 max-h-64 overflow-y-auto font-mono text-[11px]">
        {events.map((e) => (
          <li key={e.id} className="flex gap-2 text-slate-400">
            <span className="text-slate-600 shrink-0">{new Date(e.createdAt).toLocaleTimeString()}</span>
            <span className="text-teal-300/80 shrink-0">[{e.kind}]</span>
            <span className="truncate">{formatEventLabel(e)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
