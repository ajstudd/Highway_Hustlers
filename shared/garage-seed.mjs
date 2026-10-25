import base from '../src/data/garage-seed.json' with { type: 'json' };
import drafts from '../src/data/garage-drafts.json' with { type: 'json' };
import additions from '../src/data/garage-additions.json' with { type: 'json' };
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

// Offer riders added to the seed after a catalogue already exists: the member,
// their bike and hero entry. Skipped once the bike or entry exists, so saved
// edits are never overwritten. The admin must still Save draft and Publish.
export function offerNewRiders(garage) {
  const members = [...garage.members], bikes = [...garage.bikes], lineup = [...garage.lineup];
  for (const entry of seedGarage.lineup.filter(e => additions.includes(e.id))) {
    if (lineup.some(e => e.id === entry.id) || bikes.some(b => b.id === entry.bikeId)) continue;
    if (bikes.length >= 150 || lineup.length >= 200) break;
    const member = seedGarage.members.find(m => m.id === entry.memberId);
    if (!members.some(m => m.id === member.id)) { if (members.length >= 150) break; members.push(structuredClone(member)); }
    bikes.push(structuredClone(seedGarage.bikes.find(b => b.id === entry.bikeId)));
    lineup.push(structuredClone(entry));
  }
  return lineup.length === garage.lineup.length ? garage : { members, bikes, lineup };
}
