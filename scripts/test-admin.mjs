import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresStore, createLocalStore } from '../server/store.mjs';
import { createCms } from '../server/cms.mjs';
import { hashPassword, verifyPassword, digest, sessionCookie } from '../server/security.mjs';
import { cleanPlaces } from '../server/content.mjs';
import { policy, uploadParameters, uploadSignature, uploadTicket, verifyUploadTicket, validateUploadSize } from '../server/uploads.mjs';
import seed from '../src/data/gallery-seed.json' with {type:'json'};

const password = 'A-test-only-long-password';
const hash = await hashPassword(password);
assert(await verifyPassword(password,hash)); assert(!await verifyPassword('wrong',hash)); assert(!await verifyPassword(password,'bad-hash'));
assert.match(sessionCookie('abc',true),/__Host-hh_admin=abc; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
assert.throws(()=>cleanPlaces([{...seed[0],media:[{id:'bad',type:'image',publicId:'../bad',version:1,width:1,height:1,caption:''}]}]));
assert.throws(()=>cleanPlaces([{...seed[0],legacyId:undefined,media:[]}]),/photo or video/);
assert.throws(()=>cleanPlaces([seed[0],seed[0]]),/unique/);
const pg = new PGlite();
const sql = async (strings,...values) => (await pg.query(strings.reduce((q,s,i)=>q+s+(i<values.length?`$${i+1}`:''),''),values)).rows;
const store = await createPostgresStore('',sql);
const env = { ADMIN_PASSWORD_HASH:hash,CLOUDINARY_CLOUD_NAME:'jr5po5s7',CLOUDINARY_API_KEY:'test-key',CLOUDINARY_API_SECRET:'test-secret' };
let cloudCalls = 0, storedBytes = 1000000, storedDimension = 2048;
const cloud = async (url,options)=>{
  cloudCalls++; assert.match(url,/^https:\/\/api.cloudinary.com\/v1_1\/jr5po5s7\/resources\/image\/upload[?\/]/);
  assert.equal(options.headers.Authorization,`Basic ${Buffer.from('test-key:test-secret').toString('base64')}`);
  if (!url.includes('?')) return Response.json({asset_id:'confirmed-image',public_id:decodeURIComponent(url.split('/upload/')[1]),resource_type:'image',bytes:storedBytes,version:1792211673,width:storedDimension,height:1000});
  return Response.json({resources:[{asset_id:'test-image',public_id:'IMG20261011140502',version:1792211673,width:4080,height:3072}],next_cursor:'test-cursor'});
};
let handler = createCms(env,store,cloud);
const server = createServer((req,res)=>handler(req,res)); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function request(action,{method='GET',body,cookie='',origin=base,headers={}}={}) {
  const response = await fetch(`${base}/api/cms?action=${action}`,{method,headers:{Origin:origin,'Content-Type':'application/json','X-HH-Admin':'1',Cookie:cookie,...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,headers:response.headers,data:await response.json()};
}
try {
  assert.equal((await request('public')).data.places.length,7); assert.equal(cloudCalls,0);
  for(const action of ['places','library','sign-upload','confirm-upload']) assert.equal((await request(action,{method:action.endsWith('upload')?'POST':'GET',body:action.endsWith('upload')?{}:undefined})).status,401);
  assert.equal((await request('login',{method:'POST',body:{password},origin:'https://evil.example'})).status,403);
  assert.equal((await request('login',{method:'POST',body:{password},headers:{'X-HH-Admin':''}})).status,403);
  assert.equal((await request('login',{method:'POST',body:{password:'wrong'}})).status,401);
  const login = await request('login',{method:'POST',body:{password}}); assert.equal(login.status,200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'),/HttpOnly/); assert.equal(login.headers.get('cache-control'),'no-store');
  assert.equal((await request('session',{cookie})).data.authenticated,true);
  const original = (await request('places',{cookie})).data;
  const media = {id:'test-image',type:'image',publicId:'IMG20261011140502',version:1792211673,width:4080,height:3072,caption:'An actual HH ride photo'};
  const draft = {...seed[0],id:'test-draft',legacyId:undefined,name:'Private draft',published:false,media:[media]};
  const updated = [{...seed[0],description:'Updated from the dashboard',media:[media]},draft,...seed.slice(1)];
  const saved = await request('places',{method:'PUT',cookie,body:{revision:original.revision,places:updated}}); assert.equal(saved.status,200);
  const publicData = (await request('public')).data;
  assert.equal(publicData.places[0].description,'Updated from the dashboard'); assert(!publicData.places.some(p=>p.id==='test-draft')); assert.equal(publicData.places[0].media[0].publicId,media.publicId);
  assert.equal((await request('places',{method:'PUT',cookie,body:{revision:original.revision,places:updated}})).status,409,'stale tabs cannot overwrite newer changes');
  assert.equal((await request('places',{method:'PUT',cookie,body:{revision:saved.data.revision,places:[{...draft,lat:500}]}})).status,400);
  const library = await request('library',{cookie}); assert.equal(library.status,200); assert.equal(library.data.media[0].publicId,media.publicId); assert.equal(cloudCalls,1);
  for (const type of ['image','video']) {
    assert.equal((await request('sign-upload',{method:'POST',cookie,body:{type,sourceBytes:25000001,bytes:1000000}})).status,400);
    assert.equal((await request('sign-upload',{method:'POST',cookie,body:{type,sourceBytes:25000000,bytes:25000001}})).status,400);
    assert.equal((await request('sign-upload',{method:'POST',cookie,body:{type}})).status,400);
  }
  assert.equal((await request('sign-upload',{method:'POST',cookie,body:{type:'image',sourceBytes:10000000,bytes:1500001}})).status,400);
  const video = await request('sign-upload',{method:'POST',cookie,body:{type:'video',sourceBytes:25000000,bytes:25000000}}); assert.equal(video.status,200);
  assert.match(video.data.params.transformation,/w_1280/); assert.match(video.data.params.transformation,/vc_h264/); assert.match(video.data.params.transformation,/f_mp4/);
  const signature = await request('sign-upload',{method:'POST',cookie,body:{type:'image',sourceBytes:25000000,bytes:1000000,eager:'unsafe',overwrite:true}}); assert.equal(signature.status,200);
  assert.equal(signature.data.params.overwrite,'false'); assert(!('eager' in signature.data.params)); assert(!JSON.stringify(signature.data).includes('test-secret'));
  assert.match(signature.data.signature,/^[a-f0-9]{64}$/); assert.equal(signature.data.params.folder,'hh-mornings');
  assert.equal(signature.data.signature,uploadSignature(signature.data.params,'test-secret'),'incoming transformations are covered by the upload signature');
  assert.match(signature.data.params.transformation,/w_2048/);
  assert.equal((await request('confirm-upload',{method:'POST',cookie,body:{ticket:signature.data.ticket+'x'}})).status,400);
  const confirmed=await request('confirm-upload',{method:'POST',cookie,body:{ticket:signature.data.ticket}}); assert.equal(confirmed.status,200); assert.equal(confirmed.data.media.id,'confirmed-image');
  storedBytes=policy.maxSourceBytes+1;
  assert.equal((await request('confirm-upload',{method:'POST',cookie,body:{ticket:signature.data.ticket}})).status,400,'oversized provider assets cannot enter the album');
  storedBytes=1000000; storedDimension=3000;
  assert.equal((await request('confirm-upload',{method:'POST',cookie,body:{ticket:signature.data.ticket}})).status,400,'unoptimized provider assets cannot enter the album');
  storedDimension=2048;
  const payload={publicId:'hh-mornings/'+ 'a'.repeat(24),type:'image',session:'test-session',expires:Date.now()+1000};
  const ticket=uploadTicket(payload,'test-secret'); assert.equal(verifyUploadTicket(ticket,'test-session','test-secret').publicId,payload.publicId);
  assert.throws(()=>verifyUploadTicket(ticket,'another-session','test-secret'));
  assert.throws(()=>verifyUploadTicket(ticket,'test-session','test-secret',Date.now()+2000));
  assert.throws(()=>validateUploadSize({type:'image',sourceBytes:0,bytes:1}));
  assert.equal(uploadParameters('image','id',123).backup,'false');
  await request('logout',{method:'POST',cookie,body:{}}); assert.equal((await request('places',{cookie})).status,401,'logout invalidates the server-side session');
  const fresh = await request('login',{method:'POST',body:{password}}); const token = fresh.headers.get('set-cookie').split(';')[0];
  handler=createCms({...env,ADMIN_PASSWORD_HASH:await hashPassword('A-different-test-password')},store,cloud);
  assert.equal((await request('places',{cookie:token})).status,401,'password rotation invalidates old sessions');
  handler=createCms(env,store,cloud);
  for(let i=0;i<11;i++) await request('login',{method:'POST',body:{password:'wrong'}});
  assert.equal((await request('login',{method:'POST',body:{password}})).status,429,'persistent rate limiting blocks password attempts');
  const rows = await sql`SELECT token FROM hh_sessions`; assert(rows.every(r=>r.token.length===64 && !token.includes(r.token)),'only token digests are persisted');
  handler=createCms({VERCEL:'1',CMS_LOCAL_FILE:'/tmp/never-used',ADMIN_PASSWORD_HASH:hash});
  assert.equal((await request('session')).data.setupRequired,true,'production never falls back to local filesystem storage');
  handler=createCms({}); assert.equal((await request('session')).data.setupRequired,true); assert.equal((await request('places')).status,503);
  const temp=await mkdtemp(path.join(tmpdir(),'hh-admin-test-'));
  try {
    const filename=path.join(temp,'content.json');const local=createLocalStore(filename); const first=await local.get(seed);
    const writes=await Promise.all([local.save(updated,first.revision),local.save([],first.revision)]); assert.equal(writes.filter(Boolean).length,1);
    assert.equal((await createLocalStore(filename).get(seed)).places.length,8,'local development changes survive reloads');
  } finally { await rm(temp,{recursive:true}); }
  console.log('Admin: real Postgres schema, login, CSRF, private APIs, published-only feed, concurrent saves, upload signatures, library, logout, password rotation, persistent throttling and fail-closed setup passed.');
} finally { await new Promise(resolve=>server.close(resolve)); await pg.close(); }
