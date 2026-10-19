import { cleanGarage, publicRiders } from './garage.mjs';
import { cleanPlaces } from '../server/content.mjs';
import seed from '../src/data/garage-seed.json' with { type: 'json' };

const paths = new Set(seed.bikes.flatMap(b => b.frames.map(f => f.path)));
// Shared by the browser and deployment check: a successful HTTP response alone
// must not enable a deployment with content the browser cannot read.
export function validateSnapshot(s) {
  if (!s || s.schemaVersion !== 1 || typeof s.revision !== 'string' || s.revision.length > 100 || typeof s.publishedAt !== 'string' || !Number.isFinite(Date.parse(s.publishedAt)) || !/^[a-zA-Z0-9_-]+$/.test(s.cloudName) || !Array.isArray(s.riders) || s.riders.length > 200) throw Error('Invalid published content.');
  if (new Set(s.riders.map(r => r.id)).size !== s.riders.length) throw Error('Duplicate published entry.');
  const riders = s.riders.flatMap(r => publicRiders(cleanGarage({
    members: [{ id: r.id, name: r.name, active: true, role: r.role || '', line: r.line || '' }],
    bikes: [{ ...r, id: r.id, status: 'published', frames: r.frameAssets }],
    lineup: [{ id: r.id, memberId: r.id, bikeId: r.id, visible: true }],
  }, paths)));
  return { schemaVersion: 1, revision: s.revision, publishedAt: s.publishedAt, cloudName: s.cloudName, places: cleanPlaces(s.places).filter(p => p.published), riders };
}
