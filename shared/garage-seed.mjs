import base from '../src/data/garage-seed.json' with { type: 'json' };
import drafts from '../src/data/garage-drafts.json' with { type: 'json' };
import { cleanGarage } from './garage.mjs';

const source = { ...base, bikes: [...base.bikes, ...drafts] };
export const localFramePaths = new Set(source.bikes.flatMap(b => b.frames.map(f => f.path)));
export const seedGarage = cleanGarage(source, localFramePaths);

// Offer new checked-in draft presets to existing catalogues without overwriting
// saved edits or assignments. The admin must still Save draft to persist them.
export function offerDraftBikes(garage) {
  const existing = new Set(garage.bikes.map(b => b.id));
  const missing = seedGarage.bikes.filter(b => b.status === 'draft' && !existing.has(b.id)).slice(0, Math.max(0, 150-garage.bikes.length));
  return missing.length ? { ...garage, bikes: [...garage.bikes, ...structuredClone(missing)] } : garage;
}
