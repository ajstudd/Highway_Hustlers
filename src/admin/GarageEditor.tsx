import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Bike as BikeIcon, Eye, Plus, Upload, Users, X } from 'lucide-react';
import { bikeFrameUrl, publicRiders, type Bike, type Garage, type PublicRider } from '../../shared/garage.mjs';
import { BikeSpinner } from '../components/hero/BikeSpinner';
import { Showroom } from '../components/hero/Hero';
import type { Section } from './types';

type Props = { section: Section; garage: Garage; cloudName: string; cloudReady: boolean; busy: boolean; dirty: boolean; change: (garage: Garage) => void; upload: (bikeId: string, files: File[]) => Promise<void>; migrate: () => Promise<void> };
export default function GarageEditor({ section, garage, cloudName, cloudReady, busy, dirty, change, upload, migrate }: Props) {
  const [memberId, setMemberId] = useState(garage.members[0]?.id || ''), [bikeId, setBikeId] = useState(garage.bikes[0]?.id || ''), [preview, setPreview] = useState(false);
  const member = garage.members.find(m => m.id === memberId), bike = garage.bikes.find(b => b.id === bikeId);
  const remaining = garage.bikes.reduce((n,b) => n+b.frames.filter(f => f.source === 'local').length, 0);
  const riders = useMemo(() => publicRiders(garage), [garage]);
  const setMember = (value: Partial<NonNullable<typeof member>>) => change({ ...garage, members: garage.members.map(m => m.id === memberId ? { ...m, ...value } : m) });
  const setBike = (value: Partial<Bike>) => change({ ...garage, bikes: garage.bikes.map(b => b.id === bikeId ? { ...b, ...value } : b) });
  const framePreview = useMemo(() => bike?.frames.length ? { ...bike, name: 'Preview', frames: bike.frames.length, frameAssets: bike.frames } as PublicRider : null, [bike]);
  function addMember() {
    const id = `member-${crypto.randomUUID()}`;
    change({ ...garage, members: [...garage.members, { id, name: 'New member', active: true, role: '', line: '' }] }); setMemberId(id);
  }
  function addBike() {
    const id = `bike-${crypto.randomUUID()}`;
    change({ ...garage, bikes: [...garage.bikes, { id, brand: '', model: 'Untitled bike', colorName: '', cc: 0, character: '', glow: '#82909c', status: 'draft', dir: 1, facing: 'right', frames: [] }] }); setBikeId(id);
  }
  function move(index: number, direction: number) {
    const items = [...garage.lineup], next = index+direction;
    if (next < 0 || next >= items.length) return;
    [items[index],items[next]] = [items[next],items[index]]; change({ ...garage, lineup: items });
  }
  function moveFrame(index: number, direction: number) {
    if (!bike) return;
    const frames = [...bike.frames], next = index+direction;
    if (next < 0 || next >= frames.length) return;
    [frames[index],frames[next]] = [frames[next],frames[index]]; setBike({ frames });
  }
  return <div hidden={section === 'places'}>
    {section === 'members' && <div className="admin-layout">
      <aside className="admin-sidebar"><div className="admin-list-title"><h1>Members</h1><button type="button" aria-label="Add member" onClick={addMember} disabled={busy || garage.members.length >= 150}><Plus size={20}/></button></div><p className="admin-muted">People first. Bikes can be reassigned.</p>
        <nav aria-label="Edit members">{garage.members.map(m => <button key={m.id} type="button" className={memberId === m.id ? 'is-current' : ''} aria-current={memberId === m.id ? 'page' : undefined} onClick={() => setMemberId(m.id)} disabled={busy}><Users size={19}/><span><strong>{m.name}</strong><small>{m.active ? 'Active' : 'Inactive'} · {garage.lineup.filter(e => e.memberId === m.id).length} bike entries</small></span></button>)}</nav>
      </aside>
      <section className="admin-editor"><div className="admin-editor-heading"><div><h2>{member?.name || 'Add a member'}</h2><p className="admin-muted">Saved changes go live only when you publish.</p></div></div>
        {member ? <fieldset disabled={busy} className="admin-fields"><section className="admin-section"><div className="admin-section-title"><h3>Member details</h3><label className="admin-publish"><input type="checkbox" checked={member.active} onChange={e => setMember({ active: e.target.checked })}/> Active member</label></div>
          <label>Name<input maxLength={80} value={member.name} onChange={e => setMember({ name: e.target.value })}/></label>
          <div className="admin-two"><label>Role <span className="admin-muted">Optional</span><input maxLength={80} value={member.role} onChange={e => setMember({ role: e.target.value })}/></label><label>Short line <span className="admin-muted">Optional</span><input maxLength={160} value={member.line} onChange={e => setMember({ line: e.target.value })}/></label></div>
          {!member.active && <p className="admin-warning">This member’s entries will be excluded from the next publication. Their bikes remain in the library.</p>}
        </section><section className="admin-section"><h3>Assigned bikes</h3><ul className="admin-assigned">{garage.lineup.filter(e => e.memberId === member.id).map(e => <li key={e.id}>{garage.bikes.find(b => b.id === e.bikeId)?.model} <span className="admin-muted">{e.visible ? '' : '· Hidden entry'}</span></li>)}</ul><p className="admin-muted admin-small">Use Hero lineup to change an assignment.</p></section></fieldset> : <div className="admin-empty"><Users/><p>Add a member, then assign a bike in Hero lineup.</p></div>}
      </section>
    </div>}
    {section === 'bikes' && <div className="admin-layout">
      <aside className="admin-sidebar"><div className="admin-list-title"><h1>Bike library</h1><button type="button" aria-label="Add bike" onClick={addBike} disabled={busy || garage.bikes.length >= 150}><Plus size={20}/></button></div><p className="admin-muted">One image set. Any member assignment.</p>
        <nav aria-label="Edit bikes">{garage.bikes.map(b => <button type="button" key={b.id} className={bikeId === b.id ? 'is-current' : ''} aria-current={bikeId === b.id ? 'page' : undefined} onClick={() => setBikeId(b.id)} disabled={busy}>{b.frames[0] ? <img src={bikeFrameUrl(b.frames[0], cloudName, 160)} alt="" loading="lazy"/> : <BikeIcon size={19}/>}<span><strong>{b.model || 'Untitled bike'}</strong><small>{b.colorName || 'Colour not set'} · {b.status}</small></span></button>)}</nav>
      </aside>
      <section className="admin-editor"><div className="admin-editor-heading"><div><h2>{bike?.model || 'Add a bike'}</h2><p className="admin-muted">Keep original paint, transparent edges and ordered views.</p></div></div>
        {bike ? <fieldset disabled={busy} className="admin-fields">
          <section className="admin-section"><div className="admin-section-title"><h3>Bike details</h3><label>Status<select value={bike.status} onChange={e => setBike({ status: e.target.value as Bike['status'] })}><option value="draft">Draft</option><option value="published">Published</option><option value="hidden">Hidden</option></select></label></div>
            <div className="admin-two"><label>Brand<input maxLength={80} value={bike.brand} onChange={e => setBike({ brand: e.target.value })}/></label><label>Model<input maxLength={80} value={bike.model} onChange={e => setBike({ model: e.target.value })}/></label><label>Colour name<input maxLength={100} value={bike.colorName} onChange={e => setBike({ colorName: e.target.value })}/></label><label>Engine (cc)<input type="number" min={0} max={5000} value={Number.isNaN(bike.cc) ? '' : bike.cc} onChange={e => setBike({ cc: e.target.value === '' ? NaN : Number(e.target.value) })}/></label><label>Bike category<input maxLength={100} value={bike.character} onChange={e => setBike({ character: e.target.value })}/></label><label>Hero glow<input type="color" value={bike.glow} onChange={e => setBike({ glow: e.target.value })}/></label></div>
            <p className="admin-muted admin-small admin-field-note">Draft and hidden bikes never appear in the public lineup. Publishing a bike also requires a visible entry and an active member.</p>
          </section>
          <section className="admin-section"><div className="admin-section-title"><h3>Rotation preview</h3><span className="admin-muted admin-small">{bike.frames.length} prepared views</span></div>
            {framePreview ? <div className="admin-bike-preview"><BikeSpinner key={`${bike.id}-${bike.frames.length}`} rider={framePreview} cloudName={cloudName}/></div> : <div className="admin-empty"><BikeIcon/><p>Add prepared images to preview this bike.</p></div>}
            <div className="admin-two"><label>Opening view faces<select value={bike.facing} onChange={e => setBike({ facing: e.target.value as Bike['facing'] })}><option value="right">Right</option><option value="left">Left</option></select></label><label>Increasing frame numbers bring the…<select value={bike.dir} onChange={e => setBike({ dir: Number(e.target.value) as 1 | -1 })}><option value="1">Rear toward the viewer</option><option value="-1">Front toward the viewer</option></select></label></div>
          </section>
          <section className="admin-section"><div className="admin-section-title"><h3>Prepared images</h3><label className={`admin-upload ${!cloudReady ? 'is-disabled' : ''}`}><Upload size={16}/> {bike.frames.length ? 'Replace image set' : 'Upload image set'}<input type="file" accept="image/png,image/webp,.png,.webp" multiple disabled={!cloudReady || busy} onChange={e => { const files = Array.from(e.target.files || []); e.target.value = ''; if (files.length && (!bike.frames.length || window.confirm('Replace this bike’s draft image set? The live site and original files stay unchanged until publishing.'))) void upload(bike.id, files); }}/></label></div>
            <p className="admin-muted admin-small">Transparent PNG/WebP, 1200 × 720, below 10 MB each. Select all angles together; filenames set their initial order. One photo uses tilt, not an invented rotation. Uploads stay in Cloudinary when removed here.</p>
            <ol className="admin-frame-grid">{bike.frames.map((frame, i) => <li key={`${bike.id}-${i}`}><img src={bikeFrameUrl(frame, cloudName, 160)} alt={`Rotation frame ${i+1}`} loading="lazy"/><div><span>{String(i+1).padStart(2,'0')}</span><button type="button" aria-label={`Move frame ${i+1} earlier`} disabled={i === 0} onClick={() => moveFrame(i,-1)}><ArrowUp size={13}/></button><button type="button" aria-label={`Move frame ${i+1} later`} disabled={i === bike.frames.length-1} onClick={() => moveFrame(i,1)}><ArrowDown size={13}/></button><button type="button" aria-label={`Remove frame ${i+1}`} onClick={() => setBike({ frames: bike.frames.filter((_,j) => j !== i), status: 'draft' })}><X size={13}/></button></div></li>)}</ol>
          </section>
        </fieldset> : <div className="admin-empty"><BikeIcon/><p>Add a bike to prepare its images and details.</p></div>}
        <section className="admin-section"><h3>Cloudinary migration</h3><p className="admin-muted admin-field-note">{remaining ? `${remaining} original frames remain on this website. Import them in resumable batches; completed batches are saved as drafts. Nothing is published or deleted.` : 'All library frames are already hosted on Cloudinary.'}</p><button type="button" onClick={() => void migrate()} disabled={busy || dirty || !cloudReady || !remaining}><Upload size={16}/> Move existing frames to Cloudinary</button>{dirty && <p className="admin-muted admin-small">Save your draft before starting the migration.</p>}{!cloudReady && <p className="admin-warning">Migration and new uploads need the existing Cloudinary credentials on the server.</p>}</section>
      </section>
    </div>}
    {section === 'lineup' && <section className="admin-editor admin-lineup-editor"><div className="admin-editor-heading"><div><h1>Hero lineup</h1><p className="admin-muted">Assign the bikes, set the order, choose who appears.</p></div><button type="button" disabled={!riders.length || busy} onClick={() => setPreview(true)}><Eye size={16}/> Preview hero</button></div>
      <fieldset disabled={busy} className="admin-fields"><div className="admin-lineup-list">{garage.lineup.map((entry, index) => {
        const assigned = garage.members.find(m => m.id === entry.memberId), machine = garage.bikes.find(b => b.id === entry.bikeId);
        const visible = entry.visible && assigned?.active && machine?.status === 'published';
        const update = (value: Partial<typeof entry>) => change({ ...garage, lineup: garage.lineup.map(e => e.id === entry.id ? { ...e, ...value } : e) });
        return <article className="admin-lineup-row" key={entry.id}>
          <span className="admin-lineup-number">{String(index+1).padStart(2,'0')}</span>
          <label>Member<select value={entry.memberId} onChange={e => update({ memberId: e.target.value })}>{garage.members.map(m => <option key={m.id} value={m.id}>{m.name}{m.active ? '' : ' · inactive'}</option>)}</select></label>
          <label>Bike<select value={entry.bikeId} onChange={e => update({ bikeId: e.target.value })}>{garage.bikes.map(b => <option key={b.id} value={b.id}>{b.brand} {b.model} · {b.colorName || 'Colour not set'}{b.status === 'published' ? '' : ` · ${b.status}`}</option>)}</select></label>
          <div><label className="admin-publish"><input type="checkbox" checked={entry.visible} onChange={e => update({ visible: e.target.checked })}/> Show entry</label><small className="admin-muted">{visible ? 'Included on publish' : !assigned?.active ? 'Member inactive' : machine?.status !== 'published' ? 'Bike not published' : 'Hidden'}</small></div>
          <div className="admin-lineup-tools"><button type="button" aria-label={`Move entry ${index+1} earlier`} disabled={index === 0} onClick={() => move(index,-1)}><ArrowUp size={16}/></button><button type="button" aria-label={`Move entry ${index+1} later`} disabled={index === garage.lineup.length-1} onClick={() => move(index,1)}><ArrowDown size={16}/></button><button type="button" aria-label={`Remove entry ${index+1}`} onClick={() => change({ ...garage, lineup: garage.lineup.filter(e => e.id !== entry.id) })}><X size={16}/></button></div>
        </article>;
      })}</div>
      {!garage.lineup.length && <div className="admin-empty"><BikeIcon/><p>No bikes are selected for the hero.</p><span>Add an entry, or publish an empty lineup to show the HH introduction without bikes.</span></div>}
      <button className="admin-lineup-add" type="button" disabled={!garage.members.length || !garage.bikes.length || garage.lineup.length >= 200} onClick={() => {
        const pair = garage.members.flatMap(m => garage.bikes.map(b => ({ memberId: m.id, bikeId: b.id }))).find(p => !garage.lineup.some(e => e.memberId === p.memberId && e.bikeId === p.bikeId));
        if (pair) change({ ...garage, lineup: [...garage.lineup, { id: `entry-${crypto.randomUUID()}`, ...pair, visible: true }] });
      }}><Plus size={16}/> Add hero entry</button></fieldset>
    </section>}
    {preview && <HeroPreview riders={riders} cloudName={cloudName} close={() => setPreview(false)}/>}
  </div>;
}
function HeroPreview({ riders, cloudName, close }: { riders: PublicRider[]; cloudName: string; close: () => void }) {
  // A portal preserves the real hero typography instead of inheriting admin form styles.
  return createPortal(<dialog className="hh-hero-preview" ref={el => { if (el && !el.open) el.showModal(); }} onCancel={close}><header><span>Draft preview · not published</span><button type="button" onClick={close} aria-label="Close hero preview"><X size={20}/></button></header><Showroom riders={riders} cloudName={cloudName}/></dialog>, document.body);
}
