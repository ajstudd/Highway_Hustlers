import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { createPostgresStore,createLocalStore } from '../server/store.mjs';
import { createMemberPhotos,normalizeMemberPhoto } from '../server/member-photos.mjs';
import { createCms } from '../server/cms.mjs';
import { createMembers } from '../server/members.mjs';
import { hashPassword,digest } from '../server/security.mjs';
import { mutateMembers,signInAccount } from '../server/member-state.mjs';
import { seedPlaces,seedGarage } from '../server/publication.mjs';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const pg=new PGlite(),sql=async(strings,...values)=>(await pg.query(strings.reduce((q,s,i)=>q+s+(i<values.length?`$${i+1}`:''),''),values)).rows;
const db=await createPostgresStore('',sql),rideId='ride-aaaaaaaaaaaaaaaaaaaaaaaa',ride={id:rideId,published:true,location:'Kerwa',description:'Morning',meetingPoint:'Bhopal',notes:'',mapsUrl:'',date:'2099-01-01',meetingTime:'06:00',images:[]};
const ids=await mutateMembers(db,s=>{const ids=['one','two','pending','outsider'].map(n=>signInAccount(s,{sub:n,email:`${n}@gmail.com`,name:n}));s.accounts.forEach((a,i)=>{a.phone='9999999999';a.status=i===2?'pending':'approved';if(i!==2)s.allowed.push(a.email);});s.rides.push({id:rideId,details:ride,status:'open',participants:ids.slice(0,3)});return ids;});
const tokens=ids.map((_,i)=>String(i+1).repeat(64));await Promise.all(tokens.map((t,i)=>db.putMemberSession(digest(t),ids[i],Date.now()+600000)));
const jpeg=await sharp({create:{width:64,height:48,channels:3,background:'#59a5d0'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'PRIVATE TEST'}}}).toBuffer();
assert((await sharp(await normalizeMemberPhoto(jpeg)).metadata()).exif===undefined,'server strips source metadata');
await assert.rejects(normalizeMemberPhoto(await sharp({create:{width:10,height:10,channels:3,background:'red'}}).png().toBuffer()));
await assert.rejects(normalizeMemberPhoto(Buffer.from('<svg/>')));
await assert.rejects(normalizeMemberPhoto(Buffer.from([255,216,255,0])));
await assert.rejects(normalizeMemberPhoto(await sharp({create:{width:2049,height:10,channels:3,background:'red'}}).jpeg().toBuffer()));
let photoHandler,cms,member,calls=0,failProvider=false;
const server=createServer((req,res)=>req.url.startsWith('/api/member-photo')?photoHandler(req,res):req.url.startsWith('/api/cms')?cms(req,res):member(req,res));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const env={MEMBER_APP_ORIGIN:base,CLOUDINARY_API_KEY:'server-key-only',CLOUDINARY_API_SECRET:'server-secret-only',CLOUDINARY_CLOUD_NAME:'test',ADMIN_PASSWORD_HASH:await hashPassword('Photo-test-admin-password')};
const provider=async(url,options)=>{calls++;if(failProvider)throw Error('Provider failure');const form=options.body;assert.equal(form.get('api_key'),env.CLOUDINARY_API_KEY);assert(form.get('signature'));assert.equal(form.get('overwrite'),'false');const bytes=Buffer.from(await form.get('file').arrayBuffer()),meta=await sharp(bytes).metadata();assert.equal(meta.format,'jpeg');assert(!meta.exif);return Response.json({asset_id:`asset-${calls}`,public_id:`${form.get('folder')}/${form.get('public_id')}`,format:'jpg',resource_type:'image',version:123,width:meta.width,height:meta.height,bytes:bytes.length});};
photoHandler=createMemberPhotos(env,db,provider);cms=createCms(env,db,provider);member=createMembers(env,db,provider);
async function upload(who=0,{body=jpeg,uuid=randomUUID(),ride=rideId,purpose='',headers={}}={}){const response=await fetch(`${base}/api/member-photo?${purpose?'purpose='+purpose:'ride='+ride}`,{method:'POST',headers:{Origin:base,'Content-Type':'application/octet-stream','X-HHR-Member':'1','X-HHR-Photo-Consent':'1','X-HHR-Upload':uuid,Cookie:who===null?'':`hhr_member_dev=${tokens[who]}`,...headers},body});return {status:response.status,data:await response.json()};}
let adminCookie='';async function admin(action,method='GET',body){const r=await fetch(`${base}/api/cms?action=${action}`,{method,headers:{Origin:base,'Content-Type':'application/json','X-HH-Admin':'1',Cookie:adminCookie},...(body?{body:JSON.stringify(body)}:{})});if(action==='login')adminCookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,data:await r.json()};}
try{
  assert.equal((await upload(null)).status,401);assert.equal((await upload(0,{headers:{Origin:'https://evil.example'}})).status,403);assert.equal((await upload(2)).status,403);assert.equal((await upload(3)).status,403);assert.equal(calls,0);
  assert.equal((await upload(0,{body:Buffer.alloc(1500001)})).status,413);assert.equal(calls,0);
  assert.equal((await upload(0,{body:Buffer.from('<svg/>')})).status,400);assert.equal(calls,0);
  const uuid=randomUUID(),results=await Promise.all([upload(0,{uuid}),upload(0)]);assert.deepEqual(results.map(r=>r.status),[200,200]);assert.equal(calls,2);assert(results.every(r=>r.data.status==='pending'));assert.equal((await db.accountPhotos(ids[0])).length,2);
  assert(!JSON.stringify(results).includes('server-key-only'));assert(!JSON.stringify(results).includes('signature'));assert(!JSON.stringify(results).includes('server-secret-only'));
  assert.equal((await upload(0,{uuid})).status,200);assert.equal(calls,2,'confirmed replay must not upload again');assert.equal((await upload(0)).status,409);assert.equal(calls,2);
  await admin('login','POST',{password:'Photo-test-admin-password'});assert.equal((await admin('ride-photos')).data.photos.length,2);
  let doc=(await admin('editor')).data;const submission=results[0].data.id,target=doc.places[0].id;
  assert.equal((await admin('add-ride-photo','POST',{id:submission,placeId:target,revision:doc.revision})).status,400);
  assert.equal((await admin('moderate-ride-photo','POST',{id:submission,status:'approved',expected:'pending'})).status,200);
  assert.equal((await admin('moderate-ride-photo','POST',{id:submission,status:'rejected',expected:'pending'})).status,409,'stale moderation cannot overwrite a decision');
  assert.equal((await admin('add-ride-photo','POST',{id:submission,placeId:target,revision:doc.revision+1})).status,409);
  let added=await admin('add-ride-photo','POST',{id:submission,placeId:target,revision:doc.revision});assert.equal(added.status,200);assert(added.data.places[0].media.some(m=>m.id===results[0].data.media.id));
  assert.equal((await db.getGarage(seedGarage)).published,null,'album selection never publishes');
  const count=added.data.places[0].media.length;added=await admin('add-ride-photo','POST',{id:submission,placeId:target,revision:added.data.revision});assert.equal(added.data.places[0].media.length,count,'catalogue reuse does not duplicate an album item');
  await admin('moderate-ride-photo','POST',{id:results[1].data.id,status:'rejected',expected:'pending'});assert.equal((await db.accountPhotos(ids[0])).length,2,'rejection never refunds a slot');
  await mutateMembers(db,s=>{s.rides[0].status='completed';});assert.equal((await upload(1)).status,200,'joined members can share photos after a ride');
  const homeResponse=await fetch(`${base}/api/member?action=home`,{headers:{Cookie:`hhr_member_dev=${tokens[1]}`}}),home=await homeResponse.json();assert.equal(home.pastRides[0].photos.length,1,'members only see their own submissions');
  await mutateMembers(db,s=>{s.rides[0].status='cancelled';});assert.equal((await upload(1)).status,403);
  assert.equal((await upload(1,{purpose:'profile'})).status,200);assert.equal((await db.getMemberState()).state.accounts[1].photo.type,'image');
  failProvider=true;const retry=randomUUID();assert.equal((await upload(1,{purpose:'profile',uuid:retry})).status,503);const before=calls;assert.equal((await upload(1,{purpose:'profile',uuid:retry})).status,409);assert.equal(calls,before,'uncertain provider uploads retain their reservation');
  assert.equal((await upload(1,{purpose:'profile'})).status,503); // fourth attempt is still allowed; provider remains unavailable.
  assert.equal((await upload(1,{purpose:'profile'})).status,429,'durable per-member daily quota');
  const temp=await mkdtemp(path.join(tmpdir(),'hhr-photo-test-'));try{const local=createLocalStore(path.join(temp,'data.json')),entry={id:'a',accountId:'a',rideId:'r',purpose:'ride',publicId:'a'};assert(await local.reservePhoto(entry,1));assert(await local.reservePhoto({...entry,id:'b',publicId:'b'},1));assert.equal(await local.reservePhoto({...entry,id:'c',publicId:'c'},2),null);assert(await local.reservePhoto({...entry,id:'c',publicId:'c'},600002));}finally{await rm(temp,{recursive:true,force:true});}
  console.log('Member photos: binary validation, metadata removal, permissions, concurrent two-slot limit, idempotency, moderation, draft-only reuse, owner privacy, completed rides, durable quotas and local leases passed.');
}finally{await new Promise(r=>server.close(r));await pg.close();}
