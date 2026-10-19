import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { seedGarage, localFramePaths } from '../shared/garage-seed.mjs';
import seedPlaces from '../src/data/gallery-seed.json' with { type: 'json' };
import { cleanGarage, publicRiders } from '../shared/garage.mjs';
import { cleanPlaces } from './content.mjs';
import { uploadSignature } from './uploads.mjs';

export { seedGarage, seedPlaces, localFramePaths };
export function snapshotOf(places, garage, cloudName, revision, publishedAt = new Date().toISOString()) {
  return { schemaVersion: 1, revision, publishedAt, cloudName,
    places: cleanPlaces(places).filter(p => p.published), riders: publicRiders(cleanGarage(garage, localFramePaths)) };
}
export function createPublisher(env, fetcher = fetch) {
  const local = env.VERCEL !== '1' && env.NODE_ENV !== 'production' && env.CMS_LOCAL_FILE;
  const development = env.VERCEL !== '1' && env.NODE_ENV !== 'production';
  const cloudName = env.CLOUDINARY_CLOUD_NAME || 'jr5po5s7';
  const publicId = env.CONTENT_SNAPSHOT_ID || 'hh-site/published.json';
  if (!/^[a-zA-Z0-9_-]+$/.test(cloudName) || !/^[a-zA-Z0-9_/-]+\.json$/.test(publicId) || publicId.includes('..')) throw Error('Invalid public content configuration.');
  const snapshotUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${publicId}`;
  const ready = !!local || (!!env.CLOUDINARY_API_KEY && !!env.CLOUDINARY_API_SECRET && (env.VERCEL_ENV !== 'preview' || !!env.CONTENT_SNAPSHOT_ID));
  async function upload(json, id, overwrite) {
    const params = { public_id: id, timestamp: String(Math.floor(Date.now()/1000)), overwrite: String(overwrite), invalidate: String(overwrite) };
    const form = new FormData();
    for (const [key, value] of Object.entries(params)) form.set(key, value);
    form.set('api_key', env.CLOUDINARY_API_KEY); form.set('signature', uploadSignature(params, env.CLOUDINARY_API_SECRET));
    form.set('file', new Blob([json], { type: 'application/json' }), 'content.json');
    const response = await fetcher(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, { method: 'POST', body: form, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('Publishing failed. Your saved draft is safe; retry publishing.');
    const result = await response.json();
    if (result.public_id !== id || !Number.isSafeInteger(result.version)) throw Error('Could not confirm the publication. Retry publishing.');
    return result;
  }
  return { cloudName, snapshotUrl, ready, local: !!local, development,
    async readLocal() {
      if (!local && development) return snapshotOf(seedPlaces, seedGarage, cloudName, 'local-seed');
      if (!local) throw Error('Local publishing is not enabled.');
      try { return JSON.parse(await readFile(`${local}.published.json`, 'utf8')); }
      catch (error) { if (error.code !== 'ENOENT') throw error; return snapshotOf(seedPlaces, seedGarage, cloudName, 'local-seed'); }
    },
    async publish(snapshot, releaseId) {
      if (!ready) throw Error('Publishing needs Cloudinary credentials and a separate snapshot ID for Preview environments.');
      const json = JSON.stringify(snapshot);
      if (Buffer.byteLength(json) > 1500000) throw Error('The public content file is too large. Reduce the number of items.');
      if (local) {
        await mkdir(dirname(local), { recursive: true });
        await writeFile(`${local}.published.json.tmp`, json, { mode: 0o600 });
        await rename(`${local}.published.json.tmp`, `${local}.published.json`);
        return { url: '/content.json', publishedAt: snapshot.publishedAt };
      }
      // Keep an immutable recovery copy before replacing the public alias.
      const release = publicId.replace(/\.json$/, `/releases/${releaseId}.json`);
      await upload(json, release, false);
      await upload(json, publicId, true);
      return { url: snapshotUrl, publishedAt: snapshot.publishedAt };
    },
  };
}
