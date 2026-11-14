import { useEffect, useState } from 'react';
import { usePublicContent } from '../lib/public-content';
import { UserRound } from 'lucide-react';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="none" stroke="rgb(var(--paper) / .18)" />
      <path d="M13 10v20M27 10v20" stroke="rgb(var(--paper))" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M13 20h14" stroke="rgb(var(--marigold))" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="3.5 3" />
    </svg>
  );
}

const LINKS = [
  ['#vibe', 'Our vibe'],
  ['#sundays', 'Sundays'],
  ['#routes', 'Routes'],
] as const;

export function Nav() {
  const { snapshot } = usePublicContent();
  const ride=snapshot?.upcomingRide;
  const hasUpcoming=!!ride&&(!ride.date||ride.date>=new Date(Date.now()+19800000).toISOString().slice(0,10));
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? 'border-b border-paper/[0.06] bg-ink/70 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Highway Hustlers, back to top">
          <Logo className="h-8 w-8" />
          <span className="font-display text-[15px] font-bold tracking-tight">Highway Hustlers</span>
        </a>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a href="/member" aria-label="HHR member login" title="HHR member" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-paper/80 transition hover:bg-paper/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marigold"><UserRound size={19}/></a>
          {LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="hidden rounded-full px-3.5 py-2 text-sm text-paper/65 transition hover:bg-paper/[0.06] hover:text-paper md:block"
            >
              {label}
            </a>
          ))}
          <a
            href={hasUpcoming ? '#upcoming-ride' : '#join'}
            className="ml-2 rounded-full bg-paper px-4 py-2 text-sm font-semibold text-ink transition hover:bg-marigold"
          >
            Ride with us
          </a>
        </nav>
      </div>
    </header>
  );
}
