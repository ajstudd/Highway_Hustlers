import { lazy, Suspense, useState } from 'react';
import { ArrowRight, Coffee, Camera, Home, MapPin } from 'lucide-react';
import { BEYOND, SUNDAY } from '../data/site';
const SundayGame = lazy(() => import('./sunday/game/SundayGame'));

export function Sunday() {
  const [story, setStory] = useState(false);
  return <section id="sundays" className="sunday-section" aria-labelledby="sunday-heading">
    <div className="sunday-wrap">
      <div className="sunday-heading-row">
        <div><p className="sunday-intro"><span /> A Sunday with HH</p><h2 id="sunday-heading" className="sunday-heading">Sunrise, open road,<br /><span>chai.</span> Repeat.</h2></div>
        <button type="button" className="ride-text-button" aria-pressed={story} onClick={() => setStory(!story)}>{story ? 'Back to the ride' : 'Just here for the story'}<ArrowRight size={16} /></button>
      </div>
      {story ? <ol className="ride-written-story">{SUNDAY.map((stop, index) => {
        const Icon = index === 3 ? Coffee : index === 4 ? Camera : index === 5 ? Home : MapPin;
        return <li key={stop.time}><span>{stop.time}</span><Icon size={22} /><div><h3>{stop.title}</h3><p>{stop.body}</p></div></li>;
      })}</ol> : <Suspense fallback={<div className="ride-loading-shell">Getting the garage ready…</div>}><SundayGame /></Suspense>}
      <div className="sunday-beyond"><ul>{BEYOND.map(item => <li key={item}>{item}</li>)}</ul></div>
    </div>
  </section>;
}
