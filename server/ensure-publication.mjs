import { createPostgresStore } from './store.mjs';
import { createPublisher, seedGarage, seedPlaces, snapshotOf } from './publication.mjs';
import { sessionToken } from './security.mjs';
import { validateSnapshot } from '../shared/public-snapshot.mjs';

// Runs during the production BUILD, never from a visitor request. Existing
// publications are checked without querying Neon or publishing newer drafts.
export async function ensureProductionPublication(env, { fetcher = fetch, storeFactory = createPostgresStore, wait = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production') return 'skipped';
  const publisher = createPublisher(env, fetcher);
  if ((env.VITE_CLOUDINARY_CLOUD_NAME || 'jr5po5s7') !== publisher.cloudName || (env.VITE_CONTENT_SNAPSHOT_ID || 'hh-site/published.json') !== (env.CONTENT_SNAPSHOT_ID || 'hh-site/published.json')) throw Error('Public content configuration does not match server configuration. Check the matching public cloud name and snapshot ID in Vercel.');
  async function read() {
    const response = await fetcher(publisher.snapshotUrl, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (response.status === 404) return null;
    if (!response.ok || Number(response.headers.get('content-length')) > 1500000) throw Error('Published content is unavailable.');
    const body = await response.text();
    if (body.length > 1500000) throw Error('Published content is too large.');
    const snapshot = validateSnapshot(JSON.parse(body));
    if (snapshot.cloudName !== publisher.cloudName) throw Error('Published content uses a different media environment.');
    return snapshot;
  }
  try {
    if (await read()) return 'existing';
    if (!env.DATABASE_URL || !publisher.ready) throw Error('First publication needs DATABASE_URL and the Cloudinary server credentials in Vercel Production.');
    const db = await storeFactory(env.DATABASE_URL);
    await db.getGarage(seedGarage);
    const lock = sessionToken();
    if (!await db.acquirePublish(lock, Date.now())) throw Error('Another publication is running. Retry this deployment shortly.');
    try {
      // Recheck after locking: another build/admin may have just published.
      if (await read()) return 'existing';
      const [places, garage] = await Promise.all([db.get(seedPlaces), db.getGarage(seedGarage)]);
      if (garage.published) throw Error('An earlier publication is missing from the CDN. Restore it or explicitly publish in the dashboard; deployment will not publish newer drafts automatically.');
      const revision = `${places.revision}-${garage.revision}-${lock.slice(0,12)}`;
      const snapshot = snapshotOf(places.places, garage.garage, publisher.cloudName, revision);
      const result = await publisher.publish(snapshot, revision);
      if (!await db.finishPublish(lock, { ...result, revision: places.revision, garageRevision: garage.revision, snapshotRevision: revision })) throw Error('First content upload completed but its status could not be saved. Retry the deployment.');
      // Check the exact URL the browser will use, allowing bounded propagation.
      for (let attempt = 0; attempt < 4; attempt++) {
        try { if ((await read())?.revision === revision) return 'created'; } catch { /* Retry briefly; never replace content again here. */ }
        if (attempt < 3) await wait(1000 * (attempt+1));
      }
      throw Error('The first content file is uploaded but not readable from the CDN yet. Retry the deployment.');
    } finally { await db.releasePublish(lock); }
  } catch (error) {
    // Do not print provider exceptions, response bodies or database credentials.
    if (/^(First publication needs|Another publication|An earlier publication|First content upload|The first content file)/.test(error.message || '')) throw error;
    throw Error('Could not prepare or verify public content. Check the Neon/Cloudinary Production settings in Vercel and retry the deployment. Existing saved data is unchanged.');
  }
}
