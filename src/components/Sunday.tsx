import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Camera, CheckCheck, Coffee, Pause, Play, RotateCcw, ShieldCheck } from 'lucide-react';
import { BEYOND, SUNDAY } from '../data/site';
import { usePrefersReducedMotion } from '../hooks/motion';
import { SundayScene } from './sunday/SundayScene';
import { BhopalMap } from './sunday/BhopalMap';
import { ACTION_DURATIONS, PHOTO_TIME, advanceJourney, createJourney, replayAction, seekJourney, timelineAt, toggleJourney } from './sunday/journey';

const ACTIONS = ['Helmet on', 'Roll out together', 'Find breakfast', 'Chai cheers', 'Take a photo', 'Check in safe'];
const STATUS = ['Getting ready', 'Meet up & roll call', 'Riding in formation', 'Parked for breakfast', 'Parked at the destination', 'Everyone checked in'];
const PHYSICAL_STATUS:Record<string,string>={'mount':'Mounting up','dismount':'Stepping off','walk':'Walking to the stop','walk-back':'Back to the bikes','stand-up':'Getting back on the road','pull-in':'Turning in & braking','pull-out':'Joining the road','cruise':'Riding in formation'};
const ActionIcons = [ShieldCheck, ArrowRight, ArrowRight, Coffee, Camera, CheckCheck];

