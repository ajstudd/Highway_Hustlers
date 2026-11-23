import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Eye, ImagePlus, MapPin, Plus, Save, Star, Trash2, Upload, X } from 'lucide-react';
import { LoadingSpinner } from '../components/Loading';
import { mediaUrl, placeMapUrl, type Place } from '../lib/gallery';
import MediaPreviewImage from './MediaPreviewImage';
import PlaceLocation from './PlaceLocation';
import './editor-workspaces.css';

type PlaceEditorProps = {
  places: Place[]; savedPlaces: Place[]; selected: string; cloudName: string; cloudReady: boolean;
  busy: boolean; dirty: boolean; saving: boolean;
  select: (id: string) => void; add: () => void; remove: () => void; move: (direction: number) => void;
  change: (patch: Partial<Place>) => void; save: (event?: FormEvent) => void;
  upload: (files: FileList | null) => void; openLibrary: () => void;
};

export default function PlaceEditor(props: PlaceEditorProps) {
  const { places, savedPlaces, selected, cloudName, busy, select, add } = props;
  const [query, setQuery] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const index = places.findIndex(place => place.id === selected);
  const place = places[index];
  const filtered = places.filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="media-workspace" aria-labelledby="place-workspace-heading">
    <header className="workspace-heading place-workspace-heading">
      <div><h1 id="place-workspace-heading">Places &amp; media</h1><p>Edit the places and albums shown in Our favourite mornings.</p></div>
      <button className={props.dirty ? 'admin-primary' : ''} type="button" disabled={busy || !props.dirty} onClick={() => props.save()}>{props.saving ? <LoadingSpinner size={16}/> : <Save size={16}/>} Save draft</button>
    </header>
    <div className="place-workspace">
      <aside className="workspace-panel place-browser">
        <div className="place-browser-heading"><h2>Places</h2><button type="button" disabled={busy || places.length >= 100} onClick={() => {
          setQuery(''); add(); requestAnimationFrame(() => heading.current?.focus());
        }}><Plus size={16}/> New place</button></div>
        {!!places.length && <>
          <label className="place-search"><span className="sr-only">Find a place</span><input type="search" placeholder="Find a place…" value={query} onChange={event => setQuery(event.target.value)}/></label>
          <label className="place-mobile-picker">Choose a place<select value={selected} disabled={busy} onChange={event => select(event.target.value)}>{places.map(item => <option key={item.id} value={item.id}>{item.name || 'Untitled place'}</option>)}</select></label>
          <nav className="place-list" aria-label="Edit places">{filtered.length ? filtered.map(item => <button key={item.id} type="button" aria-current={item.id === selected ? 'true' : undefined} onClick={() => select(item.id)} disabled={busy}>
            <span className="place-thumb">{item.media[0] || item.legacyId ? <img src={item.media[0] ? mediaUrl(item.media[0], cloudName, 120, true) : `/destinations/${item.legacyId}-thumb.webp`} alt="" loading="lazy"/> : <MapPin size={18} aria-hidden="true"/>}</span>
            <span><strong>{item.name || 'Untitled place'}</strong><small>{item.media.length} {item.media.length === 1 ? 'media item' : 'media items'}</small></span>
          </button>) : <p className="admin-muted">No matching places.</p>}</nav>
        </>}
      </aside>
      {place ? <PlaceDetails key={place.id} place={place} index={index} saved={savedPlaces[index]} heading={heading} {...props}/> : <div className="workspace-panel workspace-empty">Add a place to start an album.</div>}
    </div>
  </section>;
}

