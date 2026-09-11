// src/os/shell/AIPresence.tsx
//
// The persistent AI presence. Now uses the real 3D wireframe bust
// (use-holographic-head.ts) matching the screenshot's actual rendering
// technique. use-face-particles.ts is left in place, unused by this
// file, in case the 2D look is wanted again for a lighter-weight
// context -- nothing was deleted.

import { useEffect, useRef } from 'react';
import { useOS } from '../state/os-context.tsx';
import { useHolographicHead } from './use-holographic-head.ts';

const STATE_LABEL: Record<string, string> = {
  idle: 'IDLE',
  listening: 'LISTENING',
  thinking: 'THINKING',
  executing: 'EXECUTING',
  waiting: 'AWAITING APPROVAL',
  alert: 'ALERT',
};

export function AIPresence({ compact = false }: { compact?: boolean }) {
  const { aiState } = useOS();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const head = useHolographicHead(canvasRef);

  useEffect(() => {
    const isActive = aiState !== 'idle';
    head.current?.setForm(isActive ? 1 : 0.55);
    head.current?.setEyesLit(isActive);
    head.current?.setAlert(aiState === 'alert');
  }, [aiState, head]);

  return (
    <div className={`relative ${compact ? 'h-40' : 'h-full'} w-full`} data-ai-state={aiState}>
      <canvas ref={canvasRef} className="h-full w-full" />
      <div
        className={`pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] tracking-widest font-mono ${
          aiState === 'alert'
            ? 'border-red-400/50 text-red-300'
            : aiState === 'waiting'
            ? 'border-amber-400/50 text-amber-300'
            : 'border-teal-400/30 text-teal-300/80'
        }`}
      >
        {STATE_LABEL[aiState] ?? aiState.toUpperCase()}
      </div>
    </div>
  );
}
