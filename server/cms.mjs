import seed from '../src/data/gallery-seed.json' with { type: 'json' };
import { createPostgresStore, createLocalStore } from './store.mjs';
import { cleanPlaces, cleanMedia } from './content.mjs';
import { resolveMapsLink } from './maps-link.mjs';
import { digest, validPasswordHash, verifyPassword, sessionToken, readToken, sessionCookie, sameOrigin } from './security.mjs';
import { validateUploadSize, uploadParameters, uploadSignature, uploadTicket, verifyUploadTicket, policy } from './uploads.mjs';
import { cleanGarage } from '../shared/garage.mjs';
import { createPublisher, snapshotOf, seedGarage, localFramePaths } from './publication.mjs';
import { reviewPublication } from './publication-review.mjs';
import { validateSnapshot } from '../shared/public-snapshot.mjs';
import { signBikeBatch, verifyBikeBatch, confirmedBikeFrame } from './bike-uploads.mjs';
import { cleanUpcomingRide } from '../shared/upcoming-ride.mjs';
import { archiveExpiredRide, identifiedRide, rideExpired } from './ride-lifecycle.mjs';
import { approved, canRemoveUnconfirmedAccount, completeProfile, emailOf, mutateMembers, notice, publicAccount, syncPublishedRide } from './member-state.mjs';
import { profileBikeDetails, linkedBikeIds, preparedBike, ridingBike, heroBikeIds, profileBikeIds, MAX_PROFILE_BIKES } from './profile-bikes.mjs';
import { adminCredentials, adminEmails, passwordCredential } from './admin-access.mjs';
import { authConfiguration } from './google-login.mjs';

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (status, message) => { throw new HttpError(status, message); };
function allowMemberEmail(state, email) {
  if (state.allowed.includes(email)) return;
  if (state.allowed.length >= 500) fail(400, 'Use up to 500 approved emails.');
  state.allowed.push(email);
}
function approveMembership(state, account, message) {
  allowMemberEmail(state, account.email);
  account.status = 'approved';
  account.membershipConfirmed = true;
  notice(state, 'Welcome to HHR', message, account.id);
}
export function createCms(env = process.env, injectedStore, fetcher = fetch) {
  const production = env.VERCEL === '1' || env.NODE_ENV === 'production';
  const local = !production && env.CMS_LOCAL_FILE;
  const configured = !!(env.DATABASE_URL || local || injectedStore) && validPasswordHash(env.ADMIN_PASSWORD_HASH);
  const cloudName = env.CLOUDINARY_CLOUD_NAME || 'jr5po5s7';
  const cloudReady = !!(env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  const publisher = createPublisher(env, fetcher);
  async function publicationReview(db, places, garage) {
    let live;
    try { live = await publisher.readLive(garage.published?.snapshotRevision); }
    catch { fail(503, 'The current website publication could not be verified. Try opening the review again shortly.'); }
    const closedRides = new Set();
    if (places.upcomingRide?.id) {
      const { state } = await db.getMemberState();
      for (const ride of state.rides) if (['completed', 'cancelled'].includes(ride.status)) closedRides.add(ride.id);
    }
    return reviewPublication(live, places, garage, closedRides);
  }
  let storePromise;
  const store = () => {
    if (!env.DATABASE_URL && !local && !injectedStore) fail(503, 'Connect a Neon database in Vercel Storage to enable the dashboard.');
    return storePromise ??= Promise.resolve(injectedStore || (local ? createLocalStore(local) : createPostgresStore(env.DATABASE_URL))).catch(e => { storePromise = undefined; throw e; });
  };
  async function cloud(path, timeout = 15000) {
    if (!cloudReady) fail(503, 'Add the Cloudinary API key and secret to the server environment to browse or upload media.');
    const response = await fetcher(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${path}`, { headers: { Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString('base64')}` }, signal: AbortSignal.timeout(timeout) });
    const result = await response.json();
    if (!response.ok) fail(response.status === 429 ? 429 : 502, response.status === 429 ? 'Cloudinary is rate-limiting requests. Wait a moment before refreshing.' : 'Cloudinary could not load the library. Check the server credentials.');
    return result;
  }
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const action = url.searchParams.get('action') || 'public';
      if (!['GET', 'POST', 'PUT'].includes(req.method)) { res.setHeader('Allow', 'GET, POST, PUT'); fail(405, 'Method not allowed.'); }
      if (req.method !== 'GET' && !sameOrigin(req, production)) fail(403, 'This request must come from the HH dashboard.');
      let body = {};
      if (req.method !== 'GET') {
        if (req.body !== undefined) {
          if (Buffer.byteLength(JSON.stringify(req.body)) > 2000000) fail(413, 'That update is too large. Use fewer items.');
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } else {
          let content = ''; for await (const chunk of req) { content += chunk; if (Buffer.byteLength(content) > 2000000) fail(413, 'That update is too large.'); }
          body = content ? JSON.parse(content) : {};
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid request.');
      }
      if (action === 'public' && req.method === 'GET') {
        // Deliberately before authentication/store(): public reads NEVER wake Neon.
        if (publisher.development) return send(200, await publisher.readLocal());
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600');
        res.setHeader('Location', publisher.snapshotUrl); res.statusCode = 302; return res.end();
      }
      const googleAdmin = configured && adminEmails(env).size > 0 && !!authConfiguration(env);
      if (action === 'session' && req.method === 'GET' && !configured) return send(200, { authenticated: false, setupRequired: true, googleAdmin: false });
      if (!configured) fail(503, 'Finish the server setup before signing in: database and admin password hash are required.');
      const db = await store(), credential = passwordCredential(env);
      if (action === 'login' && req.method === 'POST') {
        const ip = production ? String(req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim() : req.socket?.remoteAddress || 'local';
        const now = Date.now();
        const [attempts, total] = await Promise.all([db.attempt(`ip:${digest(ip)}`, now), db.attempt('global', now)]);
        if (attempts > 10 || total > 100) { res.setHeader('Retry-After', '900'); fail(429, 'Too many sign-in attempts. Try again in 15 minutes.'); }
        if (!await verifyPassword(body.password, env.ADMIN_PASSWORD_HASH)) fail(401, 'That password is not correct.');
        const token = sessionToken(); await db.putSession(digest(token), credential, now + 28800000);
        res.setHeader('Set-Cookie', sessionCookie(token, production));
        return send(200, { authenticated: true });
      }
      const token = readToken(req, production);
      const authenticated = !!token && await db.session(digest(token), adminCredentials(env));
      if (action === 'session' && req.method === 'GET') return send(200, { authenticated, setupRequired: false, googleAdmin });
      if (action === 'logout' && req.method === 'POST') {
        if (token) await db.logout(digest(token));
        res.setHeader('Set-Cookie', sessionCookie('', production, true)); return send(200, { authenticated: false });
      }
      if (!authenticated) fail(401, 'Your session has ended. Sign in again; unsaved work is still in this tab.');
      if(action==='resolve-place'&&req.method==='POST'){
        if(await db.attempt('maps-link:admin',Date.now())>30)fail(429,'Too many map lookups. Please wait a few minutes.');
        try{return send(200,await resolveMapsLink(body.url,fetcher));}catch(error){fail(400,error.message?.startsWith('This link')||error.message?.startsWith('Use ')||error.message?.startsWith('Paste ')?error.message:'Could not resolve this Maps link. Try its full place URL.');}
      }
      if(action==='ride-photos'&&req.method==='GET'){
        const status=url.searchParams.get('status')||'';if(!['','pending','approved','rejected'].includes(status))fail(400,'Invalid photo status.');
        const offset=Number(url.searchParams.get('offset')||0);if(!Number.isSafeInteger(offset)||offset<0||offset>100000)fail(400,'Invalid catalogue page.');
        const rideId=url.searchParams.get('ride')||'';
        if(rideId&&!/^[a-z0-9-]{1,80}$/.test(rideId))fail(400,'Choose a ride to filter photos.');
        const [photos,{state}]=await Promise.all([db.reviewPhotos(status,offset,rideId),db.getMemberState()]);
        const rides=state.rides.map(ride=>({id:ride.id,name:ride.details.location,date:ride.details.date})).reverse();
        return send(200,{photos:photos.slice(0,50).map(p=>({...p,name:state.accounts.find(a=>a.id===p.accountId)?.name||'Former member',ride:state.rides.find(r=>r.id===p.rideId)?.details.location||p.rideId})),more:photos.length>50,rides});
      }
      if(action==='moderate-ride-photo'&&req.method==='POST'){
        if(!['pending','approved','rejected'].includes(body.expected)||!['approved','rejected'].includes(body.status))fail(400,'Choose a review decision.');
        if(!await db.moderatePhoto(body.id,body.status,body.expected))fail(409,'This photo changed. Refresh the catalogue.');return send(200,{ok:true});
      }
      if(action==='add-ride-photo'&&req.method==='POST'){
        const photo=await db.photoById(body.id);if(photo?.purpose!=='ride'||photo.status!=='approved'||!photo.media)fail(400,'Approve the photo before adding it to an album.');
        const current=await db.get(seed);if(current.revision!==body.revision)fail(409,'Content changed. Reload before adding a photo.');
        const place=current.places.find(p=>p.id===body.placeId);if(!place)fail(400,'Choose an album.');
        if(!place.media.some(m=>m.id===photo.media.id)){if(place.media.length>=40)fail(400,'This album already has 40 items.');place.media.push(photo.media);}
        const saved=await db.save(cleanPlaces(current.places),body.revision);if(!saved)fail(409,'Content changed. Reload before adding a photo.');return send(200,saved);
      }
      if (action === 'editor' && req.method === 'GET') {
        const liveRide = (await db.getGarage(seedGarage)).published?.upcomingRide;
        if (rideExpired(liveRide)) await archiveExpiredRide(db, seed, Date.now(), liveRide);
        let [places, garage] = await Promise.all([db.get(seed), db.getGarage(seedGarage)]);
        if(places.upcomingRide&&!places.upcomingRide.id){
          const assigned=await db.saveUpcomingRide(identifiedRide(places.upcomingRide),places.revision);
          places=assigned?{...places,...assigned}:await db.get(seed);
        }
        return send(200, { places: places.places, upcomingRide: places.upcomingRide ?? null, revision: places.revision, garage: garage.garage, garageRevision: garage.revision, published: garage.published, cloudName, cloudReady, publishReady: publisher.ready, localPreview: publisher.local, snapshotUrl: publisher.snapshotUrl });
      }
      if (action === 'upcoming-ride' && req.method === 'PUT') {
        if (!Number.isInteger(body.revision) || body.revision < 0) fail(400, 'Invalid content revision. Reload the dashboard.');
        const current = await db.get(seed);
        let ride; try { ride = identifiedRide(body.upcomingRide, current.upcomingRide, { draft: body.draft === true }); } catch (e) { fail(400, e.message); }
        if (ride?.published && rideExpired(ride)) fail(400,'Choose a future ride date before including it on publish.');
        const saved = await db.saveUpcomingRide(ride, body.revision);
        if (!saved) fail(409, 'Another tab changed the content. Your edits are still here; reload before saving.');
        return send(200, saved);
      }
      if(action==='membership'&&req.method==='GET') {
        const {state,revision}=await db.getMemberState();
        const {garage}=await db.getGarage(seedGarage);
        const accountView=a=>publicAccount({...a,...profileBikeDetails(a,garage)});
        const rides=state.rides.map(r=>({...r,participants:r.participants.map(id=>state.accounts.find(a=>a.id===id)).filter(Boolean).map(a=>({...accountView(a),...ridingBike(a,r,garage)}))}));
        const bikes=garage.bikes.filter(preparedBike).map(b=>({id:b.id,brand:b.brand,model:b.model,colorName:b.colorName,frames:b.frames.length,status:b.status}));
        const heroMembers=garage.members.map(m=>({id:m.id,name:m.name,active:m.active,bikes:garage.lineup.filter(e=>e.memberId===m.id).length,accountId:state.accounts.find(a=>a.heroMemberId===m.id)?.id||null}));
        return send(200,{revision,accounts:state.accounts.map(account=>({...accountView(account),canRemove:canRemoveUnconfirmedAccount(state,account)})),allowed:state.allowed,rides,bikes,heroMembers});
      }
      if(action==='dream-bike'&&req.method==='POST'){
        if(typeof body.bikeId!=='string'||typeof body.expectedName!=='string')fail(400,'Choose a dream bike.');
        const {garage}=await db.getGarage(seedGarage),bike=garage.bikes.find(b=>b.id===body.bikeId);
        if(body.bikeId&&(!preparedBike(bike)||bike.frames.length<2))fail(400,'Choose a prepared rotation with at least two frames from the saved library.');
        await mutateMembers(db,state=>{const a=state.accounts.find(a=>a.id===body.accountId);if(!a)fail(404,'Profile not found.');if((a.dreamBikeName||'')!==body.expectedName)fail(409,'The member changed their dream bike. Refresh before assigning.');if(!a.dreamBikeName&&body.bikeId)fail(400,'The member has not requested a dream bike.');a.dreamBikeId=body.bikeId||null;notice(state,'Your dream garage',bike?`${bike.brand} ${bike.model} is ready to explore on your profile.`:'Your dream bike display has been removed.',a.id);});return send(200,{ok:true});
      }
      if(action==='profile-bike'&&req.method==='POST') {
        if(!['link','unlink'].includes(body.operation)||typeof body.bikeId!=='string'||!body.bikeId)fail(400,'Choose a bike to link or unlink.');
        const {garage}=await db.getGarage(seedGarage),bike=garage.bikes.find(b=>b.id===body.bikeId);
        if(body.operation==='link'&&!preparedBike(bike))fail(400,'Choose a prepared bike from the library.');
        await mutateMembers(db,state=>{
          const a=state.accounts.find(a=>a.id===body.accountId);if(!a)fail(404,'Profile not found.');
          const linked=linkedBikeIds(a),owned=profileBikeIds(a,garage);
          if(body.operation==='link'){
            if(owned.includes(bike.id))return;
            if(owned.length>=MAX_PROFILE_BIKES)fail(400,`A profile can have up to ${MAX_PROFILE_BIKES} bikes.`);
            // The first linked bike also fills the self-reported fields, which
            // the member sees again if every library bike is later unlinked.
            if(!owned.length){a.bikeName=`${bike.brand} ${bike.model}`;a.bikeColour=bike.colorName;}
            a.bikeIds=[...linked,bike.id];delete a.bikeId;
            notice(state,'Your garage updated',`${bike.brand} ${bike.model} is now linked to your profile.`,a.id);
          } else {
            if(!linked.includes(body.bikeId)){if(heroBikeIds(a,garage).includes(body.bikeId))fail(400,'This bike comes from the Hero lineup. Change it there, or disconnect the hero member.');return;}
            a.bikeIds=linked.filter(id=>id!==body.bikeId);delete a.bikeId;
            if(a.bikeNicknames)delete a.bikeNicknames[body.bikeId];
            for(const ride of state.rides)if(ride.bikeChoices?.[a.id]===body.bikeId)delete ride.bikeChoices[a.id];
            notice(state,'Your garage updated',profileBikeIds(a,garage).length?`${bike?`${bike.brand} ${bike.model}`:'A bike'} was removed from your profile.`:'Your bike-library links were removed. You can edit your bike details in your profile.',a.id);
          }
        });return send(200,{ok:true});
      }
      if(action==='hero-member'&&req.method==='POST') {
        // Connects a signed-in profile to an existing hero member so the bikes
        // assigned in Hero lineup become the profile's bikes. Always an explicit
        // admin decision: names are never matched automatically.
        if(typeof body.heroMemberId!=='string')fail(400,'Choose a hero member or Not connected.');
        const {garage}=await db.getGarage(seedGarage),hero=body.heroMemberId?garage.members.find(m=>m.id===body.heroMemberId):null;
        if(body.heroMemberId&&!hero)fail(400,'Choose a hero member from the saved Hero members list. Save draft first if you just added them.');
        await mutateMembers(db,state=>{
          const a=state.accounts.find(a=>a.id===body.accountId);if(!a)fail(404,'Profile not found.');
          if(hero&&state.accounts.some(o=>o.id!==a.id&&o.heroMemberId===hero.id))fail(409,'That hero member is already connected to another profile.');
          if((a.heroMemberId||null)===(hero?.id||null))return;
          a.heroMemberId=hero?.id||null;
          const owned=profileBikeIds(a,garage);
          for(const ride of state.rides)if(ride.bikeChoices?.[a.id]&&!owned.includes(ride.bikeChoices[a.id]))delete ride.bikeChoices[a.id];
          notice(state,'Your garage updated',hero?'Your profile is now connected to your HHR rider entry and its bikes.':'Your profile is no longer connected to an HHR rider entry.',a.id);
        });return send(200,{ok:true});
      }
      if(action==='sync-member-ride'&&req.method==='POST') {
        const garage=await db.getGarage(seedGarage);
        if(!garage.published?.snapshotRevision)fail(409,'Publish the saved ride first.');
        await syncPublishedRide(db,garage.published.upcomingRide||null,garage.published.snapshotRevision);return send(200,{ok:true});
      }
      if(action==='membership'&&req.method==='POST') {
        if (body.operation === 'remove-account') {
          const accountId = body.accountId;
          if (typeof accountId !== 'string' || !/^[a-f0-9]{24}$/.test(accountId)) fail(400, 'Choose an unconfirmed account to remove.');
          await mutateMembers(db, state => {
            const account = state.accounts.find(entry => entry.id === accountId);
            if (!account) return;
            if (!canRemoveUnconfirmedAccount(state, account)) fail(409, 'Only unconfirmed accounts without member records can be removed.');
            state.accounts = state.accounts.filter(entry => entry.id !== accountId);
            state.notifications = state.notifications.filter(entry => entry.recipient !== accountId);
          }, { revokeAccountId: accountId });
          return send(200, { ok: true });
        }
        try { await mutateMembers(db,state=>{
          if(body.operation==='allow') {
            const email=emailOf(body.email);allowMemberEmail(state,email);
            for(const a of state.accounts.filter(a=>a.email===email))approveMembership(state,a,'Your membership is approved. Complete your profile to join a ride.');
          } else if(body.operation==='remove-allow') {
            const email=emailOf(body.email);state.allowed=state.allowed.filter(e=>e!==email);
            for(const a of state.accounts.filter(a=>a.email===email)){a.membershipConfirmed=true;a.status='suspended';for(const r of state.rides.filter(r=>r.status==='open'))r.participants=r.participants.filter(id=>id!==a.id);notice(state,'Membership updated','Your ride access has been paused. Contact an HHR administrator.',a.id);}
          } else if(['approve','reject'].includes(body.operation)) {
            const a=state.accounts.find(a=>a.id===body.accountId);if(!a)fail(404,'Profile not found.');
            if(body.operation==='approve')approveMembership(state,a,'Your membership request has been approved.');
            else{if(['approved','suspended'].includes(a.status))a.membershipConfirmed=true;a.status='rejected';state.allowed=state.allowed.filter(e=>e!==a.email);for(const r of state.rides.filter(r=>r.status==='open'))r.participants=r.participants.filter(id=>id!==a.id);notice(state,'Membership request reviewed','Your request was not approved. Contact HHR if you have a question.',a.id);}
          } else fail(400,'Choose a membership action.');
        }); } catch(e){if(e.status)throw e;fail(400,e.message);}
        return send(200,{ok:true});
      }
      if(action==='ride-participant'&&req.method==='POST') {
        await mutateMembers(db,state=>{
          const ride=state.rides.find(r=>r.id===body.rideId),a=state.accounts.find(a=>a.id===body.accountId);
          if(!ride||!['open','closed','completed'].includes(ride.status))fail(409,'Choose an upcoming or completed ride. Cancelled rides cannot be edited.');
          if(!a)fail(404,'Profile not found.');
          if(['add','approve-add'].includes(body.operation)) {
            if (!completeProfile(a)) fail(400, 'Choose a member with a complete profile.');
            if (body.operation === 'approve-add' && a.status === 'pending') approveMembership(state, a, 'Your membership request has been approved.');
            if (!approved(state,a)) fail(400,'Choose an approved member or a pending membership request.');
            if (ride.participants.includes(a.id)) return;
            ride.participants.push(a.id);
            notice(state,ride.status==='open'&&!rideExpired(ride.details)?'You’re on the ride':'Ride history updated',`An administrator added you to ${ride.details.location}${ride.details.date?` (${ride.details.date})`:''}. You can share your ride photos from your profile.`,a.id);
          }
          else if(body.operation==='remove'){if(!ride.participants.includes(a.id))return;ride.participants=ride.participants.filter(id=>id!==a.id);if(ride.bikeChoices)delete ride.bikeChoices[a.id];notice(state,'Ride enrolment updated',`An administrator removed your entry for ${ride.details.location}.`,a.id);}
          else fail(400,'Choose Add or Remove.');
        });return send(200,{ok:true});
      }
      if(action==='cancel-ride'&&req.method==='POST') {
        const content=await db.get(seed);
        if(content.revision!==body.revision||!content.upcomingRide?.id)fail(409,'Reload the saved ride before cancelling.');
        const id=content.upcomingRide.id;
        const live = (await db.getGarage(seedGarage)).published?.upcomingRide;
        if (live?.id !== id || rideExpired(live)) fail(409, 'Only a live upcoming ride can be cancelled.');
        const saved=await db.saveUpcomingRide({...content.upcomingRide,published:false},content.revision);
        if(!saved)fail(409,'Another editor changed the ride. Reload first.');
        await mutateMembers(db,state=>{const r=state.rides.find(r=>r.id===id);if(r&&r.status!=='cancelled'){r.status='cancelled';notice(state,'Ride cancelled',`${r.details.location} has been cancelled. Please do not travel to the meeting point.`);}});
        return send(200,{...saved,notice:'Cancelled for members. Select the announcement removal in Review & publish.'});
      }
      if(action==='new-ride'&&req.method==='POST') {
        const content=await db.get(seed);if(content.revision!==body.revision)fail(409,'Reload before starting a new ride.');
        const live = (await db.getGarage(seedGarage)).published?.upcomingRide;
        if (live?.published && !rideExpired(live)) {
          const { state } = await db.getMemberState();
          if (!state.rides.some(ride => ride.id === live.id && ride.status === 'cancelled')) fail(409, 'Remove or cancel the live ride before starting another.');
        }
        const saved=await db.saveUpcomingRide(null,content.revision);if(!saved)fail(409,'Content changed. Reload first.');return send(200,saved);
      }
      if (action === 'garage' && req.method === 'PUT') {
        if (!Number.isInteger(body.revision) || body.revision < 0) fail(400, 'Invalid garage revision. Reload the dashboard.');
        let garage; try { garage = cleanGarage(body.garage, localFramePaths); } catch (e) { fail(400, e.message); }
        const cloudFrames = garage.bikes.flatMap(b => b.frames.filter(f => f.source === 'cloudinary'));
        const verified = new Map((await db.knownBikeFrames([...new Set(cloudFrames.map(f => f.publicId))])).map(f => [f.publicId, f]));
        if (cloudFrames.some(f => { const known = verified.get(f.publicId); return !known || known.version !== f.version || known.format !== f.format || known.width !== f.width || known.height !== f.height; })) fail(400, 'One or more bike frames have not been confirmed by this dashboard. Upload and verify them first.');
        await db.getGarage(seedGarage);
        const saved = await db.saveGarage(garage, body.revision);
        if (!saved) fail(409, 'Another tab changed the garage. Your edits are still here; reload before saving.');
        return send(200, saved);
      }
      if (action === 'publish-review' && req.method === 'GET') {
        if (!publisher.ready) fail(503, 'Publishing needs Cloudinary credentials. Preview deployments also need a separate CONTENT_SNAPSHOT_ID.');
        const [places, garage] = await Promise.all([db.get(seed), db.getGarage(seedGarage)]);
        const { changes, reviewId, revision, garageRevision } = await publicationReview(db, places, garage);
        return send(200, { changes, reviewId, revision, garageRevision });
      }
      if (action === 'publish' && req.method === 'POST') {
        if (!publisher.ready) fail(503, 'Publishing needs Cloudinary credentials. Preview deployments also need a separate CONTENT_SNAPSHOT_ID.');
        if (![body.revision, body.garageRevision].every(n => Number.isInteger(n) && n >= 0)) fail(400, 'Save your draft before publishing.');
        await db.getGarage(seedGarage);
        const lock = sessionToken();
        if (!await db.acquirePublish(lock, Date.now())) fail(409, 'A publication is already running. Wait for it to finish before retrying.');
        try {
          const [places, garage] = await Promise.all([db.get(seed), db.getGarage(seedGarage)]);
          if (places.revision !== body.revision || garage.revision !== body.garageRevision) fail(409, 'Another tab saved newer content. Reload before publishing.');
          const revision = `${places.revision}-${garage.revision}-${lock.slice(0,12)}`;
          const reviewed = body.reviewId !== undefined || body.selection !== undefined;
          let snapshot;
          if (reviewed) {
            const review = await publicationReview(db, places, garage);
            if (body.reviewId !== review.reviewId) fail(409, 'The website or saved drafts changed. Open a new review before publishing.');
            const selection = body.selection;
            const eligible = new Set(review.changes.filter(change => !change.issue).map(change => change.id));
            if (!Array.isArray(selection) || !selection.length || selection.length > eligible.size || new Set(selection).size !== selection.length || selection.some(id => !eligible.has(id))) fail(400, 'Select available changes from the publication review.');
            if (selection.includes('ride') && selection.includes('remove-ride')) fail(400, 'Choose one action for the upcoming ride.');
            try {
              snapshot = validateSnapshot({ schemaVersion: 1, revision, publishedAt: new Date().toISOString(), cloudName, ...review.apply(selection) });
            } catch (error) { fail(400, error.message); }
          } else {
            snapshot = snapshotOf(places.places, garage.garage, cloudName, revision, undefined, places.upcomingRide);
            if(snapshot.upcomingRide&&rideExpired(snapshot.upcomingRide))fail(409,'This ride date has passed. Reload to archive it before publishing.');
            if(snapshot.upcomingRide?.id){const memberState=await db.getMemberState();if(memberState.state.rides.some(r=>r.id===snapshot.upcomingRide.id&&['cancelled','completed'].includes(r.status)))fail(409,'This ride is closed. Start a new ride instead.');}
          }
          let published;
          try { published = await publisher.publish(snapshot, revision); } catch { fail(502, 'Publishing could not be confirmed. Your saved draft is safe. The previous publication remains available if the upload failed; retry publishing.'); }
          const state = { ...published, revision: places.revision, garageRevision: garage.revision, snapshotRevision: revision, upcomingRide:snapshot.upcomingRide };
          if (!await db.finishPublish(lock, state)) fail(503, 'Content was uploaded but its status could not be saved. Refresh and retry publishing.');
          try {await syncPublishedRide(db,snapshot.upcomingRide,revision);} catch {return send(200,{published:state,warning:'The website was published, but member ride updates need a retry. Open Membership and sync the published ride.'});}
          return send(200, { published: state });
        } finally { try { await db.releasePublish(lock); } catch { /* The bounded lock expires if the database is unavailable. */ } }
      }
      if (action === 'places' && req.method === 'GET') return send(200, { ...await db.get(seed), cloudName, cloudReady });
      if (action === 'places' && req.method === 'PUT') {
        if (!Number.isInteger(body.revision) || body.revision < 0) fail(400, 'Invalid revision. Reload the dashboard.');
        let places; try { places = cleanPlaces(body.places, { draft: body.draft === true }); } catch (e) { fail(400, e.message); }
        const saved = await db.save(places, body.revision);
        if (!saved) fail(409, 'Another tab changed these places. Copy any unsaved text, then reload before saving.');
        return send(200, saved);
      }
      if (action === 'library' && req.method === 'GET') {
        const type = url.searchParams.get('type') === 'video' ? 'video' : 'image';
        const cursor = url.searchParams.get('cursor') || '';
        if (cursor.length > 512) fail(400, 'Invalid library page.');
        const params = new URLSearchParams({ max_results: '30', ...(cursor ? { next_cursor: cursor } : {}) });
        const result = await cloud(`resources/${type}/upload?${params}`);
        const media = result.resources.filter(r => !['hh-bikes/','hh-profiles/','hh-ride-contributions/'].some(prefix=>r.public_id.startsWith(prefix))).map(r => { try { return cleanMedia({ id: r.asset_id, type, publicId: r.public_id, version: r.version, width: r.width, height: r.height, caption: '' }); } catch { return null; } }).filter(Boolean);
        return send(200, { media, cursor: result.next_cursor || '', cloudName });
      }
      if (action === 'sign-bike-upload' && req.method === 'POST') {
        if (!cloudReady) fail(503, 'Add the Cloudinary server credentials before uploading bikes.');
        if (await db.attempt(`bike-uploads:${digest(token)}`, Date.now()) > 50) fail(429, 'Bike upload limit reached. Save completed batches and continue in 15 minutes.');
        let signed;
        try { signed = signBikeBatch(body.count, sessionToken().slice(0,24), digest(token), env.CLOUDINARY_API_SECRET); } catch (e) { fail(400, e.message); }
        return send(200, { ...signed, apiKey: env.CLOUDINARY_API_KEY, cloudName });
      }
      if (action === 'confirm-bike-upload' && req.method === 'POST') {
        if (!cloudReady) fail(503, 'Cloudinary credentials are missing.');
        let ticket;
        try { ticket = verifyBikeBatch(body.ticket, digest(token), env.CLOUDINARY_API_SECRET); } catch (e) { fail(400, e.message); }
        if (!Array.isArray(body.uploaded) || body.uploaded.length !== ticket.ids.length || body.uploaded.some(v => typeof v !== 'boolean')) fail(400, 'Invalid bike batch confirmation.');
        const frames = [], errors = [];
        const cached = new Map((await db.knownBikeFrames(ticket.ids)).map(f => [f.publicId,f]));
        // Bounded verification avoids a burst against the Cloudinary Admin API.
        for (let start = 0; start < ticket.ids.length; start += 3) {
          await Promise.all(ticket.ids.slice(start, start+3).map(async (id, j) => {
            const index = start+j;
            if (cached.has(id)) { frames[index] = cached.get(id); return; }
            try {
              frames[index] = confirmedBikeFrame(await cloud(`resources/image/upload/${encodeURIComponent(id)}`, 8000), id);
              await db.rememberBikeFrame(frames[index]);
            }
            catch { frames[index] = null; errors.push(`Frame ${index+1} could not be verified. Keep the completed frames and retry the missing ones.`); }
          }));
        }
        return send(200, { frames, errors });
      }
      if (action === 'sign-upload' && req.method === 'POST') {
        if (!cloudReady) fail(503, 'Add the Cloudinary server credentials before uploading.');
        try { validateUploadSize(body); } catch (e) { fail(400,e.message); }
        const attempts = await db.attempt(`uploads:${digest(token)}`, Date.now());
        if (attempts > 50) fail(429, 'Upload limit reached. Try again in 15 minutes.');
        // Only sign our own fixed parameters; never sign arbitrary client input.
        const params = uploadParameters(body.type,sessionToken().slice(0,24),Math.floor(Date.now()/1000));
        const signature = uploadSignature(params,env.CLOUDINARY_API_SECRET);
        const ticket = uploadTicket({publicId:`${params.folder}/${params.public_id}`,type:body.type,session:digest(token),expires:Date.now()+3600000},env.CLOUDINARY_API_SECRET);
        return send(200, { params, signature, ticket, apiKey: env.CLOUDINARY_API_KEY, cloudName, type: body.type });
      }
      if (action === 'confirm-upload' && req.method === 'POST') {
        if (!cloudReady) fail(503, 'Cloudinary credentials are missing.');
        let ticket; try { ticket = verifyUploadTicket(body.ticket,digest(token),env.CLOUDINARY_API_SECRET); } catch (e) { fail(400,e.message); }
        const id = encodeURIComponent(ticket.publicId);
        const resource = await cloud(`resources/${ticket.type}/upload/${id}`);
        if (resource.public_id !== ticket.publicId || resource.resource_type !== ticket.type) fail(502,'Cloudinary returned an unexpected upload.');
        if (!Number.isSafeInteger(resource.bytes) || resource.bytes <= 0 || resource.bytes > policy.maxSourceBytes) fail(400,'The stored file exceeds 25 MB. It was not added to the album. Remove this upload from Cloudinary and try a smaller file.');
        const dimension = ticket.type === 'image' ? policy.maxPhotoDimension : policy.maxVideoDimension;
        if (Math.max(resource.width,resource.height) > dimension) fail(400,'This upload was not optimized correctly. It was not added to the album.');
        return send(200,{ media:cleanMedia({ id:resource.asset_id,type:ticket.type,publicId:resource.public_id,version:resource.version,width:resource.width,height:resource.height,caption:'' }) });
      }
      fail(404, 'Not found.');
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : error.status || 503;
      // Never send provider exceptions, URLs, SQL or credentials to the browser/log.
      send(status, { error: error.status ? error.message : status === 400 ? 'Invalid JSON request.' : 'The content service is unavailable. Try again shortly or check the server setup.' });
    }
  };
}
