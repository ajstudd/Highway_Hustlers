// Bootstrap the CDN BEFORE switching a production frontend to snapshot delivery.
// No credentials are printed; use the existing server-only variables securely.
import { createPostgresStore } from '../server/store.mjs';
import { createPublisher, seedGarage, seedPlaces, snapshotOf } from '../server/publication.mjs';
import { sessionToken } from '../server/security.mjs';

if (!process.env.DATABASE_URL || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw Error('Set the existing DATABASE_URL and Cloudinary server credentials in this shell. Never paste them into chat or source control.');
const publisher = createPublisher({ ...process.env, NODE_ENV: 'production', CMS_LOCAL_FILE: undefined });
if (!publisher.ready) throw Error('This environment is not ready to publish. Preview environments need their own CONTENT_SNAPSHOT_ID.');
const db = await createPostgresStore(process.env.DATABASE_URL);
const [places, garage] = await Promise.all([db.get(seedPlaces), db.getGarage(seedGarage)]);
console.log(JSON.stringify({ places: places.places.filter(p => p.published).length, bikes: garage.garage.bikes.length, placesRevision: places.revision, garageRevision: garage.revision, mode: process.argv.includes('--publish') ? 'publish' : 'dry-run' }));
if (!process.argv.includes('--publish')) {
  console.log('No publication made. Review the target environment, then rerun with --publish only when production rollout is approved.');
} else {
  const lock = sessionToken();
  if (!await db.acquirePublish(lock, Date.now())) throw Error('Another publication is running. Wait before retrying.');
  try {
    const [latestPlaces, latestGarage] = await Promise.all([db.get(seedPlaces), db.getGarage(seedGarage)]);
    const revision = `${latestPlaces.revision}-${latestGarage.revision}-${lock.slice(0,12)}`;
    const snapshot = snapshotOf(latestPlaces.places, latestGarage.garage, publisher.cloudName, revision, undefined, latestPlaces.upcomingRide);
    const result = await publisher.publish(snapshot, revision);
    const published = { ...result, revision: latestPlaces.revision, garageRevision: latestGarage.revision, snapshotRevision: revision };
    if (!await db.finishPublish(lock, published)) throw Error('The upload completed but its status could not be saved. Check before retrying.');
    console.log('Published the current saved content snapshot. Verify it before deploying the new public frontend.');
  } finally { await db.releasePublish(lock); }
}
