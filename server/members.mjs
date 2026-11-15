import { createLocalStore, createPostgresStore } from './store.mjs';
import { digest, sessionToken } from './security.mjs';
import { authConfiguration, beginGoogle, finishGoogle, cookieValue, memberCookieName, oauthCookieName, privateCookie } from './google-login.mjs';
import { approved, completeProfile, mutateMembers, publicAccount, signInAccount, syncPublishedRide } from './member-state.mjs';
import { seedGarage } from '../shared/garage-seed.mjs';
import { enrollmentOpen, rideExpired } from './ride-lifecycle.mjs';
import { profileBikeDetails,profileBannerBikes,rideRoster,linkedBikeIds,profileBikeIds } from './profile-bikes.mjs';
import { adminEmails, googleAdminCredential } from './admin-access.mjs';
import { validPasswordHash, sessionCookie } from './security.mjs';
import { riderCardId,dreamBikeView,memberGallery } from './member-extras.mjs';

class MemberError extends Error { constructor(status,message){super(message);this.status=status;} }
const fail = (status,message) => { throw new MemberError(status,message); };
const field = (value,max) => { if(typeof value!=='string'||value.length>max||/[\u0000-\u001f]/.test(value)) fail(400,'Check your profile fields.');return value.trim(); };
export function createMembers(env = process.env, injectedStore, fetcher = fetch, identityVerifier) {
  const production = env.VERCEL === '1' || env.NODE_ENV === 'production';
  const config = authConfiguration(env), cloudName = env.CLOUDINARY_CLOUD_NAME || 'jr5po5s7';
  let pendingStore;
  const store = () => {
    if (!injectedStore && !env.DATABASE_URL && (production || !env.CMS_LOCAL_FILE)) fail(503,'Member sign-in is not configured yet.');
    return pendingStore ??= Promise.resolve(injectedStore || (!production && env.CMS_LOCAL_FILE ? createLocalStore(env.CMS_LOCAL_FILE) : createPostgresStore(env.DATABASE_URL))).catch(e=>{pendingStore=undefined;throw e;});
  };
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store, private');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    const redirect=url=>{res.statusCode=303;res.setHeader('Location',url);res.end();};
    try {
      const url = new URL(req.url,'http://localhost'), action = url.searchParams.get('action') || 'session';
      if (!['GET','POST','PUT'].includes(req.method)) fail(405,'Method not allowed.');
      if (action === 'session' && req.method === 'GET' && !cookieValue(req,memberCookieName(production))) return send(200,{account:null,googleReady:!!config});
      const db = await store();
      if (action === 'google' && req.method === 'GET') {
        if (!config) fail(503,'Google sign-in is not configured yet.');
        if (req.headers['sec-fetch-site'] === 'cross-site') fail(403,'Start sign-in from the HHR website.');
        const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
        if(await db.attempt(`google:${digest(ip)}`,Date.now())>20) fail(429,'Too many sign-in attempts. Try again in 15 minutes.');
        const rawIntent=url.searchParams.get('ride'),adminSignIn=url.searchParams.get('purpose')==='admin';
        if(adminSignIn&&(!adminEmails(env).size||!validPasswordHash(env.ADMIN_PASSWORD_HASH)))fail(503,'Administrator Google sign-in is not configured.');
        const intent=adminSignIn?'admin':/^ride-[a-f0-9]{24}$/.test(rawIntent||'')?rawIntent:'';
        const result=await beginGoogle(db,config,intent);res.setHeader('Set-Cookie',result.cookie);return redirect(result.url);
      }
      if (action === 'callback' && req.method === 'GET') {
        if(!config) fail(503,'Google sign-in is not configured yet.');
        try {
          const result=await finishGoogle(db,config,req,url,fetcher,identityVerifier);
          if(result.intent==='admin'){
            // Administrator sign-in never creates a member account. Only an exact,
            // verified Google email listed in ADMIN_EMAILS receives a dashboard session.
            if(!adminEmails(env).has(result.identity.email)||!validPasswordHash(env.ADMIN_PASSWORD_HASH)){res.setHeader('Set-Cookie',privateCookie(oauthCookieName(production),'',production,0));return redirect('/admin?error=google-admin');}
            const adminToken=sessionToken();await db.putSession(digest(adminToken),googleAdminCredential(env,result.identity.email),Date.now()+28800000);
            res.setHeader('Set-Cookie',[sessionCookie(adminToken,production),privateCookie(oauthCookieName(production),'',production,0)]);
            return redirect('/admin');
          }
          const accountId=await mutateMembers(db,state=>signInAccount(state,result.identity));
          const token=sessionToken();await db.putMemberSession(digest(token),accountId,Date.now()+604800000);
          res.setHeader('Set-Cookie',[privateCookie(memberCookieName(production),token,production,604800),privateCookie(oauthCookieName(production),'',production,0)]);
          return redirect(`/member${result.intent?`?ride=${result.intent}`:''}`);
        } catch {res.setHeader('Set-Cookie',privateCookie(oauthCookieName(production),'',production,0));return redirect('/member?error=google');}
      }
      if(req.method!=='GET') {
        let origin;try{origin=new URL(req.headers.origin);}catch{fail(403,'Use your HHR profile to make changes.');}
        const expected=config?.origin || (!production?`http://${req.headers.host}`:'');
        if(origin.origin!==expected||req.headers['x-hhr-member']!=='1'||(req.headers['content-type']||'').split(';')[0]!=='application/json')fail(403,'Use your HHR profile to make changes.');
      }
      const token=cookieValue(req,memberCookieName(production));
      const accountId=/^[a-f0-9]{64}$/.test(token)?await db.memberSession(digest(token)):null;
      if(action==='logout'&&req.method==='POST'){if(token)await db.logoutMember(digest(token));res.setHeader('Set-Cookie',privateCookie(memberCookieName(production),'',production,0));return send(200,{ok:true});}
      let memberGarage;
      if(action==='home'&&accountId){const live=await db.getGarage(seedGarage);memberGarage=live.garage;if(live.published?.snapshotRevision)await syncPublishedRide(db,live.published.upcomingRide||null,live.published.snapshotRevision);}
      const row=await db.getMemberState(),account=row.state.accounts.find(a=>a.id===accountId);
      if(action==='session'&&req.method==='GET')return send(200,{account:account?publicAccount({...account,status:approved(row.state,account)?'approved':account.status==='approved'?'suspended':account.status}):null,googleReady:!!config});
      if(!account)fail(401,'Sign in again to continue.');
      let body={};
      if(req.method!=='GET') {
        if(req.body!==undefined){const text=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(text)>12000)fail(413,'That update is too large.');body=JSON.parse(text);}
        else{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>12000)fail(413,'That update is too large.');}body=JSON.parse(raw||'{}');}
        if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Invalid request.');
        if(await db.attempt(`member-write:${accountId}`,Date.now())>100)fail(429,'Too many changes. Try again shortly.');
      }
      if(action==='home'&&req.method==='GET') {
        const notifications=row.state.notifications.filter(n=>!n.recipient||n.recipient===account.id).slice(0,60);
        const photos=await db.accountPhotos(account.id);
        const rideView=r=>({id:r.id,details:r.details,status:r.status,joined:r.participants.includes(account.id),enrollmentOpen:r.status==='open'&&enrollmentOpen(r.details),roster:rideRoster(row.state,r,account,memberGarage),bikeId:r.participants.includes(account.id)?r.bikeChoices?.[account.id]||null:null,photos:photos.filter(p=>p.rideId===r.id).map(p=>({id:p.id,status:p.status,media:p.media})),canUploadPhotos:approved(row.state,account)&&r.participants.includes(account.id)&&['open','closed','completed'].includes(r.status)});
        const rides=row.state.rides.filter(r=>r.status==='open'&&!rideExpired(r.details)).map(rideView);
        const pastRides=row.state.rides.filter(r=>r.participants.includes(account.id)&&(r.status==='completed'||r.status==='closed'||(r.status==='open'&&rideExpired(r.details)))).slice(-20).reverse().map(rideView);
        return send(200,{account:publicAccount({...account,...profileBikeDetails(account,memberGarage),status:approved(row.state,account)?'approved':account.status==='approved'?'suspended':account.status}),cardId:approved(row.state,account)?riderCardId(account):null,dreamBike:dreamBikeView(account,memberGarage),gallery:memberGallery(photos,row.state),bannerBikes:profileBannerBikes(account,memberGarage),rides,pastRides,notifications,cloudName,photoUploads:!!(env.CLOUDINARY_API_KEY&&env.CLOUDINARY_API_SECRET)});
      }
      if(action==='dream-bike'&&req.method==='PUT'){
        const name=field(body.name,180);
        await mutateMembers(db,state=>{const a=state.accounts.find(a=>a.id===accountId);if((a.dreamBikeName||'')===name)return;a.dreamBikeName=name;a.dreamBikeId=null;a.dreamBikeRequestedAt=name?new Date().toISOString():null;});
        return send(200,{ok:true});
      }
      if(action==='profile'&&req.method==='PUT') {
        const name=field(body.name,100),phone=field(body.phone,24);
        const bikeFields={};for(const [key,max]of [['bikeName',180],['bikeColour',100],['bikeNickname',60]])if(body[key]!==undefined)bikeFields[key]=field(body[key],max);
        let nicknames=null;
        if(body.bikeNicknames!==undefined){if(!body.bikeNicknames||typeof body.bikeNicknames!=='object'||Array.isArray(body.bikeNicknames)||Object.keys(body.bikeNicknames).length>6)fail(400,'Check your bike nicknames.');nicknames=Object.fromEntries(Object.entries(body.bikeNicknames).map(([id,value])=>[id,field(value,60)]));}
        const {garage}=await db.getGarage(seedGarage);
        if(!completeProfile({name,phone}))fail(400,'Enter your name and a valid phone number.');
        await mutateMembers(db,state=>{const a=state.accounts.find(a=>a.id===accountId);a.name=name;a.phone=phone;const linked=linkedBikeIds(a).filter(id=>garage.bikes.some(b=>b.id===id));a.bikeIds=linked;delete a.bikeId;const owned=profileBikeIds(a,garage);
          // Library and hero-lineup model and colour are admin-managed; only nicknames are the member's.
          for(const [key,value]of Object.entries(bikeFields)){if(!owned.length)a[key]=value;}
          if(nicknames){a.bikeNicknames={};for(const id of owned)if(nicknames[id]!==undefined)a.bikeNicknames[id]=nicknames[id];}if(a.status==='new'&&!state.allowed.includes(a.email)){a.status='pending';a.requestedAt=new Date().toISOString();}});
        return send(200,{ok:true});
      }
      if(action==='enroll'&&req.method==='POST') {
        if(!['join','leave'].includes(body.operation)||typeof body.rideId!=='string'||(body.bikeId!==undefined&&typeof body.bikeId!=='string'))fail(400,'Choose a ride and an action.');
        const {garage}=body.bikeId?await db.getGarage(seedGarage):{garage:null};
        await mutateMembers(db,state=>{
          const a=state.accounts.find(a=>a.id===accountId),ride=state.rides.find(r=>r.id===body.rideId);
          if(!ride||ride.status!=='open'||rideExpired(ride.details))fail(409,'This ride is no longer open.');
          if(body.operation==='leave'){ride.participants=ride.participants.filter(id=>id!==accountId);if(ride.bikeChoices)delete ride.bikeChoices[accountId];return;}
          if(!approved(state,a))fail(403,'Your HHR membership must be approved before joining a ride.');
          if(body.bikeId&&!profileBikeIds(a,garage).includes(body.bikeId))fail(400,'Choose one of the bikes on your profile.');
          const setBike=()=>{if(body.bikeId){ride.bikeChoices??={};ride.bikeChoices[accountId]=body.bikeId;}};
          // Already riding: only the chosen bike changes, so it stays editable after enrolment closes.
          if(ride.participants.includes(accountId)){setBike();return;}
          if(!completeProfile(a))fail(400,'Complete your name and phone number before joining.');
          if(!enrollmentOpen(ride.details))fail(409,'Enrolment is closed. Contact an HHR administrator.');
          ride.participants.push(accountId);setBike();
        });return send(200,{ok:true});
      }
      if(action==='read-notifications'&&req.method==='POST'){await mutateMembers(db,state=>{state.accounts.find(a=>a.id===accountId).seenAt=new Date().toISOString();});return send(200,{ok:true});}
      if(['sign-photo','confirm-photo'].includes(action)&&req.method==='POST')fail(410,'Profile photos now use the secure uploader. Refresh your profile and try again.');
      fail(404,'Not found.');
    }catch(error){const status=error instanceof SyntaxError?400:error.status||503;send(status,{error:error.status?error.message:status===400?'Invalid JSON request.':'The member service is unavailable. Please try again shortly.'});}
  };
}
