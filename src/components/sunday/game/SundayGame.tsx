import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Check, CheckCheck, ChevronRight, CircleHelp, Maximize2, Minimize2, Pause, Play, RotateCcw, X } from 'lucide-react';
import { usePrefersReducedMotion } from '../../../hooks/motion';
import { act, actionLabel, canPark, CHAPTERS, createGame, objective, recover, targetDistance, TIMES, type GameInput, type GameState } from './controller';
import { bays, checkpoints, mapPath, mapPoint, sampleRoad } from './route';
import './game.css';

function MiniMap({ state }: { state: GameState }) {
  const [x, y] = mapPoint(state.x, state.z);
  return <div className="ride-minimap" aria-label="Your position on the condensed Bhopal–Kerwa loop">
    <svg viewBox="0 0 200 164" role="img" aria-label="Sunday ride route and player position">
      <path d={mapPath} fill="none" stroke="#8a9d8d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={mapPath} fill="none" stroke="#eeb34f" strokeWidth="1.8" strokeLinecap="round" />
      {bays.filter((_, i) => i !== 2).map((bay, i) => { const p = mapPoint(bay.x, bay.z); return <circle key={i} cx={p[0]} cy={p[1]} r="3" fill="#162a23" stroke="#edc37a" strokeWidth="1.3" />; })}
      {state.chapter >= 2 && state.chapter < 5 && state.companions.map((d, i) => { const p = sampleRoad(d), xy = mapPoint(p.x, p.z); return <circle key={i} cx={xy[0]} cy={xy[1]} r="2.6" fill="#cfdfd4" />; })}
      <g transform={`translate(${x},${y}) rotate(${180 - state.heading * 180 / Math.PI})`}><circle r="7" fill="#f5a524" opacity=".2" /><path d="M0,-5 L3.8,4 L0,2 L-3.8,4Z" fill="#fff1c8" stroke="#151d17" strokeWidth="1" /></g>
    </svg><span>N</span>
  </div>;
}
function initialGame(reduced:boolean) {
  const state=createGame(reduced);
  // Local visual-regression fixtures only; Vite removes this block in production.
  if (import.meta.env.DEV) {
    const key=new URLSearchParams(location.search).get('ride-scene')??'';
    const chapter=({meet:1,breakfast:3,kerwa:4,home:5} as Record<string,number>)[key];
    if (chapter) { const bay=bays[chapter]; Object.assign(state,{chapter,phase:'activity',timer:3,x:bay.x,z:bay.z,heading:bay.heading,parkedX:bay.x,parkedZ:bay.z,parkedHeading:bay.heading,distance:checkpoints[chapter]-8,guided:true}); }
    if(key==='road'){const road=sampleRoad(1000,-1.25);Object.assign(state,road,{phase:'ride',chapter:2,assist:false,guided:false,speed:7});}
  }
  return state;
}
export default function SundayGame() {
  const reduced = usePrefersReducedMotion();
  const game = useRef(initialGame(reduced)), input = useRef<GameInput>({ throttle: 0, brake: 0, steer: 0 });
  const frame = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<GameState>({ ...game.current });
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attempt, setAttempt] = useState(0), [help, setHelp] = useState(false), [credits, setCredits] = useState(false);
  const [fullscreen, setFullscreen] = useState(false), [photo, setPhoto] = useState<string>(), [photoError, setPhotoError] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [photoPreview,setPhotoPreview]=useState(false),[photoUrl,setPhotoUrl]=useState<string>();
  useEffect(()=>{ if(!photo){setPhotoUrl(undefined);return;} const bytes=Uint8Array.from(atob(photo.split(',')[1]),c=>c.charCodeAt(0)); const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));setPhotoUrl(url);return()=>URL.revokeObjectURL(url); },[photo]);
  const keys = useRef(new Set<string>());
  const sync = () => setState({ ...game.current, companions: [...game.current.companions] });
  const clearInput = () => { keys.current.clear(); input.current.throttle = input.current.brake = input.current.steer = 0; };
  const pause = () => { game.current.paused = !game.current.paused; clearInput(); sync(); };
  const action = () => { if (act(game.current)) sync(); frame.current?.focus({ preventScroll: true }); };
  const reset = () => { clearInput(); const ready = game.current.ready; Object.assign(game.current, createGame(reduced), { ready }); setPhoto(undefined); setPhotoError(false); setCaptured(false); setPhotoPreview(false); sync(); frame.current?.focus({ preventScroll: true }); };
  useEffect(() => { game.current.reduced = reduced; if (reduced) game.current.guided = true; }, [reduced]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    let cancelled = false, dispose: (() => void) | undefined;
    const abort = new AbortController();
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return; observer.disconnect(); setStatus('loading');
      import('./world').then(({ createGameWorld }) => createGameWorld(element, game.current, input.current, sync, abort.signal)).then(cleanup => {
        if (cancelled) { cleanup(); return; } dispose = cleanup; setStatus('ready');
      }).catch(error => { if (!cancelled) { console.warn('Sunday ride could not load.', error); setStatus('error'); game.current.ready = false; } });
    }, { rootMargin: '100px' }); observer.observe(element);
    return () => { cancelled = true; abort.abort(); observer.disconnect(); dispose?.(); };
  }, [attempt]);
  useEffect(() => {
    const element = frame.current; if (!element) return;
    const save = (event: Event) => { setPhoto((event as CustomEvent<string>).detail); setCaptured(true); window.setTimeout(() => setCaptured(false), 450); };
    const failed = () => setPhotoError(true), contextLost = () => setStatus('error');
    const blur = () => { clearInput(); if (game.current.phase !== 'garage') { game.current.paused = true; sync(); } };
    const hidden = () => { if (document.hidden) blur(); };
    const onFullscreen = () => { if (document.fullscreenElement) setFullscreen(true); };
    element.addEventListener('ride-photo', save); element.addEventListener('ride-photo-error', failed); element.addEventListener('ride-error', contextLost);
    window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hidden); document.addEventListener('fullscreenchange', onFullscreen);
    return () => { element.removeEventListener('ride-photo', save); element.removeEventListener('ride-photo-error', failed); element.removeEventListener('ride-error', contextLost); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hidden); document.removeEventListener('fullscreenchange', onFullscreen); };
  }, []);
  const readKeys = () => {
    input.current.throttle = keys.current.has('w') || keys.current.has('arrowup') ? 1 : 0;
    input.current.brake = keys.current.has('s') || keys.current.has('arrowdown') || keys.current.has(' ') ? 1 : 0;
    input.current.steer = (keys.current.has('d') || keys.current.has('arrowright') ? 1 : 0) - (keys.current.has('a') || keys.current.has('arrowleft') ? 1 : 0);
  };
  const hold = (event: PointerEvent<HTMLButtonElement>, key: keyof GameInput, value: number) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); input.current[key] = value; frame.current?.focus({ preventScroll: true }); };
  const release = (key: keyof GameInput) => { input.current[key] = 0; };
  const toggleFullscreen = () => { setFullscreen(value => !value); frame.current?.focus({ preventScroll: true }); };
  useEffect(() => { if (!fullscreen) return; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, [fullscreen]);
  const showHelp = () => { game.current.paused = true; clearInput(); setHelp(true); sync(); };
  const active = state.phase !== 'garage' && state.phase !== 'complete';
  const actionEnabled = state.phase === 'garage' || (state.phase === 'activity' && (!state.actionDone || state.timer >= 2.4)) || canPark(state);
  const distance = Math.max(0, targetDistance(state) - state.distance);
  return <>
    <div ref={frame} className={`ride-game ${fullscreen ? 'ride-expanded' : ''} ${captured && !reduced ? 'ride-captured' : ''}`} tabIndex={0} role="group" aria-label="Playable Sunday ride. W accelerates, S brakes, A and D steer, E interacts, Escape pauses." onKeyDown={event => {
      const key = event.key.toLowerCase();
      if (key === 'tab' && (fullscreen || help || credits || photoPreview || state.paused)) {
        const container = frame.current?.querySelector('.ride-overlay') ?? frame.current;
        const items = Array.from(container?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input') ?? []).filter(el => el.offsetParent !== null);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === frame.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === frame.current || !container?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
      if (key === 'escape' && !event.repeat) {
        event.preventDefault();
        if (photoPreview) setPhotoPreview(false);
        else if (help || credits) { setHelp(false); setCredits(false); if (!active) { game.current.paused = false; sync(); } }
        else if (active && !state.paused) pause();
        else if (fullscreen) setFullscreen(false);
        else if (active) pause();
        frame.current?.focus({ preventScroll: true }); return;
      }
      if ((event.target as HTMLElement).closest('button,a,input,summary')) return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'e', 'escape'].includes(key)) event.preventDefault();
      if (key === 'e' && !event.repeat) action();
      else if (key === 'escape' && !event.repeat) { if (photoPreview) setPhotoPreview(false);
        else if (help || credits) { setHelp(false); setCredits(false); if (!active) { game.current.paused = false; sync(); } } else if (active) pause(); }
      else { keys.current.add(key); readKeys(); }
    }} onKeyUp={event => { keys.current.delete(event.key.toLowerCase()); readKeys(); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { clearInput(); if (active) { game.current.paused = true; sync(); } } }}>
      <div className="ride-webgl" ref={host} /><div className="ride-vignette" aria-hidden="true" />
      {status !== 'ready' && <div className="ride-load-screen"><div><h3>{status === 'error' ? 'The garage couldn’t open.' : 'Getting your ride ready.'}</h3><p>{status === 'error' ? 'The 3D view needs WebGL and a little memory. Try again, or read the story above.' : 'Hunter 350 · Bhopal, 05:30'}</p>{status === 'error' ? <button type="button" className="ride-primary" onClick={() => { reset(); setAttempt(n => n + 1); }}>Try again <RotateCcw size={16} /></button> : <span className="ride-loading-line" aria-label="Loading ride" />}</div></div>}
      {status === 'ready' && <>
        <div className="ride-topbar"><div className="ride-objective"><span>{String(state.chapter + 1).padStart(2, '0')} / 06 <i /> {CHAPTERS[state.chapter]}</span><strong>{objective(state)}</strong>{state.phase === 'ride' && <small>{distance > 950 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`} {state.chapter === 2 ? 'to Bhadbhada' : 'to the next stop'}</small>}</div><div className="ride-utilities"><time>{TIMES[state.chapter]}<small> AM</small></time><button type="button" aria-label="Ride controls" onClick={showHelp}><CircleHelp size={18} /></button>{active && <button type="button" aria-label={state.paused ? 'Resume ride' : 'Pause ride'} onClick={pause}>{state.paused ? <Play size={18} /> : <Pause size={18} />}</button>}<button type="button" aria-label={fullscreen ? 'Collapse riding view' : 'Expand riding view'} onClick={toggleFullscreen}>{fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button></div></div>
        {state.phase === 'garage' && <div className="ride-garage-intro"><span className="ride-selected-bike"><Check size={14} /> Your ride</span><h3>Hunter 350.</h3><p>Upper Lake. Ratibad. Kerwa.<br />Back home before lunch.</p><button type="button" className="ride-primary" onClick={action}>Ride this Sunday <ArrowRight size={18} /></button><label className="ride-guided-choice"><input type="checkbox" checked={state.guided} onChange={event => { game.current.guided = event.target.checked; sync(); }} /><span>Guided ride<small>We drive. You enjoy the stops.</small></span></label></div>}
        {active && <MiniMap state={state} />}
        {active && <div className="ride-speed"><strong>{Math.round(state.speed * 3.6).toString().padStart(2, '0')}</strong><span>km/h</span><div><i style={{ transform: `scaleX(${state.speed / 16.5})` }} /></div></div>}
        {active && !state.paused && <>
          {(state.phase === 'activity' || (state.phase === 'ride' && distance < 38)) && <div className="ride-context-action"><button type="button" className="ride-primary" disabled={!actionEnabled} onClick={action}><kbd>E</kbd>{actionLabel(state)}<ChevronRight size={16} /></button>{state.phase === 'ride' && !canPark(state) && <small>{state.speed > .55 ? 'Slow down and pull into the amber ring.' : 'Steer closer to the marked bay.'}</small>}</div>}
          {state.phase === 'ride' && !state.guided && <div className="ride-touch-controls" aria-label="Touch driving controls"><div>{([-1, 1] as const).map(value => <button key={value} type="button" aria-label={value < 0 ? 'Steer left' : 'Steer right'} onPointerDown={event => hold(event, 'steer', value)} onPointerUp={() => release('steer')} onPointerCancel={() => release('steer')} onLostPointerCapture={() => release('steer')}>{value < 0 ? <ArrowLeft size={24} /> : <ArrowRight size={24} />}</button>)}</div><div><button type="button" aria-label="Brake" onPointerDown={event => hold(event, 'brake', 1)} onPointerUp={() => release('brake')} onPointerCancel={() => release('brake')} onLostPointerCapture={() => release('brake')}><ArrowDown size={24} /></button><button type="button" aria-label="Accelerate" className="ride-throttle" onPointerDown={event => hold(event, 'throttle', 1)} onPointerUp={() => release('throttle')} onPointerCancel={() => release('throttle')} onLostPointerCapture={() => release('throttle')}><ArrowUp size={24} /></button></div></div>}
        </>}
        {state.phase === 'complete' && <div className="ride-complete"><CheckCheck size={36} /><span>11:30 · Home safe</span><h3>Sunday, well spent.</h3><p>Chai shared. Memories made.<br />Same time next Sunday?</p><button type="button" className="ride-primary" onClick={reset}>Ride again <RotateCcw size={16} /></button>{photo && <button type="button" className="ride-postcard-button" onClick={()=>{setPhotoPreview(true);frame.current?.focus({preventScroll:true});}}><Camera size={16} />Your Kerwa postcard <ArrowRight size={15} /></button>}</div>}
        {photo && state.chapter === 4 && <button type="button" className="ride-photo-save" onClick={()=>{setPhotoPreview(true);frame.current?.focus({preventScroll:true});}}><Camera size={16} />View your photo <ArrowRight size={14} /></button>}
        {photoPreview && photo && <div className="ride-overlay" role="dialog" aria-modal="true" aria-label="Your Kerwa postcard"><div className="ride-postcard"><h3>Kerwa, 10:00 AM.</h3><img src={photo} alt="Your in-game Sunday postcard at Kerwa."/><a className="ride-primary" href={photoUrl??photo} download="hh-sunday-at-kerwa.jpg">Download JPEG <ArrowDown size={16}/></a><p>Or long-press / right-click the photo to save.</p><button type="button" className="ride-text-button" onClick={()=>{setPhotoPreview(false);frame.current?.focus({preventScroll:true});}}>Back to the ride <ArrowRight size={16}/></button></div></div>}
        {photoError && <p className="ride-photo-error" role="status">The photo couldn’t save. You can still finish the ride.</p>}
        {active && state.paused && !help && !credits && <div className="ride-overlay" role="dialog" aria-modal="true" aria-label="Ride information"><div><h3>Paused.</h3><button type="button" className="ride-primary" onClick={() => { pause(); frame.current?.focus({ preventScroll: true }); }}>Back to the ride <Play size={17} /></button><button type="button" className="ride-text-button" onClick={showHelp}>Controls & options <CircleHelp size={15}/></button>{state.phase==='ride' && state.offroad>6 && <button type="button" className="ride-text-button" onClick={()=>{recover(game.current);sync();}}>Return to the road <RotateCcw size={15}/></button>}<button type="button" className="ride-text-button" onClick={reset}>Start again <RotateCcw size={15} /></button></div></div>}
        {(help || credits) && <div className="ride-overlay" role="dialog" aria-modal="true" aria-label="Ride information"><div className="ride-help"><button type="button" className="ride-overlay-close" aria-label="Close information" onClick={() => { setHelp(false); setCredits(false); if (!active) { game.current.paused = false; sync(); } frame.current?.focus({ preventScroll: true }); }}><X size={20} /></button><h3>{credits ? 'Ride credits.' : 'Controls.'}</h3>{credits ? <div className="ride-credit-copy"><p>Hunter 350 by <a href="https://sketchfab.com/3d-models/royal-enfield-hunter-350-181adce5a476412e8bcc272883225397" target="_blank" rel="noreferrer">keshavckm1</a>, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Geometry, rig and paint modified for HH. In-game paint is an interpretation, not a factory decal match.</p><p>Environment: <a href="https://polyhaven.com" target="_blank" rel="noreferrer">Poly Haven</a>, CC0. Riders: Mixamo; face scan: <a href="https://www.triplegangers.com/" target="_blank" rel="noreferrer">Lee Perry-Smith</a>, <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>, adapted for the riders.</p><p>Route data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>, via OSRM. Condensed Bhopal–Kerwa loop; scenery and stop locations are illustrative, not navigation.</p></div> : <><dl><div><dt><kbd>W</kbd> / <kbd>↑</kbd></dt><dd>Accelerate</dd></div><div><dt><kbd>S</kbd> / <kbd>Space</kbd></dt><dd>Brake</dd></div><div><dt><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd></dt><dd>Steer and lean</dd></div><div><dt><kbd>E</kbd></dt><dd>Interact at a stop</dd></div><div><dt><kbd>Esc</kbd></dt><dd>Pause</dd></div></dl><p>Follow the amber arrows. Stop in the marked bay, then press E. On mobile, hold the arrow buttons to ride.</p><fieldset className="ride-preferences"><legend>Driving</legend><label><span>Steering help</span><input type="checkbox" checked={state.assist} onChange={event=>{game.current.assist=event.target.checked;sync();}} /></label><label><span>Let the group lead<small>Automatic riding between stops</small></span><input type="checkbox" checked={state.guided} onChange={event=>{game.current.guided=event.target.checked;clearInput();sync();}} /></label></fieldset></>}<button type="button" className="ride-primary" onClick={() => { setHelp(false); setCredits(false); game.current.paused = false; sync(); frame.current?.focus({ preventScroll: true }); }}>Got it <Check size={16} /></button></div></div>}
        <ol className="ride-chapter-rail" aria-label="Sunday checkpoints">{CHAPTERS.map((name, i) => <li key={name} className={i === state.chapter ? 'is-current' : i < state.chapter ? 'is-done' : ''} aria-current={i === state.chapter ? 'step' : undefined}><span>{i < state.chapter ? <Check size={11} /> : i + 1}</span><small>{name}</small></li>)}</ol>
      </>}
    </div>
    <div className="ride-bottom-note"><span>Sunday with HH</span><div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a><button type="button" onClick={() => { if (active) game.current.paused = true; clearInput(); setCredits(true); sync(); }}>Ride credits</button></div></div>
    <p className="sr-only" role="status" aria-live="polite">{CHAPTERS[state.chapter]}. {state.phase === 'activity' ? actionLabel(state) : state.phase === 'complete' ? 'Mission complete. Home safe.' : state.paused ? 'Ride paused.' : ''}</p>
  </>;
}
