// src/os/workspaces/IntelligenceWorkspace.tsx
import { useCallback, useEffect, useState } from 'react';
import { request } from '../state/api.ts';
import { useOS } from '../state/os-context.tsx';

type MetaDecision = {
  systemMode: string;
  assessment: { anomalyScore: number; degraded: boolean; signals: string[] };
  strategy: { mode: string; reason: string };
};
type EvolverRec = { recordType: string; successRate: number; recommendation: string; successCount: number; reviewCount: number };
type HealerRec = { action: string; reason: string; safeModeCurrentlyActive: boolean };

export function IntelligenceWorkspace() {
  const { adminKey, tenantId } = useOS();
  const [introspection, setIntrospection] = useState<unknown | null>(null);
  const [organs, setOrgans] = useState<unknown | null>(null);
  const [decision, setDecision] = useState<MetaDecision | null>(null);
  const [evolver, setEvolver] = useState<EvolverRec[] | null>(null);
  const [healerResult, setHealerResult] = useState<HealerRec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [healing, setHealing] = useState(false);

  const loadMeta = useCallback(() => {
    if (!adminKey) return;
    Promise.all([
      request<MetaDecision>('/api/autonomy/meta/decide', adminKey, tenantId),
      request<EvolverRec[]>('/api/autonomy/meta/evolve', adminKey, tenantId),
    ]).then(([d, e]) => { setDecision(d); setEvolver(e); }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [adminKey, tenantId]);

  useEffect(() => {
    if (!adminKey) return;
    Promise.all([
      request('/api/autonomy/introspection', adminKey, tenantId).then(setIntrospection),
      request('/api/autonomy/organs', adminKey, tenantId).then(setOrgans),
    ]).catch((e) => setError(e instanceof Error ? e.message : String(e)));
    loadMeta();
  }, [adminKey, tenantId, loadMeta]);

  const runHeal = useCallback(async () => {
    setHealing(true);
    try {
      const result = await request<HealerRec>('/api/autonomy/meta/heal', adminKey, tenantId, { method: 'POST' });
      setHealerResult(result);
      loadMeta();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setHealing(false);
    }
  }, [adminKey, tenantId, loadMeta]);

  return (
    <div className="p-6 text-slate-200 space-y-4">
      <div>
        <div className="text-[11px] tracking-widest text-teal-400/70 font-mono mb-2">INTELLIGENCE</div>
        <h1 className="text-2xl font-semibold">Cognition, memory, organ registry, and meta-layer</h1>
      </div>
      {!adminKey && <div className="text-xs text-amber-400">Connect an admin key to load real cognition state.</div>}
      {error && <div className="text-xs text-red-400">Unavailable: {error}</div>}

      <div className="rounded-md border border-violet-500/20 bg-black/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] tracking-widest text-violet-300/70 font-mono">META LAYER</div>
          <button onClick={runHeal} disabled={healing || !adminKey} className="rounded border border-violet-400/40 px-3 py-1 text-xs text-violet-300 disabled:opacity-40">
            {healing ? 'Running…' : 'Run MetaHealer'}
          </button>
        </div>
        {decision ? (
          <div className="grid gap-3 md:grid-cols-2 text-xs">
            <div>
              <div className="text-slate-500 mb-1">SYSTEM MODE</div>
              <div className={decision.systemMode === 'degraded-safe' ? 'text-amber-400' : 'text-teal-300'}>{decision.systemMode}</div>
              <div className="text-slate-500 mt-2 mb-1">STRATEGY</div>
              <div className="text-teal-300">{decision.strategy.mode}</div>
              <div className="text-slate-600 mt-1">{decision.strategy.reason}</div>
              <div className="text-slate-500 mt-2 mb-1">ANOMALY SCORE</div>
              <div className={decision.assessment.degraded ? 'text-red-400' : 'text-teal-300'}>{decision.assessment.anomalyScore}</div>
              {decision.assessment.signals.length > 0 && (
                <ul className="mt-1 text-slate-500 list-disc list-inside">
                  {decision.assessment.signals.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              )}
            </div>
            <div>
              <div className="text-slate-500 mb-1">EVOLVER RECOMMENDATIONS</div>
              {evolver && evolver.length > 0 ? (
                <ul className="space-y-1">
                  {evolver.map((r) => (
                    <li key={r.recordType} className="flex justify-between">
                      <span>{r.recordType}</span>
                      <span className={r.recommendation === 'retirement-candidate' ? 'text-red-400' : r.recommendation === 'expansion-candidate' ? 'text-teal-300' : 'text-slate-500'}>
                        {r.recommendation} ({r.successCount}/{r.successCount + r.reviewCount})
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <div className="text-slate-600">No records yet.</div>}
              {healerResult && (
                <div className="mt-3 rounded border border-white/10 p-2">
                  <div className="text-slate-500">LAST HEALER RUN</div>
                  <div className="text-teal-300">{healerResult.action}</div>
                  <div className="text-slate-600">{healerResult.reason}</div>
                </div>
              )}
            </div>
          </div>
        ) : <div className="text-xs text-slate-600">Loading…</div>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-teal-500/10 bg-black/30 p-4">
          <div className="mb-2 text-[11px] tracking-widest text-teal-400/70 font-mono">INTROSPECTION</div>
          {introspection != null ? (
            <pre className="text-xs text-slate-400 overflow-auto max-h-80">{JSON.stringify(introspection, null, 2)}</pre>
          ) : <div className="text-xs text-slate-600">No data loaded yet.</div>}
        </div>
        <div className="rounded-md border border-teal-500/10 bg-black/30 p-4">
          <div className="mb-2 text-[11px] tracking-widest text-teal-400/70 font-mono">ORGAN REGISTRY</div>
          {organs != null ? (
            <pre className="text-xs text-slate-400 overflow-auto max-h-80">{JSON.stringify(organs, null, 2)}</pre>
          ) : <div className="text-xs text-slate-600">No data loaded yet.</div>}
        </div>
      </div>
    </div>
  );
}
