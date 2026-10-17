const legacyIds = new Set(['kerwa', 'bhojpur', 'kolar', 'bhimbetka', 'raisen', 'sanchi', 'pachmarhi']);
const text = (value, max, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('Check the text fields and their lengths.');
  return value.trim();
};
const number = (value, min, max) => { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('Check distances and coordinates.'); return value; };
export function cleanMedia(value) {
  if (!value || !['image', 'video'].includes(value.type)) throw new Error('Choose an image or video.');
  const publicId = text(value.publicId, 255, true);
  if (!/^[\p{L}\p{N}_. /-]+$/u.test(publicId) || publicId.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Invalid Cloudinary asset ID.');
  return { id: text(value.id, 255, true), type: value.type, publicId, version: number(value.version, 1, 99999999999), width: number(value.width, 1, 100000), height: number(value.height, 1, 100000), caption: text(value.caption ?? '', 300) };
}
export function cleanPlaces(input) {
  if (!Array.isArray(input) || input.length > 100) throw new Error('Use up to 100 places.');
  const ids = new Set();
  return input.map(value => {
    const id = text(value.id, 80, true);
    if (!/^[a-z0-9-]+$/.test(id) || ids.has(id)) throw new Error('Places need unique IDs.'); ids.add(id);
    if (!['Sunday morning', 'Full day', 'Weekend'].includes(value.kind) || typeof value.published !== 'boolean') throw new Error('Choose the ride type and publication status.');
    if (!Array.isArray(value.media) || value.media.length > 40) throw new Error('Use up to 40 photos/videos per place.');
    const media = value.media.map(cleanMedia);
    if (new Set(media.map(m => m.id)).size !== media.length) throw new Error('An asset can only appear once in each place.');
    const legacyId = legacyIds.has(value.legacyId) ? value.legacyId : undefined;
    if (value.published && !media.length && !legacyId) throw new Error('Add a photo or video before publishing a new place.');
    return { id, name: text(value.name, 80, true), description: text(value.description, 400), kind: value.kind, km: number(value.km, 0, 5000), lat: number(value.lat, -90, 90), lon: number(value.lon, -180, 180), published: value.published, ...(legacyId ? { legacyId } : {}), media };
  });
}
