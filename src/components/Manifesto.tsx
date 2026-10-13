import { useMemo, useRef } from 'react';
import { MANIFESTO } from '../data/site';
import { useStickyProgress } from '../hooks/motion';

/** Words light up one by one as you scroll through the section. */
export function Manifesto() {
  const ref = useRef<HTMLElement>(null);
  const p = useStickyProgress(ref);

  const words = useMemo(() => {
    const out: { w: string; accent: boolean }[] = [];
    let accent = false;
    for (const raw of MANIFESTO.split(' ')) {
      let w = raw;
      const opens = w.startsWith('*');
      if (opens) {
        accent = true;
        w = w.slice(1);
      }
      const closes = w.endsWith('*') || w.endsWith('*.') || w.endsWith('*,');
      w = w.replace('*', '');
      out.push({ w, accent });
      if (closes) accent = false;
    }
    return out;
  }, []);

  // leave a little dwell at both ends
  const lit = Math.min(1, Math.max(0, (p - 0.08) / 0.78)) * words.length;

  return (
    <section id="vibe" ref={ref} className="relative h-[180svh]">
      <div className="sticky top-0 flex h-[100svh] items-center">
        <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-8">
          <div className="eyebrow mb-8 flex items-center gap-3">
            <span className="h-px w-8 bg-marigold" /> Our vibe
          </div>
          <p className="font-display text-[clamp(28px,4.4vw,62px)] font-bold leading-[1.08] tracking-[-0.02em]">
            {words.map(({ w, accent }, i) => {
              const o = Math.min(1, Math.max(0.12, lit - i + 1));
              return (
                <span
                  key={i}
                  className={accent ? 'font-serif font-normal italic tracking-normal text-marigold' : ''}
                  style={{ opacity: o, transition: 'opacity 200ms linear' }}
                >
                  {w}{' '}
                </span>
              );
            })}
          </p>
        </div>
      </div>
    </section>
  );
}
