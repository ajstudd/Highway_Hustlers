import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresStore, createLocalStore } from '../server/store.mjs';
import { createCms } from '../server/cms.mjs';
import { hashPassword } from '../server/security.mjs';
import { snapshotOf, seedGarage, seedPlaces } from '../server/publication.mjs';
import { validateSnapshot } from '../shared/public-snapshot.mjs';
import { cleanUpcomingRide, emptyUpcomingRide } from '../shared/upcoming-ride.mjs';

const image = { id: 'ride-photo', type: 'image', publicId: 'hh-mornings/test-ride', version: 1, width: 1600, height: 1000, caption: 'Test-only ride photograph' };
const ride = { ...emptyUpcomingRide(), published: true, location: 'Test destination', description: 'Test-only announcement, not a scheduled HH ride.', meetingPoint: 'Test meeting point', date: '2026-11-01', meetingTime: '06:00' };
assert.equal(cleanUpcomingRide(null), null);
assert.deepEqual(cleanUpcomingRide(emptyUpcomingRide()), emptyUpcomingRide());
assert.equal(cleanUpcomingRide(ride).images.length, 0, 'photos are optional');
for (const field of ['location', 'description', 'meetingPoint']) assert.throws(() => cleanUpcomingRide({ ...ride, [field]: '' }), /location, description and meeting point/);
for (const mapsUrl of ['https://maps.app.goo.gl/example', 'https://www.google.com/maps/search/?api=1&query=Bhopal', 'https://goo.gl/maps/example', 'https://maps.google.com/?q=Bhopal']) assert.equal(cleanUpcomingRide({ ...ride, mapsUrl }).mapsUrl, mapsUrl);
for (const mapsUrl of ['javascript:alert(1)', 'https://evil.example/maps', 'https://google.com.evil.example/maps', 'https://google.com/search?q=x', 'https://user:password@google.com/maps', 'http://maps.app.goo.gl/test']) assert.throws(() => cleanUpcomingRide({ ...ride, mapsUrl }), /Google Maps/);
for (const date of ['2026-02-30', '2026-13-01', '2026-2-01']) assert.throws(() => cleanUpcomingRide({ ...ride, date }), /valid ride date/);
assert.throws(() => cleanUpcomingRide({ ...ride, meetingTime: '24:30' }), /valid meeting time/);
assert.throws(() => cleanUpcomingRide({ ...ride, images: [{ ...image, type: 'video' }] }), /not videos/);
assert.throws(() => cleanUpcomingRide({ ...ride, images: [image, image] }), /only once/);
assert.throws(() => cleanUpcomingRide({ ...ride, notes: 'a'.repeat(1201) }));
assert.throws(() => cleanUpcomingRide({ ...ride, images: Array(7).fill(image) }), /six photos/);
const old = snapshotOf(seedPlaces, seedGarage, 'test-hh', 'old'); delete old.upcomingRide;
assert.equal(validateSnapshot(old).upcomingRide, null, 'old publications and cached copies remain compatible');
assert.equal(snapshotOf(seedPlaces, seedGarage, 'test-hh', 'draft', undefined, { ...ride, published: false }).upcomingRide, null);
assert.equal(validateSnapshot(snapshotOf(seedPlaces, seedGarage, 'test-hh', 'ride', undefined, ride)).upcomingRide.location, ride.location);

