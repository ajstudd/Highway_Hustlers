import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUp, ArrowUpRight, Check, ExternalLink, LockKeyhole, LogOut, Plus, Save, X, Send } from 'lucide-react';
import { cmsRequest, mediaUrl, type Media, type Place } from '../lib/gallery';
import { LoadingSpinner, LoadingStatus } from '../components/Loading';
import './admin.css';
import { compressPhoto, fileSize, validateUpload } from './uploads';
import GarageEditor from './GarageEditor';
import { inspectBikeFrame, uploadBikeBatch, uploadPreparedSet } from './bike-uploads';
import type { BikeFrame, Garage } from '../../shared/garage.mjs';
import type { EditorDocument, Publication, PublishReview, Section } from './types';
import { offerDraftBikes, offerNewRiders } from '../../shared/garage-seed.mjs';
import { emptyUpcomingRide, type UpcomingRide } from '../../shared/upcoming-ride.mjs';
import UpcomingRideEditor from './UpcomingRideEditor';
import MembershipEditor from './MembershipEditor';
import PlaceEditor from './PlaceEditor';
import MediaPreviewImage from './MediaPreviewImage';
import RidePhotoReview from './RidePhotoReview';
import PublishReviewDialog from './PublishReviewDialog';

type Library = { media: Media[]; cursor: string; cloudName: string };
const messageOf = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Try again.';
const sectionNames: Record<Section, string> = { upcoming: 'Upcoming ride', membership: 'Membership & enrolments', ridePhotos: 'Ride photos', places: 'Places & media', members: 'Hero members', bikes: 'Bike library', lineup: 'Hero lineup' };
type DraftSection = 'places' | 'upcoming' | keyof Garage;

