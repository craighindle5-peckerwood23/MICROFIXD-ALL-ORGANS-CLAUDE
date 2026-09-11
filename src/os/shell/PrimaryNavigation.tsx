// src/os/shell/PrimaryNavigation.tsx
import { useOS, type Workspace } from '../state/os-context.tsx';

const ITEMS: { id: Workspace; label: string; sub: string }[] = [
  { id: 'mission', label: 'MISSION', sub: 'Control center' },
  { id: 'intelligence', label: 'INTELLIGENCE', sub: 'Cognition layer' },
  { id: 'agents', label: 'AGENTS', sub: 'Governed systems' },
  { id: 'laboratory', label: 'LABORATORY', sub: 'Sandbox & build' },
  { id: 'system', label: 'SYSTEM', sub: 'Infrastructure' },
];

export function PrimaryNavigation({ onSelect }: { onSelect?: () => void }) {
  const { workspace, setWorkspace } = useOS();
  return (
    <nav className="flex gap-1 p-2 justify-center">
      {ITEMS.map((item) => {
        const active = workspace === item.id;
        return (
          <button
            key={item.id}
            onClick={() => { setWorkspace(item.id); onSelect?.(); }}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 max-w-[180px] text-center rounded-md px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
              active ? 'bg-teal-500/15 border border-teal-400/40 text-teal-200' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
            }`}
          >
            <div className="text-[11px] tracking-widest font-mono">{item.label}</div>
            <div className="text-[10px] text-slate-500">{item.sub}</div>
          </button>
        );
      })}
    </nav>
  );
}
