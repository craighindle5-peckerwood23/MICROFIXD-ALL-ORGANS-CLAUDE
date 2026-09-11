// src/os/state/os-context.tsx
//
// Central OS state. AIVisualState transitions only happen in response to
// real events from event-bridge.ts (a real mission started, a real step
// requires approval, a real mission completed) -- never on a timer, never
// randomized. If nothing real is happening, the state stays 'idle'.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { MicrofixedEvent } from './event-bridge.ts';
import { audioManager } from '../shell/audio-manager.ts';

export type Workspace = 'mission' | 'intelligence' | 'agents' | 'laboratory' | 'system';
export type AIVisualState = 'idle' | 'listening' | 'thinking' | 'executing' | 'waiting' | 'alert';

type OSState = {
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
  aiState: AIVisualState;
  adminKey: string;
  setAdminKey: (k: string) => void;
  tenantId: string;
  activeMissionId: string | null;
  setActiveMissionId: (id: string | null) => void;
  handleEvent: (event: MicrofixedEvent) => void;
  lastError: string | null;
  lastVoiceTranscript: string | null;
  setLastVoiceTranscript: (t: string | null) => void;
  pendingCommand: string | null;
  setPendingCommand: (cmd: string | null) => void;
  booted: boolean;
  setBooted: (b: boolean) => void;
};

const OSContext = createContext<OSState | null>(null);

function stateForEvent(event: MicrofixedEvent, current: AIVisualState): AIVisualState {
  // Real sound triggered at the exact same point as the real state
  // transition -- one source of truth, not two systems that could drift
  // out of sync with each other.
  switch (event.type) {
    case 'graph.started':
      if (current === 'idle') audioManager.play('wake');
      audioManager.play('thinking-pulse');
      return 'thinking';
    case 'graph.step':
      if (event.status === 'running') audioManager.play('agent-pulse');
      return event.status === 'running' ? 'executing' : current;
    case 'approval.required':
      audioManager.play('approval-required');
      return 'waiting';
    case 'mission.completed':
      audioManager.play(event.outcome === 'failed' ? 'warning' : 'mission-complete');
      return event.outcome === 'failed' ? 'alert' : 'idle';
    case 'system.error':
      audioManager.play('warning');
      return 'alert';
    default:
      return current;
  }
}

export function OSProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>('mission');
  const [aiState, setAiState] = useState<AIVisualState>('idle');
  const [adminKey, setAdminKey] = useState<string>(() => localStorage.getItem('microfixd_admin_key') || '');
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState<string | null>(null);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);
  const tenantId = 'global';

  const persistAdminKey = useCallback((k: string) => {
    setAdminKey(k);
    localStorage.setItem('microfixd_admin_key', k);
  }, []);

  const handleEvent = useCallback((event: MicrofixedEvent) => {
    setAiState((current) => stateForEvent(event, current));
    if (event.type === 'system.error') setLastError(event.message);
    if (event.type === 'mission.completed') setLastError(event.error ?? null);
  }, []);

  const value = useMemo<OSState>(() => ({
    workspace, setWorkspace, aiState, adminKey, setAdminKey: persistAdminKey, tenantId,
    activeMissionId, setActiveMissionId, handleEvent, lastError,
    lastVoiceTranscript, setLastVoiceTranscript,
    pendingCommand, setPendingCommand, booted, setBooted,
  }), [workspace, aiState, adminKey, persistAdminKey, activeMissionId, handleEvent, lastError, lastVoiceTranscript, pendingCommand, booted]);

  return <OSContext.Provider value={value}>{children}</OSContext.Provider>;
}

export function useOS(): OSState {
  const ctx = useContext(OSContext);
  if (!ctx) throw new Error('useOS() called outside <OSProvider>.');
  return ctx;
}
