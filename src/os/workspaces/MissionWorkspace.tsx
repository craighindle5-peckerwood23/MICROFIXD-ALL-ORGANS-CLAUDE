// src/os/workspaces/MissionWorkspace.tsx
import { useCallback, useRef, useState } from 'react';
import { request } from '../state/api.ts';
import { streamRun, type MicrofixedEvent } from '../state/event-bridge.ts';
import { useOS } from '../state/os-context.tsx';
import { useTelemetryStore } from '../state/telemetry-store.ts';
import { FastValue } from '../shell/FastValue.tsx';
import { MissionGraph } from '../shell/MissionGraph.tsx';
import type { RunRecord, StepRecord } from '../../autonomy/types.ts';

export function MissionWorkspace() {
  const { adminKey, tenantId, setActiveMissionId, handleEvent } = useOS();
  const [goal, setGoal] = useState('');
  const [run, setRun] = useState<RunRecord | null>(null);
  const [steps, setSteps] = useState<StepRecord[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollHandle = useRef<{ stop: () => void } | null>(null);

  const onEvent = useCallback((event: MicrofixedEvent) => {
    handleEvent(event);
    setLog((prev) => [...prev.slice(-19), describeEvent(event)]);
    if (event.type === 'graph.step') {
      setSteps((prev) => {
        const others = prev.filter((s) => s.id !== event.stepId);
        const next = [...others, { id: event.stepId, runId: event.missionId, sequence: event.sequence, status: event.status, action: event.action, createdAt: new Date().toISOString() }].sort((a, b) => a.sequence - b.sequence);
        // Feed the transient telemetry store directly -- bypasses a React
        // re-render for these two fast-moving numbers (see FastValue.tsx).
        useTelemetryStore.getState().setTelemetry({
          activeNode: event.action?.kind ?? 'unknown',
          completedSteps: next.filter((s) => s.status === 'succeeded').length,
          totalSteps: next.length,
        });
        return next;
      });
    }
    if (event.type === 'graph.started') {
      useTelemetryStore.getState().setTelemetry({ missionStatus: 'running' });
    }
    if (event.type === 'mission.completed') {
      useTelemetryStore.getState().setTelemetry({ missionStatus: event.outcome, activeNode: 'idle' });
    }
  }, [handleEvent]);

  const submit = useCallback(async () => {
    if (!goal.trim() || !adminKey) return;
    setSubmitting(true);
    setError(null);
    setSteps([]);
    setLog([]);
    try {
      const result = await request<{ run: RunRecord }>('/api/autonomy/goals', adminKey, tenantId, {
        method: 'POST',
        body: JSON.stringify({ goal: goal.trim(), requestedBy: 'Craig' }),
      });
      setRun(result.run);
      setActiveMissionId(result.run.id);
      pollHandle.current?.stop();
      pollHandle.current = streamRun(result.run.id, adminKey, tenantId, onEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [goal, adminKey, tenantId, onEvent, setActiveMissionId]);

  return (
    <div className="flex h-full flex-col gap-4 p-6 text-slate-200">
      <div>
        <div className="text-[11px] tracking-widest text-teal-400/70 font-mono">MISSION WORKSPACE</div>
        <h1 className="text-2xl font-semibold">What are we accomplishing?</h1>
      </div>

      <div className="flex gap-2">
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Give Microfixd a mission…"
          className="flex-1 rounded-md border border-teal-500/20 bg-black/40 px-4 py-3 font-mono text-sm outline-none focus:border-teal-400/60"
        />
        <button
          onClick={submit}
          disabled={submitting || !goal.trim() || !adminKey}
          className="rounded-md border border-teal-400/40 bg-teal-500/10 px-5 py-3 text-sm text-teal-200 disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Run'}
        </button>
      </div>
      {!adminKey && <div className="text-xs text-amber-400">No admin key set — connect before submitting a mission.</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}

      {run && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-teal-500/10 bg-black/30 p-4">
            <div className="mb-2 text-[11px] tracking-widest text-teal-400/70 font-mono">CURRENT MISSION</div>
            <div className="text-sm text-slate-300">{run.goal}</div>
            <div className="mt-2 text-xs text-slate-500">Status: <span className="text-teal-300">{run.status}</span></div>
            <div className="mt-2 flex gap-4 font-mono text-xs text-slate-500">
              <span>NODE: <FastValue field="activeNode" className="text-teal-300" /></span>
              <span>STEPS: <FastValue field="completedSteps" className="text-teal-300" />/<FastValue field="totalSteps" className="text-teal-300" /></span>
            </div>
          </div>
          <div className="rounded-md border border-teal-500/10 bg-black/30 p-4 h-64">
            <div className="mb-2 text-[11px] tracking-widest text-teal-400/70 font-mono">MISSION GRAPH</div>
            <MissionGraph steps={steps} />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-md border border-teal-500/10 bg-black/30 p-4 font-mono text-xs text-slate-400">
        <div className="mb-2 text-[11px] tracking-widest text-teal-400/70">LIVE INTELLIGENCE</div>
        {log.length === 0 && <div className="text-slate-600">No activity yet.</div>}
        {log.map((line, i) => <div key={i}>{line}</div>)}
      </div>
    </div>
  );
}

function describeEvent(event: MicrofixedEvent): string {
  switch (event.type) {
    case 'graph.started': return `Mission ${event.missionId} started.`;
    case 'graph.step': return `Step #${event.sequence} (${event.action?.kind ?? 'action'}) → ${event.status}`;
    case 'approval.required': return `Step ${event.stepId} is awaiting approval.`;
    case 'mission.completed': return `Mission ${event.missionId} ${event.outcome}${event.error ? `: ${event.error}` : '.'}`;
    case 'system.error': return `Error: ${event.message}`;
    default: return JSON.stringify(event);
  }
}
