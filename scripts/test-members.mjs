import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPair, SignJWT } from 'jose';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresStore } from '../server/store.mjs';
import { createCms } from '../server/cms.mjs';
import { createMembers } from '../server/members.mjs';
import { createRideCron } from '../server/ride-cron.mjs';
import { verifyGoogleToken } from '../server/google-login.mjs';
import { hashPassword, digest } from '../server/security.mjs';
import { emptyUpcomingRide } from '../shared/upcoming-ride.mjs';
import { emptyMemberState, mutateMembers } from '../server/member-state.mjs';
import { archiveExpiredRide, todayIST, enrollmentOpen } from '../server/ride-lifecycle.mjs';
import { validateSnapshot } from '../shared/public-snapshot.mjs';
import { seedPlaces } from '../server/publication.mjs';

const {privateKey,publicKey}=await generateKeyPair('RS256');
const claims={sub:'google-sub',email:'rider@gmail.com',email_verified:true,nonce:'nonce',name:'Rider'};
const config={clientId:'client'};
const jwt=async extra=>new SignJWT({...claims,...extra}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setAudience('client').setIssuedAt().setExpirationTime('5m').sign(privateKey);
assert.equal((await verifyGoogleToken(await jwt({}),config,'nonce',publicKey)).sub,'google-sub');
await assert.rejects(verifyGoogleToken(await jwt({nonce:'wrong'}),config,'nonce',publicKey));
await assert.rejects(verifyGoogleToken(await jwt({email_verified:false}),config,'nonce',publicKey));
await assert.rejects(verifyGoogleToken(await jwt({email:'thirdparty@example.com'}),config,'nonce',publicKey));
await assert.rejects(verifyGoogleToken(await jwt({}),{clientId:'wrong'},'nonce',publicKey));
assert.equal(todayIST(Date.parse('2026-11-14T18:29:59Z')),'2026-11-14');assert.equal(todayIST(Date.parse('2026-11-14T18:30:00Z')),'2026-11-15');
const windowRide={date:'2099-11-01',enrollmentStart:'2099-10-01T06:00:00+05:30',enrollmentEnd:'2099-10-02T06:00:00+05:30'};
assert(!enrollmentOpen(windowRide,Date.parse(windowRide.enrollmentStart)-1));assert(enrollmentOpen(windowRide,Date.parse(windowRide.enrollmentStart)));assert(!enrollmentOpen(windowRide,Date.parse(windowRide.enrollmentEnd)));
const pg=new PGlite();let queries=0;
const sql=async(strings,...values)=>{queries++;return(await pg.query(strings.reduce((q,s,i)=>q+s+(i<values.length?`$${i+1}`:''),''),values)).rows;};
const db=await createPostgresStore('',sql),assets=new Map();
const cloud=async(url,options={})=>{
  if(url==='https://oauth2.googleapis.com/token')return Response.json({id_token:options.body.get('code')});
  if(url.includes('/resources/image/upload/'))return Response.json({public_id:decodeURIComponent(url.split('/upload/')[1]),resource_type:'image',asset_id:'profile-photo',version:123,width:640,height:640,bytes:100000});
  if(options.method==='POST'){const id=options.body.get('public_id');assets.set(id,JSON.parse(await options.body.get('file').text()));return Response.json({public_id:id,version:123});}
  if(url.startsWith('https://res.cloudinary.com/'))return assets.has('hh-site/published.json')?Response.json(assets.get('hh-site/published.json')):new Response('',{status:404});
  throw Error('Unexpected provider call');
};
const identities={first:{sub:'sub-first',email:'first@gmail.com',name:'First Rider'},second:{sub:'sub-second',email:'second@gmail.com',name:'Second Rider'}};
let cms,member,cron;
const server=createServer((req,res)=>req.url.startsWith('/api/cms')?cms(req,res):req.url.startsWith('/api/ride-rollover')?cron(req,res):member(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const env={VERCEL:'1',MEMBER_APP_ORIGIN:base,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test-secret',ADMIN_PASSWORD_HASH:await hashPassword('Member-admin-test-only-password'),CLOUDINARY_API_KEY:'key',CLOUDINARY_API_SECRET:'secret',CLOUDINARY_CLOUD_NAME:'test-hh',CRON_SECRET:'cron-test-secret'};
// HTTP loopback is test-only; factories see production cookies, while OAuth
// configuration deliberately uses development to permit the loopback origin.
const memberEnv={...env,VERCEL:'',NODE_ENV:'development'};
cms=createCms(memberEnv,db,cloud);member=createMembers(memberEnv,db,cloud,async token=>identities[token]);cron=createRideCron(env,db,cloud);
async function request(path,method='GET',body,cookie='',headers={}){
  const response=await fetch(`${base}${path}`,{method,redirect:'manual',headers:{Origin:base,'Content-Type':'application/json','X-HH-Admin':'1','X-HHR-Member':'1',Cookie:cookie,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,headers:response.headers,data:response.headers.get('content-type')?.includes('json')?await response.json():null};
}
const admin=(action,method='GET',body)=>request(`/api/cms?action=${action}`,method,body,adminCookie);
const account=(cookie,action,method='GET',body,headers)=>request(`/api/member?action=${action}`,method,body,cookie,headers);
let adminCookie;
async function googleLogin(code){
  const start=await request('/api/member?action=google&ride=ride-aaaaaaaaaaaaaaaaaaaaaaaa');assert.equal(start.status,303);
  const oauthCookie=start.headers.get('set-cookie').split(';')[0],url=new URL(start.headers.get('location')),state=url.searchParams.get('state');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('scope'),'openid email profile');
  const callback=await request(`/api/member?action=callback&state=${state}&code=${code}`,'GET',undefined,oauthCookie);assert.equal(callback.status,303);assert.match(callback.headers.get('location'),/^\/member\?ride=/);
  const replay=await request(`/api/member?action=callback&state=${state}&code=${code}`,'GET',undefined,oauthCookie);assert.equal(replay.headers.get('location'),'/member?error=google');
  return callback.headers.getSetCookie().find(c=>c.startsWith('hhr_member_dev=')).split(';')[0];
}
try{
  const before=queries;assert.equal((await request('/api/member?action=session')).data.account,null);assert.equal(queries,before,'anonymous public pages do not wake Neon for sign-in status');
  const login=await request('/api/cms?action=login','POST',{password:'Member-admin-test-only-password'});adminCookie=login.headers.get('set-cookie').split(';')[0];
  const first=await googleLogin('first'),second=await googleLogin('second');
  assert.equal((await request('/api/cms?action=membership','GET',undefined,first)).status,401,'member cookie cannot authenticate an administrator');
  assert.equal((await account(adminCookie,'home')).status,401,'admin cookie cannot impersonate a member');
  assert.equal((await account(first,'profile','PUT',{name:'First',phone:'+91 99999 00000'},{Origin:'https://evil.example'})).status,403);
  assert.equal((await account(first,'profile','PUT',{name:'First Rider',phone:'+91 99999 00000',bikeName:'Yamaha R15',bikeColour:'Blue',bikeNickname:'Skyline-test-only',bikeId:'hunter-350',status:'approved',email:'admin@gmail.com'})).status,200);
  let home=(await account(first,'home')).data;assert.equal(home.account.status,'pending');assert.equal(home.account.email,'first@gmail.com');assert(!('sub'in home.account));
  assert.equal(home.account.bikeName,'Yamaha R15');assert.equal(home.account.bikeColour,'Blue');assert.equal(home.account.bikeNickname,'Skyline-test-only');assert.equal(home.account.bikeId,null,'members cannot assign their own library assets');assert.equal(home.bannerBike,null);
  assert.equal((await account(first,'profile','PUT',{name:'First Rider',phone:'+91 99999 00000',bikeNickname:'a'.repeat(61)})).status,400);
  assert.equal((await account(first,'profile','PUT',{name:'First',phone:'-------'})).status,400);
  assert.equal((await account(first,'sign-photo','POST',{sourceBytes:200000,bytes:100000})).status,410,'members must not receive reusable provider signatures');
  assert.equal((await account(first,'confirm-photo','POST',{})).status,410);
  let workspace=(await admin('membership')).data;assert.equal(workspace.accounts.filter(a=>a.status==='pending').length,1);
  const firstId=home.account.id;
  const secondId=(await account(second,'home')).data.account.id;
  assert.equal((await request('/api/cms?action=assign-profile-bike','POST',{accountId:firstId,bikeId:'hunter-350'},first)).status,401);
  assert.equal((await admin('assign-profile-bike','POST',{accountId:firstId,bikeId:'honda-monkey'})).status,400,'pending empty image sets are not assignable');
  assert.equal((await admin('assign-profile-bike','POST',{accountId:firstId,bikeId:'pulsar-ns125'})).status,200);
  home=(await account(first,'home')).data;assert.equal(home.bannerBike.frames,16);assert.equal(home.bannerBike.model,'Pulsar NS125');assert.equal(home.account.bikeName,'Bajaj Pulsar NS125');assert.equal(home.account.bikeNickname,'Skyline-test-only');
  assert.equal((await account(second,'home')).data.bannerBike,null,'another account cannot read the assigned banner');
  await account(first,'profile','PUT',{name:'First Rider',phone:'+91 99999 00000',bikeId:'hunter-350',bikeName:'Forged model',bikeColour:'Forged colour',bikeNickname:'Skyline-test-only'});
  home=(await account(first,'home')).data;assert.equal(home.account.bikeId,'pulsar-ns125');assert.equal(home.account.bikeColour,'Black','members cannot overwrite a linked library bike');
  const doc=(await admin('editor')).data;
  const ride={...emptyUpcomingRide(),published:true,location:'Future test lake',description:'Test ride',meetingPoint:'Test meet',date:'2099-11-01',meetingTime:'06:00',enrollmentStart:'2020-01-01T00:00:00+05:30',enrollmentEnd:'2099-11-01T05:00:00+05:30'};
  let saved=await admin('upcoming-ride','PUT',{revision:doc.revision,upcomingRide:ride});assert.equal(saved.status,200);const rideId=saved.data.upcomingRide.id;assert.match(rideId,/^ride-/);
  assert.equal((await account(first,'home')).data.rides.length,0,'saved draft is not an announced ride');
  assert.equal((await admin('publish','POST',{revision:saved.data.revision,garageRevision:doc.garageRevision})).status,200);
  assert.equal((await account(first,'enroll','POST',{operation:'join',rideId})).status,403);
  assert.equal((await admin('membership','POST',{operation:'approve',accountId:firstId})).status,200);
  assert.equal((await account(first,'enroll','POST',{operation:'join',rideId})).status,200);
  await Promise.all(Array.from({length:3},()=>account(first,'enroll','POST',{operation:'join',rideId})));
  workspace=(await admin('membership')).data;assert.equal(workspace.rides[0].participants.length,1,'duplicate and concurrent joins are idempotent');
  assert(!(await account(second,'home')).data.rides[0].participants,'other members never see attendee PII');
  assert.deepEqual((await account(second,'home')).data.rides[0].roster,[],'pending accounts cannot read the rider list');
  assert.deepEqual((await account(first,'home')).data.rides[0].roster,[{name:'First Rider',bikeName:'Bajaj Pulsar NS125',bikeColour:'Black',bikeNickname:'Skyline-test-only'}]);
  await admin('membership','POST',{operation:'approve',accountId:secondId});
  assert.equal((await account(second,'home')).data.rides[0].roster[0].name,'First Rider','approved members see names and bikes, not private profiles');
  const roster=JSON.stringify((await account(second,'home')).data.rides[0].roster);assert(!roster.includes('first@gmail.com')&&!roster.includes('99999')&&!roster.includes('frameAssets')&&!roster.includes(firstId));
  const live=assets.get('hh-site/published.json');validateSnapshot(live);const text=JSON.stringify(live);assert(!text.includes('first@gmail.com')&&!text.includes('99999')&&!text.includes('pending')&&!text.includes('Skyline-test-only'));
  await admin('assign-profile-bike','POST',{accountId:firstId,bikeId:''});assert.equal((await account(first,'home')).data.bannerBike,null);
  await account(first,'profile','PUT',{name:'First Rider',phone:'+91 99999 00000',bikeName:'Honda CB350RS',bikeColour:'Matte black',bikeNickname:'Skyline-test-only'});
  assert.equal((await account(second,'home')).data.rides[0].roster[0].bikeName,'Honda CB350RS','unlinked self-reported bike updates appear in the rider list');
  await admin('assign-profile-bike','POST',{accountId:firstId,bikeId:'pulsar-ns125'});
  let current=(await admin('editor')).data;
  const closed={...current.upcomingRide,enrollmentEnd:'2020-01-02T00:00:00+05:30'};
  saved=await admin('upcoming-ride','PUT',{revision:current.revision,upcomingRide:closed});assert.equal(saved.status,200);
  await admin('publish','POST',{revision:saved.data.revision,garageRevision:current.garageRevision});
  assert((await account(first,'home')).data.notifications.some(n=>n.title==='Ride updated'));
  assert.equal((await account(first,'enroll','POST',{operation:'leave',rideId})).status,200,'leaving works after enrolment closes');
  assert.equal((await account(first,'enroll','POST',{operation:'join',rideId})).status,409,'server enforces deadline');
  assert.equal((await admin('ride-participant','POST',{operation:'add',accountId:firstId,rideId})).status,200,'admin can override enrolment deadline');
  assert.equal((await account(first,'home')).data.rides[0].joined,true);
  await admin('membership','POST',{operation:'remove-allow',email:'first@gmail.com'});
  assert.equal((await account(first,'home')).data.rides[0].joined,false,'revocation immediately removes open entries');
  assert.equal((await account(first,'enroll','POST',{operation:'join',rideId})).status,403);
  await admin('membership','POST',{operation:'allow',email:'first@gmail.com'});
  // Re-signing with the same Google subject keeps edits and phone/photo; a
  // changed verified email loses membership until approved for that address.
  identities.first.email='changed@gmail.com';const changed=await googleLogin('first');assert.equal((await account(changed,'home')).data.account.status,'new');
  identities.first.email='first@gmail.com';await googleLogin('first');
  current=(await admin('editor')).data;
  assert.equal((await admin('cancel-ride','POST',{revision:current.revision})).status,200);
  assert.equal((await account(first,'home')).data.rides.length,0);assert((await account(first,'home')).data.notifications.some(n=>n.title==='Ride cancelled'));
  assert.equal((await account(first,'enroll','POST',{operation:'join',rideId})).status,409);
  await account(first,'read-notifications','POST',{});assert((await account(first,'home')).data.account.seenAt);
  // Automatic gallery draft + expiry, without publishing unrelated saved edits.
  current=(await admin('editor')).data;
  await admin('new-ride','POST',{revision:current.revision});current=(await admin('editor')).data;
  saved=await admin('upcoming-ride','PUT',{revision:current.revision,upcomingRide:ride});await admin('publish','POST',{revision:saved.data.revision,garageRevision:current.garageRevision});
  const pastRide={...saved.data.upcomingRide,date:'2020-01-01'};
  await db.saveUpcomingRide(pastRide,saved.data.revision);
  const originalSnapshot=assets.get('hh-site/published.json');assets.set('hh-site/published.json',{...originalSnapshot,upcomingRide:pastRide});
  const beforeArchive=await db.get(seedPlaces);await db.save([{...beforeArchive.places[0],name:'Secret draft name'},...beforeArchive.places.slice(1)],beforeArchive.revision);
  assert.equal((await request('/api/ride-rollover')).status,401);
  const rollover=await request('/api/ride-rollover','GET',undefined,'',{Authorization:'Bearer cron-test-secret'});assert.equal(rollover.status,200);
  const archived=await db.get(seedPlaces);assert.equal(archived.upcomingRide,null);assert.equal(archived.places[0].published,false);assert.equal(archived.places[0].sourceRideId,pastRide.id);assert.equal(archived.places[0].needsLocationReview,true);
  assert.equal(assets.get('hh-site/published.json').upcomingRide,null);assert(!JSON.stringify(assets.get('hh-site/published.json')).includes('Secret draft name'));
  await request('/api/ride-rollover','GET',undefined,'',{Authorization:'Bearer cron-test-secret'});assert.equal((await db.get(seedPlaces)).places.filter(p=>p.sourceRideId===pastRide.id).length,1,'rollover retry never duplicates albums');
  const legacy={...pastRide};delete legacy.id;
  await archiveExpiredRide(db,seedPlaces,Date.now(),legacy);await archiveExpiredRide(db,seedPlaces,Date.now(),legacy);
  assert.equal((await db.get(seedPlaces)).places.filter(p=>p.sourceRideId?.startsWith('legacy-')).length,1,'pre-ID publications also archive exactly once');
  await account(first,'logout','POST',{});assert.equal((await account(first,'home')).status,401);
  const stored=await pg.query('SELECT token FROM hh_member_sessions');assert(stored.rows.every(row=>!second.includes(row.token)),'sessions stored only as hashes');
  console.log('Members: verified Google JWTs, OAuth state/PKCE/replay, separate sessions/CSRF, pending approval, access revocation, deadline enforcement/admin override, private attendees, notifications, automatic IST rollover and idempotent gallery drafts passed.');
}finally{await new Promise(resolve=>server.close(resolve));await pg.close();}
