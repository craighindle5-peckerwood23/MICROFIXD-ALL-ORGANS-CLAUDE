// src/os/state/telemetry-store.ts
//
// Adopts the Zustand-transient-store pattern from Craig's research: fast,
// frequently-changing values (step counts, current node) get written
// here and consumed via direct DOM refs (see FastValue.tsx), bypassing
// React's render tree instead of forcing a re-render on every update.
//
// Deliberately NOT fed by a WebSocket/EventSource -- no such route
// exists on this backend (checked: no SSE handler, no ws server anywhere
// in src/autonomy). It's fed by the real pollRun() bridge in
// event-bridge.ts, which is the actual data source. At current polling
// frequency (1.5s) React alone could handle this fine -- the value of
// wiring Zustand now is that it's a drop-in path to a real SSE/WS
// transport later without touching the consumer components.

import { create } from 'zustand';

interface TelemetryState {
  activeNode: string;
  completedSteps: number;
  totalSteps: number;
  missionStatus: string;
  setTelemetry: (partial: Partial<Omit<TelemetryState, 'setTelemetry'>>) => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  activeNode: 'idle',
  completedSteps: 0,
  totalSteps: 0,
  missionStatus: 'idle',
  setTelemetry: (partial) => set(partial),
}));
