// src/os/boot/BootExperience.tsx
//
// Six stages matching the approved reference: boot log -> emergence ->
// awareness -> greeting -> interaction -> full interface. Now uses the
// real 3D wireframe head (use-holographic-head.ts) instead of the old 2D
// particle renderer -- this was a real inconsistency: the main OS shell
// switched to the wireframe head, but boot never did, so a user saw one
// visual identity at boot and a different one after. Real per-stage
// sound wired through the same audio-manager used everywhere else, not
// a separate audio system.

import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../state/api.ts';
import { useHolographicHead } from '../shell/use-holographic-head.ts';
import { audioManager } from '../shell/audio-manager.ts';

const BOOT_LINES = [
  'Initializing Core Systems...',
  'Loading Neural Architecture...',
  'Allocating Memory...',
  'Establishing Secure Connection...',
  'Calibrating Sensors...',
  'Synchronizing Modules...',
];

type Props = { adminKey: string; tenantId: string; onDone: () => void };

export function BootExperience({ adminKey, tenantId, onDone }: Props) {
  const [stage, setStage] = useState(0); // 0 boot log, 1 emergence, 2 awareness, 3 greeting, 4 interaction, 5 done
  const [lineIndex, setLineIndex] = useState(0);
  const [status, setStatus] = useState<'checking' | 'nominal' | 'degraded'>('checking');
  const [recentCount, setRecentCount] = useState<string>('checking recent activity…');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const head = useHolographicHead(canvasRef);

  // Real backend check, not decorative.
  useEffect(() => {
    fetch(apiUrl('/readyz')).then((r) => r.json()).then((body) => setStatus(body.status === 'ok' ? 'nominal' : 'degraded')).catch(() => setStatus('degraded'));
  }, []);

  useEffect(() => {
    if (stage !== 3 || !adminKey) return;
    fetch(apiUrl('/api/autonomy/usage-report'), { headers: { 'x-microfixd-admin-key': adminKey, 'x-microfixd-tenant': tenantId } })
      .then((r) => r.json())
      .then((body) => setRecentCount(`${body?.inMemoryWindow?.eventCount ?? 0} events recorded since last restart.`))
      .catch(() => setRecentCount('Recent activity unavailable.'));
  }, [stage, adminKey, tenantId]);

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      // First boot line click is the real "user gesture" this page gets
      // for free (page load counts for some browsers, but audio may
      // still be blocked -- markUserInteracted() is safe to call
      // speculatively; play() no-ops until a real gesture unlocks it
      // anyway if the browser is strict about it).
      audioManager.markUserInteracted();
      for (let i = 0; i < BOOT_LINES.length; i++) {
        if (cancelled) return;
        setLineIndex(i);
        audioManager.play('system-sync-pulse');
        await sleep(280);
      }
      await sleep(400); if (cancelled) return; setStage(1); head.current?.setForm(1); audioManager.play('wake');
      await sleep(1600); if (cancelled) return; setStage(2); head.current?.setEyesLit(true); audioManager.play('online-arrival');
      await sleep(1200); if (cancelled) return; setStage(3);
      await sleep(2200); if (cancelled) return; setStage(4); audioManager.play('listening');
      await sleep(1800); if (cancelled) return; setStage(5); onDone();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black text-slate-200">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-90" />

      {stage === 0 && (
        <div className="relative z-10 w-full max-w-md font-mono text-xs text-teal-400/80 space-y-1 px-6">
          <div className="text-teal-300 mb-2">MICROFIXD OS</div>
          {BOOT_LINES.slice(0, lineIndex + 1).map((line, i) => (
            <div key={i}>{i < lineIndex ? <span className="text-teal-500">✓</span> : <span className="animate-pulse text-teal-300">›</span>} {line}</div>
          ))}
        </div>
      )}

      {stage === 2 && (
        <div className="relative z-10 text-center font-mono">
          <div className="text-lg tracking-widest text-teal-300">MICROFIXD ONLINE</div>
          <div className="text-xs text-slate-500 mt-1">SYSTEM {status === 'nominal' ? 'NOMINAL' : status === 'degraded' ? 'DEGRADED' : 'CHECKING…'}</div>
        </div>
      )}

      {stage === 3 && (
        <div className="relative z-10 text-center font-mono max-w-sm px-6">
          <div className="text-xl text-teal-200">Good day. I am Microfixd.</div>
          <div className="text-xs text-slate-500 mt-2">{recentCount}</div>
          <div className="text-xs text-slate-500 mt-1">How may I assist you today?</div>
        </div>
      )}

      {stage === 4 && (
        <div className="relative z-10 text-center font-mono">
          <div className="text-sm text-teal-300 animate-pulse">I am listening.</div>
          <div className="text-xs text-slate-500 mt-1">What would you like to accomplish?</div>
        </div>
      )}
    </div>
  );
}