function PlaceDetails({ place, index, saved, heading, places, cloudName, cloudReady, busy, change, move, remove, save, upload, openLibrary }: PlaceEditorProps & {
  place: Place; index: number; saved?: Place; heading: RefObject<HTMLHeadingElement>;
}) {
  const [view, setView] = useState<'details' | 'media' | 'preview'>('details');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const views = [['details', 'Details'], ['media', `Media (${place.media.length})`], ['preview', 'Preview']] as const;
  function moveMedia(from: number, to: number) {
    if (from === to || to < 0 || to >= place.media.length) return;
    const media = [...place.media];
    media.splice(to, 0, ...media.splice(from, 1));
    change({ media });
  }

  return <form className="workspace-panel place-editor" onSubmit={save}>
    <header className="place-editor-heading">
      <div><h2 ref={heading} tabIndex={-1}>{place.name || 'Untitled place'}</h2><p>{place.kind}</p></div>
      {JSON.stringify(place) !== JSON.stringify(saved) && <span className="place-draft-label">Unsaved changes</span>}
    </header>
    <div className="workspace-segments place-editor-tabs" role="group" aria-label="Place editor view">{views.map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{id === 'preview' && <Eye size={16}/>} {label}</button>)}</div>
    <fieldset disabled={busy} className="place-editor-body admin-fields">
      {view === 'details' && <>
        <div className="place-details">
          <div className="admin-two"><label>Place name<input required maxLength={100} value={place.name} onChange={event => change({ name: event.target.value })}/></label><label>Ride type<select value={place.kind} onChange={event => change({ kind: event.target.value as Place['kind'] })}><option>Sunday morning</option><option>Full day</option><option>Weekend</option></select></label></div>
          <label>Description<textarea maxLength={400} rows={3} value={place.description} onChange={event => change({ description: event.target.value })} placeholder="What makes this stop worth the ride?"/></label>
          <PlaceLocation place={place} change={change}/>
        </div>
        <div className="place-settings">
          <div><h3>Display order</h3><p className="admin-muted">Place {index + 1} of {places.length}</p></div>
          <div className="workspace-actions"><button type="button" disabled={index === 0} onClick={() => move(-1)}><ArrowUp size={16}/> Move earlier</button><button type="button" disabled={index === places.length - 1} onClick={() => move(1)}><ArrowDown size={16}/> Move later</button></div>
        </div>
        <div className="place-settings">
          {confirmRemove ? <><p>Remove this place from the draft? Choose its removal in Review &amp; publish to take it off the website.</p><div className="workspace-actions"><button type="button" onClick={() => setConfirmRemove(false)}>Keep place</button><button type="button" className="admin-danger" onClick={remove}>Remove from draft</button></div></> : <button type="button" className="admin-danger" onClick={() => setConfirmRemove(true)}><Trash2 size={16}/> Remove place</button>}
        </div>
      </>}
      {view === 'media' && <>
        <div className="place-media-toolbar"><div><h3>Album media</h3><p>Choose a cover, edit captions, and set the display order.</p></div><span className="admin-muted">{place.media.length} of 40</span></div>
        {!cloudReady && <p className="admin-warning">Connect Cloudinary to upload files or browse the library.</p>}
        <div className="workspace-actions"><label className={`admin-upload ${!cloudReady || place.media.length >= 40 ? 'is-disabled' : ''}`}><Upload size={17}/> Upload files<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/*,.heic,.heif" multiple disabled={!cloudReady || busy || place.media.length >= 40} onChange={event => { upload(event.target.files); event.target.value = ''; }}/></label><button type="button" disabled={!cloudReady || place.media.length >= 40} onClick={openLibrary}><ImagePlus size={17}/> Choose from Cloudinary</button></div>
        <p className="admin-muted admin-small">Up to 25 MB per file.</p>
        {place.media.length ? <ol className="place-media-list">{place.media.map((media, position) => <li key={media.id}>
          <div className="place-media-image"><MediaPreviewImage src={mediaUrl(media, cloudName, 360, true)} alt={media.caption || `Album ${media.type}`} loading="lazy"/>{position === 0 && <span>Cover</span>}</div>
          <div className="place-media-item-edit">
            <label>Caption<input maxLength={300} value={media.caption} onChange={event => change({ media: place.media.map(item => item.id === media.id ? { ...item, caption: event.target.value } : item) })}/></label>
            <div className="workspace-actions">
              {position !== 0 && <button type="button" onClick={() => moveMedia(position, 0)} aria-label={`Set item ${position + 1} as cover`}><Star size={15}/> Set as cover</button>}
              <button type="button" disabled={!position} onClick={() => moveMedia(position, position - 1)} aria-label={`Move item ${position + 1} earlier`}><ArrowUp size={15}/></button>
              <button type="button" disabled={position === place.media.length - 1} onClick={() => moveMedia(position, position + 1)} aria-label={`Move item ${position + 1} later`}><ArrowDown size={15}/></button>
              <button type="button" className="admin-danger" onClick={() => change({ media: place.media.filter(item => item.id !== media.id) })} aria-label={`Remove item ${position + 1} from album`}><X size={15}/> Remove</button>
            </div>
          </div>
        </li>)}</ol> : <p className="workspace-empty">{place.legacyId ? 'The destination photo will be used until you add album media.' : 'Add photos or videos to create the album.'}</p>}
      </>}
      {view === 'preview' && <PlacePreview place={place} cloudName={cloudName}/>}
    </fieldset>
  </form>;
}

function PlacePreview({ place, cloudName }: { place: Place; cloudName: string }) {
  const cover = place.media[0];
  const coverUrl = cover ? mediaUrl(cover, cloudName, 720, true) : place.legacyId ? `/destinations/${place.legacyId}.webp` : '';
  const mapUrl = placeMapUrl(place);
  return <article className="place-preview">
    {coverUrl ? <MediaPreviewImage src={coverUrl} alt={cover?.caption || place.name}/> : <div className="workspace-empty">Add a cover photo to preview it here.</div>}
    <div><p className="admin-muted">{place.kind}</p><h3>{place.name || 'Untitled place'}</h3>
      {place.description && <p>{place.description}</p>}
      {!(place.distanceUnknown ?? Boolean(place.needsLocationReview && place.km === 0)) && <p>{place.km} km one way from Bhopal</p>}
      {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps <ArrowUpRight size={16}/></a>}
    </div>
  </article>;
}