const pg = new PGlite(); let calls = 0;
const sql = async (strings, ...values) => { calls++; return (await pg.query(strings.reduce((q,s,i) => q+s+(i<values.length ? `$${i+1}` : ''), ''), values)).rows; };
// Simulate an existing installation: the migration must preserve its gallery.
await pg.exec(`CREATE TABLE hh_gallery (id INTEGER PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, places JSONB NOT NULL DEFAULT '[]'); INSERT INTO hh_gallery VALUES (1,7,'[]');`);
const store = await createPostgresStore('', sql);
assert.equal((await store.get(seedPlaces)).revision, 7);
await createPostgresStore('', sql); // Additive migration is safe to repeat.
const temp = await mkdtemp(path.join(tmpdir(), 'hh-upcoming-test-'));
const localFile = path.join(temp, 'content.json');
const password = 'Upcoming-ride-test-password-only';
const env = { ADMIN_PASSWORD_HASH: await hashPassword(password), CMS_LOCAL_FILE: localFile };
const handler = createCms(env, store);
const server = createServer(handler); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function request(action, method = 'GET', body, cookie = '') {
  const result = await fetch(`${base}/api/cms?action=${action}`, { method, headers: { Origin: base, 'Content-Type': 'application/json', 'X-HH-Admin': '1', Cookie: cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: result.status, headers: result.headers, data: await result.json() };
}
try {
  assert.equal((await request('upcoming-ride', 'PUT', { revision: 7, upcomingRide: ride })).status, 401);
  const login = await request('login', 'POST', { password }); const cookie = login.headers.get('set-cookie').split(';')[0];
  let doc = (await request('editor', 'GET', undefined, cookie)).data; assert.equal(doc.upcomingRide, null);
  let saved = await request('upcoming-ride', 'PUT', { revision: doc.revision, upcomingRide: { ...ride, images: [image] } }, cookie);
  assert.equal(saved.status, 200); assert.equal(saved.data.revision, 8);
  assert.equal((await request('public')).data.upcomingRide, null, 'saving cannot publish an announcement');
  assert.equal((await request('upcoming-ride', 'PUT', { revision: doc.revision, upcomingRide: ride }, cookie)).status, 409);
  assert.equal((await request('publish', 'POST', { revision: doc.revision, garageRevision: doc.garageRevision }, cookie)).status, 409);
  assert.equal((await request('upcoming-ride', 'PUT', { revision: 8, upcomingRide: { ...ride, mapsUrl: 'javascript:bad' } }, cookie)).status, 400);
  assert.equal((await request('publish', 'POST', { revision: 8, garageRevision: doc.garageRevision }, cookie)).status, 200);
  assert.equal((await request('public')).data.upcomingRide.images[0].id, image.id);
  saved = await request('places', 'PUT', { revision: 8, places: seedPlaces }, cookie); assert.equal(saved.status, 200);
  assert.equal((await request('editor', 'GET', undefined, cookie)).data.upcomingRide.location, ride.location, 'saving places preserves the ride');
  saved = await request('upcoming-ride', 'PUT', { revision: 9, upcomingRide: { ...ride, published: false } }, cookie); assert.equal(saved.status, 200);
  assert.equal((await request('public')).data.upcomingRide.location, ride.location, 'hiding a draft still needs publish');
  await request('publish', 'POST', { revision: 10, garageRevision: doc.garageRevision }, cookie);
  assert.equal((await request('public')).data.upcomingRide, null);
  const before = calls; for (let i = 0; i < 5; i++) await request('public'); assert.equal(calls, before, 'public reads execute zero SQL queries');
  const local = createLocalStore(path.join(temp, 'local.json'));
  const initial = await local.get(seedPlaces);
  await local.saveUpcomingRide(ride, initial.revision); await local.save(seedPlaces.slice(1), initial.revision + 1);
  assert.equal((await createLocalStore(path.join(temp, 'local.json')).get(seedPlaces)).upcomingRide.location, ride.location);
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'); assert(app.indexOf('<UpcomingRide />') > app.indexOf('<RouteMap />') && app.indexOf('<UpcomingRide />') < app.indexOf('<Join />'));
  const join = await readFile(new URL('../src/components/Join.tsx', import.meta.url), 'utf8'); assert(!join.includes('Find the next ride on Instagram'));
  console.log('Upcoming ride: optional fields/photos, safe Maps URLs, migration, local persistence, auth, revision conflicts, publish/hide separation, old JSON compatibility, zero public DB queries and section placement passed.');
} finally { await new Promise(resolve => server.close(resolve)); await pg.close(); await rm(temp, { recursive: true }); }
