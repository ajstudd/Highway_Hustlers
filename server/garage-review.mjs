import { isDeepStrictEqual } from 'node:util';
import { cleanGarage, publicRiders } from '../shared/garage.mjs';
import { localFramePaths, seedGarage } from '../shared/garage-seed.mjs';
import { digest } from './security.mjs';

const sections = {
  members: { id: 'hero-members', title: 'Hero members', label: member => member.name },
  bikes: { id: 'bike-library', title: 'Bike library', label: bike => [bike.brand, bike.model, bike.colorName].filter(Boolean).join(' · ') || 'Untitled bike' },
  lineup: { id: 'hero-lineup', title: 'Hero lineup', label: (entry, garage) => {
    const member = garage.members.find(item => item.id === entry.memberId);
    const bike = garage.bikes.find(item => item.id === entry.bikeId);
    return [member.name, bike.model || 'Untitled bike'].join(' · ');
  } },
};
const bikeAvailability = { draft: 'in preparation', published: 'available for hero', hidden: 'hidden from hero' };

export function publishedGarageFor(site, live) {
  if (site.publishedGarage) return cleanGarage(site.publishedGarage, localFramePaths);
  if (!live) return { members: [], bikes: [], lineup: [] };
  const saved = cleanGarage(site.garage, localFramePaths);
  if (isDeepStrictEqual(publicRiders(saved), live.riders)) return saved;

  // Older releases only stored flattened public riders. Restore public values
  // from that release and retain private records whose history is unavailable.
  const published = { members: new Map(), bikes: new Map() };
  const savedEntries = new Map(saved.lineup.map(entry => [entry.id, entry]));
  const seedEntries = new Map(seedGarage.lineup.map(entry => [entry.id, entry]));
  const pairs = new Set();
  function restore(section, field, rider, values, allowed = () => true) {
    const selected = published[section];
    const savedId = savedEntries.get(rider.id)?.[field];
    const seedId = seedEntries.get(rider.id)?.[field];
    const candidates = [savedId, seedId, ...saved[section].map(item => item.id), ...seedGarage[section].map(item => item.id), ...selected.keys()].filter(Boolean);
    const rows = id => [selected.get(id), saved[section].find(item => item.id === id), seedGarage[section].find(item => item.id === id)].filter(Boolean);
    const same = item => isDeepStrictEqual(item, { id: item.id, ...values });
    const usable = id => allowed(id) && (!selected.has(id) || same(selected.get(id)));
    let id = candidates.find(id => usable(id) && rows(id).some(same)) || [savedId, seedId].find(id => id && usable(id));
    if (!id) {
      const key = `restored-${field.toLowerCase()}-${digest(rider.id).slice(0, 20)}`;
      id = key;
      for (let suffix = 1; selected.has(id) || !allowed(id) || rows(id).length; suffix++) id = `${key}-${suffix}`;
    }
    selected.set(id, { id, ...values });
    return id;
  }
  const lineup = live.riders.map(rider => {
    const { name, role = '', line = '', brand, model, cc, colorName, character, glow, dir, facing, frameAssets: frames } = rider;
    const memberId = restore('members', 'memberId', rider, { name, active: true, role, line });
    const bikeId = restore('bikes', 'bikeId', rider, { brand, model, colorName, character, cc, glow, dir, facing, status: 'published', frames },
      id => !pairs.has(`${memberId}:${id}`));
    pairs.add(`${memberId}:${bikeId}`);
    return { id: rider.id, memberId, bikeId, visible: true };
  });
  const restoreRows = section => {
    const rows = new Map(saved[section].map(item => [item.id, item]));
    for (const [id, item] of published[section]) rows.set(id, item);
    return [...rows.values()];
  };
  const result = { members: restoreRows('members'), bikes: restoreRows('bikes'), lineup };
  const liveIds = new Set(lineup.map(entry => entry.id));
  const draftVisible = new Set(publicRiders(saved).map(rider => rider.id));
  saved.lineup.forEach((entry, index) => {
    const pair = `${entry.memberId}:${entry.bikeId}`;
    if (liveIds.has(entry.id) || draftVisible.has(entry.id) || pairs.has(pair)) return;
    const [rider] = publicRiders({ ...result, lineup: [entry] });
    if (rider) return;
    pairs.add(pair);
    lineup.splice(index, 0, entry);
  });
  return cleanGarage(result, localFramePaths);
}

export function reviewGarage(saved, published) {
  const changes = [];
  for (const [section, { id, title, label }] of Object.entries(sections)) {
    const before = new Map(published[section].map(item => [item.id, item]));
    const after = new Set(saved[section].map(item => item.id));
    const details = saved[section].flatMap(item => {
      const previous = before.get(item.id);
      if (isDeepStrictEqual(item, previous)) return [];
      const name = label(item, saved);
      if (!previous) return [`Add ${name}`];
      if (section === 'members' && item.active !== previous.active) return [`${item.active ? 'Activate' : 'Deactivate'} ${name}`];
      if (section === 'bikes' && item.status !== previous.status) return [`Mark ${name} as ${bikeAvailability[item.status]}`];
      if (section === 'lineup' && item.visible !== previous.visible) return [`${item.visible ? 'Show' : 'Hide'} ${name}`];
      return [`Update ${name}`];
    });
    details.push(...published[section].filter(item => !after.has(item.id)).map(item => `Remove ${label(item, published)}`));
    if (section === 'lineup' && !isDeepStrictEqual(
      published.lineup.filter(entry => after.has(entry.id)).map(entry => entry.id),
      saved.lineup.filter(entry => before.has(entry.id)).map(entry => entry.id),
    )) details.push('Change display order');
    if (details.length) changes.push({ id, title, area: 'Homepage hero', action: 'Update', details });
  }
  return {
    changes,
    apply(selection) {
      const garage = { ...published };
      for (const [section, { id }] of Object.entries(sections)) if (selection.has(id)) garage[section] = saved[section];
      const missing = missingLineupReference(garage);
      if (missing) throw Error(`Select Hero lineup and ${missing} together for these assignments.`);
      return cleanGarage(garage, localFramePaths);
    },
  };
}

export function missingLineupReference(garage) {
  if (garage.lineup.some(entry => !garage.members.some(member => member.id === entry.memberId))) return sections.members.title;
  if (garage.lineup.some(entry => !garage.bikes.some(bike => bike.id === entry.bikeId))) return sections.bikes.title;
  return '';
}
