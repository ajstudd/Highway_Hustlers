import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { RideMotion } from './journey';

export function SundayScene({ motion }: { motion: MutableRefObject<RideMotion> }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      import('./world').then(async ({ createRideWorld, prepareRideActors }) => {
        await prepareRideActors();
        if (cancelled) return;
        dispose = createRideWorld(element, motion);
        motion.current.ready = true;
        setStatus('ready');
      }).catch(() => { if (!cancelled) { motion.current.ready = true; setStatus('fallback'); } });
    }, { rootMargin: '400px' });
    observer.observe(element);
    return () => { cancelled = true; observer.disconnect(); motion.current.ready = false; dispose?.(); };
  }, [motion]);

  return <>
    <div ref={host} className="sunday-render" aria-hidden="true" />
    {status !== 'ready' && <div className="sunday-render-fallback"><img src="/bikes/hunter-350/09.webp" alt="" /><p>{status === 'loading' ? 'Loading the ride…' : '3D view unavailable. Explore the stops below.'}</p></div>}
    <span className="sr-only">Illustrated Bhopal–Kerwa ride with a woman and two men on different bikes. Six stops: kit up, meet up, open road, breakfast, destination and home. Scroll or choose a stop. Use Play for automatic travel.</span>
  </>;
}