export function Sunday() {
  const reduced = usePrefersReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const scrollTrack = useRef<HTMLDivElement>(null);
  const userScrollUntil = useRef(0);
  const autoScrollUntil=useRef(0);
  const pagePosition=useRef(0);
  const scrollAnchor=useRef<{page:number;story:number}|null>(null);
  const motion = useRef(createJourney(reduced));
  const [snapshot, setSnapshot] = useState({ progress: 0, chapter: 0, destination: 0, phase: 'action', actionTime: 0, actionVersion: 0, playing: false,stage:'at-stop' });
  const [wide, setWide] = useState(false);
  const [postcard, setPostcard] = useState<string>();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const stop = snapshot.chapter;
  const atEnd = stop===5 && snapshot.phase==='action';
  const ActionIcon = ActionIcons[stop];
  const sync = () => {
    const ride = motion.current;
    const chapter = ride.phase === 'travel' ? Math.min(5, Math.floor(ride.progress*5 + .05)) : ride.chapter;
    const next = { progress: ride.vehicleProgress??ride.progress, chapter, destination: ride.chapter, phase: ride.phase, actionTime: ride.actionTime, actionVersion: ride.actionVersion, playing: ride.playing,stage:ride.rigStage??'at-stop' };
    setSnapshot(previous => previous.progress===next.progress && previous.chapter===next.chapter && previous.destination===next.destination && previous.phase===next.phase && previous.actionTime===next.actionTime && previous.actionVersion===next.actionVersion && previous.playing===next.playing&&previous.stage===next.stage ? previous : next);
  };

  useEffect(() => {
    const ride = motion.current; ride.reduced = reduced;
    if (reduced) { ride.playing = false; ride.progress = ride.target; ride.phase = 'action'; ride.actionTime = ACTION_DURATIONS[ride.chapter]; ride.actionRunning = false; sync(); }
  }, [reduced]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => { motion.current.visible = entry.isIntersecting; }, { threshold: .1 });
    observer.observe(element);
    const savePhoto = (event: Event) => setPostcard((event as CustomEvent<string>).detail);
    element.addEventListener('sunday-photo',savePhoto);
    const adoptScroll = (page:number) => {
      const ride=motion.current;
      if(ride.input==='scroll'||!ride.visible)return;
      let position:number;
      if(ride.phase==='action'){
        const time=ride.chapter===3&&ride.actionReplay?Math.max(5.55,ride.actionTime):ride.actionTime;
        position=ride.chapter===2?timelineAt(ride.vehicleProgress??ride.progress):(ride.chapter+(ride.chapter===5?.32:.28)*time/ACTION_DURATIONS[ride.chapter])/5.32;
      }
      else if(ride.target>ride.from&&Math.abs(ride.from*5-Math.round(ride.from*5))<.001&&Math.abs(ride.target-ride.from)<=.201){
        const stop=Math.round(ride.from*5),dwell=stop===2?0:.28;
        position=(stop+dwell+(ride.travelTime/ride.travelDuration)*(1-dwell))/5.32;
      }else position=timelineAt(ride.vehicleProgress??ride.progress);
      ride.scrollPosition=ride.scrollTarget=Math.max(0,Math.min(1,position));ride.input='scroll';ride.paused=false;
      // Re-anchor the mapping instead of moving the page in a wheel handler.
      // The first gesture remains intact; both physical page endpoints still
      // map to the story endpoints, including assistive/scrollbar scrolling.
      scrollAnchor.current={page,story:ride.scrollPosition};
    };
    const readScroll = (native=false,resize=false) => {
      const track=scrollTrack.current;if(!track)return;
      const rect=track.getBoundingClientRect(),sticky=element.parentElement!;
      const top=parseFloat(getComputedStyle(sticky).top)||88;
      const raw=Math.max(0,Math.min(1,(top-rect.top)/Math.max(1,rect.height-sticky.offsetHeight)));
      const previousPage=pagePosition.current;pagePosition.current=raw;
      const ride=motion.current;
      if(resize&&ride.input==='scroll')scrollAnchor.current={page:raw,story:ride.scrollPosition};
      if(native&&Math.abs(raw-previousPage)>.0001&&performance.now()>autoScrollUntil.current)adoptScroll(previousPage);
      const anchor=scrollAnchor.current;
      const position=anchor?raw<anchor.page?anchor.story*raw/Math.max(.000001,anchor.page):anchor.story+(1-anchor.story)*(raw-anchor.page)/Math.max(.000001,1-anchor.page):raw;
      if(Math.abs(position-ride.scrollTarget)<.0001)return;
      ride.scrollTarget=Math.max(0,Math.min(1,position));
    };
    const onScroll=()=>readScroll(true);
    const onResize=()=>{autoScrollUntil.current=performance.now()+150;readScroll(false,true);};
    const scrollIntent = () => {
      userScrollUntil.current = performance.now()+1200;
      adoptScroll(pagePosition.current);
    };
    const keyIntent = (event:KeyboardEvent) => { if(!event.defaultPrevented && ['PageDown','PageUp','Home','End','ArrowDown','ArrowUp',' '].includes(event.key)) scrollIntent(); };
    const scrollbarIntent = (event:PointerEvent) => { if(event.pointerType==='mouse' && event.clientX>=document.documentElement.clientWidth-16) scrollIntent(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('wheel',scrollIntent,{passive:true});
    window.addEventListener('touchmove',scrollIntent,{passive:true});
    window.addEventListener('keydown',keyIntent);
    window.addEventListener('pointerdown',scrollbarIntent,{passive:true});
    readScroll();
    let frame = 0, last = performance.now(), published = 0;
    const tick = (now: number) => {
      const dt = Math.min(.05, (now-last)/1000); last = now;
      if (!document.hidden) advanceJourney(motion.current, dt);
      if (motion.current.visible && now-published > 70) { published = now; sync(); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); element.removeEventListener('sunday-photo',savePhoto); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); window.removeEventListener('wheel',scrollIntent); window.removeEventListener('touchmove',scrollIntent); window.removeEventListener('keydown',keyIntent); window.removeEventListener('pointerdown',scrollbarIntent); };
  }, []);

  const seek = (index: number) => {
    userScrollUntil.current=0;
    autoScrollUntil.current=performance.now()+200;scrollAnchor.current=null;
    seekJourney(motion.current,index);
    const track=scrollTrack.current,sticky=stage.current?.parentElement;
    if(track && sticky) {
      const position=timelineAt(index/5);
      pagePosition.current=position;
      motion.current.scrollTarget=motion.current.scrollPosition=position;
      window.scrollTo({top:track.getBoundingClientRect().top+window.scrollY-(parseFloat(getComputedStyle(sticky).top)||88)+position*(track.offsetHeight-sticky.offsetHeight),behavior:'instant'});
    }
    sync();
  };
  const act = () => { if(motion.current.chapter===1 || motion.current.chapter===2) seek(motion.current.chapter+1); else { replayAction(motion.current); sync(); } };
  const toggle = () => { toggleJourney(motion.current); sync(); };
  const photo = stop === 4 && snapshot.phase === 'action' && snapshot.actionTime > PHOTO_TIME && snapshot.actionTime < PHOTO_TIME + .32;

  return (
    <section id="sundays" className="sunday-section" aria-labelledby="sunday-heading">
      <div className="sunday-wrap">
        <div className="sunday-heading-row">
          <div><p className="sunday-intro"><span /> A Sunday with HH</p><h2 id="sunday-heading" className="sunday-heading">Sunrise, open road,<br /><span>chai.</span> Repeat.</h2></div>
        </div>

        <div className="sunday-scroll-track" ref={scrollTrack}>
        <div className="sunday-sticky">
        <div className="sunday-scroll-instruction"><span><ArrowDown size={15} /> Scroll to ride</span></div>
        <div className="sunday-film" ref={stage} data-chapter={stop} data-input={motion.current.input}>
          <div className="sunday-visuals">
          <div className="sunday-stage" onPointerMove={(event) => {
            if (event.pointerType !== 'mouse') return;
            const rect=event.currentTarget.getBoundingClientRect(); motion.current.pointer.x=(event.clientX-rect.left)/rect.width*2-1; motion.current.pointer.y=(event.clientY-rect.top)/rect.height*2-1;
          }} onPointerLeave={() => { motion.current.pointer.x=motion.current.pointer.y=0; }}>
            <SundayScene motion={motion} />
            <div className="sunday-film-shade" />
            <BhopalMap progress={snapshot.progress} chapter={stop} onSeek={seek} />
            <div className="sunday-film-top"><button className="sunday-camera" type="button" aria-label="Switch scenic camera view" aria-pressed={wide} onClick={() => { motion.current.wide=!wide; setWide(!wide); }}><Camera size={16} /><span>{wide ? 'Scenic view' : 'Close-up view'}</span></button></div>
            <div className="sunday-film-caption"><strong>{SUNDAY[stop].time}<small>AM</small></strong></div>
            <div className="sunday-film-foot"><span className="sunday-scene-status"><span />{PHYSICAL_STATUS[snapshot.stage]??STATUS[stop]}</span></div>
            <button className="sunday-act sunday-scene-act" type="button" onClick={act} disabled={snapshot.phase === 'travel'||(snapshot.stage!=='at-stop'&&stop!==0&&stop!==2)}><ActionIcon size={17} />{ACTIONS[stop]}</button>
            {photo && <div className="sunday-shutter" aria-hidden="true" />}
            {stop === 4 && snapshot.phase === 'action' && snapshot.actionTime > PHOTO_TIME + .32 && postcard && <div className="sunday-photo-note" key={snapshot.actionVersion}><a href={postcard} download="hh-sunday-at-kerwa.jpg"><Camera size={15} />Save photo <ArrowDown size={13}/></a></div>}
            {stop === 5 && snapshot.phase === 'action' && snapshot.actionTime > .65 && <div className="sunday-home-message" key={snapshot.actionVersion}><strong>Home safe! <CheckCheck size={15} /></strong></div>}
          </div>
          </div>

          <div className="sunday-ride-detail" id="sunday-panel" role="tabpanel" aria-labelledby={`sunday-tab-${stop}`}>
            <div className="sunday-detail-count">{String(stop+1).padStart(2,'0')}<span>/ 06</span></div>
            <div className="sunday-detail-copy" key={stop}><h3>{SUNDAY[stop].title}</h3><p>{SUNDAY[stop].body}</p></div>
            <div className="sunday-detail-actions">
              <button type="button" className="sunday-step" disabled={stop===0} onClick={() => seek(stop-1)} aria-label="Previous Sunday stop"><ArrowLeft size={15} /></button>
              <button type="button" className="sunday-play" onClick={toggle} aria-label={snapshot.playing ? 'Pause the Sunday story' : atEnd ? 'Replay the Sunday story' : 'Play the Sunday story'}>{snapshot.playing ? <Pause size={15} /> : atEnd ? <RotateCcw size={15} /> : <Play size={15} />}<span>{snapshot.playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}</span></button>
              <button type="button" className="sunday-step" disabled={stop===5} onClick={() => seek(stop+1)} aria-label="Next Sunday stop"><ArrowRight size={15} /></button>
            </div>
          </div>

          <div className="sunday-transport">
            <label htmlFor="sunday-scrubber" className="sr-only">Choose a Sunday stop</label><input id="sunday-scrubber" className="sunday-scrubber" type="range" min="0" max="5" step="1" value={stop} aria-valuetext={`${SUNDAY[stop].time}, ${SUNDAY[stop].title}`} onChange={(event) => seek(Number(event.target.value))} style={{ '--ride-progress': `${snapshot.progress*100}%` } as CSSProperties} />
            <div className="sunday-timeline" role="tablist" aria-label="Choose a stop from the Sunday story">
              {SUNDAY.map((moment,index) => <button key={moment.time} type="button" role="tab" id={`sunday-tab-${index}`} aria-controls="sunday-panel" aria-selected={stop===index} tabIndex={stop===index ? 0 : -1} className={`sunday-stop ${stop===index ? 'is-active' : ''}`} ref={(el) => { tabs.current[index]=el; }} onClick={() => seek(index)} onKeyDown={(event) => {
                let target:number|undefined;
                if(event.key==='ArrowRight') target=(index+1)%6;
                if(event.key==='ArrowLeft') target=(index+5)%6;
                if(event.key==='Home') target=0;
                if(event.key==='End') target=5;
                if(target!==undefined) { event.preventDefault(); seek(target); tabs.current[target]?.focus(); }
              }}><span className="sunday-stop-time">{moment.time}</span><span className="sunday-stop-name">{moment.title}</span></button>)}
            </div>
          </div>
          <p className="sr-only" role="status" aria-live="polite">{SUNDAY[stop].time}, {SUNDAY[stop].title}. {snapshot.phase==='travel' ? 'Arriving.' : STATUS[stop]}</p>
        </div>
        <a className="sunday-route-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Route data © OpenStreetMap</a>
        </div>
        </div>
        <div className="sunday-beyond"><ul>{BEYOND.map(item => <li key={item}>{item}</li>)}</ul></div>
      </div>
    </section>
  );
}
