import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Check, Images, Play, Shuffle, X } from 'lucide-react';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';
import { usePrefersReducedMotion } from '../hooks/motion';
import { mediaUrl, type Place } from '../lib/gallery';
import { usePublicContent } from '../lib/public-content';
import './gallery.css';

const FILTERS = ['All escapes', 'Sunday morning', 'Further afield'] as const;
type Filter = typeof FILTERS[number];
const matches = (p: Place, f: Filter) => f === 'All escapes' || (f === 'Sunday morning' ? p.kind === f : p.kind !== 'Sunday morning');

export function RouteMap() {
  const reduced = usePrefersReducedMotion();
  const { snapshot } = usePublicContent();
  const gallery = snapshot || { places: [] as Place[], cloudName: 'jr5po5s7' };
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState<Filter>('All escapes'), [shuffle, setShuffle] = useState(0);
  const [mediaIndex, setMediaIndex] = useState(0), [lightbox, setLightbox] = useState(false), [failed, setFailed] = useState('');
  const rail = useRef<HTMLDivElement>(null);
  const choices = gallery.places.filter(p => matches(p, filter));
  const selected = choices.find(p => p.id === selectedId) || choices[0];
  const index = choices.findIndex(p => p.id === selected?.id);
  const visual = selected?.legacyId ? DESTINATION_VISUALS[selected.legacyId] : undefined;
  const media = selected?.media[Math.min(mediaIndex, selected.media.length - 1)];
  const source = selected && (media ? mediaUrl(media, gallery.cloudName, 1600, true) : selected.legacyId ? `/destinations/${selected.legacyId}.webp` : '');
  useEffect(() => { setMediaIndex(0); setFailed(''); setLightbox(false); }, [selected?.id]);
  useEffect(() => {
    const el = rail.current, button = el?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (el && button && el.scrollWidth > el.clientWidth) el.scrollTo({ left: button.offsetLeft - el.offsetLeft - (el.clientWidth - button.clientWidth) / 2, behavior: reduced ? 'instant' : 'smooth' });
  }, [selected?.id, filter, reduced]);
  function step(direction: number) { if (choices.length) setSelectedId(choices[(index + direction + choices.length) % choices.length].id); }
  function surprise() { const other = choices.filter(p => p.id !== selected?.id); if (other.length) { setSelectedId(other[Math.floor(Math.random() * other.length)].id); setShuffle(n => n+1); } }
  return <section id="routes" className="mornings-section" aria-labelledby="mornings-title"><div className="mornings-wrap">
    <header className="mornings-heading-row"><div><h2 id="mornings-title" className="mornings-title">Our favourite <span>mornings.</span></h2><p className="mornings-intro">{gallery.places.some(p => p.media.length) ? 'Our rides. Our people. A few moments along the way.' : 'Our go-to rides from Bhopal.'}</p></div><button type="button" className="mornings-shuffle" onClick={surprise} disabled={choices.length < 2}><Shuffle key={shuffle} size={18} className={shuffle ? 'mornings-shuffled' : ''}/> Pick for me <ArrowUpRight size={17}/></button></header>
    <div className="mornings-toolbar"><div className="mornings-filters" role="group" aria-label="Choose the kind of ride">{FILTERS.map(f => <button key={f} type="button" aria-pressed={filter === f} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
    {!selected ? <p className="album-empty">{gallery.places.length ? 'No places in this filter yet. Try All escapes.' : 'More mornings to come.'}</p> : <>
      <div className="mornings-explorer"><div className="mornings-feature" id="morning-destination" aria-label="Selected ride destination">
        <div className="mornings-photo-stack">{source && source !== failed ? <img key={source} src={source} width={media?.width || 1280} height={media?.height || 853} loading="lazy" decoding="async" className="is-selected" alt={media ? media.caption || `Highway Hustlers ride at ${selected.name}` : visual?.alt || selected.name} style={{objectPosition: media ? '50% 50%' : visual?.position}} onError={()=>setFailed(source)}/> : <div className="mornings-photo-fallback">{selected.name}<small>Photo unavailable.</small></div>}</div>
        <div className="mornings-feature-top"><span className="mornings-ride-kind"><span/>{selected.kind}</span><div className="mornings-pagination"><button type="button" aria-label="Previous destination" onClick={()=>step(-1)} disabled={choices.length<2}><ArrowLeft size={18}/></button><span>{String(index+1).padStart(2,'0')} / {String(choices.length).padStart(2,'0')}</span><button type="button" aria-label="Next destination" onClick={()=>step(1)} disabled={choices.length<2}><ArrowRight size={18}/></button></div></div>
        {media && <button type="button" className="album-open" onClick={()=>setLightbox(true)} aria-label={`Open ${selected.name} album, ${selected.media.length} photos and videos`}>{media.type === 'video' ? <Play size={18}/> : <Images size={18}/>} {media.type === 'video' ? 'Play video' : 'View album'} <span>{selected.media.length}</span></button>}
        <div className="mornings-feature-copy" key={selected.id}><span className="mornings-mood">{media ? 'With HH' : visual?.mood}</span><h3>{selected.name}</h3><p>{selected.description}</p><a href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lon}`} target="_blank" rel="noopener noreferrer" aria-label={`Find ${selected.name} in Google Maps`}>Find this place <ArrowUpRight size={18}/></a></div>
        {media ? <span className="mornings-photo-note">{media.caption || 'Highway Hustlers'}</span> : visual && <a className="mornings-photo-note" href={visual.source} target="_blank" rel="noopener noreferrer">Photo: {visual.author} ↗</a>}
      </div><div className="mornings-picker"><div className="mornings-picker-heading">Pick a ride <ArrowDownRight size={21}/></div><div ref={rail} className="mornings-rail" role="group" aria-label="Ride destinations">{choices.map(p => <button key={p.id} type="button" className="mornings-destination" aria-pressed={p.id === selected.id} aria-controls="morning-destination" aria-label={`${p.name}, about ${p.km} kilometres one way`} onClick={()=>setSelectedId(p.id)} onKeyDown={e => {
        if (!['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].includes(e.key)) return;
        e.preventDefault(); const i = choices.indexOf(p), next = e.key === 'Home' ? 0 : e.key === 'End' ? choices.length-1 : (i + (['ArrowUp','ArrowLeft'].includes(e.key) ? -1 : 1) + choices.length) % choices.length;
        setSelectedId(choices[next].id); rail.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus({preventScroll:true});
      }}>{p.media[0] ? <img src={mediaUrl(p.media[0],gallery.cloudName,200,true)} width="160" height="110" loading="lazy" alt=""/> : p.legacyId ? <img src={`/destinations/${p.legacyId}-thumb.webp`} width="160" height="110" loading="lazy" alt=""/> : null}<span><strong>{p.name}</strong><small>{p.media.length ? `${p.media.length} ${p.media.length === 1 ? 'moment' : 'moments'}` : p.legacyId && DESTINATION_VISUALS[p.legacyId]?.mood}</small></span><span className="mornings-list-distance">~{p.km}<small>km</small></span>{p.id === selected.id && <Check className="mornings-selected-mark" size={13}/>}</button>)}</div></div></div>
      {!!selected.media.length && <div className="album-strip" role="group" aria-label={`${selected.name} photos and videos`}>{selected.media.map((m,i)=><button type="button" key={m.id} aria-label={`Show ${m.type} ${i+1}${m.caption ? `: ${m.caption}` : ''}`} aria-pressed={media?.id === m.id} onClick={()=>setMediaIndex(i)}><img src={mediaUrl(m,gallery.cloudName,240,true)} alt="" loading="lazy"/>{m.type === 'video' && <Play size={18}/>}<span>{String(i+1).padStart(2,'0')}</span></button>)}</div>}
      <div className="mornings-route-summary"><div className="mornings-route-line"><span className="mornings-home-dot"/> Bhopal <span className="mornings-road"><i/></span><span className="mornings-end-dot"/>{selected.name}</div><span className="mornings-distance">~{selected.km} km <small>one way</small></span></div>
      <div className="mornings-footnote"><span>Approximate distances from Bhopal city centre.</span>{gallery.places.some(p=>!p.media.length && p.legacyId) && <details className="mornings-credits"><summary>Photo credits</summary><ul>{gallery.places.filter(p=>!p.media.length && p.legacyId).map(p=> { const v = DESTINATION_VISUALS[p.legacyId!]; return v && <li key={p.id}><a href={v.source} target="_blank" rel="noopener noreferrer">{p.name} — {v.author}</a> · <a href={v.licenseUrl} target="_blank" rel="noopener noreferrer">{v.license}</a></li>; })}</ul><p>Credited destination photos are not club ride photos. Original licences apply.</p></details>}</div>
      <p className="sr-only" role="status">{selected.name}. About {selected.km} kilometres one way. {selected.kind}.</p>
      {lightbox && media && <AlbumDialog place={selected} initial={Math.min(mediaIndex,selected.media.length-1)} cloudName={gallery.cloudName} close={()=>setLightbox(false)}/>}
    </>}
  </div></section>;
}

function AlbumDialog({place,initial,cloudName,close}:{place:Place;initial:number;cloudName:string;close:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null), [index,setIndex] = useState(initial), touch = useRef<number>();
  const activeIndex = Math.min(index,place.media.length-1), media = place.media[activeIndex];
  useEffect(()=>{ dialog.current?.showModal(); const previous = document.body.style.overflow; document.body.style.overflow='hidden'; return ()=> { dialog.current?.close(); document.body.style.overflow=previous; }; },[]);
  function step(direction:number) { setIndex(i=>(i+direction+place.media.length)%place.media.length); }
  if (!media) return null;
  return <dialog ref={dialog} className="album-dialog" aria-label={`${place.name} ride album`} onCancel={close} onKeyDown={e=>{ if ((e.target as HTMLElement).tagName === 'VIDEO') return; if(e.key === 'ArrowRight'){e.preventDefault();step(1);}if(e.key === 'ArrowLeft'){e.preventDefault();step(-1);} }}>
    <header><div><h3>{place.name}</h3><span>{activeIndex+1} / {place.media.length}</span></div><button type="button" aria-label="Close album" onClick={close}><X size={24}/></button></header>
    <div className="album-stage" onTouchStart={e=>{touch.current=e.touches[0].clientX;}} onTouchEnd={e=>{if(media.type === 'video')return;const dx=e.changedTouches[0].clientX-(touch.current??e.changedTouches[0].clientX);if(Math.abs(dx)>60)step(dx<0?1:-1);}}>
      {media.type === 'video' ? <video key={media.id} src={mediaUrl(media,cloudName,1280)} poster={mediaUrl(media,cloudName,1280,true)} controls playsInline preload="metadata" aria-label={media.caption || `${place.name} ride video`}/> : <img key={media.id} src={mediaUrl(media,cloudName,2000)} alt={media.caption || `Highway Hustlers at ${place.name}`}/>}
    </div><footer><button type="button" aria-label="Previous album item" disabled={place.media.length<2} onClick={()=>step(-1)}><ArrowLeft size={22}/></button><p>{media.caption || 'Highway Hustlers'}</p><button type="button" aria-label="Next album item" disabled={place.media.length<2} onClick={()=>step(1)}><ArrowRight size={22}/></button></footer>
  </dialog>;
}
