// src/os/shell/use-face-particles.ts
//
// Extracted from src/MicrofixedOS.tsx's useFaceParticles -- byte-identical
// rendering logic, moved here so it has one home instead of being
// duplicated between the legacy boot screen and the new persistent OS
// AIPresence. This is the actual particle-face technique already
// approved and running in production; nothing about the visual algorithm
// changed in this extraction.

import { useEffect, useRef, type RefObject } from 'react';

export function useFaceParticles(canvasRef: RefObject<HTMLCanvasElement>, count: number, ringY: number) {
  const stateRef = useRef<{ setForm: (p: number) => void; setEyesLit: (v: boolean) => void } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, formProgress = 0, eyesLit = false, t = 0;

    function resize() {
      w = canvas!.clientWidth; h = canvas!.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function buildFacePoints(n: number, cx: number, cy: number, scale: number) {
      const off = document.createElement('canvas'); off.width = 200; off.height = 240;
      const octx = off.getContext('2d')!;
      octx.fillStyle = '#fff';
      octx.beginPath(); octx.ellipse(100, 110, 58, 78, 0, 0, Math.PI * 2); octx.fill();
      octx.beginPath(); octx.moveTo(65, 175); octx.lineTo(60, 230); octx.lineTo(140, 230); octx.lineTo(135, 175); octx.closePath(); octx.fill();
      octx.globalCompositeOperation = 'destination-out';
      octx.beginPath(); octx.ellipse(78, 105, 8, 6, 0, 0, Math.PI * 2); octx.fill();
      octx.beginPath(); octx.ellipse(122, 105, 8, 6, 0, 0, Math.PI * 2); octx.fill();
      octx.beginPath(); octx.ellipse(100, 140, 14, 5, 0, 0, Math.PI * 2); octx.fill();
      octx.globalCompositeOperation = 'source-over';
      const data = octx.getImageData(0, 0, 200, 240).data;
      const candidates: { x: number; y: number }[] = [];
      for (let y = 0; y < 240; y += 2) for (let x = 0; x < 200; x += 2) {
        if (data[(y * 200 + x) * 4 + 3] > 100) candidates.push({ x: (x - 100) * scale + cx, y: (y - 120) * scale + cy });
      }
      for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
      return candidates.slice(0, n);
    }

    const cx = w / 2, cy = h / 2;
    const targets = buildFacePoints(count, cx, cy, Math.min(w, h) / 260);
    const particles = targets.map((tp) => ({ x: cx + (Math.random() - 0.5) * w * 1.4, y: cy + (Math.random() - 0.5) * h * 1.4, tx: tp.x, ty: tp.y, size: Math.random() * 1.4 + 0.6, hueMix: Math.random(), driftPhase: Math.random() * Math.PI * 2 }));
    const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
    const color = (mix: number, alpha: number) => { const c1 = [94, 234, 212], c2 = [167, 139, 250]; const r = c1[0] + (c2[0] - c1[0]) * mix, g = c1[1] + (c2[1] - c1[1]) * mix, b = c1[2] + (c2[2] - c1[2]) * mix; return `rgba(${r | 0},${g | 0},${b | 0},${alpha})`; };

    function draw() {
      t += 0.016;
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        const drift = Math.sin(t * 0.6 + p.driftPhase) * (1 - formProgress) * 6;
        const ex = p.x + (p.tx - p.x) * easeOutCubic(formProgress) + drift * (1 - formProgress);
        const ey = p.y + (p.ty - p.y) * easeOutCubic(formProgress) + drift * (1 - formProgress) * 0.5;
        p.x += (ex - p.x) * 0.06; p.y += (ey - p.y) * 0.06;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx!.fillStyle = color(p.hueMix, 0.35 + 0.45 * formProgress); ctx!.fill();
      }
      if (eyesLit && formProgress > 0.8) {
        const scale = Math.min(w, h) / 260;
        [[-22, -15], [22, -15]].forEach(([dx, dy]) => {
          const gx = cx + dx * scale, gy = cy + dy * scale;
          const grad = ctx!.createRadialGradient(gx, gy, 0, gx, gy, 14 * scale);
          grad.addColorStop(0, 'rgba(94,234,212,0.9)'); grad.addColorStop(1, 'rgba(94,234,212,0)');
          ctx!.fillStyle = grad; ctx!.beginPath(); ctx!.arc(gx, gy, 14 * scale, 0, Math.PI * 2); ctx!.fill();
        });
      }
      const ringCx = w / 2, ringCy = h * ringY;
      for (let i = 0; i < 3; i++) {
        ctx!.beginPath(); ctx!.ellipse(ringCx, ringCy, (60 + i * 22) * formProgress, (10 + i * 3) * formProgress, 0, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(94,234,212,${0.25 - i * 0.07})`; ctx!.lineWidth = 1.2; ctx!.stroke();
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    stateRef.current = { setForm: (p) => { formProgress = p; }, setEyesLit: (v) => { eyesLit = v; } };
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [canvasRef, count, ringY]);

  return stateRef;
}
