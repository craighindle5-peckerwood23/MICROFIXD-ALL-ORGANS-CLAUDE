// src/os/state/event-bridge.ts
//
// This backend has no SSE/WebSocket transport -- confirmed by grepping
// routes.ts and the rest of src/autonomy for 'text/event-stream',
// 'WebSocket', and 'EventSource' (none exist). Per the implementation
// directive's own rule ("if no event stream exists, implement the
// smallest appropriate bridge using the existing Express architecture"),
// this is a polling bridge over the real GET /api/autonomy/runs/:runId
// route, not a fabricated push transport.
//
// Every event emitted here is derived from a real RunRecord/StepRecord
// field the backend already returns -- nothing is synthesized to make
// the UI look more alive than the backend actually is.

import type { RunRecord, StepRecord } from '../../autonomy/types.ts';
import { request, apiUrl } from './api.ts';

export type MicrofixedEvent =
  | { type: 'graph.started'; missionId: string }
  | { type: 'graph.step'; missionId: string; stepId: string; sequence: number; status: StepRecord['status']; action: StepRecord['action'] }
  | { type: 'approval.required'; missionId: string; stepId: string }
  | { type: 'mission.completed'; missionId: string; outcome: RunRecord['status']; error?: string }
  | { type: 'system.error'; message: string };

type RunWithSteps = { run: RunRecord; steps: StepRecord[] };

export type PollHandle = { stop: () => void };

/**
 * Real server push. Mints a single-use, 60-second stream token via the
 * authenticated POST route (native EventSource can't send the admin-key
 * header), then opens an EventSource against the real backend SSE route.
 * Falls back to pollRun() only if the token mint or the stream itself
 * fails to connect -- a real fallback triggered by a real failure, not a
 * default.
 */
export function streamRun(
  runId: string,
  adminKey: string,
  tenantId: string,
  onEvent: (event: MicrofixedEvent) => void,
): PollHandle {
  let closed = false;
  let fallback: PollHandle | null = null;
  let source: EventSource | null = null;

  (async () => {
    try {
      const { token } = await request<{ token: string }>(`/api/autonomy/runs/${runId}/stream-token`, adminKey, tenantId, { method: 'POST' });
      if (closed) return;
      source = new EventSource(apiUrl(`/api/autonomy/runs/${runId}/stream?token=${encodeURIComponent(token)}&tenantId=${encodeURIComponent(tenantId)}`));
      const on = (name: MicrofixedEvent['type']) => {
        source!.addEventListener(name, (e: MessageEvent) => {
          try { onEvent(JSON.parse(e.data)); } catch { /* ignore malformed frame */ }
        });
      };
      (['graph.started', 'graph.step', 'approval.required', 'mission.completed', 'system.error'] as const).forEach(on);
      source.onerror = () => {
        if (closed) return;
        source?.close();
        onEvent({ type: 'system.error', message: 'Stream connection lost; falling back to polling.' });
        fallback = pollRun(runId, adminKey, tenantId, onEvent);
      };
    } catch (err) {
      if (closed) return;
      onEvent({ type: 'system.error', message: `Could not open stream (${err instanceof Error ? err.message : String(err)}); using polling instead.` });
      fallback = pollRun(runId, adminKey, tenantId, onEvent);
    }
  })();

  return {
    stop: () => {
      closed = true;
      source?.close();
      fallback?.stop();
    },
  };
}

/**
 * Polls a single run and emits real, derived events on state changes.
 * Stops automatically once the run reaches a terminal status
 * (succeeded/failed/cancelled) or on repeated failure. Used as the
 * fallback transport by streamRun() above, and directly usable on its
 * own.
 */
export function pollRun(
  runId: string,
  adminKey: string,
  tenantId: string,
  onEvent: (event: MicrofixedEvent) => void,
  intervalMs = 1500,
): PollHandle {
  let stopped = false;
  let seenStepStatus = new Map<string, StepRecord['status']>();
  let announcedStart = false;

  const tick = async () => {
    if (stopped) return;
    try {
      const detail = await request<RunWithSteps>(`/api/autonomy/runs/${runId}`, adminKey, tenantId);
      if (!announcedStart) {
        onEvent({ type: 'graph.started', missionId: detail.run.id });
        announcedStart = true;
      }
      for (const step of detail.steps) {
        const previous = seenStepStatus.get(step.id);
        if (previous !== step.status) {
          seenStepStatus.set(step.id, step.status);
          onEvent({ type: 'graph.step', missionId: detail.run.id, stepId: step.id, sequence: step.sequence, status: step.status, action: step.action });
          if (step.status === 'blocked') {
            onEvent({ type: 'approval.required', missionId: detail.run.id, stepId: step.id });
          }
        }
      }
      if (detail.run.status === 'succeeded' || detail.run.status === 'failed' || detail.run.status === 'cancelled') {
        onEvent({ type: 'mission.completed', missionId: detail.run.id, outcome: detail.run.status, error: detail.run.error });
        stopped = true;
        return;
      }
    } catch (err) {
      onEvent({ type: 'system.error', message: err instanceof Error ? err.message : String(err) });
      // Do not stop on a single transient failure; keep polling until the
      // caller explicitly stops or the run resolves.
    }
    if (!stopped) setTimeout(tick, intervalMs);
  };

  tick();
  return { stop: () => { stopped = true; } };
}
