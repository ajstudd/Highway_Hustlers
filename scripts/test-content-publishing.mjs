import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresStore } from '../server/store.mjs';
import { createCms } from '../server/cms.mjs';
import { hashPassword } from '../server/security.mjs';
import { cleanGarage, publicRiders } from '../shared/garage.mjs';
import { seedGarage, localFramePaths } from '../server/publication.mjs';
import { signBikeBatch, verifyBikeBatch, confirmedBikeFrame } from '../server/bike-uploads.mjs';

const password = 'Publication-test-password-only', hash = await hashPassword(password);
const pg = new PGlite(); let sqlCalls = 0;
const sql = async (strings, ...values) => { sqlCalls++; return (await pg.query(strings.reduce((q,s,i) => q+s+(i<values.length ? `$${i+1}` : ''), ''), values)).rows; };
const store = await createPostgresStore('', sql);
const env = { VERCEL: '1', ADMIN_PASSWORD_HASH: hash, CLOUDINARY_CLOUD_NAME: 'test-hh', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret' };
const assets = new Map(); let uploads = 0, lookups = 0, failAlias = false;
const cloud = async (url, options) => {
  if (options.method === 'POST') {
    assert(url.endsWith('/raw/upload'));
    const id = options.body.get('public_id'), json = JSON.parse(await options.body.get('file').text());
    assert(!JSON.stringify(json).includes('test-secret')); assert(!('garage' in json));
    uploads++;
    if (failAlias && id === 'hh-site/published.json') return new Response('', { status: 500 });
    assets.set(id, json); return Response.json({ public_id: id, version: uploads });
  }
  lookups++;
  const id = decodeURIComponent(url.split('/upload/')[1]);
  return Response.json({ public_id: id, resource_type: 'image', version: 12345, format: 'webp', width: 1200, height: 720, bytes: 10000 });
};
let handler = createCms(env, store, cloud);
const server = createServer((req,res) => handler(req,res)); await new Promise(r => server.listen(0,'127.0.0.1',r));
const base = `http://127.0.0.1:${server.address().port}`;
async function request(action, method = 'GET', body, cookie = '') {
  const response = await fetch(`${base}/api/cms?action=${action}`, { redirect: 'manual', method, headers: { Origin: base.replace('http:','https:'), 'Content-Type': 'application/json', 'X-HH-Admin': '1', Cookie: cookie }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, headers: response.headers, data: response.headers.get('content-type')?.includes('json') ? await response.json() : null };
}
try {
  const before = sqlCalls;
  for (let i = 0; i < 20; i++) {
    const publicRead = await request('public'); assert.equal(publicRead.status,302); assert.equal(publicRead.headers.get('location'),'https://res.cloudinary.com/test-hh/raw/upload/hh-site/published.json');
  }
  assert.equal(sqlCalls,before,'public requests must not initialize or query the database');
  assert.equal(lookups,0); assert.equal(uploads,0);
  for (const action of ['editor','garage','publish','sign-bike-upload','confirm-bike-upload']) assert.equal((await request(action, action === 'editor' ? 'GET' : 'POST', action === 'editor' ? undefined : {})).status,401);
  const login = await request('login','POST',{password}); assert.equal(login.status,200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const doc = (await request('editor','GET',undefined,cookie)).data;
  assert.equal(doc.garage.bikes.length,15); assert.equal(doc.garage.members.length,11);
  assert.equal(doc.garage.bikes.filter(b => b.status === 'published').reduce((n,b) => n+b.frames.length,0),273);
  assert.equal(doc.garage.bikes.filter(b => b.status === 'draft').length,3);
  let result = await request('publish','POST',{revision:doc.revision,garageRevision:doc.garageRevision},cookie); assert.equal(result.status,200);
  assert.equal(assets.get('hh-site/published.json').riders.length,12);
  const garage = structuredClone(doc.garage);
  garage.members.find(m => m.id === 'junaid-a').active = false;
  garage.bikes.find(b => b.id === 'classic-350').status = 'draft';
  garage.lineup.find(e => e.bikeId === 'tvs-raider-125').visible = false;
  garage.lineup.find(e => e.bikeId === 'ninja-300').memberId = 'anjali';
  const saved = await request('garage','PUT',{revision:doc.garageRevision,garage},cookie); assert.equal(saved.status,200);
  assert.equal(assets.get('hh-site/published.json').riders.length,12,'saving must not publish');
  assert.equal((await request('garage','PUT',{revision:doc.garageRevision,garage},cookie)).status,409);
  const publish = {revision:doc.revision,garageRevision:saved.data.revision};
  const count = uploads;
  assert.equal((await request('publish','POST',{...publish,garageRevision:0},cookie)).status,409); assert.equal(uploads,count);
  failAlias = true;
  assert.equal((await request('publish','POST',publish,cookie)).status,502);
  assert.equal(assets.get('hh-site/published.json').riders.length,12,'failed alias update keeps the previous live snapshot');
  assert.equal((await request('editor','GET',undefined,cookie)).data.published.garageRevision,0);
  failAlias = false;
  assert.equal((await request('publish','POST',publish,cookie)).status,200);
  const snapshot = assets.get('hh-site/published.json');
  assert.equal(snapshot.riders.length,8);
  assert(!snapshot.riders.some(r => r.id === 'classic-350' || r.id === 'tvs-raider-125' || r.name === 'Junaid A'));
  assert.equal(snapshot.riders.find(r => r.id === 'ninja-300').name,'Anjali');
  assert(!JSON.stringify(snapshot).includes('memberId')); assert(!JSON.stringify(snapshot).includes('session'));
  assert(await store.acquirePublish('test-lock',Date.now()));
  assert.equal((await request('publish','POST',publish,cookie)).status,409); await store.releasePublish('test-lock');
  const signed = await request('sign-bike-upload','POST',{count:2,transformation:'unsafe',overwrite:true},cookie); assert.equal(signed.status,200);
  assert.equal(signed.data.uploads[0].params.overwrite,'false'); assert(!('transformation' in signed.data.uploads[0].params));
  assert.equal((await request('confirm-bike-upload','POST',{ticket:signed.data.ticket+'x',uploaded:[true,true]},cookie)).status,400);
  const confirmed = await request('confirm-bike-upload','POST',{ticket:signed.data.ticket,uploaded:[true,true]},cookie); assert.equal(confirmed.status,200); assert.equal(confirmed.data.frames.length,2);
  const previousLookups = lookups;
  await request('confirm-bike-upload','POST',{ticket:signed.data.ticket,uploaded:[false,false]},cookie);
  assert.equal(lookups,previousLookups,'confirmed assets should not repeatedly consume Cloudinary Admin API calls');
  const migrated = structuredClone(saved.data.garage); migrated.bikes[0].frames[0] = confirmed.data.frames[0];
  assert.equal((await request('garage','PUT',{revision:saved.data.revision,garage:migrated},cookie)).status,200,'persist a partial migration with the remaining local frames intact');
  const forged = structuredClone(migrated); forged.bikes[0].frames[0].publicId = 'hh-bikes/unconfirmed/00';
  assert.equal((await request('garage','PUT',{revision:saved.data.revision+1,garage:forged},cookie)).status,400);
  const empty = {...migrated,lineup:[]}; assert.deepEqual(publicRiders(cleanGarage(empty,localFramePaths)),[],'intentional empty lineup must not restore source riders');
  const invalid = structuredClone(seedGarage); invalid.bikes[0].frames[0].path = '/../../secret'; assert.throws(() => cleanGarage(invalid,localFramePaths));
  invalid.bikes[0].frames = []; assert.throws(() => cleanGarage(invalid,localFramePaths));
  const batch = signBikeBatch(1,'a'.repeat(24),'session','secret',1000);
  assert.throws(() => verifyBikeBatch(batch.ticket,'other','secret',1000)); assert.throws(() => verifyBikeBatch(batch.ticket,'session','secret',3601001));
  assert.throws(() => confirmedBikeFrame({ public_id:'hh-bikes/a/0',resource_type:'image',width:800,height:720,bytes:10 },'hh-bikes/a/0'));
  const dbBefore = sqlCalls;
  await request('public'); assert.equal(sqlCalls,dbBefore);
  handler = createCms({...env,VERCEL_ENV:'preview'},store,cloud);
  assert.equal((await request('publish','POST',publish,cookie)).status,503,'preview must not overwrite production snapshot IDs');
  console.log('Publishing: zero public DB queries, real Postgres revisions, drafts, hidden/inactive filtering, reassignment, failure recovery, locks, cached frame verification, safe partial migration and preview isolation passed.');
} finally { await new Promise(r => server.close(r)); await pg.close(); }
