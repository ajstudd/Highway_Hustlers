import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Maximize2, X } from 'lucide-react';
import { LoadingSpinner, LoadingStatus } from '../components/Loading';
import { cmsRequest, mediaUrl, type Media, type Place } from '../lib/gallery';
import MediaPreviewImage from './MediaPreviewImage';
import './editor-workspaces.css';

const statuses = { pending: 'Awaiting review', approved: 'Approved', rejected: 'Not selected' } as const;
type PhotoStatus = keyof typeof statuses;
type Photo = { id: string; media: Media; status: PhotoStatus; name: string; ride: string };
type Catalogue = { photos: Photo[]; more: boolean; rides: { id: string; name: string; date: string }[] };
type Albums = { places: Place[]; revision: number };
type PhotoDialog = { photo: Photo; mode: 'preview' | 'album' };
const pageSize = 50;

export default function RidePhotoReview({ cloudName, places, revision, placesDirty, busy, onAlbumsSaved, activity }: {
  cloudName: string; places: Place[]; revision: number; placesDirty: boolean; busy: boolean;
  onAlbumsSaved: (saved: Albums) => void; activity: (busy: boolean) => void;
}) {
  const [catalogue, setCatalogue] = useState<Catalogue>({ photos: [], more: false, rides: [] });
  const [status, setStatus] = useState<PhotoStatus | ''>('pending');
  const [ride, setRide] = useState('');
  const [offset, setOffset] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [processing, setProcessing] = useState<{ id: string; label: string } | null>(null);
  const [dialog, setDialog] = useState<PhotoDialog | null>(null);
  const waiting = loading || busy;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    const query = new URLSearchParams({ status, ride, offset: String(offset) });
    void cmsRequest<Catalogue>(`ride-photos&${query}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (!result.photos.length && offset > 0) { setOffset(offset - pageSize); return; }
      setCatalogue(result);
      setLoading(false);
    }).catch(error => {
      if (controller.signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : 'Could not load ride photos.');
      setLoading(false);
    });
    return () => controller.abort();
  }, [status, ride, offset, version]);

  function changeFilter(update: () => void) {
    setOffset(0); setActionError(''); setNotice(''); update();
  }

  async function run(photo: Photo, label: string, work: () => Promise<void>) {
    setProcessing({ id: photo.id, label }); activity(true); setActionError(''); setNotice('');
    try { await work(); }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setProcessing(null); activity(false); }
  }

  function moderate(photo: Photo, next: 'approved' | 'rejected') {
    void run(photo, next === 'approved' ? 'Approving photo…' : 'Updating photo…', async () => {
      await cmsRequest('moderate-ride-photo', { method: 'POST', body: JSON.stringify({ id: photo.id, expected: photo.status, status: next }) });
      setNotice(next === 'approved' ? 'Approved. The photo is ready to add to an album.' : 'Marked not selected.');
      setVersion(value => value + 1);
    });
  }

  function addToAlbum(photo: Photo, place: Place) {
    void run(photo, 'Adding to album…', async () => {
      const saved = await cmsRequest<Albums>('add-ride-photo', { method: 'POST', body: JSON.stringify({ id: photo.id, placeId: place.id, revision }) });
      onAlbumsSaved(saved);
      setDialog(null);
      setNotice(`Added to the ${place.name} draft. Select that album in Review & publish when you’re ready.`);
    });
  }

  function openDialog(next: PhotoDialog) { setActionError(''); setDialog(next); }
  const filters = [['pending', statuses.pending], ['approved', statuses.approved], ['rejected', statuses.rejected], ['', 'All photos']] as const;

  return <section className="media-workspace" aria-labelledby="ride-photo-heading">
    <header className="workspace-heading"><h1 id="ride-photo-heading">Ride photos</h1><p>Review member submissions, then add approved photos to a place album.</p></header>
    <div className="workspace-panel">
      <div className="photo-filters">
        <div className="workspace-segments" role="group" aria-label="Photo status">{filters.map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} disabled={busy} onClick={() => { if (value !== status) changeFilter(() => setStatus(value)); }}>{label}</button>)}</div>
        <label>Ride<select value={ride} disabled={busy} onChange={event => changeFilter(() => setRide(event.target.value))}><option value="">All rides</option>{catalogue.rides.map(item => <option key={item.id} value={item.id}>{item.name}{item.date ? ` · ${item.date}` : ''}</option>)}</select></label>
      </div>
      <div className="photo-results">
        {!dialog && actionError && <p className="admin-error" role="alert">{actionError}</p>}
        {notice && <p className="admin-success" role="status"><Check size={17}/>{notice}</p>}
        {loading ? <div className="workspace-empty"><LoadingStatus label="Loading ride photos…"/></div> : loadError ? <div className="workspace-empty"><p className="admin-error" role="alert">{loadError}</p><button type="button" onClick={() => setVersion(value => value + 1)}>Try again</button></div> : catalogue.photos.length ? <div className="photo-review-grid">
          {catalogue.photos.map(photo => <article key={photo.id} className="photo-review-card">
            <button type="button" className="photo-review-preview" aria-label={`Preview photo by ${photo.name} from ${photo.ride}`} disabled={waiting} onClick={() => openDialog({ photo, mode: 'preview' })}>
              <MediaPreviewImage src={mediaUrl(photo.media, cloudName, 600)} alt={`Ride photo by ${photo.name}`} loading="lazy"/><Maximize2 className="photo-expand" size={17} aria-hidden="true"/>
            </button>
            <div className="photo-review-copy">
              <span className="photo-status" data-status={photo.status}>{statuses[photo.status]}</span>
              <h2>{photo.ride}</h2><p className="admin-muted">{photo.name}</p>
              {processing?.id === photo.id && !dialog ? <LoadingStatus label={processing.label}/> : <div className="photo-card-actions">
                {photo.status !== 'rejected' && <button type="button" disabled={waiting} onClick={() => moderate(photo, 'rejected')}>Don’t select</button>}
                {photo.status === 'approved' ? <button type="button" className="admin-primary" disabled={waiting} onClick={() => openDialog({ photo, mode: 'album' })}><ImagePlus size={16}/> Add to album</button> : <button type="button" className="admin-primary" disabled={waiting} onClick={() => moderate(photo, 'approved')}><Check size={16}/> Approve</button>}
              </div>}
            </div>
          </article>)}
        </div> : <p className="workspace-empty">{status === 'pending' ? 'No photos awaiting review.' : 'No photos match these filters.'}</p>}
        {!loading && !loadError && (offset > 0 || catalogue.more) && <nav className="photo-pagination" aria-label="Photo pages">
          <button type="button" disabled={waiting || !offset} onClick={() => setOffset(value => value - pageSize)}><ArrowLeft size={16}/> Previous</button>
          <span className="admin-muted">Page {offset / pageSize + 1}</span>
          <button type="button" disabled={waiting || !catalogue.more} onClick={() => setOffset(value => value + pageSize)}>Next <ArrowRight size={16}/></button>
        </nav>}
      </div>
    </div>
    {dialog && <RidePhotoDialog key={`${dialog.photo.id}-${dialog.mode}`} item={dialog} cloudName={cloudName} places={places} placesDirty={placesDirty} busy={busy} error={actionError} close={() => setDialog(null)} add={place => addToAlbum(dialog.photo, place)}/>}
  </section>;
}

function RidePhotoDialog({ item, cloudName, places, placesDirty, busy, error, close, add }: {
  item: PhotoDialog; cloudName: string; places: Place[]; placesDirty: boolean; busy: boolean; error: string; close: () => void; add: (place: Place) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [album, setAlbum] = useState('');
  const place = places.find(entry => entry.id === album);
  const { photo, mode } = item;
  const adding = mode === 'album';
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  function dismiss() {
    if (!busy) { dialog.current?.close(); close(); }
  }
  function unavailable(entry: Place) {
    return entry.media.some(media => media.id === photo.media.id) ? 'Already added' : entry.media.length >= 40 ? 'Album full' : '';
  }
  return <dialog className="admin-library photo-dialog" ref={dialog} aria-labelledby="ride-photo-dialog-title" onCancel={event => { event.preventDefault(); dismiss(); }}>
    <header><div><h2 id="ride-photo-dialog-title">{adding ? 'Add to a place album' : photo.ride}</h2><p className="admin-muted">{adding ? `${photo.ride} · ${photo.name}` : `Photo by ${photo.name}`}</p></div><button type="button" aria-label="Close photo dialog" disabled={busy} onClick={dismiss}><X size={20}/></button></header>
    {adding ? <form onSubmit={event => { event.preventDefault(); if (place && !unavailable(place) && !placesDirty && !busy) add(place); }}>
      {placesDirty && <p className="admin-warning">Save the Places &amp; media draft before adding a photo.</p>}
      {places.length ? <label>Destination album<select value={album} disabled={busy || placesDirty} onChange={event => setAlbum(event.target.value)}><option value="">Choose an album</option>{places.map(entry => <option key={entry.id} value={entry.id} disabled={!!unavailable(entry)}>{entry.name}{unavailable(entry) ? ` · ${unavailable(entry)}` : ''}</option>)}</select></label> : <p className="admin-muted">Create and save a place album under Places &amp; media first.</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}
      <footer><button type="button" disabled={busy} onClick={dismiss}>Cancel</button><button className="admin-primary" disabled={busy || placesDirty || !place || !!unavailable(place)}>{busy ? <LoadingSpinner size={16}/> : <ImagePlus size={16}/>} {busy ? 'Adding to draft…' : 'Add to draft'}</button></footer>
    </form> : <MediaPreviewImage className="photo-dialog-image" src={mediaUrl(photo.media, cloudName, 1600)} alt={`Ride photo by ${photo.name}`}/>}
  </dialog>;
}
