// Shared, dependency-free validation. Only normalized public fields leave the CMS.
const text = (v, max = 100, required = false) => {
  if (typeof v !== 'string' || v.length > max || /[\u0000-\u001f]/.test(v) || (required && !v.trim())) throw Error('Check the text fields and their lengths.');
  return v.trim();
};
const id = v => { if (typeof v !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(v)) throw Error('Use unique lowercase IDs.'); return v; };
const list = (v, max) => { if (!Array.isArray(v) || v.length > max) throw Error(`Use no more than ${max} items.`); return v; };
const bool = v => { if (typeof v !== 'boolean') throw Error('Choose a visibility setting.'); return v; };
const unique = rows => { if (new Set(rows.map(r => r.id)).size !== rows.length) throw Error('Each item needs a unique ID.'); return rows; };
export function cleanFrame(v, localPaths = new Set()) {
  if (!v || v.width !== 1200 || v.height !== 720) throw Error('Bike frames must share a 1200 × 720 canvas.');
  if (v.source === 'local') {
    if (!localPaths.has(v.path)) throw Error('Unknown original bike frame.');
    return { source: 'local', path: v.path, width: 1200, height: 720 };
  }
  if (v.source !== 'cloudinary' || !/^hh-bikes\/[a-zA-Z0-9_/-]+$/.test(v.publicId || '') || v.publicId.includes('..')) throw Error('Choose a verified bike image.');
  if (!Number.isSafeInteger(v.version) || v.version < 1 || !['webp', 'png'].includes(v.format)) throw Error('Invalid bike image version or format.');
  return { source: 'cloudinary', publicId: v.publicId, version: v.version, format: v.format, width: 1200, height: 720 };
}
export function cleanGarage(value, localPaths = new Set()) {
  if (!value || typeof value !== 'object') throw Error('Invalid garage.');
  const members = unique(list(value.members, 150).map(m => ({ id: id(m.id), name: text(m.name, 80, true), active: bool(m.active), role: text(m.role ?? '', 80), line: text(m.line ?? '', 160) })));
  const bikes = unique(list(value.bikes, 150).map(b => {
    if (!['draft', 'published', 'hidden'].includes(b.status)) throw Error('Choose Draft, Published or Hidden for each bike.');
    if (!Number.isFinite(b.cc) || b.cc < 0 || b.cc > 5000 || !/^#[a-f0-9]{6}$/i.test(b.glow) || ![1, -1].includes(b.dir) || !['left', 'right'].includes(b.facing)) throw Error('Check the bike specifications and rotation settings.');
    const frames = list(b.frames, 144).map(f => cleanFrame(f, localPaths));
    const keys = frames.map(f => f.source === 'local' ? f.path : `${f.publicId}@${f.version}`);
    if (new Set(keys).size !== keys.length) throw Error('Remove duplicate rotation frames.');
    const bike = { id: id(b.id), brand: text(b.brand, 80), model: text(b.model, 80), colorName: text(b.colorName, 100), character: text(b.character, 100), cc: b.cc, glow: b.glow, dir: b.dir, facing: b.facing, status: b.status, frames };
    if (b.status === 'published' && (!bike.brand || !bike.model || !bike.colorName || !frames.length)) throw Error('Published bikes need a brand, model, colour and prepared image(s).');
    return bike;
  }));
  const lineup = unique(list(value.lineup, 200).map(e => {
    if (!members.some(m => m.id === e.memberId) || !bikes.some(b => b.id === e.bikeId)) throw Error('Each hero entry needs an existing member and bike.');
    return { id: id(e.id), memberId: e.memberId, bikeId: e.bikeId, visible: bool(e.visible) };
  }));
  if (new Set(lineup.map(e => `${e.memberId}:${e.bikeId}`)).size !== lineup.length) throw Error('This member and bike are already in the lineup.');
  return { members, bikes, lineup };
}
export function publicRiders(garage) {
  return garage.lineup.flatMap(entry => {
    const member = garage.members.find(m => m.id === entry.memberId), bike = garage.bikes.find(b => b.id === entry.bikeId);
    if (!entry.visible || !member?.active || bike?.status !== 'published' || !bike.frames.length) return [];
    return [{ id: entry.id, name: member.name, ...(member.role ? { role: member.role } : {}), ...(member.line ? { line: member.line } : {}), brand: bike.brand, model: bike.model, cc: bike.cc, character: bike.character, colorName: bike.colorName, glow: bike.glow, dir: bike.dir, facing: bike.facing, frames: bike.frames.length, frameAssets: bike.frames }];
  });
}
export function bikeFrameUrl(frame, cloudName, width = 1200) {
  if (frame.source === 'local') return frame.path;
  const path = frame.publicId.split('/').map(encodeURIComponent).join('/');
  // Fixed dimensions, no auto-crop or lossy paint edits. Preserve alpha explicitly.
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/c_scale,w_${width},f_webp,fl_lossless/v${frame.version}/${path}.${frame.format}`;
}
