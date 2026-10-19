import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresStore } from '../server/store.mjs';
import { ensureProductionPublication } from '../server/ensure-publication.mjs';
import { snapshotOf, seedPlaces, seedGarage } from '../server/publication.mjs';
import { validateSnapshot } from '../shared/public-snapshot.mjs';

const pg = new PGlite();
let dbCalls = 0, uploads = 0, requests = 0, failUpload = false, deliveryStatus = 200, staleReads = 0;
const sql = async (strings, ...values) => { dbCalls++; return (await pg.query(strings.reduce((q,s,i) => q+s+(i<values.length ? `$${i+1}` : ''), ''), values)).rows; };
const db = await createPostgresStore('', sql), assets = new Map();
const alias = 'hh-site/published.json';
const env = { VERCEL: '1', VERCEL_ENV: 'production', DATABASE_URL: 'test-only', CLOUDINARY_CLOUD_NAME: 'test-hh', VITE_CLOUDINARY_CLOUD_NAME: 'test-hh', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret' };
const fetcher = async (url, options) => {
  requests++;
  if (options.method === 'POST') {
    uploads++;
    if (failUpload) return new Response('', { status: 500 });
    const id = options.body.get('public_id'), snapshot = JSON.parse(await options.body.get('file').text());
    validateSnapshot(snapshot); assert(!JSON.stringify(snapshot).includes('test-secret'));
    assets.set(id, snapshot); return Response.json({ public_id: id, version: uploads });
  }
  assert.equal(url, 'https://res.cloudinary.com/test-hh/raw/upload/hh-site/published.json');
  if (deliveryStatus !== 200) return new Response('', { status: deliveryStatus });
  if (!assets.has(alias)) return new Response('', { status: 404 });
  if (staleReads-- > 0) return new Response('', { status: 404 });
  return Response.json(assets.get(alias));
};
const options = { fetcher, storeFactory: async () => db, wait: async () => {} };
try {
  const before = dbCalls;
  for (const settings of [{}, { ...env, VERCEL_ENV: 'preview' }, { ...env, VERCEL: undefined }, { ...env, VERCEL_ENV: undefined }]) assert.equal(await ensureProductionPublication(settings, options), 'skipped');
  assert.equal(requests, 0); assert.equal(dbCalls, before);
  await assert.rejects(ensureProductionPublication({ ...env, VITE_CONTENT_SNAPSHOT_ID: 'wrong.json' }, options), /configuration/);
  await assert.rejects(ensureProductionPublication({ ...env, CLOUDINARY_API_SECRET: '' }, options), /First publication needs/);
  assert.equal(dbCalls, before);
  failUpload = true;
  await assert.rejects(ensureProductionPublication(env, options), /Could not prepare/);
  assert.equal((await db.getGarage(seedGarage)).published, null);
  assert(!assets.has(alias));
  failUpload = false; staleReads = 2;
  assert.equal(await ensureProductionPublication(env, options), 'created');
  const published = assets.get(alias), state = await db.getGarage(seedGarage);
  assert.equal(published.riders.length, 11); assert.equal(state.published.snapshotRevision, published.revision);
  const changed = structuredClone(state.garage); changed.members[0].active = false;
  await db.saveGarage(changed, state.revision);
  const savedCalls = dbCalls, savedUploads = uploads;
  assert.equal(await ensureProductionPublication(env, options), 'existing');
  assert.equal(dbCalls, savedCalls, 'subsequent builds need no database query');
  assert.equal(uploads, savedUploads, 'redeploying must never publish saved drafts');
  assert.equal(assets.get(alias).riders.length, 11);
  assets.delete(alias);
  await assert.rejects(ensureProductionPublication(env, options), /An earlier publication/);
  assert.equal(uploads, savedUploads, 'missing CDN file is not permission to publish newer drafts');
  assets.set(alias, published);
  deliveryStatus = 503;
  const unavailableCalls = dbCalls;
  await assert.rejects(ensureProductionPublication(env, options), /Could not prepare/);
  assert.equal(dbCalls, unavailableCalls); assert.equal(uploads, savedUploads);
  deliveryStatus = 200;
  assets.set(alias, { schemaVersion: 1 });
  await assert.rejects(ensureProductionPublication(env, options), /Could not prepare/);
  assets.set(alias, snapshotOf(seedPlaces, { ...seedGarage, lineup: [] }, 'test-hh', 'empty'));
  assert.equal(await ensureProductionPublication(env, options), 'existing', 'an intentionally empty lineup is valid');
  console.log('Production bootstrap: first publication, verified CDN delivery, failure recovery, environment isolation, matching configuration, no DB reads on later builds, no automatic draft publication and empty lineup passed.');
} finally { await pg.close(); }
