import { ArrowUpRight, Instagram } from 'lucide-react';
import { CODE, LINKS } from '../data/site';
import { Logo } from './Nav';

export function Join() {
  const instagramClass = 'group inline-flex items-center gap-2.5 rounded-full bg-marigold px-7 py-4 text-[15px] font-semibold text-ink transition hover:bg-[#ffb63d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marigold';
  return (
    <section id="join" className="relative overflow-hidden">
      <div className="relative mx-auto max-w-[1180px] px-4 py-28 text-center sm:px-8 md:py-40">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-marigold/[0.08] blur-[120px]" />
        <div className="reveal relative">
          <h2 className="font-display text-[clamp(48px,9vw,96px)] font-extrabold leading-[0.95] tracking-[-0.04em]">
            Got a bike?
            <br />
            <span className="font-serif font-normal italic tracking-normal text-marigold">You’re in.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-md text-[17px] leading-relaxed text-paper/65">
            Find the next ride on Instagram.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {LINKS.instagram ? <a
              href={LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={instagramClass}
            >
              <Instagram size={18} />
              Follow on Instagram
              <ArrowUpRight size={16} />
            </a> : <button type="button" disabled className={`${instagramClass} opacity-60`}>
              <Instagram size={18} /> Instagram · coming soon
            </button>}
          </div>

          <ul className="mx-auto mt-14 flex max-w-2xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-paper/45">
            {CODE.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-marigold" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-paper/[0.07]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-10 text-sm text-paper/45 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Logo className="h-7 w-7" />
          <span>Highway Hustlers · Bhopal</span>
        </div>
        <details className="max-w-md text-xs leading-relaxed text-paper/65 md:text-right">
          <summary className="cursor-pointer underline underline-offset-4">Image credits</summary>
          <p className="mt-3">
            Bike imagery © Royal Enfield, TVS, Triumph, Yamaha, Honda, Hero and Bajaj. Ninja 300 photo © Kawasaki (background removed).
            <br />RR 310 Titanium Black rotation © TVS Mexico; Raider Split Seat Blazing Blue rotation © TVS (studio floor removed); CB350RS matte/lime rotation © Honda. Speed 400 rotation via West Coast Triumph (background removed). CB125 Hornet paint colour digitally adapted for the 360° view.
            <br />Actors adapted from Mixamo. Head scan © <a className="underline underline-offset-2" href="https://www.triplegangers.com/">Lee Perry-Smith</a>, adapted under <a className="underline underline-offset-2" href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>.
          </p>
        </details>
      </div>
    </footer>
  );
}
