import { useEffect, useRef, useState } from 'react';
import { frameSrc, type Rider } from '../../data/site';
import { usePrefersReducedMotion } from '../../hooks/motion';

const CANVAS_W = 1200;
const CANVAS_H = 720;

type Props = {
  rider: Rider;
  /** spin once into the side profile when the frames are ready */
  intro?: boolean;
  onInteract?: () => void;
};

/**
 * Real-photo turntable: draws one of N transparent frames to a canvas and maps
 * horizontal drag to rotation, with inertia. Single-frame bikes get a tilt instead.
 */
export function BikeSpinner({ rider, intro = false, onInteract }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  const pos = useRef(0);
  const vel = useRef(0);
  const drawn = useRef(-1);
  const drag = useRef<{ x: number; t: number; startPos: number; lastX: number } | null>(null);
  const introAnim = useRef<{ from: number; start: number; dur: number } | null>(null);
  const [hinted, setHinted] = useState(false);
  const reduced = usePrefersReducedMotion();
  const n = rider.frames;
  const spins = n > 1;

  // load frames: 00 first so something shows immediately, the rest in order
  useEffect(() => {
    images.current = new Array(n).fill(null);
    drawn.current = -1;
    let cancelled = false;
    let loaded = 0;
    const onAllLoaded = () => {
      if (intro && spins && !reduced && !cancelled) {
        pos.current = -n;
        introAnim.current = { from: -n, start: performance.now(), dur: 1700 };
      }
    };
    for (let i = 0; i < n; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = frameSrc(rider.id, i);
      img.onload = () => {
        if (cancelled) return;
        images.current[i] = img;
        if (i === 0) drawn.current = -1;
        loaded++;
        if (loaded === n) onAllLoaded();
      };
    }
    return () => {
      cancelled = true;
    };
  }, [rider.id, n, intro, spins, reduced]);

  // render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;

    const smooth = n > 1 && n <= 16 && !reduced;
    const frameAt = (p: number) => {
      const idx = p * rider.dir;
      return ((idx % n) + n) % n;
    };

    const nearestLoaded = (i: number) => {
      if (images.current[i]) return i;
      for (let d = 1; d < n; d++) {
        if (images.current[(i + d) % n]) return (i + d) % n;
        if (images.current[(i - d + n) % n]) return (i - d + n) % n;
      }
      return -1;
    };

    const paint = (i: number, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(images.current[i]!, 0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      if (smooth) {
        // few frames: blend the two neighbours so the turn doesn't stutter
        const base = Math.floor(pos.current);
        const f = Math.round((pos.current - base) * 20) / 20;
        const i0 = frameAt(base);
        const i1 = frameAt(base + 1);
        if (images.current[i0] && images.current[i1]) {
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

    const tick = (now: number) => {
      const a = introAnim.current;
      if (a) {
        const t = Math.min(1, (now - a.start) / a.dur);
        const ease = 1 - Math.pow(1 - t, 4);
        pos.current = a.from * (1 - ease);
        if (t >= 1) introAnim.current = null;
      } else if (!drag.current && Math.abs(vel.current) > 0.002) {
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
  }, [rider.dir, n, reduced]);

  const pxPerFrame = () => {
    const w = canvasRef.current?.clientWidth ?? 800;
    return (w * 0.9) / n;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    introAnim.current = null;
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
