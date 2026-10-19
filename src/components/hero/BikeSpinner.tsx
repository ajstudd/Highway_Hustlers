import { useEffect, useRef, useState } from 'react';
import type { PublicRider } from '../../../shared/garage.mjs';
import { FrameCache } from '../../../shared/frame-cache.mjs';
import { riderFrameSrc } from '../../lib/public-content';
import { usePrefersReducedMotion } from '../../hooks/motion';

const CANVAS_W = 1200;
const CANVAS_H = 720;

type Props = {
  rider: PublicRider;
  cloudName: string;
  onInteract?: () => void;
};

/**
 * Real-photo turntable: draws one of N transparent frames to a canvas and maps
 * horizontal drag to rotation, with inertia. Single-frame bikes get a tilt instead.
 */
export function BikeSpinner({ rider, cloudName, onInteract }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const images = useRef<FrameCache | null>(null);
  const pos = useRef(0);
  const vel = useRef(0);
  const drawn = useRef(-1);
  const drag = useRef<{ x: number; t: number; startPos: number; lastX: number } | null>(null);
  const [hinted, setHinted] = useState(false);
  const [unavailable, setUnavailable] = useState(false), [retry, setRetry] = useState(0);
  const [visible, setVisible] = useState(!document.hidden);
  const reduced = usePrefersReducedMotion();
  const n = rider.frames;
  const spins = n > 1;

  // Decode only a small moving window, never all 36/40 frames at once.
  // Large decorative intro spins no longer force a complete set download.
  useEffect(() => {
    drawn.current = -1;
    setUnavailable(false);
    const width = window.matchMedia('(max-width: 640px)').matches ? 720 : 1200;
    const pool = new FrameCache({ count: n, capacity: width === 720 ? 8 : 12, concurrency: 2,
      load: async (i, signal) => {
        const response = await fetch(riderFrameSrc(rider, i, cloudName, width), { signal, credentials: 'omit' });
        if (!response.ok) throw Error('Bike image unavailable.');
        const bitmap = await createImageBitmap(await response.blob(), { resizeWidth: width, resizeQuality: 'high' });
        if (signal.aborted) { bitmap.close(); throw Error('Cancelled'); }
        return bitmap;
      },
      onChange: () => { drawn.current = -1; setUnavailable(false); },
      onError: () => { if (!pool.images.size) setUnavailable(true); },
    });
    images.current = pool; pool.window(0);
    return () => { pool.close(); if (images.current === pool) images.current = null; };
  }, [rider, cloudName, n, retry]);

  useEffect(() => {
    let onScreen = true;
    const update = () => setVisible(onScreen && !document.hidden);
    const io = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; update(); });
    if (canvasRef.current) io.observe(canvasRef.current);
    document.addEventListener('visibilitychange', update);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    images.current?.pause(!visible);
    if (!visible) return;
    let raf = 0;

    const smooth = n > 1 && n <= 16 && !reduced;
    const frameAt = (p: number) => {
      const idx = p * rider.dir;
      return ((idx % n) + n) % n;
    };

    const nearestLoaded = (i: number) => {
      if (images.current?.get(i)) return i;
      for (let d = 1; d < n; d++) {
        if (images.current?.get((i + d) % n)) return (i + d) % n;
        if (images.current?.get((i - d + n) % n)) return (i - d + n) % n;
      }
      return -1;
    };

    const paint = (i: number, alpha = 1) => {
      ctx.globalAlpha = alpha;
      const image = images.current?.get(i); if (!image) return;
      ctx.drawImage(image, 0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      images.current?.window(frameAt(Math.round(pos.current)));
      if (smooth) {
        // few frames: blend the two neighbours so the turn doesn't stutter
        const base = Math.floor(pos.current);
        const f = Math.round((pos.current - base) * 20) / 20;
        const i0 = frameAt(base);
        const i1 = frameAt(base + 1);
        if (images.current?.get(i0) && images.current?.get(i1)) {
          const key = i0 + f;
          if (key === drawn.current) return;
          ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
          paint(i0, 1 - f);
          if (f > 0) paint(i1, f);
          drawn.current = key;
          return;
        }
      }
      const i = nearestLoaded(frameAt(Math.round(pos.current)));
      if (i === -1 || i === drawn.current) return;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      paint(i);
      drawn.current = i;
    };

    const tick = () => {
      if (!drag.current && Math.abs(vel.current) > 0.002) {
        pos.current += vel.current * 16;
        vel.current *= 0.9;
      } else if (!drag.current) {
        // settle on a real frame rather than resting mid-blend
        const target = Math.round(pos.current);
        const d = target - pos.current;
        pos.current = Math.abs(d) < 0.02 ? target : pos.current + d * 0.18;
      }

      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rider.dir, n, reduced, visible, retry]);

  const pxPerFrame = () => {
    const w = canvasRef.current?.clientWidth ?? 800;
    return (w * 0.9) / n;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    vel.current = 0;
    drag.current = { x: e.clientX, t: performance.now(), startPos: pos.current, lastX: e.clientX };
    setHinted(true);
    onInteract?.();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (spins) {
      const now = performance.now();
      const dt = Math.max(1, now - d.t);
      const step = (e.clientX - d.lastX) / pxPerFrame();
      vel.current = Math.max(-0.05, Math.min(0.05, step / dt));
      d.t = now;
      d.lastX = e.clientX;
      pos.current = d.startPos + dx / pxPerFrame();
    } else if (tiltRef.current) {
      const deg = Math.max(-22, Math.min(22, dx * 0.08));
      tiltRef.current.style.transition = 'none';
      tiltRef.current.style.transform = `perspective(1400px) rotateY(${deg}deg)`;
    }
  };

  const onPointerUp = () => {
    // a pause before letting go means "stop here", not "fling"
    if (drag.current && performance.now() - drag.current.t > 80) vel.current = 0;
    drag.current = null;
    if (!spins && tiltRef.current) {
      tiltRef.current.style.transition = 'transform 900ms cubic-bezier(.2,1.6,.4,1)';
      tiltRef.current.style.transform = 'perspective(1400px) rotateY(0deg)';
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!spins) return;
    const step = Math.max(1, Math.round(n / 16));
    if (e.key === 'ArrowLeft') pos.current -= step;
    else if (e.key === 'ArrowRight') pos.current += step;
    else return;
    e.preventDefault();
    setHinted(true);
    onInteract?.();
  };

  return (
    <div className="relative h-full w-full select-none">
      <div
        ref={tiltRef}
        className="relative h-full w-full cursor-grab touch-pan-y rounded-3xl outline-none focus-visible:ring-1 focus-visible:ring-marigold/40 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="img"
        aria-label={`${rider.brand} ${rider.model} in ${rider.colorName}.${spins ? ' Drag or use arrow keys to rotate.' : ''}`}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="bike-canvas pointer-events-none mx-auto block h-auto max-h-full w-full object-contain"
        />
      </div>
      {unavailable && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"><p className="text-sm text-paper/70">Bike image unavailable.</p><button type="button" className="rounded-full border border-paper/30 px-4 py-2 text-sm" onClick={() => setRetry(i => i+1)}>Try again</button></div>}
      <div
        className={`pointer-events-none absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.2em] text-paper/45 transition-opacity duration-700 ${
          hinted ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <svg width="34" height="10" viewBox="0 0 34 10" fill="none" aria-hidden>
          <path d="M5 1 1 5l4 4M29 1l4 4-4 4M1 5h32" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        {spins ? 'Drag to spin 360°' : 'Drag to tilt'}
      </div>
    </div>
  );
}
