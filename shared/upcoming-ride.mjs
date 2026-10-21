import { cleanMedia } from '../server/content.mjs';

export const emptyUpcomingRide = () => ({ published: false, location: '', description: '', meetingPoint: '', notes: '', mapsUrl: '', date: '', meetingTime: '', images: [] });
const text = (value, max) => {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw Error('Check the ride text fields and their lengths.');
  return value.trim();
};
export function cleanUpcomingRide(value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value) || typeof value.published !== 'boolean') throw Error('Choose whether to include the upcoming ride.');
  const ride = { published: value.published, location: text(value.location, 100), description: text(value.description, 600), meetingPoint: text(value.meetingPoint, 240), notes: text(value.notes ?? '', 1200), mapsUrl: text(value.mapsUrl ?? '', 2048), date: text(value.date ?? '', 10), meetingTime: text(value.meetingTime ?? '', 5), images: [] };
  if (ride.published && (!ride.location || !ride.description || !ride.meetingPoint)) throw Error('Add a location, description and meeting point before including the ride on publish.');
  if (ride.date && (!/^\d{4}-\d{2}-\d{2}$/.test(ride.date) || ride.date < '2000-01-01' || ride.date > '2199-12-31' || !Number.isFinite(Date.parse(`${ride.date}T00:00:00Z`)) || new Date(`${ride.date}T00:00:00Z`).toISOString().slice(0,10) !== ride.date)) throw Error('Choose a valid ride date.');
  if (ride.meetingTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(ride.meetingTime)) throw Error('Choose a valid meeting time.');
  if (ride.mapsUrl) {
    let url; try { url = new URL(ride.mapsUrl); } catch { throw Error('Use a full HTTPS Google Maps link.'); }
    const full = ['google.com', 'www.google.com', 'maps.google.com', 'google.co.in', 'www.google.co.in'];
    const valid = (full.includes(url.hostname) && (url.hostname === 'maps.google.com' || /^\/maps(?:\/|$)/.test(url.pathname))) || url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/'));
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !valid) throw Error('Use a Google Maps link, such as https://maps.app.goo.gl/…');
    ride.mapsUrl = url.href;
  }
  if (!Array.isArray(value.images) || value.images.length > 6) throw Error('Use up to six photos for the upcoming ride.');
  ride.images = value.images.map(image => { const media = cleanMedia(image); if (media.type !== 'image') throw Error('Upcoming rides accept photos, not videos.'); return media; });
  if (new Set(ride.images.map(image => image.id)).size !== ride.images.length) throw Error('Each ride photo should appear only once.');
  return ride;
}
