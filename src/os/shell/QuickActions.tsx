// src/os/shell/QuickActions.tsx
//
// Each button here sets a real command into shared OS state, which
// ChatDock picks up and sends through the actual governed
// /api/autonomy/chat endpoint -- same intents, same Paragon approval
// gates as typing it by hand. These are shortcuts to real actions, not
// decorative hexagons: "Optimize System" really calls the self-healing
// status intent, "Research Knowledge" really calls usage-report, etc.
// Two reference-image actions (Build Agent, Deploy System) don't have a
// backing governed intent yet -- rather than fake a result, they're
// labeled accordingly and route to 'help' so the user sees what's
// actually supported instead of a silent no-op.

import { useOS } from '../state/os-context.tsx';

const ACTIONS: { label: string; command: string; note?: string }[] = [
  { label: 'Optimize System', command: 'self-healing status' },
  { label: 'Analyze Data', command: 'compute status' },
  { label: 'Automate Workflow', command: 'agent posture' },
  { label: 'Research Knowledge', command: 'usage report' },
  { label: 'Build Agent', command: 'help', note: 'not yet a governed intent' },
  { label: 'Deploy System', command: 'help', note: 'not yet a governed intent' },
];

export function QuickActions() {
  const { setPendingCommand, adminKey } = useOS();
  return (
    <div className="grid grid-cols-3 gap-2">
      {ACTIONS.map((a) => (
        <button
          key={a.label}
          disabled={!adminKey}
          onClick={() => setPendingCommand(a.command)}
          title={a.note}
          className="flex flex-col items-center gap-1 rounded-md border border-violet-500/20 bg-black/40 px-2 py-3 text-[10px] text-slate-300 hover:border-violet-400/40 hover:bg-violet-500/5 disabled:opacity-30"
        >
          <span className="text-lg">{'\u25C8'}</span>
          <span className="tracking-wide">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
