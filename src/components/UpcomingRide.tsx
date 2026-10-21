import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Clock3, MapPin } from 'lucide-react';
import type { UpcomingRide as Ride } from '../../shared/upcoming-ride.mjs';
import { usePublicContent } from '../lib/public-content';
import { mediaUrl } from '../lib/gallery';
import './upcoming-ride.css';

export function UpcomingRide() {
  const { snapshot } = usePublicContent();
  return snapshot?.upcomingRide ? <UpcomingRideView key={snapshot.revision} ride={snapshot.upcomingRide} cloudName={snapshot.cloudName} /> : null;
}

export function UpcomingRideView({ ride, cloudName, preview = false }: { ride: Ride; cloudName: string; preview?: boolean }) {
  useEffect(() => {
    // Content arrives after the browser's initial anchor jump.
    if (!preview && window.location.hash === '#upcoming-ride') document.getElementById('upcoming-ride')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [preview]);
  const [selected, setSelected] = useState(0), [failed, setFailed] = useState('');
  const index = Math.min(selected, Math.max(0, ride.images.length - 1));
  const image = ride.images[index];
  const source = image ? mediaUrl(image, cloudName, 1400) : '';
  const hasImage = !!image && failed !== source;
  const date = ride.date ? new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(`${ride.date}T12:00:00+05:30`)) : '';
  const time = ride.meetingTime ? new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(`2000-01-01T${ride.meetingTime}:00+05:30`)) : '';
  function step(direction: number) { setSelected((index + direction + ride.images.length) % ride.images.length); }
  return <section id={preview ? undefined : 'upcoming-ride'} className={`upcoming-ride${ride.images.length ? ' upcoming-ride-with-photo' : ''}`} aria-label={preview ? 'Upcoming ride preview' : 'Upcoming ride'}>
    <div className="upcoming-ride-inner">
      <header className="upcoming-ride-heading"><h2>Our next <em>ride.</em></h2>{(date || time) && <div className="upcoming-ride-when">{date && <span><CalendarDays size={17} aria-hidden="true"/><time dateTime={ride.date}>{date}</time></span>}{time && <span><Clock3 size={17} aria-hidden="true"/><time dateTime={ride.meetingTime}>{time} <span className="upcoming-ride-timezone">IST</span></time></span>}</div>}</header>
      <div className="upcoming-ride-body">
        <div className="upcoming-ride-copy"><h3>{ride.location || (preview ? 'Your next destination' : '')}</h3><p className="upcoming-ride-description">{ride.description || (preview ? 'Add a description to introduce the ride.' : '')}</p>
          <div className="upcoming-ride-plan"><div className="upcoming-ride-meet"><MapPin size={20} aria-hidden="true"/><div><h4>Meet us here</h4><p>{ride.meetingPoint || (preview ? 'Add the meeting point.' : '')}</p></div></div>{ride.notes && <div className="upcoming-ride-notes"><h4>Before you roll</h4><p>{ride.notes}</p></div>}</div>
          {ride.mapsUrl && <a className="upcoming-ride-map" href={ride.mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps <ArrowUpRight size={19} aria-hidden="true"/></a>}
        </div>
        {!!ride.images.length && <div className="upcoming-ride-photos"><figure>{hasImage ? <img src={source} alt={image.caption || ride.location} width={image.width} height={image.height} loading="lazy" decoding="async" onError={() => setFailed(source)}/> : <p className="upcoming-ride-image-error">This photo couldn’t load.</p>}{image.caption && <figcaption>{image.caption}</figcaption>}</figure>{ride.images.length > 1 && <div className="upcoming-ride-photo-controls"><p aria-live="polite">Photo {index + 1} of {ride.images.length}</p><div><button type="button" aria-label="Previous ride photo" onClick={() => step(-1)}><ArrowLeft size={19}/></button><button type="button" aria-label="Next ride photo" onClick={() => step(1)}><ArrowRight size={19}/></button></div></div>}</div>}
      </div>
    </div>
  </section>;
}
