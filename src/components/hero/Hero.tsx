import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { riderFrameSrc, usePublicContent } from '../../lib/public-content';
import type { PublicRider } from '../../../shared/garage.mjs';
import { usePrefersReducedMotion } from '../../hooks/motion';
import { BikeSpinner } from './BikeSpinner';

const AUTO_MS = 7000;
const OUT_MS = 400;
const IN_MS = 760;

const Spinner = memo(BikeSpinner);

export function Hero() {
  const { snapshot, status } = usePublicContent();
  const riders = snapshot?.riders || [];
  if (!riders.length) return <section id="top" className="relative flex min-h-[75svh] items-center px-4 pt-24 sm:px-8"><div className="mx-auto w-full max-w-[1336px]"><h1 className="font-display text-[clamp(44px,7vw,96px)] font-extrabold leading-[.95]">Highway <span className="font-serif font-normal italic text-marigold">Hustlers</span></h1><p className="mt-6 text-paper/70">Bhopal’s riding family. Sunday rides and chai stops.</p>{status === 'loading' && <div className="mt-12 h-48" aria-busy="true" aria-label="Loading riders"/>}</div></section>;
  return <Showroom key={JSON.stringify(riders)} riders={riders} cloudName={snapshot!.cloudName}/>;
}

export function Showroom({ riders: RIDERS, cloudName }: { riders: PublicRider[]; cloudName: string }) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle');
  const [auto, setAuto] = useState(!reduced);

  const rootRef = useRef<HTMLElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const rider = RIDERS[shown];
  const target = RIDERS[active];

  const stopAuto = useCallback(() => setAuto(false), []);

  const select = useCallback(
    (i: number) => {
      if (i === active || phase !== 'idle') return;
      setActive(i);
      if (reduced) {
        setShown(i);
        return;
      }
      setPhase('out');
      timers.current.push(
        window.setTimeout(() => {
          setShown(i);
          setPhase('in');
        }, OUT_MS),
        window.setTimeout(() => setPhase('idle'), OUT_MS + IN_MS)
      );
    },
    [active, phase, reduced]
  );

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // keep the active chip centred in the rail without scrolling the page
  useEffect(() => {
    const box = chipsRef.current;
    const chip = box?.querySelectorAll<HTMLElement>('[role=tab]')[active];
    if (!box || !chip || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: chip.offsetLeft - (box.clientWidth - chip.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [active, reduced]);

  // only rotate the showroom while it's on screen
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // showroom auto-advance until someone touches anything
  useEffect(() => {
    if (!auto || !onScreen) return;
    const t = window.setTimeout(() => select((active + 1) % RIDERS.length), AUTO_MS);
    return () => clearTimeout(t);
  }, [auto, onScreen, active, select]);

  const rideClass =
    phase === 'out'
      ? rider.facing === 'right'
        ? 'ride-out-right'
        : 'ride-out-left'
      : phase === 'in'
        ? rider.facing === 'right'
          ? 'ride-in-right'
          : 'ride-in-left'
        : '';

  return (
    <section
      ref={rootRef}
      id="top"
      className="relative overflow-hidden"
      style={{ '--glow': target.glow } as CSSProperties}
      onPointerDown={stopAuto}
    >
      <div className="stage-light pointer-events-none absolute inset-0" />

      {/* giant model name behind the bike */}
      <div
        key={target.id}
        aria-hidden
        className="ghost-text fade-up pointer-events-none absolute inset-x-0 top-[30%] select-none whitespace-nowrap text-center font-display text-[17vw] font-extrabold leading-none tracking-tight"
      >
        {target.model.toUpperCase()}
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-[1400px] flex-col px-4 pb-6 pt-24 sm:px-8 md:pt-28">
        {/* title row */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <h1 className="font-display text-[clamp(44px,7vw,104px)] font-extrabold leading-[0.9] tracking-[-0.03em]">
            Highway <span className="font-serif text-[1.08em] font-normal italic tracking-normal text-marigold">Hustlers</span>
          </h1>
          <div className="max-w-[340px] pb-2 md:text-right">
            <p className="text-[15px] leading-relaxed text-paper/70">
              Bhopal’s riding family. Sunday rides and chai stops.
            </p>
          </div>
        </div>

        {/* stage */}
        <div className="relative -mx-4 min-h-[260px] flex-1 sm:mx-0 md:min-h-[340px]">
          <div className="floor-shadow pointer-events-none absolute bottom-[6%] left-1/2 h-[16%] w-[70%] -translate-x-1/2" />
          <div className={`absolute inset-0 ${rideClass}`}>
            <div className="mx-auto flex h-full max-w-[1000px] items-end">
              <Spinner key={rider.id} rider={rider} cloudName={cloudName} onInteract={stopAuto} />
            </div>
          </div>
        </div>

        {/* rider + bike details */}
        <div key={target.id} className="fade-up mt-2 grid items-end gap-5 md:grid-cols-[1fr_auto_auto] md:gap-10">
          <div>
            <div className="eyebrow mb-2 flex items-center gap-3">
              <span className="text-marigold">{String(active + 1).padStart(2, '0')}</span>
              <span className="h-px w-8 bg-paper/20" />
              {target.role ?? 'Rider'}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="font-serif text-[clamp(36px,4vw,52px)] italic leading-none">{target.name}</span>
              {target.line && <span className="text-[15px] text-paper/60">{target.line}</span>}
            </div>
          </div>
          <dl className="flex gap-8 text-sm">
            <div>
              <dt className="eyebrow mb-1">Rides</dt>
              <dd className="font-medium">
                {target.brand} {target.model}
              </dd>
            </div>
            <div>
              <dt className="eyebrow mb-1">Engine</dt>
              <dd className="font-medium">
                {target.cc} cc
              </dd>
            </div>
          </dl>
          <div className="flex items-center gap-3 justify-self-start">
            <span className="text-sm tabular-nums text-paper/45">
              <span className="text-paper">{String(active + 1).padStart(2, '0')}</span> / {String(RIDERS.length).padStart(2, '0')}
            </span>
            {[
              { label: 'Previous rider', icon: <ChevronLeft size={18} />, step: -1 },
              { label: 'Next rider', icon: <ChevronRight size={18} />, step: 1 },
            ].map(({ label, icon, step }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                onClick={() => {
                  stopAuto();
                  select((active + step + RIDERS.length) % RIDERS.length);
                }}
                className="grid h-11 w-11 place-items-center rounded-full border border-paper/15 text-paper/80 transition hover:border-marigold/60 hover:text-marigold"
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* rider picker */}
        <div
          ref={chipsRef}
          className="chip-rail -mx-4 mt-6 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] sm:-mx-8 sm:px-8"
        >
          <div role="tablist" aria-label="Choose a rider" className="flex gap-2">
            {RIDERS.map((r, i) => {
              const on = i === active;
              return (
                <button
                  key={r.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    stopAuto();
                    select(i);
                  }}
                  className={`group relative flex w-[176px] shrink-0 items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition ${
                    on ? 'border-paper/20 bg-paper/[0.06]' : 'border-paper/[0.06] hover:border-paper/15 hover:bg-paper/[0.03]'
                  }`}
                >
                  <span className="absolute inset-x-0 top-0 h-[2px] bg-paper/5">
                    {on && (
                      <span
                        key={`${r.id}-${auto}-${onScreen}`}
                        className="block h-full bg-marigold"
                        style={
                          auto
                            ? { animation: `fill ${AUTO_MS}ms linear forwards`, animationPlayState: onScreen ? 'running' : 'paused', width: 0 }
                            : { width: '100%' }
                        }
                      />
                    )}
                  </span>
                  <img
                    src={riderFrameSrc(r, 0, cloudName, 160)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`h-9 w-[60px] shrink-0 object-contain transition ${on ? '' : 'opacity-60 grayscale group-hover:opacity-90 group-hover:grayscale-0'}`}
                  />
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-semibold ${on ? 'text-paper' : 'text-paper/70'}`}>{r.name}</span>
                    <span className="block truncate text-xs text-paper/45">{r.model}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
