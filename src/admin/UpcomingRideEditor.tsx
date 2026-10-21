import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, ImagePlus, Upload, X } from 'lucide-react';
import { emptyUpcomingRide, type UpcomingRide } from '../../shared/upcoming-ride.mjs';
import { mediaUrl } from '../lib/gallery';
import { UpcomingRideView } from '../components/UpcomingRide';

type Props = { ride: UpcomingRide; change: (ride: UpcomingRide) => void; cloudName: string; cloudReady: boolean; busy: boolean; upload: (files: FileList | null) => void; library: () => void };
export default function UpcomingRideEditor({ ride, change, cloudName, cloudReady, busy, upload, library }: Props) {
  const [preview, setPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null), previewButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (preview) previewRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [preview]);
  const update = (value: Partial<UpcomingRide>) => change({ ...ride, ...value });
  function move(index: number, direction: number) {
    const images = [...ride.images], next = index + direction;
    if (next < 0 || next >= images.length) return;
    [images[index], images[next]] = [images[next], images[index]]; update({ images });
  }
  return <div className="admin-upcoming-editor">
    <section className="admin-editor">
      <div className="admin-editor-heading"><div><h1>Upcoming ride</h1><p className="admin-muted">One next ride, just above the Instagram invitation.</p></div><button ref={previewButton} type="button" aria-expanded={preview} aria-controls="ride-draft-preview" onClick={() => setPreview(!preview)}><Eye size={16}/>{preview ? 'Hide preview' : 'Preview section'}</button></div>
      <fieldset disabled={busy} className="admin-fields">
        <section className="admin-section"><div className="admin-section-title"><h2>Ride details</h2><label className="admin-publish"><input type="checkbox" checked={ride.published} onChange={e => update({ published: e.target.checked })}/>Include on publish</label></div>
          <p className="admin-muted admin-small">Leave this off while planning. Required when included: location, description and meeting point.</p>
          <label>Location name<input maxLength={100} value={ride.location} onChange={e => update({ location: e.target.value })}/></label>
          <label>Description<textarea rows={3} maxLength={600} value={ride.description} onChange={e => update({ description: e.target.value })}/></label>
          <div className="admin-two admin-field-note"><label>Ride date (optional)<input type="date" min="2000-01-01" max="2199-12-31" value={ride.date} onChange={e => update({ date: e.target.value })}/></label><label>Meeting time (optional, IST)<input type="time" value={ride.meetingTime} onChange={e => update({ meetingTime: e.target.value })}/></label></div>
          {(ride.date || ride.meetingTime) && <button type="button" onClick={() => update({ date: '', meetingTime: '' })}>Clear date & time</button>}
          <label>Meeting point<input maxLength={240} value={ride.meetingPoint} onChange={e => update({ meetingPoint: e.target.value })}/></label>
          <label>Google Maps link (optional)<input type="url" inputMode="url" maxLength={2048} value={ride.mapsUrl} onChange={e => update({ mapsUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…"/></label>
          <label>Notes (optional)<textarea rows={3} maxLength={1200} value={ride.notes} onChange={e => update({ notes: e.target.value })} placeholder="Anything riders should know before setting off."/></label>
          <p className="admin-muted admin-small admin-field-note">All included details will be public. After the ride, turn off Include on publish, save and publish again to hide the section.</p>
        </section>
        <section className="admin-section"><div className="admin-section-title"><div><h2>Photos (optional)</h2><p className="admin-muted">Up to six. First photo opens the section; captions describe each view.</p></div></div>
          {!cloudReady && <p className="admin-warning">Uploads and the library need the Cloudinary credentials on the server. You can publish a ride without photos.</p>}
          <div className="admin-media-actions"><label className={`admin-upload ${!cloudReady ? 'is-disabled' : ''}`}><Upload size={17}/>Upload photos<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,.heic,.heif" multiple disabled={busy || !cloudReady || ride.images.length >= 6} onChange={e => { upload(e.target.files); e.target.value = ''; }}/></label><button type="button" disabled={busy || !cloudReady || ride.images.length >= 6} onClick={library}><ImagePlus size={17}/>Choose from Cloudinary</button></div>
          <p className="admin-muted admin-small">25 MB per source photo. Compressed before upload. Only use photos you have permission to publish.</p>
          {!!ride.images.length && <div className="admin-media-list">{ride.images.map((image, index) => <article className="admin-media-row" key={image.id}><div className="admin-media-preview"><img src={mediaUrl(image, cloudName, 320)} alt={image.caption || `Ride photo ${index + 1}`}/><span>{index === 0 ? 'Opening photo' : `Photo ${index + 1}`}</span></div><div><label>Caption / image description<input maxLength={300} value={image.caption} onChange={e => update({ images: ride.images.map((item, i) => i === index ? { ...item, caption: e.target.value } : item) })}/></label><div className="admin-media-tools admin-field-note"><button type="button" aria-label={`Move ride photo ${index + 1} earlier`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15}/>Earlier</button><button type="button" aria-label={`Move ride photo ${index + 1} later`} disabled={index === ride.images.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15}/>Later</button><button type="button" aria-label={`Remove ride photo ${index + 1}`} onClick={() => update({ images: ride.images.filter((_, i) => i !== index) })}><X size={15}/>Remove</button></div></div></article>)}</div>}
        </section>
        <section className="admin-section"><button type="button" className="admin-danger" onClick={() => { if (window.confirm('Clear this ride draft? The live section stays unchanged until you save and publish. Cloudinary photos will not be deleted.')) change(emptyUpcomingRide()); }}>Clear ride draft</button></section>
      </fieldset>
    </section>
    {preview && <div ref={previewRef} id="ride-draft-preview" className="admin-ride-preview"><div className="admin-ride-preview-heading"><p>Draft preview · not a live announcement</p><button type="button" onClick={() => { setPreview(false); previewButton.current?.focus(); }}>Back to editing</button></div><UpcomingRideView ride={ride} cloudName={cloudName} preview/></div>}
  </div>;
}