export default function Admin() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'setup' | 'editor'>('checking');
  const [data, setData] = useState<EditorDocument | null>(null);
  const [places, setPlaces] = useState<Place[]>([]), [baseline, setBaseline] = useState('');
  const [garage, setGarage] = useState<Garage>({ members: [], bikes: [], lineup: [] });
  const [upcomingRide, setUpcomingRide] = useState<UpcomingRide>(emptyUpcomingRide), [rideBaseline, setRideBaseline] = useState('');
  const [section, setSection] = useState<Section>('places');
  const uploadedFrames = useRef(new Map<string, BikeFrame>());
  const [selected, setSelected] = useState(''), [password, setPassword] = useState(''), [googleAdmin, setGoogleAdmin] = useState(false);
  const googleRefused = new URLSearchParams(window.location.search).get('error') === 'google-admin';
  const [operation, setOperation] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [review, setReview] = useState<PublishReview | null>(null), [reviewError, setReviewError] = useState('');
  const placesDirty = !!data && JSON.stringify(places) !== baseline;
  const rideDirty = !!data && JSON.stringify(upcomingRide) !== rideBaseline;
  const changesBySection: Record<DraftSection, boolean> = {
    places: placesDirty, upcoming: rideDirty,
    members: !!data && JSON.stringify(garage.members) !== JSON.stringify(data.garage.members),
    bikes: !!data && JSON.stringify(garage.bikes) !== JSON.stringify(data.garage.bikes),
    lineup: !!data && JSON.stringify(garage.lineup) !== JSON.stringify(data.garage.lineup),
  };
  const garageDirty = changesBySection.members || changesBySection.bikes || changesBySection.lineup;
  const dirty = placesDirty || garageDirty || rideDirty;
  const draftSection = section === 'membership' || section === 'ridePhotos' ? null : section;
  const unsaved = (Object.keys(changesBySection) as DraftSection[]).filter(key => changesBySection[key]).map(key => sectionNames[key]);
  const place = places.find(p => p.id === selected);
  const busy = !!operation || photoBusy;
  useEffect(() => {
    document.body.classList.add('admin-surface'); const title = document.title; document.title = 'HH · Content dashboard';
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex,nofollow'; document.head.append(robots);
    return () => { document.body.classList.remove('admin-surface'); document.title = title; robots.remove(); };
  }, []);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', before); return () => window.removeEventListener('beforeunload', before);
  }, [dirty]);
  function failure(e: unknown) { const text = messageOf(e); setError(text); if (text.startsWith('Your session has ended')) setPhase('login'); }
  async function load() {
    const doc = await cmsRequest<EditorDocument>('editor');
    const riders = offerNewRiders(doc.garage), offered = offerDraftBikes(riders);
    setData(doc); setPlaces(doc.places); setBaseline(JSON.stringify(doc.places)); setGarage(offered); setSelected(doc.places[0]?.id || ''); setPhase('editor'); setReview(null);
    const ride = doc.upcomingRide ?? emptyUpcomingRide(); setUpcomingRide(ride); setRideBaseline(JSON.stringify(ride));
    if (riders !== doc.garage) setNotice('New presets are available in Hero members, Bike library and Hero lineup. Save the pages you want to keep.');
    else if (offered !== doc.garage) setNotice('New presets are available in Bike library. Save its draft to keep them.');
  }
  useEffect(() => {
    let active = true;
    cmsRequest<{ authenticated: boolean; setupRequired: boolean; googleAdmin?: boolean }>('session').then(async session => {
      if (!active) return;
      setGoogleAdmin(!!session.googleAdmin);
      if (session.authenticated) { try { await load(); } catch (e) { failure(e); setPhase('login'); } }
      else setPhase(session.setupRequired ? 'setup' : 'login');
    }).catch(e => { if (active) { failure(e); setPhase('login'); } });
    return () => { active = false; };
  }, []);
  async function login(event: FormEvent) {
    event.preventDefault(); setOperation('Signing in…'); setError('');
    try { await cmsRequest('login', { method: 'POST', body: JSON.stringify({ password }) }); setPassword(''); if (data) setPhase('editor'); else await load(); }
    catch (e) { failure(e); } finally { setOperation(''); }
  }
  async function logout() {
    if (dirty && !window.confirm('Discard unsaved changes and sign out?')) return;
    setOperation('Signing out…'); setError('');
    try { await cmsRequest('logout', { method: 'POST', body: '{}' }); setData(null); setPlaces([]); setBaseline(''); setPhase('login'); setNotice('Signed out.'); }
    catch (e) { failure(e); } finally { setOperation(''); }
  }
  function update(change: Partial<Place>) { setPlaces(items => items.map(p => p.id === selected ? { ...p, ...change } : p)); setNotice(''); }
  function choose(id: string) { setSelected(id); setError(''); }
  function addPlace() {
    const id = `place-${crypto.randomUUID()}`;
    setPlaces(items => [...items, { id, name: 'Untitled place', description: '', kind: 'Sunday morning', km: 0, lat: 0, lon: 0, published: false, needsLocationReview: true, distanceUnknown: true, media: [] }]); choose(id);
  }
  function removePlace() {
    const next = places.filter(item => item.id !== selected);
    setPlaces(next); choose(next[0]?.id || '');
  }
  function setSavedPlaces(saved: { revision: number; places: Place[] }) {
    setData(previous => previous ? { ...previous, revision: saved.revision, places: saved.places } : previous);
    setPlaces(saved.places); setBaseline(JSON.stringify(saved.places));
  }
  async function save(page: DraftSection, event?: FormEvent) {
    event?.preventDefault(); if (!data || busy || !changesBySection[page]) return; setOperation('Saving draft…'); setError(''); setNotice('');
    try {
      if (page === 'places') {
        const saved = await cmsRequest<{ revision: number; places: Place[] }>('places', { method: 'PUT', body: JSON.stringify({ revision: data.revision, places, draft: true }) });
        setSavedPlaces(saved);
      } else if (page === 'upcoming') {
        const saved = await cmsRequest<{ revision: number; upcomingRide: UpcomingRide }>('upcoming-ride', { method: 'PUT', body: JSON.stringify({ revision: data.revision, upcomingRide, draft: true }) });
        setData({ ...data, ...saved }); setUpcomingRide(saved.upcomingRide); setRideBaseline(JSON.stringify(saved.upcomingRide));
      } else {
        const next = { ...data.garage, [page]: garage[page] };
        if (page === 'lineup' && next.lineup.some(entry => !next.members.some(member => member.id === entry.memberId) || !next.bikes.some(bike => bike.id === entry.bikeId))) {
          throw Error('Save the assigned members and bikes on their pages before saving this lineup.');
        }
        const saved = await cmsRequest<{ revision: number; garage: Garage }>('garage', { method: 'PUT', body: JSON.stringify({ revision: data.garageRevision, garage: next }) });
        setData({ ...data, garage: saved.garage, garageRevision: saved.revision });
        setGarage(current => ({ ...current, [page]: saved.garage[page] }));
      }
      setNotice(`${sectionNames[page]} draft saved.`);
    } catch (e) { failure(e); } finally { setOperation(''); }
  }
  async function openReview() {
    if (!data || busy) return;
    setOperation('Preparing publication review…'); setError(''); setNotice(''); setReviewError('');
    try {
      const next = await cmsRequest<PublishReview>('publish-review');
      if (next.revision !== data.revision || next.garageRevision !== data.garageRevision) throw Error('Another tab saved newer drafts. Reload before reviewing the publication.');
      setReview(next);
    } catch (e) { failure(e); } finally { setOperation(''); }
  }
  async function publish(selection: string[]) {
    if (!data || !review || !selection.length || busy) return;
    setOperation('Publishing selected changes…'); setReviewError('');
    try {
      const { revision, garageRevision, reviewId } = review;
      const result = await cmsRequest<{ published: Publication; warning?:string }>('publish', { method: 'POST', body: JSON.stringify({ revision, garageRevision, reviewId, selection }) });
      setData({ ...data, published: result.published });
      setReview(null);
      setNotice(result.warning || (data.localPreview ? 'Published to this local preview only.' : 'Published. CDN updates can take a short time to appear everywhere.'));
      if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('hh-published'); channel.postMessage(result.published.snapshotRevision); channel.close(); }
    } catch (e) {
      const message = messageOf(e);
      if (message.startsWith('Your session has ended')) { setReview(null); failure(e); }
      else setReviewError(message);
    } finally { setOperation(''); }
  }
  function changeGarage(next: Garage) { setGarage(next); setNotice(''); }
  async function rideLifecycle(operation:'cancel-ride'|'new-ride') {
    if(!data||rideDirty)return;
    if(!window.confirm(operation==='cancel-ride'?'Cancel this ride for members and notify them now? Use Review & publish to remove the announcement.':'Start a fresh ride draft? This clears the current ride draft.'))return;
    setOperation(operation === 'cancel-ride' ? 'Cancelling ride…' : 'Creating a ride draft…');setError('');try {
      const saved = await cmsRequest<{revision:number; upcomingRide:UpcomingRide | null; notice?:string}>(operation,{method:'POST',body:JSON.stringify({revision:data.revision})});
      setData({ ...data, revision: saved.revision, upcomingRide: saved.upcomingRide });
      const ride = saved.upcomingRide ?? emptyUpcomingRide(); setUpcomingRide(ride); setRideBaseline(JSON.stringify(ride));
      setNotice(saved.notice || 'New ride draft ready.');
    } catch(e){failure(e);}finally{setOperation('');}
  }
  async function uploadBike(bikeId: string, files: File[]) {
    setOperation('Preparing bike images…'); setError(''); setNotice('');
    try {
      const frames = await uploadPreparedSet(files, uploadedFrames.current, setOperation);
      setGarage(current => ({ ...current, bikes: current.bikes.map(b => b.id === bikeId ? { ...b, frames, status: 'draft' } : b) }));
      setNotice('Image set uploaded. Check the preview and hero availability, then save your draft.');
    } catch (e) { failure(e); setNotice('The current image set is unchanged. Confirmed uploads can be reused by selecting the same files again in this tab.'); }
    finally { setOperation(''); }
  }
  async function migrate() {
    if (!data || dirty) return;
    setOperation('Preparing the original bike frames…'); setError(''); setNotice('');
    let current = structuredClone(garage), revision = data.garageRevision, completed = 0;
    try {
      for (const bike of current.bikes) {
        const indexes = bike.frames.map((f,i) => f.source === 'local' ? i : -1).filter(i => i >= 0);
        for (let start = 0; start < indexes.length; start += 12) {
          const batch = indexes.slice(start,start+12), prepared = [];
          for (const index of batch) {
            const frame = bike.frames[index]; if (frame.source !== 'local') continue;
            setOperation(`Checking frame ${index+1} of ${bike.frames.length} for ${bike.model}…`);
            const response = await fetch(frame.path); if (!response.ok) throw Error('An original frame is unavailable. No original files have been removed.');
            prepared.push(await inspectBikeFrame(new File([await response.blob()], `${index}.webp`, { type: 'image/webp' })));
          }
          const frames = await uploadBikeBatch(prepared, uploadedFrames.current, setOperation);
          let changed = false;
          frames.forEach((frame,i) => { if (frame) { bike.frames[batch[i]] = frame; completed++; changed = true; } });
          if (changed) {
            const saved = await cmsRequest<{ revision: number; garage: Garage }>('garage', { method: 'PUT', body: JSON.stringify({ revision, garage: current }) });
            revision = saved.revision;
            setGarage(saved.garage);
            setData(previous => previous ? { ...previous, garage: saved.garage, garageRevision: saved.revision } : previous);
          }
          if (frames.some(f => !f)) throw Error('Some frames could not be verified. Completed batches are saved. Run the migration again to continue the remaining original frames.');
        }
      }
      setNotice(`Migration complete: ${completed} frames imported. Review and publish the saved draft when ready. Original files remain untouched.`);
    } catch (e) { failure(e); setNotice(`${completed} frames were confirmed in this run. Saved batches will be skipped when you resume. Nothing has been published.`); }
    finally { setOperation(''); }
  }
  function movePlace(direction: number) {
    const index = places.findIndex(p => p.id === selected), next = index + direction;
    if (next < 0 || next >= places.length) return; const reordered = [...places]; [reordered[index], reordered[next]] = [reordered[next], reordered[index]]; setPlaces(reordered);
  }
  async function upload(files: FileList | null, target: 'place' | 'ride' = 'place') {
    if (!files?.length || !data || (target === 'place' && !place)) return;
    const current = target === 'ride' ? upcomingRide.images : place!.media;
    const maximum = target === 'ride' ? 6 : 40;
    if (files.length + current.length > maximum) { setError(target === 'ride' ? 'Use up to six ride photos.' : 'Use up to 40 photos/videos per place.'); return; }
    const destination = place?.id;
    setOperation('Preparing files…'); setError(''); setNotice(''); const uploaded: Media[] = []; let sourceBytes = 0, sentBytes = 0;
    try {
      // Validate the whole selection before decoding or uploading any of it.
      Array.from(files).forEach(file => { if (target === 'ride' && validateUpload(file) !== 'image') throw Error('Choose photos for the upcoming ride, not videos.'); validateUpload(file); });
      for (const file of Array.from(files)) {
        const type = validateUpload(file);
        setOperation(`Preparing ${uploaded.length + 1} of ${files.length}…`);
        const prepared = type === 'image' ? await compressPhoto(file) : file;
        setOperation(`Uploading ${uploaded.length + 1} of ${files.length}${type === 'video' ? ' and optimizing video' : ''}…`);
        const signed = await cmsRequest<{ params: Record<string, string>; signature: string; ticket: string; apiKey: string; cloudName: string; type: string }>('sign-upload', { method: 'POST', body: JSON.stringify({ type, sourceBytes:file.size, bytes:prepared.size }) });
        const form = new FormData(); form.set('file', prepared); Object.entries(signed.params).forEach(([k,v]) => form.set(k,v)); form.set('signature', signed.signature); form.set('api_key', signed.apiKey);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/${type}/upload`, { method: 'POST', body: form });
        const result = await response.json(); if (!response.ok) throw new Error(`Could not upload ${file.name}. Check the format, size and Cloudinary limits.`);
        setOperation(`Checking upload ${uploaded.length + 1} of ${files.length}…`);
        const confirmed = await cmsRequest<{media:Media}>('confirm-upload',{method:'POST',body:JSON.stringify({ticket:signed.ticket})});
        uploaded.push(confirmed.media); sourceBytes += file.size; sentBytes += prepared.size;
      }
      setNotice(`Upload complete.${sentBytes < sourceBytes ? ` Photos reduced the upload by ${fileSize(sourceBytes-sentBytes)}.` : ''} Add captions, then save your changes.`);
    } catch (e) { failure(e); setNotice(uploaded.length ? `${uploaded.length} file(s) uploaded. Save your draft to keep them.` : ''); }
    finally {
      if (uploaded.length) {
        if (target === 'ride') setUpcomingRide(ride => ({ ...ride, images: [...ride.images, ...uploaded] }));
        else setPlaces(items => items.map(p => p.id === destination ? { ...p, media: [...p.media, ...uploaded] } : p));
      }
      setOperation('');
    }
  }
  if (phase !== 'editor') return <main className="hh-admin admin-auth">
    <a className="admin-brand" href="/">Highway Hustlers<span>Bhopal</span></a>
    <div className="admin-auth-box">
      <LockKeyhole size={25} className="admin-accent" /><h1>Look after HH.</h1><p>Places, ride albums, members and the bikes they ride.</p>
      {phase === 'checking' ? <LoadingStatus label="Checking your session…"/> : phase === 'setup' ? <div className="admin-setup"><h2>One-time server setup</h2><p>Connect Neon in Vercel Storage and set <code>ADMIN_PASSWORD_HASH</code>. Cloudinary credentials enable the media library and uploads.</p><p>Setup instructions: <code>docs/gallery-admin.md</code> in the repository.</p><button onClick={() => location.reload()}>Check setup again</button></div> : <>{googleAdmin && <><a className="admin-google" href="/api/member?action=google&purpose=admin">Continue with Google <ArrowUpRight size={16}/></a>{googleRefused && <p className="admin-error" role="alert">That Google account isn’t an HH administrator. Use an administrator account or the password.</p>}<p className="admin-muted admin-auth-divider">Or use the admin password</p></>}<form onSubmit={login}>
        <label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} autoFocus={!googleAdmin} disabled={busy} />
        <button className="admin-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} {busy ? <LoadingSpinner size={16}/> : <ArrowUp size={16}/>}</button>
      </form></>}
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <a className="admin-back" href="/"><ArrowLeft size={15}/> Back to the website</a>
    </div>
  </main>;
  return <main className="hh-admin">
    <header className="admin-top"><a className="admin-brand" href="/">Highway Hustlers<span>Content dashboard{data?.localPreview ? ' · Local preview' : ''}</span></a><div><a href="/" target="_blank" rel="noreferrer" aria-label="View website"><span>View website</span> <ExternalLink size={15}/></a><button onClick={logout} disabled={busy}>{operation === 'Signing out…' ? <LoadingSpinner size={16}/> : <LogOut size={15}/>} Sign out</button></div></header>
    <nav className="admin-sections" aria-label="Dashboard sections">{(['upcoming','membership','ridePhotos','places','members','bikes','lineup'] as Section[]).map(id => <button key={id} type="button" aria-current={section === id ? 'page' : undefined} disabled={busy} onClick={() => { setSection(id); setShowLibrary(false); setNotice(''); setError(''); }}>{sectionNames[id]}{id !== 'membership' && id !== 'ridePhotos' && changesBySection[id] && <span className="admin-unsaved-dot" aria-label="Unsaved edits"/>}</button>)}</nav>
    {section !== 'membership' && <div className="admin-publishing"><div><strong>{data?.localPreview ? 'Website preview' : 'Website publication'}</strong>{data?.published && <p className="admin-muted admin-small">Last published {new Date(data.published.publishedAt).toLocaleString()}</p>}</div><button type="button" aria-haspopup="dialog" disabled={busy || !data?.publishReady} onClick={() => void openReview()}><Send size={16}/> Review &amp; publish</button></div>}
    {draftSection && draftSection !== 'places' && <div className="admin-draft-bar" aria-label={`${sectionNames[draftSection]} draft`}>
      <div><strong>{sectionNames[draftSection]}</strong><span className="admin-muted">{changesBySection[draftSection] ? 'Unsaved edits on this page' : 'No unsaved edits'}</span></div>
      <button className={changesBySection[draftSection] ? 'admin-primary' : ''} type="button" disabled={busy || !changesBySection[draftSection]} onClick={() => void save(draftSection)}>{operation === 'Saving draft…' ? <LoadingSpinner size={16}/> : <Save size={16}/>} Save draft</button>
    </div>}
    {operation && !review && <LoadingStatus label={operation} floating/>}
    <div className="admin-feedback admin-global-feedback" aria-live="polite">{error ? <p className="admin-error" role="alert">{error}</p> : !operation && notice ? <p className="admin-success"><Check size={16}/>{notice}</p> : null}{section !== 'membership' && !data?.publishReady && <p className="admin-warning">Publishing needs Cloudinary credentials. Preview deployments also need their own content snapshot ID.</p>}</div>
    {data && section === 'places' && <PlaceEditor places={places} savedPlaces={data.places} selected={selected} cloudName={data.cloudName} cloudReady={data.cloudReady} busy={busy} dirty={placesDirty} saving={operation === 'Saving draft…'}
      select={choose} add={addPlace} remove={removePlace} move={movePlace} change={update} save={event => void save('places', event)}
      upload={files => void upload(files)} openLibrary={() => setShowLibrary(true)}/>}
    {data && section === 'upcoming' && <><UpcomingRideEditor ride={upcomingRide} change={ride => { setUpcomingRide(ride); setNotice(''); }} cloudName={data.cloudName} cloudReady={data.cloudReady} busy={busy} upload={files => void upload(files, 'ride')} library={() => setShowLibrary(true)}/><div className="admin-editor admin-upcoming-editor"><p className="admin-muted admin-field-note">After a published ride ends, its announcement becomes an album draft.</p><div className="admin-media-actions"><button disabled={busy || rideDirty || !data.published?.upcomingRide?.id || data.published.upcomingRide.id !== upcomingRide.id} className="admin-danger" onClick={()=>void rideLifecycle('cancel-ride')}>Cancel ride &amp; notify members</button><button disabled={busy || rideDirty || !upcomingRide.id} onClick={()=>void rideLifecycle('new-ride')}>Start a new ride</button></div></div></>}
    {section==='membership'&&<MembershipEditor/>}
    {section === 'ridePhotos' && data && <RidePhotoReview cloudName={data.cloudName} places={places} revision={data.revision} placesDirty={placesDirty} busy={busy} onAlbumsSaved={setSavedPlaces} activity={setPhotoBusy}/>}
    {data && <GarageEditor section={section} garage={garage} cloudName={data.cloudName} cloudReady={data.cloudReady} busy={busy} dirty={dirty} change={changeGarage} upload={uploadBike} migrate={migrate}/>}
    {showLibrary && data && (section === 'upcoming' || place) && <MediaLibrary cloudName={data.cloudName} current={section === 'upcoming' ? upcomingRide.images : place!.media} imagesOnly={section === 'upcoming'} maximum={section === 'upcoming' ? 6 : 40} close={() => setShowLibrary(false)} add={media => { if (section === 'upcoming') setUpcomingRide(ride => ({ ...ride, images: [...ride.images, ...media] })); else update({ media: [...place!.media, ...media] }); setShowLibrary(false); }} onError={failure}/>}
    {review && <PublishReviewDialog review={review} unsaved={unsaved} local={!!data?.localPreview} busy={busy} error={reviewError} close={() => setReview(null)} confirm={selection => void publish(selection)}/>}
  </main>;
}

function MediaLibrary({ cloudName, current, imagesOnly = false, maximum = 40, close, add, onError }: { cloudName: string; current: Media[]; imagesOnly?: boolean; maximum?: number; close: () => void; add: (media: Media[]) => void; onError: (e: unknown) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), cache = useRef(new Map<string,Library>());
  const [type, setType] = useState<'image' | 'video'>('image'), [library,setLibrary] = useState<Library>({media:[],cursor:'',cloudName});
  const [picked,setPicked] = useState<Media[]>([]), [busy,setBusy] = useState(true), [error,setError] = useState(''), [query,setQuery] = useState('');
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  async function load(nextType: 'image' | 'video', cursor = '', refresh = false) {
    setType(nextType); setError('');
    if (!cursor && !refresh && cache.current.has(nextType)) { setLibrary(cache.current.get(nextType)!); setBusy(false); return; }
    setBusy(true);
    try { const result = await cmsRequest<Library>(`library&type=${nextType}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`); const next = cursor ? { ...result, media: [...library.media, ...result.media] } : result; setLibrary(next); cache.current.set(nextType,next); }
    catch (e) { setError(messageOf(e)); if (messageOf(e).startsWith('Your session has ended')) { close(); onError(e); } } finally { setBusy(false); }
  }
  useEffect(() => { void load('image'); }, []);
  const chosen = new Set([...current, ...picked].map(m=>m.id));
  return <dialog className="hh-admin admin-library" ref={dialog} onCancel={close} aria-labelledby="library-title"><header><div><h2 id="library-title">Cloudinary library</h2><p className="admin-muted">{imagesOnly ? 'Choose photos for the upcoming ride.' : 'Choose moments for this place.'}</p></div><button onClick={close} aria-label="Close media library"><X size={22}/></button></header>
    <div className="admin-library-toolbar"><div role="group" aria-label="Media type"><button aria-pressed={type === 'image'} disabled={busy} onClick={() => load('image')}>Photos</button>{!imagesOnly && <button aria-pressed={type === 'video'} disabled={busy} onClick={() => load('video')}>Videos</button>}</div><input type="search" aria-label="Filter loaded media" placeholder="Filter filenames…" value={query} onChange={e=>setQuery(e.target.value)}/><button disabled={busy} onClick={()=>load(type,'',true)}>Refresh</button></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-library-grid" aria-busy={busy}>{library.media.filter(m=>m.type === type && m.publicId.toLowerCase().includes(query.toLowerCase())).map(media=><button className={chosen.has(media.id)?'is-picked':''} key={media.id} aria-pressed={chosen.has(media.id)} disabled={current.some(m=>m.id===media.id) || (current.length+picked.length>=maximum && !chosen.has(media.id))} onClick={()=>setPicked(items=>items.some(m=>m.id===media.id)?items.filter(m=>m.id!==media.id):[...items,media])}><MediaPreviewImage src={mediaUrl(media,cloudName,280,true)} alt="" loading="lazy"/>{chosen.has(media.id)&&<Check size={18}/>}<span className="admin-library-filename">{media.publicId.split('/').pop()}</span></button>)}</div>
    {busy && <LoadingStatus label="Loading media…"/>}{!busy && !library.media.length && !error && <p className="admin-empty">No {type === 'image' ? 'photos' : 'videos'} in this Cloudinary account yet.</p>}
    <footer>{library.cursor && <button disabled={busy} onClick={()=>load(type,library.cursor)}>Load more</button>}<span className="admin-muted">{picked.length} selected</span><button className="admin-primary" disabled={!picked.length || busy} onClick={()=>add(picked)}>{imagesOnly ? 'Add to ride' : 'Add to album'} <Plus size={16}/></button></footer>
  </dialog>;
}
