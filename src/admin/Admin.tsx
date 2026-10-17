import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Check, ExternalLink, ImagePlus, LockKeyhole, LogOut, MapPin, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { cmsRequest, mediaUrl, type Media, type Place } from '../lib/gallery';
import './admin.css';
import { compressPhoto, fileSize, validateUpload } from './uploads';

type Document = { places: Place[]; revision: number; cloudName: string; cloudReady: boolean };
type Library = { media: Media[]; cursor: string; cloudName: string };
const messageOf = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Try again.';

export default function Admin() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'setup' | 'editor'>('checking');
  const [data, setData] = useState<Document | null>(null);
  const [places, setPlaces] = useState<Place[]>([]), [baseline, setBaseline] = useState('');
  const [selected, setSelected] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false), [showLibrary, setShowLibrary] = useState(false);
  const dirty = !!data && JSON.stringify(places) !== baseline;
  const place = places.find(p => p.id === selected);
  const editor = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.body.classList.add('admin-surface'); const title = document.title; document.title = 'HH · Places & media';
    const robots = document.createElement('meta'); robots.name = 'robots'; robots.content = 'noindex,nofollow'; document.head.append(robots);
    return () => { document.body.classList.remove('admin-surface'); document.title = title; robots.remove(); };
  }, []);
  useEffect(() => {
    const before = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', before); return () => window.removeEventListener('beforeunload', before);
  }, [dirty]);
  function failure(e: unknown) { const text = messageOf(e); setError(text); if (text.startsWith('Your session has ended')) setPhase('login'); }
  async function load() {
    const doc = await cmsRequest<Document>('places'); setData(doc); setPlaces(doc.places); setBaseline(JSON.stringify(doc.places)); setSelected(doc.places[0]?.id || ''); setPhase('editor');
  }
  useEffect(() => {
    let active = true;
    cmsRequest<{ authenticated: boolean; setupRequired: boolean }>('session').then(async session => {
      if (!active) return;
      if (session.authenticated) { try { await load(); } catch (e) { failure(e); setPhase('login'); } }
      else setPhase(session.setupRequired ? 'setup' : 'login');
    }).catch(e => { if (active) { failure(e); setPhase('login'); } });
    return () => { active = false; };
  }, []);
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await cmsRequest('login', { method: 'POST', body: JSON.stringify({ password }) }); setPassword(''); if (data) setPhase('editor'); else await load(); }
    catch (e) { failure(e); } finally { setBusy(false); }
  }
  async function logout() {
    if (dirty && !window.confirm('Discard unsaved changes and sign out?')) return;
    setBusy(true); setError('');
    try { await cmsRequest('logout', { method: 'POST', body: '{}' }); setData(null); setPlaces([]); setBaseline(''); setPhase('login'); setNotice('Signed out.'); }
    catch (e) { failure(e); } finally { setBusy(false); }
  }
  function update(change: Partial<Place>) { setPlaces(items => items.map(p => p.id === selected ? { ...p, ...change } : p)); setNotice(''); }
  function choose(id: string) { setSelected(id); setConfirmRemove(false); setError(''); }
  function addPlace() {
    const id = `place-${crypto.randomUUID()}`;
    setPlaces(items => [...items, { id, name: 'Untitled place', description: '', kind: 'Sunday morning', km: 0, lat: 23.2599, lon: 77.4126, published: false, media: [] }]); choose(id);
    requestAnimationFrame(() => editor.current?.focus());
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!data) return; setBusy(true); setError(''); setNotice('');
    try {
      const saved = await cmsRequest<{ revision: number; places: Place[] }>('places', { method: 'PUT', body: JSON.stringify({ revision: data.revision, places }) });
      setData({ ...data, ...saved }); setPlaces(saved.places); setBaseline(JSON.stringify(saved.places)); setNotice('Saved. Published places are now updated on the website.');
      if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel('hh-gallery'); channel.postMessage('updated'); channel.close(); }
    } catch (e) { failure(e); } finally { setBusy(false); }
  }
  function movePlace(direction: number) {
    const index = places.findIndex(p => p.id === selected), next = index + direction;
    if (next < 0 || next >= places.length) return; const reordered = [...places]; [reordered[index], reordered[next]] = [reordered[next], reordered[index]]; setPlaces(reordered);
  }
  function moveMedia(index: number, direction: number) {
    if (!place) return; const media = [...place.media], next = index + direction;
    if (next < 0 || next >= media.length) return; [media[index], media[next]] = [media[next], media[index]]; update({ media });
  }
  async function upload(files: FileList | null) {
    if (!files?.length || !place || !data) return;
    if (files.length + place.media.length > 40) { setError('Use up to 40 photos/videos per place.'); return; }
    setBusy(true); setError(''); const uploaded: Media[] = []; let sourceBytes = 0, sentBytes = 0;
    try {
      // Validate the whole selection before decoding or uploading any of it.
      Array.from(files).forEach(validateUpload);
      for (const file of Array.from(files)) {
        const type = validateUpload(file);
        setNotice(`Preparing ${uploaded.length + 1} of ${files.length}…`);
        const prepared = type === 'image' ? await compressPhoto(file) : file;
        setNotice(`${type === 'image' ? `Photo prepared: ${fileSize(file.size)} → ${fileSize(prepared.size)}. ` : ''}Uploading ${uploaded.length + 1} of ${files.length}${type === 'video' ? ' and optimizing video' : ''}…`);
        const signed = await cmsRequest<{ params: Record<string, string>; signature: string; ticket: string; apiKey: string; cloudName: string; type: string }>('sign-upload', { method: 'POST', body: JSON.stringify({ type, sourceBytes:file.size, bytes:prepared.size }) });
        const form = new FormData(); form.set('file', prepared); Object.entries(signed.params).forEach(([k,v]) => form.set(k,v)); form.set('signature', signed.signature); form.set('api_key', signed.apiKey);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/${type}/upload`, { method: 'POST', body: form });
        const result = await response.json(); if (!response.ok) throw new Error(`Could not upload ${file.name}. Check the format, size and Cloudinary limits.`);
        setNotice(`Checking upload ${uploaded.length + 1} of ${files.length}…`);
        const confirmed = await cmsRequest<{media:Media}>('confirm-upload',{method:'POST',body:JSON.stringify({ticket:signed.ticket})});
        uploaded.push(confirmed.media); sourceBytes += file.size; sentBytes += prepared.size;
      }
      setNotice(`Upload complete.${sentBytes < sourceBytes ? ` Photos reduced the upload by ${fileSize(sourceBytes-sentBytes)}.` : ''} Add captions, then save your changes.`);
    } catch (e) { failure(e); setNotice(uploaded.length ? `${uploaded.length} file(s) uploaded. Save to keep them in this place.` : ''); }
    finally { if (uploaded.length) setPlaces(items => items.map(p => p.id === place.id ? { ...p, media: [...p.media, ...uploaded] } : p)); setBusy(false); }
  }
  if (phase !== 'editor') return <main className="hh-admin admin-auth">
    <a className="admin-brand" href="/">Highway Hustlers<span>Bhopal</span></a>
    <div className="admin-auth-box">
      <LockKeyhole size={25} className="admin-accent" /><h1>Places & media.</h1><p>Sign in to look after the HH ride albums.</p>
      {phase === 'checking' ? <p role="status">Checking your session…</p> : phase === 'setup' ? <div className="admin-setup"><h2>One-time server setup</h2><p>Connect Neon in Vercel Storage and set <code>ADMIN_PASSWORD_HASH</code>. Cloudinary credentials enable the media library and uploads.</p><p>Setup instructions: <code>docs/gallery-admin.md</code> in the repository.</p><button onClick={() => location.reload()}>Check setup again</button></div> : <form onSubmit={login}>
        <label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e => setPassword(e.target.value)} autoFocus disabled={busy} />
        <button className="admin-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowUp size={16}/></button>
      </form>}
      {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <a className="admin-back" href="/"><ArrowLeft size={15}/> Back to the website</a>
    </div>
  </main>;
  return <main className="hh-admin">
    <header className="admin-top"><a className="admin-brand" href="/">Highway Hustlers<span>Places & media</span></a><div><a href="/#routes" target="_blank" rel="noreferrer" aria-label="View website"><span>View website</span> <ExternalLink size={15}/></a><button onClick={logout} disabled={busy}><LogOut size={15}/> Sign out</button></div></header>
    <div className="admin-layout">
      <aside className="admin-sidebar"><div className="admin-list-title"><h1>Places</h1><button aria-label="Add place" title="Add place" onClick={addPlace} disabled={busy || places.length >= 100}><Plus size={20}/></button></div>
        <p className="admin-muted">Your favourite mornings, in order.</p>
        <nav aria-label="Edit places">{places.map(p => <button key={p.id} className={p.id === selected ? 'is-current' : ''} aria-current={p.id === selected ? 'page' : undefined} onClick={() => choose(p.id)} disabled={busy}>
          {p.media[0] ? <img src={mediaUrl(p.media[0], data!.cloudName, 100, true)} alt=""/> : p.legacyId ? <img src={`/destinations/${p.legacyId}-thumb.webp`} alt=""/> : <MapPin size={20}/>}
          <span><strong>{p.name || 'Untitled place'}</strong><small>{p.published ? 'Published' : 'Draft'} · {p.media.length} {p.media.length === 1 ? 'photo / video' : 'photos / videos'}</small></span>
        </button>)}</nav>
        {!places.length && <p className="admin-empty">Add your first place to start a ride album.</p>}
        <button className="admin-add" onClick={addPlace} disabled={busy || places.length >= 100}><Plus size={16}/> Add a place</button>
      </aside>
      <form className="admin-editor" onSubmit={save}>
        <div className="admin-editor-heading"><div><p className="admin-muted">Our favourite mornings</p><h2 tabIndex={-1} ref={editor}>{place?.name || 'A new morning starts here.'}</h2></div><button className="admin-primary" disabled={busy || !dirty}><Save size={16}/>{busy ? 'Working…' : 'Save changes'}</button></div>
        <div className="admin-feedback" aria-live="polite">{error ? <p className="admin-error" role="alert">{error}</p> : notice ? <p className="admin-success"><Check size={16}/>{notice}</p> : <p className="admin-muted">{dirty ? 'Unsaved changes. Save when you’re ready.' : 'All changes saved.'}</p>}</div>
        {place && <fieldset disabled={busy} className="admin-fields">
          <section className="admin-section"><div className="admin-section-title"><h3>Place details</h3><label className="admin-publish"><input type="checkbox" checked={place.published} onChange={e => update({ published: e.target.checked })}/> Published</label></div>
            <div className="admin-two"><label>Place name<input required maxLength={80} value={place.name} onChange={e => update({ name: e.target.value })}/></label><label>Ride type<select value={place.kind} onChange={e => update({ kind: e.target.value as Place['kind'] })}><option>Sunday morning</option><option>Full day</option><option>Weekend</option></select></label></div>
            <label>Short description<textarea maxLength={400} rows={2} value={place.description} onChange={e => update({ description: e.target.value })} placeholder="What makes this stop worth the ride?"/></label>
            <div className="admin-three"><label>Distance from Bhopal (km)<input type="number" required min="0" max="5000" step="any" value={Number.isNaN(place.km) ? '' : place.km} onChange={e => update({ km: e.target.value === '' ? NaN : Number(e.target.value) })}/></label><label>Latitude<input type="number" required min="-90" max="90" step="any" value={Number.isNaN(place.lat) ? '' : place.lat} onChange={e => update({ lat: e.target.value === '' ? NaN : Number(e.target.value) })}/></label><label>Longitude<input type="number" required min="-180" max="180" step="any" value={Number.isNaN(place.lon) ? '' : place.lon} onChange={e => update({ lon: e.target.value === '' ? NaN : Number(e.target.value) })}/></label></div>
          </section>
          <section className="admin-section"><div className="admin-section-title"><div><h3>Photos & videos</h3><p className="admin-muted">First in the album is the cover. Only add media you have permission to publish.</p></div></div>
            {!data?.cloudReady && <p className="admin-warning">Cloudinary library and uploads need the API key and secret in your server environment. Existing published media continues to work.</p>}
            <div className="admin-media-actions"><label className={`admin-upload ${!data?.cloudReady ? 'is-disabled' : ''}`}><Upload size={17}/> Upload files<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/*,.heic,.heif" multiple disabled={!data?.cloudReady || busy} onChange={e => { void upload(e.target.files); e.target.value = ''; }}/></label><button type="button" disabled={!data?.cloudReady} onClick={() => setShowLibrary(true)}><ImagePlus size={17}/> Choose from Cloudinary</button></div>
            <p className="admin-muted admin-small">25 MB max per photo or video. Photos are compressed before upload; videos are optimized by Cloudinary. Your original files stay unchanged.</p>
            {place.media.length ? <div className="admin-media-list">{place.media.map((media,index) => <article className="admin-media-row" key={media.id}>
              <div className="admin-media-preview"><img src={mediaUrl(media, data!.cloudName, 320, true)} alt={media.caption || `Album ${media.type}`}/><span>{index === 0 ? 'Cover' : media.type === 'video' ? 'Video' : `${index+1}`}</span></div>
              <div><label>Caption / image description<input maxLength={300} value={media.caption} onChange={e => update({ media: place.media.map((m,i) => i === index ? { ...m, caption: e.target.value } : m) })}/></label><p className="admin-muted admin-filename">{media.publicId}</p><div className="admin-media-tools"><button type="button" aria-label={`Move item ${index+1} earlier`} disabled={index === 0} onClick={() => moveMedia(index,-1)}><ArrowUp size={15}/> Earlier</button><button type="button" aria-label={`Move item ${index+1} later`} disabled={index === place.media.length-1} onClick={() => moveMedia(index,1)}><ArrowDown size={15}/> Later</button><button type="button" aria-label={`Remove item ${index+1} from album`} onClick={() => update({ media: place.media.filter((_,i) => i !== index) })}><X size={15}/> Remove</button></div></div>
            </article>)}</div> : <div className="admin-empty"><ImagePlus size={25}/><p>{place.legacyId ? 'This place still uses its credited destination photo.' : 'No photos or videos yet.'}</p><span>{place.legacyId ? 'Choose your own media to turn it into an HH ride album.' : 'Upload a few moments from the ride, or choose existing Cloudinary files.'}</span></div>}
          </section>
          <section className="admin-section admin-place-actions"><div><h3>Place order</h3><button type="button" disabled={places[0]?.id === selected} onClick={() => movePlace(-1)}><ArrowUp size={15}/> Move earlier</button><button type="button" disabled={places[places.length-1]?.id === selected} onClick={() => movePlace(1)}><ArrowDown size={15}/> Move later</button></div>
            {confirmRemove ? <div className="admin-remove-confirm"><p>Remove this place? Cloudinary originals won’t be deleted.</p><button type="button" className="admin-danger" onClick={() => { const next = places.filter(p => p.id !== selected); setPlaces(next); choose(next[0]?.id || ''); }}>Remove place</button><button type="button" onClick={() => setConfirmRemove(false)}>Keep it</button></div> : <button type="button" className="admin-danger" onClick={() => setConfirmRemove(true)}><Trash2 size={15}/> Remove place</button>}
          </section>
        </fieldset>}
      </form>
    </div>
    {showLibrary && data && place && <MediaLibrary cloudName={data.cloudName} current={place.media} close={() => setShowLibrary(false)} add={media => { update({ media: [...place.media, ...media] }); setShowLibrary(false); }} onError={failure}/>}
  </main>;
}

function MediaLibrary({ cloudName, current, close, add, onError }: { cloudName: string; current: Media[]; close: () => void; add: (media: Media[]) => void; onError: (e: unknown) => void }) {
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
  return <dialog className="hh-admin admin-library" ref={dialog} onCancel={close} aria-labelledby="library-title"><header><div><h2 id="library-title">Cloudinary library</h2><p className="admin-muted">Choose moments for this place.</p></div><button onClick={close} aria-label="Close media library"><X size={22}/></button></header>
    <div className="admin-library-toolbar"><div role="group" aria-label="Media type"><button aria-pressed={type === 'image'} disabled={busy} onClick={() => load('image')}>Photos</button><button aria-pressed={type === 'video'} disabled={busy} onClick={() => load('video')}>Videos</button></div><input type="search" aria-label="Filter loaded media" placeholder="Filter filenames…" value={query} onChange={e=>setQuery(e.target.value)}/><button disabled={busy} onClick={()=>load(type,'',true)}>Refresh</button></div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    <div className="admin-library-grid" aria-busy={busy}>{library.media.filter(m=>m.type === type && m.publicId.toLowerCase().includes(query.toLowerCase())).map(media=><button className={chosen.has(media.id)?'is-picked':''} key={media.id} aria-pressed={chosen.has(media.id)} disabled={current.some(m=>m.id===media.id) || (current.length+picked.length>=40 && !chosen.has(media.id))} onClick={()=>setPicked(items=>items.some(m=>m.id===media.id)?items.filter(m=>m.id!==media.id):[...items,media])}><img src={mediaUrl(media,cloudName,280,true)} alt={media.publicId} loading="lazy"/>{chosen.has(media.id)&&<Check size={18}/>}<span>{media.publicId.split('/').pop()}</span></button>)}</div>
    {busy && <p role="status">Loading media…</p>}{!busy && !library.media.length && !error && <p className="admin-empty">No {type === 'image' ? 'photos' : 'videos'} in this Cloudinary account yet.</p>}
    <footer>{library.cursor && <button disabled={busy} onClick={()=>load(type,library.cursor)}>Load more</button>}<span className="admin-muted">{picked.length} selected</span><button className="admin-primary" disabled={!picked.length || busy} onClick={()=>add(picked)}>Add to album <Plus size={16}/></button></footer>
  </dialog>;
}
