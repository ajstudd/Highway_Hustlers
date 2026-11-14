import { useEffect, useState, type FormEvent } from 'react';
import { Check, RefreshCw, UserPlus, X } from 'lucide-react';
import { cmsRequest } from '../lib/gallery';
import type { MemberAccount } from '../member/api';
import type { UpcomingRide } from '../../shared/upcoming-ride.mjs';
type MemberRide={id:string;details:UpcomingRide;status:string;participants:MemberAccount[]};
type LibraryBike={id:string;brand:string;model:string;colorName:string;frames:number;status:string};
type Workspace={accounts:MemberAccount[];allowed:string[];rides:MemberRide[];bikes:LibraryBike[]};
export default function MembershipEditor(){
  const [data,setData]=useState<Workspace|null>(null),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[picked,setPicked]=useState<Record<string,string>>({});
  async function load(){setData(await cmsRequest<Workspace>('membership'));}
  useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
  async function action(route:string,body:unknown,message:string){setBusy(true);setError('');setNotice('');try{await cmsRequest(route,{method:'POST',body:JSON.stringify(body)});await load();setNotice(message);}catch(e){setError(e instanceof Error?e.message:'Please try again.');}finally{setBusy(false);}}
  async function addEmail(e:FormEvent){e.preventDefault();await action('membership',{operation:'allow',email},'Email approved.');setEmail('');}
  return <section className="admin-editor admin-membership"><div className="admin-editor-heading"><div><h1>HHR membership</h1><p className="admin-muted">Account approval and enrolments are private and take effect immediately. They do not need website publishing.</p></div><button disabled={busy} onClick={()=>void action('sync-member-ride',{},'Published ride synced to member profiles.')}><RefreshCw size={16}/>Sync published ride</button></div>
    {error&&<p className="admin-error" role="alert">{error}</p>}{notice&&<p className="admin-success" role="status"><Check size={16}/>{notice}</p>}
    {!data?<p role="status">Loading membership…</p>:<>
      <section className="admin-section"><h2>Membership requests</h2><p className="admin-muted admin-field-note">New Google accounts remain pending until their profile is complete and you approve them. Phone numbers stay out of the public website.</p>
        {!data.accounts.some(a=>a.status==='pending')&&<p className="admin-muted">No requests waiting.</p>}
        <div className="admin-requests">{data.accounts.filter(a=>a.status==='pending').map(a=><article key={a.id}><div><h3>{a.name}</h3><p>{a.email}</p><p className="admin-muted">{a.phone}</p><p className="admin-muted">{a.bikeName||'No bike details yet'}{a.bikeColour&&` · ${a.bikeColour}`}{a.bikeNickname&&` · ${a.bikeNickname}`}</p></div><div className="admin-media-tools"><button disabled={busy} onClick={()=>void action('membership',{operation:'approve',accountId:a.id},'Member approved.')}><Check size={16}/>Approve</button><button disabled={busy} onClick={()=>{if(window.confirm(`Decline ${a.name}’s membership request?`))void action('membership',{operation:'reject',accountId:a.id},'Request declined.');}}><X size={16}/>Decline</button></div></article>)}</div>
      </section>
      <section className="admin-section"><h2>Allowed emails</h2><p className="admin-muted admin-field-note">Existing HHR members can be approved here before their first sign-in. Use the exact Gmail or Google Workspace email. Removing an email pauses ride access and removes open ride entries.</p><form className="admin-allow-form" onSubmit={addEmail}><label>Google account email<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label><button className="admin-primary" disabled={busy||!email}><UserPlus size={16}/>Allow member</button></form>
        <ul className="admin-allowed">{data.allowed.map(email=><li key={email}><span>{email}</span><button aria-label={`Remove allowed email ${email}`} disabled={busy} onClick={()=>{if(window.confirm(`Pause membership access for ${email}? They will also be removed from open rides.`))void action('membership',{operation:'remove-allow',email},'Membership access paused.');}}><X size={15}/>Remove</button></li>)}</ul>
      </section>
      <section className="admin-section"><h2>Ride enrolments</h2><p className="admin-muted admin-field-note">Only published rides accept entries. Members obey the enrolment window; admins can add approved members after the deadline.</p>
        {!data.rides.length&&<p className="admin-muted">Publish a dated upcoming ride to open enrolment.</p>}
        {data.rides.slice().reverse().map(ride=><article className="admin-member-ride" key={ride.id}><header><div><h3>{ride.details.location}</h3><p className="admin-muted">{ride.details.date||'Date not set'} · {ride.status} · {ride.participants.length} enrolled</p></div></header>
          {ride.participants.length>0?<ul>{ride.participants.map(a=><li key={a.id}><div><strong>{a.name}</strong><p>{a.email} · {a.phone}</p><p className="admin-muted">{a.bikeName||'Bike details not added'}{a.bikeColour&&` · ${a.bikeColour}`}{a.bikeNickname&&` · ${a.bikeNickname}`}</p></div>{ride.status==='open'&&<button disabled={busy} aria-label={`Remove ${a.name} from ${ride.details.location}`} onClick={()=>void action('ride-participant',{operation:'remove',rideId:ride.id,accountId:a.id},'Entry removed.')}><X size={15}/>Remove</button>}</li>)}</ul>:<p className="admin-muted admin-field-note">No members enrolled yet.</p>}
          {ride.status==='open'&&<div className="admin-allow-form"><label>Add an approved member<select value={picked[ride.id]||''} disabled={busy} onChange={e=>setPicked({...picked,[ride.id]:e.target.value})}><option value="">Choose a member</option>{data.accounts.filter(a=>a.status==='approved'&&a.profileComplete&&data.allowed.includes(a.email)&&!ride.participants.some(p=>p.id===a.id)).map(a=><option value={a.id} key={a.id}>{a.name} · {a.email}</option>)}</select></label><button disabled={busy||!picked[ride.id]} onClick={()=>void action('ride-participant',{operation:'add',rideId:ride.id,accountId:picked[ride.id]},'Member added.')}><UserPlus size={16}/>Add to ride</button></div>}
        </article>)}
      </section>
      <section className="admin-section"><h2>Profiles & bikes</h2><p className="admin-muted admin-field-note">Link a prepared bike to give this profile its own interactive banner. This does not change hero assignments or membership approval.</p><div className="admin-requests">{data.accounts.map(a=><article key={a.id}><div><h3>{a.name||'Profile incomplete'}</h3><p>{a.email}</p><p className="admin-muted">{a.phone||'Phone not added'} · {a.status}</p><p className="admin-muted">{a.bikeName||'Bike not added'}{a.bikeColour&&` · ${a.bikeColour}`}{a.bikeNickname&&` · ${a.bikeNickname}`}</p></div><ProfileBikeAssignment account={a} bikes={data.bikes} busy={busy} assign={bikeId=>action('assign-profile-bike',{accountId:a.id,bikeId},bikeId?'Profile bike linked.':'Profile bike unlinked.')}/></article>)}</div></section>
    </>}
  </section>;
}

function ProfileBikeAssignment({account,bikes,busy,assign}:{account:MemberAccount;bikes:LibraryBike[];busy:boolean;assign:(id:string)=>Promise<void>}){
  const [bikeId,setBikeId]=useState(account.bikeId||'');
  useEffect(()=>setBikeId(account.bikeId||''),[account.bikeId]);
  return <form className="admin-profile-bike" onSubmit={e=>{e.preventDefault();void assign(bikeId);}}><label>Bike for {account.name||account.email}<select disabled={busy} value={bikeId} onChange={e=>setBikeId(e.target.value)}><option value="">No library bike · self-reported details</option>{bikes.map(b=><option key={b.id} value={b.id}>{b.brand} {b.model} · {b.colorName} · {b.frames>1?`${b.frames} views`:'single photo'}{b.status==='published'?'':` · ${b.status}`}</option>)}</select></label><button disabled={busy||bikeId===(account.bikeId||'')}>{bikeId?'Link bike':'Unlink bike'}</button></form>;
}
