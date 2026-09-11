// src/os/shell/OSShell.tsx
//
// Layout, per explicit direction: the AI head plus the command/chat
// input directly beneath it occupy the majority of the main screen.
// Side rails carry compact real telemetry (QuickActions + AIInsights,
// both backed by real routes). The five workspace destinations
// (Mission/Intelligence/Agents/Laboratory/System) live in a bottom
// strip and open as an overlay, so head+chat remain the persistent,
// dominant surface. A real boot sequence (BootExperience) gates entry,
// once per connected session.

import { useState } from 'react';
import { useOS } from '../state/os-context.tsx';
import { AIPresence } from './AIPresence.tsx';
import { PrimaryNavigation } from './PrimaryNavigation.tsx';
import { ChatDock } from './ChatDock.tsx';
import { BootExperience } from '../boot/BootExperience.tsx';
import { WorkspaceRouter } from '../workspaces/WorkspaceRouter.tsx';
import { LiveOperationsPanel, GovernanceStatusPanel, RuntimeStatusPanel, OperatorCredentialsPanel, VoiceTranscriptPanel, QuickIntentsPanel, SoundToggle } from './SpatialPanels.tsx';
import { ActivityTimeline } from './ActivityTimeline.tsx';

function ConnectGate() {
  const { setAdminKey } = useOS();
  const [value, setValue] = useState('');
  return (
    <div className="flex h-screen items-center justify-center bg-black text-slate-200">
      <div className="w-full max-w-sm space-y-3 rounded-md border border-teal-500/20 bg-black/60 p-6">
        <div className="text-[11px] tracking-widest text-teal-400/70 font-mono">MICROFIXD ACCESS</div>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && value && setAdminKey(value)}
          placeholder="Admin key"
          className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-teal-400/60"
        />
        <button
          onClick={() => value && setAdminKey(value)}
          disabled={!value}
          className="w-full rounded border border-teal-400/40 bg-teal-500/10 py-2 text-sm text-teal-200 disabled:opacity-40"
        >
          Connect
        </button>
      </div>
    </div>
  );
}

export function OSShell() {
  const { adminKey, tenantId, booted, setBooted } = useOS();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  if (!adminKey) return <ConnectGate />;
  if (!booted) return <BootExperience adminKey={adminKey} tenantId={tenantId} onDone={() => setBooted(true)} />;

  return (
    <div className="relative flex h-screen w-full flex-col bg-black text-slate-200 overflow-hidden">
      {/* Layer 0: background grid, decorative only */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#0a0f1a_1px,transparent_1px),linear-gradient(to_bottom,#0a0f1a_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-30" />

      {/* Layer 20-30: dominant central area -- matches the screenshot's 3-column Spatial OS Shell layout, real panels left and right, head+chat centered */}
      <div className="relative flex flex-1 min-h-0">
        <aside className="hidden lg:flex w-72 shrink-0 flex-col gap-3 border-r border-violet-500/10 bg-black/30 p-3 overflow-y-auto">
          <LiveOperationsPanel />
          <GovernanceStatusPanel />
          <ActivityTimeline />
        </aside>

        <main className="relative flex flex-1 flex-col items-center justify-center px-4">
          <div className="text-center mb-2">
            <div className="text-[10px] tracking-widest text-teal-400/60 font-mono">MICROFIXD / PRESENCE MODEL</div>
            <div className="text-sm text-slate-300">Always-present interface</div>
          </div>
          <div className="w-full max-w-3xl h-[55vh] max-h-[520px]">
            <AIPresence />
          </div>
          <div className="w-full max-w-2xl -mt-4">
            <ChatDock />
          </div>
        </main>

        <aside className="hidden lg:flex w-72 shrink-0 flex-col gap-3 border-l border-violet-500/10 bg-black/30 p-3 overflow-y-auto">
          <RuntimeStatusPanel />
          <OperatorCredentialsPanel />
          <VoiceTranscriptPanel />
          <SoundToggle />
          <QuickIntentsPanel />
        </aside>
      </div>

      {/* Layer 60: bottom strip navigation -- opens a workspace overlay rather than splitting the main view */}
      <div className="relative z-[60] border-t border-teal-500/10 bg-black/60 backdrop-blur-sm">
        <PrimaryNavigation onSelect={() => setWorkspaceOpen(true)} />
      </div>

      {/* Layer 80: workspace overlay, dismissible, keeps head+chat as the base layer beneath it */}
      {workspaceOpen && (
        <div className="absolute inset-0 z-[80] flex flex-col bg-black/95">
          <div className="flex items-center justify-between border-b border-teal-500/10 px-4 py-2">
            <span className="text-[11px] tracking-widest text-teal-400/70 font-mono">WORKSPACE</span>
            <button onClick={() => setWorkspaceOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">Close X</button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <WorkspaceRouter />
          </div>
        </div>
      )}
    </div>
  );
}
