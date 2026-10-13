import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Check, Shuffle } from 'lucide-react';
import { DESTINATIONS, type Destination } from '../data/site';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';
import { usePrefersReducedMotion } from '../hooks/motion';

const FILTERS = ['All escapes', 'Sunday morning', 'Further afield'] as const;
type Filter = typeof FILTERS[number];
const matches = (d: Destination, f: Filter) => f === 'All escapes' || (f === 'Sunday morning' ? d.kind === f : d.kind !== 'Sunday morning');

export function RouteMap() {
  const reduced = usePrefersReducedMotion();
  const [selected, setSelected] = useState(DESTINATIONS[0]);
  const [filter, setFilter] = useState<Filter>('All escapes');
  const [shuffle, setShuffle] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const rail = useRef<HTMLDivElement>(null);
  const choices = DESTINATIONS.filter(d => matches(d, filter));
  const index = choices.findIndex(d => d.id === selected.id);
  const visual = DESTINATION_VISUALS[selected.id];

  useEffect(() => {
    // Only pan the horizontal phone rail; never move the visitor's page position.
    const el = rail.current;
    const button = el?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (el && button && el.scrollWidth > el.clientWidth) {
      el.scrollTo({ left: button.offsetLeft - el.offsetLeft - (el.clientWidth - button.clientWidth) / 2, behavior: reduced ? 'instant' : 'smooth' });
    }
  }, [selected.id, filter, reduced]);

  function changeFilter(next: Filter) {
    setFilter(next);
    if (!matches(selected, next)) setSelected(DESTINATIONS.find(d => matches(d, next))!);
  }
  function step(direction: number) {
    setSelected(choices[(index + direction + choices.length) % choices.length]);
  }
  function surprise() {
    const other = choices.filter(d => d.id !== selected.id);
    setSelected(other[Math.floor(Math.random() * other.length)]);
    setShuffle(n => n + 1);
  }

  return (
    <section id="routes" className="mornings-section" aria-labelledby="mornings-title">
      <div className="mornings-wrap">
        <header className="mornings-heading-row">
          <div>
            <h2 id="mornings-title" className="mornings-title">Our favourite <span>mornings.</span></h2>
            <p className="mornings-intro">Our go-to rides from Bhopal.</p>
          </div>
          <button type="button" className="mornings-shuffle" onClick={surprise}>
            <Shuffle key={shuffle} size={18} className={shuffle ? 'mornings-shuffled' : ''} /> Pick for me <ArrowUpRight size={17} />
          </button>
        </header>

        <div className="mornings-toolbar">
          <div className="mornings-filters" role="group" aria-label="Choose the kind of ride">
            {FILTERS.map(f => <button type="button" key={f} aria-pressed={filter === f} onClick={() => changeFilter(f)}>{f}</button>)}
          </div>
        </div>

        <div className="mornings-explorer">
          <div className="mornings-feature" id="morning-destination" aria-label="Selected ride destination">
            <div className="mornings-photo-stack">
              {DESTINATIONS.map(d => <img
                key={d.id} src={`/destinations/${d.id}.webp`} width="1280" height="853" loading="lazy" decoding="async"
                alt={selected.id === d.id ? DESTINATION_VISUALS[d.id].alt : ''} aria-hidden={selected.id !== d.id}
                className={selected.id === d.id && !failed.includes(d.id) ? 'is-selected' : ''}
                style={{ objectPosition: DESTINATION_VISUALS[d.id].position }}
                onError={() => setFailed(prev => prev.includes(d.id) ? prev : [...prev, d.id])}
              />)}
              {failed.includes(selected.id) && <div className="mornings-photo-fallback">{selected.name}<small>Photo unavailable.</small></div>}
            </div>
            <div className="mornings-feature-top">
              <span className="mornings-ride-kind"><span />{selected.kind}</span>
              <div className="mornings-pagination">
                <button type="button" aria-label="Previous destination" onClick={() => step(-1)}><ArrowLeft size={18} /></button>
                <span>{String(index + 1).padStart(2, '0')} / {String(choices.length).padStart(2, '0')}</span>
                <button type="button" aria-label="Next destination" onClick={() => step(1)}><ArrowRight size={18} /></button>
              </div>
            </div>
            <div className="mornings-feature-copy" key={selected.id}>
              <span className="mornings-mood">{visual.mood}</span>
              <h3>{selected.name}</h3>
              <p>{selected.vibe}</p>
              <a href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lon}`} target="_blank" rel="noopener noreferrer" aria-label={`Find ${selected.name} in Google Maps`}>Find this place <ArrowUpRight size={18} /></a>
            </div>
            <a className="mornings-photo-note" href={visual.source} target="_blank" rel="noopener noreferrer">Photo: {visual.author} ↗</a>
          </div>

          <div className="mornings-picker">
            <div className="mornings-picker-heading">Pick a ride <ArrowDownRight size={21} /></div>
            <div ref={rail} className="mornings-rail" role="group" aria-label="Ride destinations">
              {choices.map(d => <button
                key={d.id} type="button" className="mornings-destination" aria-pressed={selected.id === d.id}
                aria-label={`${d.name}, about ${d.km} kilometres one way`} aria-controls="morning-destination"
                onClick={() => setSelected(d)}
                onKeyDown={e => {
                  if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
                    e.preventDefault();
                    const i = choices.indexOf(d);
                    const next = e.key === 'Home' ? 0 : e.key === 'End' ? choices.length - 1 : (i + (['ArrowUp', 'ArrowLeft'].includes(e.key) ? -1 : 1) + choices.length) % choices.length;
                    setSelected(choices[next]);
                    rail.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus({ preventScroll: true });
                  }
                }}
              >
                <img src={`/destinations/${d.id}-thumb.webp`} alt="" width="160" height="110" loading="lazy" />
                <span><strong>{d.name}</strong><small>{DESTINATION_VISUALS[d.id].mood}</small></span>
                <span className="mornings-list-distance">~{d.km}<small>km</small></span>
                {selected.id === d.id && <Check className="mornings-selected-mark" size={13} />}
              </button>)}
            </div>
          </div>
        </div>

        <div className="mornings-route-summary">
          <div className="mornings-route-line"><span className="mornings-home-dot" /> Bhopal <span className="mornings-road"><i /></span><span className="mornings-end-dot" />{selected.name}</div>
          <span className="mornings-distance">~{selected.km} km <small>one way</small></span>
        </div>
        <div className="mornings-footnote">
          <span>Approximate distances from Bhopal city centre.</span>
          <details className="mornings-credits">
            <summary>Photo credits</summary>
            <ul>{DESTINATIONS.map(d => {
              const v = DESTINATION_VISUALS[d.id];
              return <li key={d.id}><a href={v.source} target="_blank" rel="noopener noreferrer">{d.name} — {v.author}</a> · <a href={v.licenseUrl} target="_blank" rel="noopener noreferrer">{v.license}</a></li>;
            })}</ul>
            <p>Destination photos, not club ride photos. Resized and cropped; original licences apply.</p>
          </details>
        </div>
        <p className="sr-only" role="status">{selected.name}. {visual.mood}. About {selected.km} kilometres one way. {selected.kind}.</p>
      </div>
    </section>
  );
}
